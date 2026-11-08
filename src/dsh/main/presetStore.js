import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';

/**
 * 用户自定义 Agent 预设的存取、导出与导入。
 *
 * 存储分三层，互不干扰：
 *   1. `$DSH_HOME/presets/index.json` —— 可编辑的定义（唯一事实来源，升级不丢）；
 *   2. `<profile>/cordis.patch.yml` 里的 `# >>> dsh user presets` 区块 —— 由定义
 *      生成的 dsh 声明（profile 每次随客户端升级重落盘，Host 启动前会重新注入）；
 *   3. `$DSH_HOME/skills/<name>/` —— 预设引用的技能目录（与 dsh 默认搜索路径一致）。
 *
 * 预设只组合运行时已安装的官方插件行（persona / tool-fs / tool-bash / ...），
 * 不引入任意 Cordis 行、不执行包内代码；导出格式是我们的 JSON 定义 + skills，
 * 不是 npm bundle。
 */

export const PRESET_FORMAT = 'dsh-preset';
export const PRESET_FORMAT_VERSION = 1;
const BLOCK_BEGIN = '# >>> dsh user presets (managed by the desktop client; do not edit by hand)';
const BLOCK_END = '# <<< dsh user presets';
const PRESET_NAME = '@deepseek-ai/dsh-agent-preset';

const ID_RE = /^[a-z0-9][a-z0-9_-]{1,39}$/;
const SKILL_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const MAX_PERSONA = 20000;
const MAX_NAME = 60;
const MAX_DESC = 300;

/** 可选工具 → 组合行（全部是运行时已安装的官方插件）。 */
export const PRESET_TOOLS = [
    { key: 'fs', label: '文件读写', hint: '读/写工作区文件' },
    { key: 'edit', label: '精确编辑', hint: 'str_replace / 行插入（需配合文件读写）' },
    { key: 'search', label: '文件搜索', hint: '按文件名/内容搜索' },
    { key: 'bash', label: '命令执行', hint: 'shell（受会话沙箱与审批约束）' },
    { key: 'web', label: '网页搜索', hint: '联网搜索与抓取' },
    { key: 'todo', label: '任务清单', hint: 'todo_write 进度跟踪' },
    { key: 'ask', label: '向用户提问', hint: 'ask_user_question 卡片' },
    { key: 'skill', label: '技能', hint: '发现并加载 SKILL.md 知识库' },
    { key: 'present', label: '交付文件', hint: 'present 把文件发给用户' },
];

const TOOL_ROWS = {
    fs: () => [{ id: 'tool-fs', name: '@deepseek-ai/dsh-tool-fs' }],
    edit: () => [{ id: 'tool-str-replace-editor', name: '@deepseek-ai/dsh-tool-str-replace-editor' }],
    search: () => [{
        id: 'tool-fs-search',
        name: '@deepseek-ai/dsh-tool-fs-search',
        config: { sampleOverCapGlobResults: false },
    }],
    bash: () => [
        { id: 'tool-bash', name: '@deepseek-ai/dsh-tool-bash', disabled: "!!js process.platform === 'win32'" },
        { id: 'tool-pwsh', name: '@deepseek-ai/dsh-tool-pwsh', disabled: "!!js process.platform !== 'win32'" },
    ],
    web: () => [{ id: 'tool-web', name: '@deepseek-ai/dsh-tool-web' }],
    todo: () => [{
        id: 'tool-todo',
        name: '@deepseek-ai/dsh-tool-todo',
        config: { allowParallelInProgress: true },
    }],
    ask: () => [{ id: 'tool-ask-user', name: '@deepseek-ai/dsh-tool-ask-user' }],
    skill: () => [
        { id: 'skill-filesystem', name: '@deepseek-ai/dsh-skill-filesystem' },
        { id: 'tool-skill', name: '@deepseek-ai/dsh-tool-skill' },
    ],
    present: () => [{ id: 'present', name: '@deepseek-ai/dsh-tool-present' }],
};

