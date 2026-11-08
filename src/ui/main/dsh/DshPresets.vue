<template>
    <section class="dsh-preset-page">
        <div class="dsh-preset-head">
            <div>
                <h2>Agent 预设</h2>
                <p>预设决定新会话的工具、提示词和技能。可以自己建、导出给同事，也可以导入别人给的预设包。</p>
            </div>
            <div class="dsh-preset-head-actions">
                <button class="dsh-preset-btn" :disabled="busy" @click="openImport">导入预设包</button>
                <button class="dsh-preset-btn primary" :disabled="busy" @click="openCreate">＋ 新建预设</button>
            </div>
        </div>

        <p v-if="loadError" class="dsh-preset-error">{{ loadError }}</p>

        <div v-if="!items.length && !loadError" class="dsh-preset-empty">
            <strong>还没有自定义预设</strong>
            <p>新建一个预设，或导入同事发来的 .dshpreset.zip。内置预设（standard / ptc / minimal / cordis）始终可用。</p>
        </div>

        <div v-for="p in items" :key="p.id" class="dsh-preset-card">
            <div class="dsh-preset-card-head">
                <div class="dsh-preset-title">
                    <strong>{{ p.name }}</strong>
                    <span class="dsh-preset-badge" :class="p.source">{{ p.source === 'user' ? '自建' : '内置' }}</span>
                    <span v-if="isDefault(p.id)" class="dsh-preset-badge default">默认</span>
                </div>
                <div class="dsh-preset-card-actions">
                    <button v-if="p.editable" class="dsh-preset-link" @click="openEdit(p)">编辑</button>
                    <button v-if="p.editable" class="dsh-preset-link" @click="exportPreset(p)">导出</button>
                    <button v-if="!isDefault(p.id)" class="dsh-preset-link" @click="makeDefault(p)">设为默认</button>
                    <button v-if="p.editable" class="dsh-preset-link danger" @click="remove(p)">删除</button>
                </div>
            </div>
            <p class="dsh-preset-id mono">{{ p.id }}</p>
            <p v-if="p.description" class="dsh-preset-desc">{{ p.description }}</p>
            <div class="dsh-preset-meta">
                <span v-for="t in toolLabels(p)" :key="t" class="dsh-preset-chip">{{ t }}</span>
                <span v-if="!toolLabels(p).length" class="dsh-preset-chip muted">无工具</span>
                <span v-if="p.skills && p.skills.length" class="dsh-preset-chip skill">技能 {{ p.skills.length }}</span>
            </div>
        </div>

        <!-- 新建 / 编辑 -->
        <div v-if="showForm" class="dsh-preset-mask" @click.self="closeForm">
            <div class="dsh-preset-modal">
                <h2>{{ editing ? '编辑预设' : '新建预设' }}</h2>
                <p class="dsh-preset-hint">预设只组合客户端内置的官方工具，不含可执行代码；保存后对新会话生效。</p>
                <label v-if="editing" class="dsh-preset-field">
                    <span>预设 ID</span>
                    <input :value="form.id" disabled/>
                    <small>ID 已固定，不能修改</small>
                </label>
                <div v-else class="dsh-preset-field">
                    <span>预设 ID</span>
                    <p class="dsh-preset-id-auto">保存时根据“标题拼音 + 时间戳”自动生成</p>
                </div>
                <label class="dsh-preset-field">
                    <span>名称</span>
                    <input v-model.trim="form.name" placeholder="例如 代码审查"/>
                </label>
                <label class="dsh-preset-field">
                    <span>描述（可选）</span>
                    <input v-model.trim="form.description" placeholder="一句话说明这个预设适合做什么"/>
                </label>
                <div class="dsh-preset-field">
                    <span>工具</span>
                    <div class="dsh-preset-tools">
                        <label v-for="t in tools" :key="t.key" class="dsh-preset-tool">
                            <input type="checkbox" :value="t.key" v-model="form.tools"/>
                            <span>
                                <strong>{{ t.label }}</strong>
                                <small>{{ t.hint }}</small>
                            </span>
                        </label>
                    </div>
                    <small>无论是否勾选，都会带上人设、指令和上下文压缩。</small>
                </div>
                <label class="dsh-preset-field">
                    <span>提示词（人设与工作方式，可选）</span>
                    <textarea v-model="form.persona" rows="6" placeholder="你是…，负责…；回答时…"></textarea>
                </label>
                <div class="dsh-preset-field">
                    <div class="dsh-preset-skill-head">
                        <span>技能</span>
                        <div class="dsh-preset-skill-head-actions">
                            <button class="dsh-preset-link" :disabled="busy || skillsLoading" @click="loadSkills">刷新</button>
                            <button class="dsh-preset-link" :disabled="busy" @click="addSkills">＋ 添加技能目录</button>
                        </div>
                    </div>
                    <p v-if="skillsLoading" class="dsh-preset-skill-empty">正在读取技能…</p>
                    <p v-else-if="skillsError" class="dsh-preset-skill-error">
                        {{ skillsError }}
                        <button class="dsh-preset-link" @click="loadSkills">重试</button>
                    </p>
                    <p v-else-if="!allSkills.length" class="dsh-preset-skill-empty">
                        还没有安装技能。先点“添加技能目录”导入一个包含 SKILL.md 的目录。
                    </p>
                    <div v-else class="dsh-preset-skill-list">
                        <label v-for="s in allSkills" :key="s.name" class="dsh-preset-skill-item">
                            <input type="checkbox" :value="s.name" v-model="form.skills"/>
                            <span class="dsh-preset-skill-copy">
                                <strong>{{ s.displayName || s.name }}</strong>
                                <small class="mono">{{ s.name }}</small>
                                <small v-if="s.description" class="dsh-preset-skill-desc">{{ s.description }}</small>
                            </span>
                        </label>
                    </div>
                    <div v-if="missingSkills.length" class="dsh-preset-missing-skills">
                        <span>已失效：</span>
                        <span v-for="s in missingSkills" :key="s" class="dsh-preset-chip">
                            {{ s }}
                            <button class="dsh-preset-chip-x" title="移除引用" @click="removeSkill(s)">×</button>
                        </span>
                    </div>
                    <small>勾选后会随预设包导出；启用“技能”工具后，Agent 才能发现并加载这些技能。</small>
                </div>
                <p v-if="error" class="dsh-preset-error">{{ error }}</p>
                <div class="dsh-preset-modal-actions">
                    <button class="dsh-preset-btn" :disabled="saving" @click="closeForm">取消</button>
                    <button class="dsh-preset-btn primary" :disabled="saving" @click="save">
                        {{ saving ? '保存中…' : '保存' }}
                    </button>
                </div>
            </div>
        </div>

        <!-- 导入预览 -->
        <div v-if="importPreview" class="dsh-preset-mask" @click.self="importPreview = null">
            <div class="dsh-preset-modal">
                <h2>导入预设</h2>
                <p class="dsh-preset-hint">
                    来自 {{ importPreview.manifest.exportedAt ? formatTime(importPreview.manifest.exportedAt) : '未知时间' }}
                    <template v-if="importPreview.manifest.dshVersion"> · DSH {{ importPreview.manifest.dshVersion }}</template>
                </p>
                <dl class="dsh-preset-preview">
                    <dt>名称</dt><dd>{{ importPreview.spec.name }}</dd>
                    <dt>ID</dt><dd class="mono">{{ importPreview.spec.id }}</dd>
                    <dt>工具</dt><dd>{{ toolText(importPreview.spec) }}</dd>
                    <dt>技能</dt><dd>{{ importPreview.skills.join('、') || '无' }}</dd>
                    <dt>文件</dt><dd>{{ importPreview.fileCount }} 个</dd>
                </dl>
                <p v-if="importPreview.conflict" class="dsh-preset-warn">
                    已存在 ID 为 {{ importPreview.spec.id }} 的预设「{{ importPreview.conflict.name }}」。
                    改一个 ID 会保留原有预设；勾选覆盖则替换它。
                </p>
                <label class="dsh-preset-field">
                    <span>导入为 ID</span>
                    <input v-model.trim="importId" placeholder="默认用包里的 ID"/>
                </label>
                <label v-if="importPreview.conflict && importId === importPreview.spec.id" class="dsh-preset-check">
                    <input type="checkbox" v-model="importOverwrite"/> 覆盖现有的同名预设
                </label>
                <label v-if="importPreview.skillConflicts.length" class="dsh-preset-check">
                    <input type="checkbox" v-model="importOverwriteSkills"/>
                    覆盖已存在的技能（{{ importPreview.skillConflicts.join('、') }}）
                </label>
                <p v-if="error" class="dsh-preset-error">{{ error }}</p>
                <div class="dsh-preset-modal-actions">
                    <button class="dsh-preset-btn" :disabled="importing" @click="importPreview = null">取消</button>
                    <button class="dsh-preset-btn primary" :disabled="importing" @click="applyImport">
                        {{ importing ? '导入中…' : '导入' }}
                    </button>
                </div>
            </div>
        </div>
    </section>