/** 所有预设都会带上的行（与官方 standard 预设一致）。 */
function baseRows(spec) {
    const rows = [
        { id: 'persona', name: '@deepseek-ai/dsh-persona', config: spec.persona ? { prefix: spec.persona } : undefined },
        { id: 'agent-instructions', name: '@deepseek-ai/dsh-agent-instructions', config: { maxBytes: 65536 } },
    ];
    for (const key of spec.tools) {
        const build = TOOL_ROWS[key];
        if (build) rows.push(...build());
    }
    // Office 技能默认解释器：随安装包内置的 Python 载荷（没有时禁用）。
    rows.push({
        id: 'workspace-dependencies',
        name: '@deepseek-ai/dsh-tool-workspace-dependencies',
        disabled: '!!js "!process.env.DSH_PRIMARY_RUNTIME && !process.env.DSH_BUNDLED_PRIMARY_RUNTIME"',
        config: {
            source: {
                __raw: `!!js "process.getBuiltinModule('node:path').resolve(process.env.DSH_PRIMARY_RUNTIME ?? process.env.DSH_BUNDLED_PRIMARY_RUNTIME ?? '')"`,
            },
        },
    });
    rows.push({
        id: 'compaction',
        name: 'cordis:group',
        group: true,
        isolate: { compaction: true, toolResultPruner: true },
        config: [
            { id: 'compaction-basic', name: '@deepseek-ai/dsh-compaction-basic' },
            { id: 'command-compact', name: '@deepseek-ai/dsh-command-compact' },
            {
                id: 'tool-result-pruner',
                name: '@deepseek-ai/dsh-compaction-tool-result-pruner',
                config: { thresholdChars: 8192, headChars: 4096, tailChars: 1024 },
            },
        ],
    });
    return rows;
}

function q(value) {
    return JSON.stringify(String(value));
}

function scalar(value) {
    if (value && typeof value === 'object' && typeof value.__raw === 'string') return value.__raw;
    if (typeof value === 'boolean' || typeof value === 'number') return String(value);
    return q(value);
}

/** 插件行 → YAML（缩进规则与 dsh 的 profile patch 一致）。 */
function emitPluginRows(rows, pad) {
    const p = ' '.repeat(pad);
    const k = `${p}  `;
    const c = `${k}  `;
    let out = '';
    for (const row of rows) {
        out += `${p}- id: ${row.id}\n`;
        out += `${k}name: ${q(row.name)}\n`;
        if (row.group) out += `${k}group: true\n`;
        if (row.disabled !== undefined) out += `${k}disabled: ${row.disabled}\n`;
        if (row.isolate) {
            out += `${k}isolate:\n`;
            for (const [key, value] of Object.entries(row.isolate)) out += `${c}${key}: ${scalar(value)}\n`;
        }
        if (row.config !== undefined) {
            out += `${k}config:\n`;
            if (Array.isArray(row.config)) {
                out += emitPluginRows(row.config, pad + 4);
            } else {
                for (const [key, value] of Object.entries(row.config)) out += `${c}${key}: ${scalar(value)}\n`;
            }
        }
    }
    return out;
}

/** 一个 preset 定义 → `- id: preset-xxx` 行（含 config）。 */
function emitPreset(spec, index) {
    const p = '    ';
    const k = `${p}  `;
    const c = `${k}  `;
    const order = Number.isFinite(Number(spec.order)) ? Number(spec.order) : 60 + index;
    let out = `${p}- id: preset-${spec.id}\n`;
    out += `${k}name: '${PRESET_NAME}'\n`;
    out += `${k}config:\n`;
    out += `${c}id: ${spec.id}\n`;
    out += `${c}name: ${q(spec.name)}\n`;
    if (spec.description) out += `${c}description: ${q(spec.description)}\n`;
    out += `${c}order: ${order}\n`;
    out += `${c}plugins:\n`;
    out += emitPluginRows(baseRows(spec), 10);
    return out;
}

function normalizeTools(input) {
    const allowed = new Set(PRESET_TOOLS.map((t) => t.key));
    const list = Array.isArray(input) ? input : [];
    return [...new Set(list.filter((t) => typeof t === 'string' && allowed.has(t)))];
}

function normalizeSkills(input) {
    const list = Array.isArray(input) ? input : [];
    return [...new Set(list.filter((s) => typeof s === 'string' && SKILL_RE.test(s)))];
}

/** 校验并归一化一个预设定义（创建、编辑、导入共用）。 */
export function normalizeSpec(input, { fallbackId = '' } = {}) {
    const raw = input && typeof input === 'object' ? input : {};
    const id = String(raw.id || fallbackId || '').trim().toLowerCase();
    if (!ID_RE.test(id)) {
        throw new Error('预设 ID 只能用小写字母/数字/短横线/下划线，2-40 个字符');
    }
    const name = String(raw.name || '').trim();
    if (!name) throw new Error('预设名称不能为空');
    const spec = {
        id,
        name: name.slice(0, MAX_NAME),
        description: String(raw.description || '').trim().slice(0, MAX_DESC),
        persona: String(raw.persona || '').slice(0, MAX_PERSONA),
        tools: normalizeTools(raw.tools),
        skills: normalizeSkills(raw.skills),
    };
    if (Number.isFinite(Number(raw.order))) spec.order = Number(raw.order);
    return spec;
}