</template>

<script>
import {
    addDshPresetSkills,
    applyDshPresetImport,
    deleteDshPreset,
    exportDshPreset,
    inspectDshPresetImport,
    listDshPresetSkills,
    listDshPresets,
    saveDshPreset,
    setDshDefaultPreset,
} from '../../../dsh/renderer/dshClient';
import pinyin from '../../../vendor/pinyin';

const EMPTY_FORM = () => ({
    id: '',
    name: '',
    description: '',
    persona: '',
    tools: ['fs', 'search', 'todo', 'ask', 'skill'],
    skills: [],
});

export default {
    name: 'DshPresets',
    data() {
        return {
            items: [],
            tools: [],
            allSkills: [],
            skillsLoading: false,
            skillsError: '',
            defaultId: '',
            loadError: '',
            busy: false,
            error: '',
            showForm: false,
            editing: false,
            saving: false,
            form: EMPTY_FORM(),
            importPreview: null,
            importId: '',
            importOverwrite: false,
            importOverwriteSkills: false,
            importing: false,
        };
    },
    created() {
        this.load();
        this.loadSkills();
    },
    computed: {
        missingSkills() {
            if (this.skillsLoading || this.skillsError) return [];
            const all = new Set(this.allSkills.map(s => s.name));
            return (this.form.skills || []).filter(s => !all.has(s));
        },
    },
    methods: {
        async load() {
            const res = await listDshPresets();
            if (!res || !res.ok) {
                this.loadError = (res && res.error) || '读取预设失败';
                return;
            }
            this.loadError = '';
            this.items = Array.isArray(res.items) ? res.items : [];
            this.tools = Array.isArray(res.tools) ? res.tools : [];
            this.defaultId = res.default || '';
        },
        async loadSkills() {
            if (this.skillsLoading) return;
            this.skillsLoading = true;
            this.skillsError = '';
            try {
                const res = await listDshPresetSkills();
                if (!res || !res.ok) {
                    this.skillsError = (res && res.error) || '读取技能列表失败';
                    return;
                }
                this.allSkills = Array.isArray(res.skills) ? res.skills : [];
            } finally {
                this.skillsLoading = false;
            }
        },
        isDefault(id) {
            return this.defaultId === id;
        },
        toolLabels(item) {
            const keys = Array.isArray(item.tools) ? item.tools : [];
            return keys
                .map(key => (this.tools.find(t => t.key === key) || {}).label || key);
        },
        toolText(spec) {
            const labels = this.toolLabels(spec);
            return labels.length ? labels.join('、') : '仅人设与指令';
        },
        formatTime(iso) {
            if (!iso) return '';
            try {
                const d = new Date(iso);
                if (Number.isNaN(d.getTime())) return String(iso);
                return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
            } catch (e) {
                return String(iso);
            }
        },
        openCreate() {
            this.editing = false;
            this.error = '';
            this.form = EMPTY_FORM();
            this.showForm = true;
            this.loadSkills();
        },
        openEdit(item) {
            this.editing = true;
            this.error = '';
            this.form = {
                id: item.id,
                name: item.name || '',
                description: item.description || '',
                persona: item.persona || '',
                tools: Array.isArray(item.tools) && item.tools.length ? [...item.tools] : EMPTY_FORM().tools,
                skills: Array.isArray(item.skills) ? [...item.skills] : [],
            };
            this.showForm = true;
            this.loadSkills();
        },
        closeForm() {
            if (this.saving) return;
            this.showForm = false;
            this.error = '';
        },
        presetIdFromTitle(title) {
            // 中文走拼音转写；英文/数字保留，其他字符折叠为短横线。
            let romanized = String(title || '').trim();
            try {
                romanized = pinyin(romanized, {style: 0}).join(' ');
            } catch (e) { /* 转写失败时按原文处理 */ }
            let base = romanized
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '')
                .slice(0, 24)
                .replace(/-+$/g, '');
            if (!base) base = 'preset';
            let stamp = Date.now();
            let id = `${base}-${stamp}`;
            while (this.items.some(item => item.id === id)) {
                stamp += 1;
                id = `${base}-${stamp}`;
            }
            return id;
        },
        async addSkills() {
            if (this.busy) return;
            this.busy = true;
            try {
                const res = await addDshPresetSkills();
                if (res && res.ok && res.name) {
                    await this.loadSkills();
                    if (!this.form.skills.includes(res.name)) {
                        this.form.skills.push(res.name);
                    }
                    this.$notify({ title: '技能已添加', text: res.name, type: 'success' });
                } else if (res && !res.ok && !res.canceled) {
                    this.error = res.error || '添加技能失败';
                }
            } finally {
                this.busy = false;
            }
        },
        removeSkill(name) {
            this.form.skills = this.form.skills.filter(s => s !== name);
        },
        async save() {
            if (this.saving) return;
            if (!String(this.form.name || '').trim()) {
                this.error = '请填写预设名称';
                return;
            }
            this.error = '';
            this.saving = true;
            try {
                const id = this.editing ? this.form.id : this.presetIdFromTitle(this.form.name);
                const res = await saveDshPreset({
                    id,
                    name: this.form.name,
                    description: this.form.description,
                    persona: this.form.persona,
                    tools: this.form.tools,
                    skills: this.form.skills,
                });
                if (!res || !res.ok) {
                    this.error = (res && res.error) || '保存失败';
                    return;
                }
                this.applyList(res);
                this.showForm = false;
                this.$notify({ title: '预设已保存', text: '新会话即可选择', type: 'success' });
            } finally {
                this.saving = false;
            }
        },
        async remove(item) {
            const ok = window.confirm(`删除预设「${item.name}」？\n技能文件会保留在 $DSH_HOME/skills；使用该预设的已有会话下次创建 Agent 时会回退到默认预设。`);
            if (!ok) return;
            const res = await deleteDshPreset(item.id);
            if (!res || !res.ok) {
                this.$notify({ title: '删除失败', text: (res && res.error) || '', type: 'error' });
                return;
            }
            this.applyList(res);
            this.$notify({ title: '预设已删除', type: 'info' });
        },
        async makeDefault(item) {
            const res = await setDshDefaultPreset(item.id);
            if (!res || !res.ok) {
                this.$notify({ title: '设置失败', text: (res && res.error) || '', type: 'error' });
                return;
            }
            this.applyList(res);
            this.$notify({ title: '已设为默认预设', text: item.name, type: 'success' });
        },
        async exportPreset(item) {
            const res = await exportDshPreset(item.id);
            if (!res || !res.ok) {
                if (res && res.canceled) return;
                this.$notify({ title: '导出失败', text: (res && res.error) || '', type: 'error' });
                return;
            }
            this.$notify({ title: '已导出预设', text: `${res.file}（${res.skills} 个技能）`, type: 'success' });
        },
        async openImport() {
            this.error = '';
            this.busy = true;
            try {
                const res = await inspectDshPresetImport();
                if (!res || !res.ok) {
                    if (res && res.canceled) return;
                    this.$notify({ title: '导入失败', text: (res && res.error) || '', type: 'error' });
                    return;
                }
                const preview = res.preview;
                preview.spec = preview.spec || {};
                preview.skills = Array.isArray(preview.skills) ? preview.skills : [];
                preview.skillConflicts = Array.isArray(preview.skillConflicts) ? preview.skillConflicts : [];
                this.importPreview = preview;
                this.importId = preview.conflict ? this.uniqueId(preview.spec.id) : preview.spec.id;
                this.importOverwrite = false;
                this.importOverwriteSkills = false;
            } finally {
                this.busy = false;
            }
        },
        uniqueId(base) {
            const ids = new Set(this.items.map(i => i.id));
            const root = String(base || 'preset').replace(/-2$/, '');
            for (let i = 2; i < 100; i++) {
                const candidate = `${root}-${i}`;
                if (!ids.has(candidate)) return candidate;
            }
            return `${root}-${Date.now() % 1000}`;
        },
        async applyImport() {
            if (this.importing || !this.importPreview) return;
            this.error = '';
            this.importing = true;
            try {
                const res = await applyDshPresetImport({
                    file: this.importPreview.file,
                    id: this.importId || this.importPreview.spec.id,
                    overwrite: !!this.importOverwrite && this.importId === this.importPreview.spec.id,
                    overwriteSkills: !!this.importOverwriteSkills,
                });
                if (!res || !res.ok) {
                    this.error = (res && res.error) || '导入失败';
                    return;
                }
                this.applyList(res);
                this.importPreview = null;
                this.$notify({ title: '预设已导入', text: '新会话即可选择', type: 'success' });
            } finally {
                this.importing = false;
            }
        },
        applyList(res) {
            this.items = Array.isArray(res.items) ? res.items : [];
            this.tools = Array.isArray(res.tools) ? res.tools : this.tools;
            this.defaultId = res.default || '';
        },
    },
};
</script>