/** 从 profile patch 文本里解析 preset 声明（官方块 + 用户块）。 */
export function parsePresetRows(text) {
    const lines = String(text || '').split('\n');
    const items = [];
    for (let i = 0; i < lines.length; i++) {
        if (!/@deepseek-ai\/dsh-agent-preset['"]?\s*$/.test(lines[i])) continue;
        let id = '';
        let name = '';
        let description = '';
        for (let j = i + 1; j < lines.length && j < i + 14; j++) {
            const line = lines[j];
            if (/^\s*config:\s*$/.test(line)) continue;
            if (!/^ {8}\S/.test(line)) break;
            const idMatch = /^ {8}id:\s*(\S+)\s*$/.exec(line);
            if (idMatch && !id) id = idMatch[1].replace(/^['"]|['"]$/g, '');
            const nameMatch = /^ {8}name:\s*(.+?)\s*$/.exec(line);
            if (nameMatch && !name) {
                try {
                    name = JSON.parse(nameMatch[1]);
                } catch (e) {
                    name = nameMatch[1].replace(/^['"]|['"]$/g, '');
                }
            }
            const descMatch = /^ {8}description:\s*(.+?)\s*$/.exec(line);
            if (descMatch && !description) {
                try {
                    description = JSON.parse(descMatch[1]);
                } catch (e) {
                    description = descMatch[1].replace(/^['"]|['"]$/g, '');
                }
            }
        }
        if (id && !items.some((it) => it.id === id)) {
            items.push({ id, name: name || id, description });
        }
    }
    let defaultPreset = '';
    const regIdx = String(text || '').lastIndexOf('agent-preset-registry');
    if (regIdx >= 0) {
        const m = /default:\s*['"]?([A-Za-z0-9_-]+)/.exec(String(text).slice(regIdx, regIdx + 400));
        if (m) defaultPreset = m[1];
    }
    return { items, defaultPreset };
}

function walkFiles(dir, base = dir, out = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walkFiles(full, base, out);
        else if (entry.isFile()) out.push({ full, rel: path.relative(base, full) });
    }
    return out;
}

function copyDir(src, dest) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const from = path.join(src, entry.name);
        const to = path.join(dest, entry.name);
        if (entry.isDirectory()) copyDir(from, to);
        else if (entry.isFile()) fs.copyFileSync(from, to);
    }
}

/** 只读取 SKILL.md frontmatter 的 name/description，用于设置页展示。 */
function readSkillMeta(file) {
    const out = { name: '', description: '' };
    try {
        const text = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
        const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
        if (!m) return out;
        for (const line of m[1].split(/\r?\n/)) {
            const kv = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
            if (!kv) continue;
            const key = kv[1];
            if (key !== 'name' && key !== 'description') continue;
            let value = kv[2].trim();
            if ((value.startsWith('"') && value.endsWith('"'))
                || (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }
            out[key] = value;
        }
    } catch (e) { /* ignore */ }
    return out;
}

export default class PresetStore {
    constructor({ dshHome, runtimeRoot, profileName, logger }) {
        this.dshHome = dshHome;
        this.runtimeRoot = runtimeRoot;
        this.profileName = profileName || 'wildfire';
        this.logger = logger || console;
    }

    setProfile(profileName) {
        if (profileName) this.profileName = profileName;
    }

    setDshHome(home) {
        if (home) this.dshHome = home;
    }

    get indexFile() {
        return path.join(this.dshHome, 'presets', 'index.json');
    }

    get skillsDir() {
        return path.join(this.dshHome, 'skills');
    }

    get profilePatchFile() {
        return path.join(this.dshHome, 'profiles', this.profileName, 'cordis.patch.yml');
    }

    load() {
        try {
            const raw = JSON.parse(fs.readFileSync(this.indexFile, 'utf8'));
            const presets = Array.isArray(raw.presets) ? raw.presets : [];
            return {
                version: 1,
                default: typeof raw.default === 'string' ? raw.default : '',
                presets: presets
                    .map((p) => {
                        try { return normalizeSpec(p); } catch (e) { return null; }
                    })
                    .filter(Boolean),
            };
        } catch (e) {
            return { version: 1, default: '', presets: [] };
        }
    }

    saveIndex(data) {
        fs.mkdirSync(path.dirname(this.indexFile), { recursive: true });
        const payload = {
            version: 1,
            default: data.default || '',
            presets: (data.presets || []).map((p) => this._serializeSpec(p)),
        };
        fs.writeFileSync(this.indexFile, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
    }

    _serializeSpec(spec) {
        return {
            id: spec.id,
            name: spec.name,
            description: spec.description || '',
            persona: spec.persona || '',
            tools: spec.tools || [],
            skills: spec.skills || [],
            ...(Number.isFinite(Number(spec.order)) ? { order: Number(spec.order) } : {}),
        };
    }

    /** 生成用户预设区块（含默认预设的 registry 覆盖行）。 */
    _buildBlock(data) {
        const parts = [BLOCK_BEGIN];
        if (data.presets.length) {
            parts.push('- insert:');
            data.presets.forEach((spec, index) => parts.push(emitPreset(spec, index).trimEnd()));
        }
        if (data.default) {
            parts.push(`- id: agent-preset-registry\n  config:\n    default: ${q(data.default)}`);
        }
        parts.push(BLOCK_END);
        return `${parts.join('\n')}\n`;
    }

    /** 去掉 profile patch 里旧的用户区块。 */
    _stripBlock(text) {
        const begin = text.indexOf(BLOCK_BEGIN);
        if (begin < 0) return text;
        const end = text.indexOf(BLOCK_END, begin);
        if (end < 0) return text;
        return `${text.slice(0, begin)}${text.slice(end + BLOCK_END.length)}`.replace(/\n{3,}/g, '\n\n');
    }

    /**
     * 把 index.json 的定义写进 profile patch（profile 升级重落盘后由 Host 启动
     * 前调用，保证用户预设不丢）。profile 尚未落盘时静默跳过。
     */
    syncProfileBlock() {
        const file = this.profilePatchFile;
        if (!fs.existsSync(file)) return false;
        let text = '';
        try { text = fs.readFileSync(file, 'utf8'); } catch (e) { return false; }
        const data = this.load();
        const stripped = this._stripBlock(text).trimEnd();
        const block = this._buildBlock(data);
        const next = `${stripped}\n\n${block}`;
        if (next === text) return true;
        try {
            fs.writeFileSync(file, next);
            return true;
        } catch (e) {
            this.logger?.warn?.(`[preset] write profile patch failed: ${e?.message ?? e}`);
            return false;
        }
    }

    /** 列表：profile patch 里的声明（官方 + 用户）+ 可编辑定义。 */
    list() {
        this.syncProfileBlock();
        const data = this.load();
        const userById = new Map(data.presets.map((p) => [p.id, p]));
        let rows = { items: [], defaultPreset: '' };
        try {
            rows = parsePresetRows(fs.readFileSync(this.profilePatchFile, 'utf8'));
        } catch (e) {
            rows = { items: [], defaultPreset: '' };
        }
        const items = rows.items.map((row) => {
            const spec = userById.get(row.id);
            return {
                id: row.id,
                name: row.name,
                description: row.description || (spec ? spec.description : ''),
                source: spec ? 'user' : 'builtin',
                editable: !!spec,
                ...(spec ? {
                    persona: spec.persona,
                    tools: spec.tools,
                    skills: spec.skills,
                    order: spec.order,
                } : {}),
            };
        });
        // 定义存在但 patch 里还没有（profile 未落盘/写失败）时仍列出，便于编辑。
        for (const spec of data.presets) {
            if (!items.some((it) => it.id === spec.id)) {
                items.push({
                    id: spec.id,
                    name: spec.name,
                    description: spec.description,
                    source: 'user',
                    editable: true,
                    persona: spec.persona,
                    tools: spec.tools,
                    skills: spec.skills,
                    order: spec.order,
                });
            }
        }
        return {
            default: data.default || rows.defaultPreset || '',
            items,
            tools: PRESET_TOOLS,
        };
    }

    saveSpec(input) {
        const spec = normalizeSpec(input);
        const data = this.load();
        const index = data.presets.findIndex((p) => p.id === spec.id);
        if (index < 0 && this._isBuiltin(spec.id)) {
            throw new Error(`ID ${spec.id} 与内置预设重名，请换一个`);
        }
        if (index >= 0) data.presets[index] = spec;
        else data.presets.push(spec);
        this.saveIndex(data);
        this.syncProfileBlock();
        return this.list();
    }

    deleteSpec(id) {
        const data = this.load();
        const before = data.presets.length;
        data.presets = data.presets.filter((p) => p.id !== id);
        if (data.default === id) data.default = '';
        this.saveIndex(data);
        this.syncProfileBlock();
        return { removed: before !== data.presets.length, ...this.list() };
    }

    setDefault(id) {
        const data = this.load();
        if (id && !data.presets.some((p) => p.id === id) && !this._isBuiltin(id)) {
            throw new Error('预设不存在');
        }
        data.default = id || '';
        this.saveIndex(data);
        this.syncProfileBlock();
        return this.list();
    }

    _isBuiltin(id) {
        try {
            const rows = parsePresetRows(fs.readFileSync(this.profilePatchFile, 'utf8'));
            const user = new Set(this.load().presets.map((p) => p.id));
            return rows.items.some((it) => it.id === id && !user.has(id));
        } catch (e) {
            return false;
        }
    }

    /** 技能目录下的现有技能（名称）。 */
    listSkills() {
        return this.listSkillDetails().map((s) => s.name);
    }

    /** 技能目录下的现有技能（含 SKILL.md frontmatter 里的展示名和描述）。 */
    listSkillDetails() {
        try {
            return fs.readdirSync(this.skillsDir, { withFileTypes: true })
                .filter((e) => e.isDirectory() && !e.name.startsWith('.')
                    && fs.existsSync(path.join(this.skillsDir, e.name, 'SKILL.md')))
                .map((e) => {
                    const dir = path.join(this.skillsDir, e.name);
                    const meta = readSkillMeta(path.join(dir, 'SKILL.md'));
                    return {
                        name: e.name,
                        displayName: meta.name || e.name,
                        description: meta.description || '',
                        path: dir,
                    };
                })
                .sort((a, b) => a.name.localeCompare(b.name));
        } catch (e) {
            return [];
        }
    }

    /** 读取一个技能的 SKILL.md 内容，供设置页预览。 */
    readSkill(name) {
        const base = String(name || '').trim();
        if (!SKILL_RE.test(base)) throw new Error('技能名称不合法');
        const dir = path.join(this.skillsDir, base);
        const file = path.join(dir, 'SKILL.md');
        if (!fs.existsSync(file)) throw new Error('技能不存在或缺少 SKILL.md');
        const stat = fs.statSync(file);
        if (stat.size > 1024 * 1024) throw new Error('SKILL.md 过大，无法预览');
        const meta = readSkillMeta(file);
        return {
            name: base,
            displayName: meta.name || base,
            description: meta.description || '',
            path: dir,
            file,
            size: stat.size,
            content: fs.readFileSync(file, 'utf8'),
        };
    }

    /** 把一个目录作为技能装进 $DSH_HOME/skills/<name>，返回技能名。 */
    addSkillFolder(srcDir, name) {
        if (!srcDir || !fs.existsSync(srcDir)) throw new Error('技能目录不存在');
        const base = String(name || path.basename(srcDir)).trim();
        if (!SKILL_RE.test(base)) throw new Error('技能名称只能包含字母/数字/点/横线/下划线');
        const dest = path.join(this.skillsDir, base);
        copyDir(srcDir, dest);
        if (!fs.existsSync(path.join(dest, 'SKILL.md'))) {
            try { fs.rmSync(dest, { recursive: true, force: true }); } catch (e) { /* ignore */ }
            throw new Error('目录里没有 SKILL.md，不是合法的技能目录');
        }
        return base;
    }

    // ── 导出 / 导入 ────────────────────────────────────────────────────────────

    async exportPreset(id, destFile) {
        const data = this.load();
        const spec = data.presets.find((p) => p.id === id);
        if (!spec) throw new Error('只能导出自己创建的预设');
        const zip = new JSZip();
        const dshVersion = (() => {
            try { return JSON.parse(fs.readFileSync(path.join(this.runtimeRoot, 'VERSION'), 'utf8')).dsh || ''; }
            catch (e) { return ''; }
        })();
        const exportSkills = spec.skills.filter((skill) => fs.existsSync(path.join(this.skillsDir, skill)));
        spec.skills = exportSkills;
        zip.file('manifest.json', JSON.stringify({
            format: PRESET_FORMAT,
            version: PRESET_FORMAT_VERSION,
            exportedAt: new Date().toISOString(),
            dshVersion,
            preset: this._serializeSpec(spec),
            skills: exportSkills,
        }, null, 2));
        zip.file('preset.json', JSON.stringify(this._serializeSpec(spec), null, 2));
        zip.file('README.md', [
            '# ' + spec.name,
            '',
            '这是一个 DSH Agent 预设定义包（dsh-preset v1）。',
            '在野火 IM 客户端的「AI 设置 → 预设」里导入即可；导入后可在新会话页选择。',
            '',
            '- 预设 ID：' + spec.id,
            '- 工具：' + (spec.tools.join(', ') || '（无）'),
            '- 技能：' + (spec.skills.join(', ') || '（无）'),
            '',
            '包内只包含组合定义与技能文件，不包含可执行代码。',
            '',
        ].join('\n'));
        for (const skill of exportSkills) {
            const dir = path.join(this.skillsDir, skill);
            for (const file of walkFiles(dir)) {
                zip.file(`skills/${skill}/${file.rel.split(path.sep).join('/')}`, fs.readFileSync(file.full));
            }
        }
        const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
        fs.mkdirSync(path.dirname(destFile), { recursive: true });
        fs.writeFileSync(destFile, buf);
        return { file: destFile, bytes: buf.length, skills: spec.skills.length };
    }

    async inspectImport(file) {
        const buf = fs.readFileSync(file);
        const zip = await JSZip.loadAsync(buf);
        const manifestFile = zip.file('manifest.json') || zip.file('preset.json');
        if (!manifestFile) throw new Error('不是有效的预设包：缺少 manifest.json');
        let payload;
        try {
            payload = JSON.parse(await manifestFile.async('string'));
        } catch (e) {
            throw new Error('预设包 manifest.json 无法解析');
        }
        const rawSpec = payload.preset || payload;
        const spec = normalizeSpec(rawSpec);
        const skills = new Set();
        const files = [];
        zip.forEach((rel, entry) => {
            if (entry.dir) return;
            if (!rel.startsWith('skills/')) return;
            const parts = rel.split('/');
            if (parts.length < 3) return;
            const skill = parts[1];
            if (!SKILL_RE.test(skill)) return;
            if (rel.includes('..')) return;
            skills.add(skill);
            files.push(rel);
        });
        spec.skills = [...skills];
        const data = this.load();
        const conflict = data.presets.find((p) => p.id === spec.id) || null;
        const skillConflicts = spec.skills.filter((s) => fs.existsSync(path.join(this.skillsDir, s)));
        return {
            file,
            spec: this._serializeSpec(spec),
            skills: [...skills],
            fileCount: files.length,
            conflict: conflict ? { id: conflict.id, name: conflict.name } : null,
            skillConflicts,
            manifest: {
                format: payload.format || '',
                dshVersion: payload.dshVersion || '',
                exportedAt: payload.exportedAt || '',
            },
        };
    }

    /**
     * 应用导入。
     * @param {object} options - { file, id, overwrite, overwriteSkills }
     */
    async applyImport({ file, id, overwrite = false, overwriteSkills = false }) {
        const preview = await this.inspectImport(file);
        const data = this.load();
        const targetId = String(id || preview.spec.id).trim().toLowerCase();
        if (data.presets.some((p) => p.id === targetId) && !overwrite) {
            throw new Error(`预设 ID ${targetId} 已存在（可选择覆盖或改名导入）`);
        }
        if (this._isBuiltin(targetId)) {
            throw new Error(`不能覆盖内置预设 ${targetId}，请换个 ID 导入`);
        }
        const spec = normalizeSpec({ ...preview.spec, id: targetId });
        const zip = await JSZip.loadAsync(fs.readFileSync(file));
        const copied = [];
        const skipped = [];
        for (const skill of spec.skills) {
            const dest = path.join(this.skillsDir, skill);
            if (fs.existsSync(dest) && !overwriteSkills) {
                skipped.push(skill);
                continue;
            }
            if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true, force: true });
            const entries = Object.keys(zip.files).filter((rel) => rel.startsWith(`skills/${skill}/`) && !zip.files[rel].dir);
            for (const rel of entries) {
                const inner = rel.slice(`skills/${skill}/`.length);
                if (!inner || inner.includes('..') || path.isAbsolute(inner)) continue;
                const dataBuf = await zip.files[rel].async('nodebuffer');
                const out = path.join(dest, inner);
                fs.mkdirSync(path.dirname(out), { recursive: true });
                fs.writeFileSync(out, dataBuf);
            }
            copied.push(skill);
        }
        const index = data.presets.findIndex((p) => p.id === spec.id);
        if (index >= 0) data.presets[index] = spec;
        else data.presets.push(spec);
        this.saveIndex(data);
        this.syncProfileBlock();
        return { ...this.list(), importedId: spec.id, skillsCopied: copied, skillsSkipped: skipped };
    }
}