<style scoped>
.dsh-preset-page { display: flex; flex-direction: column; gap: 12px; }
.dsh-preset-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.dsh-preset-head h2 { margin: 0 0 3px; font-size: 15px; }
.dsh-preset-head p { margin: 0; max-width: 620px; font-size: 12px; line-height: 1.6; color: #8a8f99; }
.dsh-preset-head-actions { display: flex; gap: 8px; flex: 0 0 auto; }
.dsh-preset-btn {
    height: 32px; padding: 0 12px; border: 1px solid #e1e4e8; border-radius: 8px;
    background: #fff; color: #1f2329; font-size: 12px; cursor: pointer;
}
.dsh-preset-btn:hover { background: #f7f8fa; }
.dsh-preset-btn.primary { border-color: #1d4ed8; background: #1d4ed8; color: #fff; }
.dsh-preset-btn.primary:hover { background: #1e40af; }
.dsh-preset-btn:disabled { opacity: .55; cursor: default; }
.dsh-preset-empty { padding: 40px 16px; text-align: center; border: 1px dashed #e1e4e8; border-radius: 12px; color: #8a8f99; font-size: 12px; }
.dsh-preset-empty strong { display: block; margin-bottom: 6px; color: #4b5563; font-size: 13px; }
.dsh-preset-empty p { margin: 0; line-height: 1.6; }
.dsh-preset-card { border: 1px solid #e5e6eb; border-radius: 10px; padding: 14px; background: #fafbfc; }
.dsh-preset-card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
.dsh-preset-title { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; min-width: 0; }
.dsh-preset-title strong { font-size: 14px; }
.dsh-preset-badge { padding: 1px 6px; border-radius: 999px; background: #eef2f7; color: #475569; font-size: 10px; }
.dsh-preset-badge.user { background: #e8f1ff; color: #1d4ed8; }
.dsh-preset-badge.default { background: #e7f7ed; color: #1a7f37; }
.dsh-preset-card-actions { display: flex; gap: 8px; flex: 0 0 auto; }
.dsh-preset-link { padding: 0; border: 0; background: transparent; color: #1d4ed8; font-size: 12px; cursor: pointer; }
.dsh-preset-link:hover { text-decoration: underline; }
.dsh-preset-link.danger { color: #b42318; }
.dsh-preset-link:disabled { color: #8a8f99; cursor: default; text-decoration: none; }
.dsh-preset-id { margin: 6px 0 0; color: #8a8f99; font-size: 11px; }
.dsh-preset-desc { margin: 6px 0 0; color: #4b5563; font-size: 12px; line-height: 1.5; }
.dsh-preset-meta { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 9px; }
.dsh-preset-chip {
    display: inline-flex; align-items: center; gap: 4px; padding: 2px 7px;
    border: 1px solid #e1e4e8; border-radius: 999px; background: #fff;
    color: #475569; font-size: 11px;
}
.dsh-preset-chip.muted { color: #a8adb5; }
.dsh-preset-chip.skill { border-color: #c7d7f5; background: #f5f8ff; color: #1d4ed8; }
.dsh-preset-chip-x { border: 0; background: transparent; color: #8a8f99; font-size: 12px; line-height: 1; cursor: pointer; padding: 0; }
.dsh-preset-chip-x:hover { color: #b42318; }
.dsh-preset-mask { position: fixed; inset: 0; z-index: 1200; display: flex; align-items: center; justify-content: center; background: rgba(15, 23, 42, .3); }
.dsh-preset-modal {
    width: 620px; max-width: calc(100vw - 40px); max-height: calc(100vh - 60px); overflow-y: auto;
    padding: 20px; border-radius: 12px; background: #fff; box-shadow: 0 20px 60px rgba(15, 23, 42, .2);
    box-sizing: border-box;
}
.dsh-preset-modal h2 { margin: 0 0 4px; font-size: 16px; }
.dsh-preset-hint { margin: 0 0 14px; color: #6b7280; font-size: 12px; line-height: 1.5; }
.dsh-preset-field { display: flex; flex-direction: column; gap: 5px; margin-bottom: 12px; color: #4b5563; font-size: 12px; }
.dsh-preset-field input, .dsh-preset-field textarea {
    width: 100%; box-sizing: border-box; padding: 8px 9px;
    border: 1px solid #dfe3e8; border-radius: 7px; outline: none;
    background: #fff; color: #1f2329; font-size: 12px; font-family: inherit;
}
.dsh-preset-field textarea { resize: vertical; line-height: 1.6; }
.dsh-preset-field input:disabled { background: #f5f6f8; color: #8a8f99; }
.dsh-preset-field small { color: #9aa0a8; font-size: 10px; line-height: 1.5; }
.dsh-preset-tools { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.dsh-preset-tool {
    display: flex; align-items: flex-start; gap: 7px; padding: 7px 8px;
    border: 1px solid #e5e6eb; border-radius: 8px; background: #fafbfc; cursor: pointer;
}
.dsh-preset-tool input { width: auto; margin: 2px 0 0; }
.dsh-preset-tool span { display: flex; flex-direction: column; gap: 1px; }
.dsh-preset-tool strong { font-size: 12px; color: #1f2329; font-weight: 500; }
.dsh-preset-tool small { color: #9aa0a8; font-size: 10px; }
.dsh-preset-id-auto {
    margin: 0; padding: 8px 9px; border: 1px dashed #d8dde5; border-radius: 7px;
    background: #fafbfc; color: #8a8f99; font-size: 11px; line-height: 1.5;
}
.dsh-preset-skill-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.dsh-preset-skill-head-actions { display: flex; align-items: center; gap: 10px; }
.dsh-preset-skill-list {
    display: flex; flex-direction: column; gap: 2px; max-height: 220px; overflow-y: auto;
    padding: 6px; border: 1px solid #e5e6eb; border-radius: 8px; background: #fafbfc;
}
.dsh-preset-skill-item {
    display: flex; align-items: flex-start; gap: 8px; padding: 6px 7px;
    border-radius: 6px; cursor: pointer;
}
.dsh-preset-skill-item:hover { background: #f2f3f5; }
.dsh-preset-skill-item input { width: 18px; height: 18px; min-width: 18px; margin: 3px 0 0; flex: 0 0 auto; }
.dsh-preset-skill-copy { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.dsh-preset-skill-copy strong { color: #1f2329; font-size: 12px; font-weight: 500; }
.dsh-preset-skill-copy small { color: #9aa0a8; font-size: 10px; line-height: 1.4; }
.dsh-preset-skill-desc {
    color: #6b7280 !important;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.dsh-preset-skill-empty {
    margin: 0; padding: 10px; border: 1px dashed #e1e4e8; border-radius: 8px;
    color: #8a8f99; font-size: 11px; line-height: 1.5;
}
.dsh-preset-skill-error { margin: 0; color: #b42318; font-size: 11px; line-height: 1.5; }
.dsh-preset-missing-skills { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; color: #b42318; font-size: 11px; }
.dsh-preset-preview { display: grid; grid-template-columns: 64px 1fr; gap: 6px 10px; margin: 0 0 14px; font-size: 12px; }
.dsh-preset-preview dt { color: #8a8f99; }
.dsh-preset-preview dd { margin: 0; color: #1f2329; word-break: break-all; }
.dsh-preset-warn { margin: 0 0 12px; padding: 8px 10px; border-radius: 8px; background: #fffbeb; border: 1px solid #f1d18a; color: #92400e; font-size: 12px; line-height: 1.5; }
.dsh-preset-check { display: flex; align-items: center; gap: 7px; margin: 0 0 10px; color: #4b5563; font-size: 12px; }
.dsh-preset-check input { width: auto; }
.dsh-preset-error { margin: 0 0 10px; color: #b42318; font-size: 12px; }
.dsh-preset-modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 6px; }
@media (max-width: 720px) { .dsh-preset-tools { grid-template-columns: 1fr; } }
</style>
