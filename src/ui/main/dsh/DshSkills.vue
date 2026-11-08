<template>
    <section class="dsh-skill-page">
        <header class="dsh-skill-head">
            <div>
                <h2>技能</h2>
                <p>技能是可复用的 SKILL.md 知识包。安装到技能目录后，启用“技能”工具的预设即可发现并按需加载。</p>
            </div>
            <div class="dsh-skill-head-actions">
                <button class="dsh-skill-btn" :disabled="busy || loading" @click="load">刷新</button>
                <button class="dsh-skill-btn" :disabled="busy" @click="importSkill">导入技能目录</button>
                <button class="dsh-skill-btn primary" :disabled="busy" @click="openGuide('create')">＋ 新建技能</button>
            </div>
        </header>

        <p v-if="error" class="dsh-skill-error">{{ error }}</p>

        <div class="dsh-skill-layout">
            <aside class="dsh-skill-list">
                <div v-if="loading && !skills.length" class="dsh-skill-empty">正在读取技能…</div>
                <div v-else-if="!skills.length" class="dsh-skill-empty">还没有安装技能。</div>
                <button v-for="s in skills" :key="s.name"
                        class="dsh-skill-item" :class="{ active: selectedName === s.name }"
                        @click="selectSkill(s.name)">
                    <span class="dsh-skill-item-title">{{ s.displayName || s.name }}</span>
                    <span class="dsh-skill-item-id mono">{{ s.name }}</span>
                    <span v-if="s.description" class="dsh-skill-item-desc">{{ s.description }}</span>
                </button>
            </aside>

            <main class="dsh-skill-detail">
                <div v-if="detailLoading" class="dsh-skill-empty detail">正在读取 SKILL.md…</div>
                <div v-else-if="detailError" class="dsh-skill-error detail">{{ detailError }}</div>
                <template v-else-if="selected">
                    <header class="dsh-skill-detail-head">
                        <div class="dsh-skill-detail-title">
                            <h3>{{ selected.displayName || selected.name }}</h3>
                            <p class="mono">{{ selected.name }}</p>
                            <p v-if="selected.description" class="dsh-skill-detail-desc">{{ selected.description }}</p>
                        </div>
                        <div class="dsh-skill-detail-actions">
                            <button class="dsh-skill-btn" @click="openGuide('edit')">编辑提示</button>
                            <button class="dsh-skill-btn" @click="openSelectedDir">打开目录</button>
                        </div>
                    </header>
                    <div class="dsh-skill-file mono" :title="selected.file">{{ selected.file }}</div>
                    <pre class="dsh-skill-content">{{ selected.content }}</pre>
                </template>
                <div v-else class="dsh-skill-empty detail">从左侧选择一个技能查看 SKILL.md。</div>
            </main>
        </div>

        <div v-if="guideMode" class="dsh-skill-mask" @click.self="guideMode = ''">
            <div class="dsh-skill-guide">
                <header class="dsh-skill-guide-head">
                    <div>
                        <h2>{{ guideMode === 'create' ? '新建技能' : '编辑技能' }}</h2>
                        <p>{{ guideMode === 'create' ? '按下面的结构准备技能，或把指令交给 Agent 代做。' : '技能内容直接写在 SKILL.md 里，保存后回本页刷新即可。' }}</p>
                    </div>
                    <button class="dsh-skill-guide-close" title="关闭" @click="guideMode = ''">×</button>
                </header>

                <ol class="dsh-skill-guide-steps">
                    <li v-if="guideMode === 'create'">
                        在技能目录下新建文件夹，名称建议使用小写字母、数字和短横线：
                        <code>{{ guideSkillName }}</code>
                    </li>
                    <li v-else>
                        打开技能目录，编辑 <code>{{ selected ? selected.name : guideSkillName }}/SKILL.md</code>。
                    </li>
                    <li>
                        文件必须是 <code>SKILL.md</code>，开头使用 YAML frontmatter，至少包含
                        <code>name</code> 和 <code>description</code>。
                    </li>
                    <li>
                        正文写清楚适用场景、操作步骤、检查项和输出要求；有脚本或参考资料时放在同一目录下。
                    </li>
                    <li>保存文件后回到本页点“刷新”。在预设里勾选该技能，新会话才会带上它。</li>
                </ol>

                <div class="dsh-skill-dir">
                    技能目录：<code>{{ skillsDir || '$DSH_HOME/skills' }}</code>
                    <p>Agent 默认只能写工作区，可以让它在项目的 <code>.dsh/skills</code> 下创建，再用“导入技能目录”安装到这里。</p>
                </div>

                <div class="dsh-skill-block">
                    <div class="dsh-skill-block-head">
                        <span>SKILL.md 模板</span>
                        <button class="dsh-skill-link" @click="copyText(guideTemplate, 'SKILL.md 模板')">复制模板</button>
                    </div>
                    <pre class="dsh-skill-code">{{ guideTemplate }}</pre>
                </div>

                <div class="dsh-skill-block">
                    <div class="dsh-skill-block-head">
                        <span>给 Agent 的指令</span>
                        <button class="dsh-skill-link" @click="copyText(guidePrompt, 'Agent 指令')">复制给 Agent</button>
                    </div>
                    <pre class="dsh-skill-code prompt">{{ guidePrompt }}</pre>
                </div>

                <div class="dsh-skill-guide-actions">
                    <button class="dsh-skill-btn" @click="openSkillsDir">打开技能目录</button>
                    <button class="dsh-skill-btn primary" @click="guideMode = ''">知道了</button>
                </div>
            </div>
        </div>
    </section>
</template>

<script>
import {
    addDshPresetSkills,
    listDshPresetSkills,
    openDshPath,
    readDshPresetSkill,
} from '../../../dsh/renderer/dshClient';

export default {
    name: 'DshSkills',
    data() {
        return {
            skills: [],
            skillsDir: '',
            selectedName: '',
            selected: null,
            loading: false,
            detailLoading: false,
            busy: false,
            error: '',
            detailError: '',
            guideMode: '',
            _detailToken: 0,
        };
    },
    computed: {
        guideSkillName() {
            if (this.guideMode === 'edit' && this.selected) return this.selected.name;
            return 'my-skill';
        },
        guideTemplate() {
            return `---\nname: ${this.guideSkillName}\ndescription: 说明这个技能适合在什么场景使用。\n---\n\n# ${this.guideSkillName}\n\n## 适用场景\n\n- 当用户要求……时使用。\n\n## 操作步骤\n\n1. 先检查……\n2. 再执行……\n3. 最后验证……\n\n## 输出要求\n\n- 说明做了什么、结果如何、有哪些限制。\n`;
        },
        guidePrompt() {
            const dir = this.skillsDir || '$DSH_HOME/skills';
            if (this.guideMode === 'edit') {
                const name = this.selected ? this.selected.name : this.guideSkillName;
                const path = this.selected ? this.selected.file : `${dir}/${name}/SKILL.md`;
                return `请帮我修改 DSH 技能「${name}」。\n\n文件：${path}\n\n要求：\n1. 保留 frontmatter 的 name，不要改成别的技能名。\n2. 如果适用场景变了，同步更新 description。\n3. 正文补充或调整操作步骤、检查项和输出要求。\n4. 只修改这个技能目录内的文件，不要改动其他配置。\n5. 修改完成后告诉我改了哪些地方。`;
            }
            return `请帮我创建一个 DSH 技能。\n\n1. 在当前工作区新建目录 .dsh/skills/${this.guideSkillName}。\n2. 创建 .dsh/skills/${this.guideSkillName}/SKILL.md，开头写 YAML frontmatter，包含 name 和 description。\n3. 正文写清楚适用场景、操作步骤、检查项和输出要求。\n4. 目录名和 frontmatter 的 name 保持一致，不要修改其他技能。\n5. 完成后告诉我文件路径，我会用“导入技能目录”安装到全局技能目录。`;
        },
    },
    created() {
        this.load();
    },
    methods: {
        async load() {
            if (this.loading) return;
            this.loading = true;
            this.error = '';
            try {
                const res = await listDshPresetSkills();
                if (!res || !res.ok) {
                    this.error = (res && res.error) || '读取技能列表失败';
                    return;
                }
                this.skills = Array.isArray(res.skills) ? res.skills : [];
                this.skillsDir = res.dir || this.skillsDir;
                const exists = this.skills.some(s => s.name === this.selectedName);
                if (!exists) {
                    this.selectedName = this.skills.length ? this.skills[0].name : '';
                }
                if (this.selectedName) {
                    await this.selectSkill(this.selectedName);
                } else {
                    this.selected = null;
                    this.detailError = '';
                }
            } finally {
                this.loading = false;
            }
        },
        async selectSkill(name) {
            if (!name) return;
            const token = ++this._detailToken;
            this.selectedName = name;
            this.detailLoading = true;
            this.detailError = '';
            try {
                const res = await readDshPresetSkill(name);
                if (token !== this._detailToken) return;
                if (!res || !res.ok) {
                    this.selected = null;
                    this.detailError = (res && res.error) || '读取技能失败';
                    return;
                }
                this.selected = res.skill;
            } finally {
                if (token === this._detailToken) this.detailLoading = false;
            }
        },
        async importSkill() {
            if (this.busy) return;
            this.busy = true;
            this.error = '';
            try {
                const res = await addDshPresetSkills();
                if (res && res.ok && res.name) {
                    this.$notify({ title: '技能已导入', text: res.name, type: 'success' });
                    this.selectedName = res.name;
                    await this.load();
                } else if (res && !res.ok && !res.canceled) {
                    this.error = res.error || '导入技能失败';
                }
            } finally {
                this.busy = false;
            }
        },
        openGuide(mode) {
            if (mode === 'edit' && !this.selected) return;
            this.guideMode = mode;
        },
        openSelectedDir() {
            if (this.selected && this.selected.path) {
                openDshPath(this.selected.path);
            }
        },
        openSkillsDir() {
            if (this.skillsDir) openDshPath(this.skillsDir);
        },
        async copyText(text, label) {
            try {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(text);
                } else {
                    const el = document.createElement('textarea');
                    el.value = text;
                    el.style.position = 'fixed';
                    el.style.left = '-9999px';
                    document.body.appendChild(el);
                    el.select();
                    if (!document.execCommand('copy')) throw new Error('copy failed');
                    el.remove();
                }
                this.$notify({ title: '已复制', text: label, type: 'success' });
            } catch (e) {
                this.$notify({ title: '复制失败', text: '请手动选择文本复制', type: 'error' });
            }
        },
    },
};
</script>

<style scoped>
.dsh-skill-page { display: flex; flex-direction: column; gap: 12px; }
.dsh-skill-page .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
.dsh-skill-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.dsh-skill-head h2 { margin: 0 0 3px; font-size: 15px; }
.dsh-skill-head p { margin: 0; max-width: 660px; color: #8a8f99; font-size: 12px; line-height: 1.6; }
.dsh-skill-head-actions { display: flex; gap: 8px; flex: 0 0 auto; flex-wrap: wrap; }
.dsh-skill-btn {
    padding: 6px 10px; border: 1px solid #dfe3e8; border-radius: 7px;
    background: #fff; color: #4b5563; font-size: 12px; line-height: 18px; cursor: pointer;
}
.dsh-skill-btn:hover { background: #f7f8fa; }
.dsh-skill-btn.primary { border-color: #1d4ed8; background: #1d4ed8; color: #fff; }
.dsh-skill-btn.primary:hover { background: #1e40af; }
.dsh-skill-btn:disabled { opacity: .55; cursor: default; }
.dsh-skill-error { margin: 0; color: #b42318; font-size: 12px; }
.dsh-skill-error.detail { padding: 20px; }
.dsh-skill-layout { display: grid; grid-template-columns: 260px minmax(0, 1fr); gap: 12px; min-height: 460px; }
.dsh-skill-list {
    display: flex; flex-direction: column; gap: 3px; min-width: 0; max-height: 620px; overflow-y: auto;
    padding: 6px; border: 1px solid #e5e6eb; border-radius: 10px; background: #fafbfc;
}
.dsh-skill-item {
    display: flex; flex-direction: column; gap: 2px; width: 100%; padding: 8px 9px;
    border: 1px solid transparent; border-radius: 7px; background: transparent;
    color: #1f2329; text-align: left; cursor: pointer;
}
.dsh-skill-item:hover { background: #f2f3f5; }
.dsh-skill-item.active { border-color: #c7d7f5; background: #eef4ff; }
.dsh-skill-item-title { font-size: 12px; font-weight: 600; }
.dsh-skill-item-id { color: #9aa0a8; font-size: 10px; }
.dsh-skill-item-desc {
    margin-top: 2px; color: #6b7280; font-size: 10px; line-height: 1.45;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.dsh-skill-empty { padding: 24px 12px; color: #9aa0a8; text-align: center; font-size: 12px; }
.dsh-skill-empty.detail { display: flex; align-items: center; justify-content: center; flex: 1; }
.dsh-skill-detail {
    display: flex; flex-direction: column; min-width: 0; min-height: 0;
    border: 1px solid #e5e6eb; border-radius: 10px; background: #fff; overflow: hidden;
}
.dsh-skill-detail-head {
    display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;
    padding: 14px 16px; border-bottom: 1px solid #eef0f3;
}
.dsh-skill-detail-title { min-width: 0; }
.dsh-skill-detail-title h3 { margin: 0; font-size: 15px; }
.dsh-skill-detail-title p { margin: 3px 0 0; color: #9aa0a8; font-size: 10px; word-break: break-all; }
.dsh-skill-detail-title .dsh-skill-detail-desc { color: #4b5563; font-size: 12px; line-height: 1.5; }
.dsh-skill-detail-actions { display: flex; gap: 8px; flex: 0 0 auto; }
.dsh-skill-file { margin: 0; padding: 7px 16px; border-bottom: 1px solid #f0f2f5; background: #fcfcfd; color: #9aa0a8; font-size: 10px; word-break: break-all; }
.dsh-skill-content {
    flex: 1; min-height: 0; margin: 0; padding: 16px; overflow: auto;
    color: #1f2329; background: #fff; font: 12px/1.7 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    white-space: pre-wrap; word-break: break-word;
}
.dsh-skill-mask { position: fixed; inset: 0; z-index: 1250; display: flex; align-items: center; justify-content: center; background: rgba(15, 23, 42, .3); }
.dsh-skill-guide {
    width: 700px; max-width: calc(100vw - 40px); max-height: calc(100vh - 60px); overflow-y: auto;
    padding: 20px; border-radius: 12px; background: #fff; box-shadow: 0 20px 60px rgba(15, 23, 42, .2);
    box-sizing: border-box;
}
.dsh-skill-guide-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.dsh-skill-guide-head h2 { margin: 0 0 3px; font-size: 17px; }
.dsh-skill-guide-head p { margin: 0; color: #6b7280; font-size: 12px; line-height: 1.5; }
.dsh-skill-guide-close { border: 0; background: transparent; color: #8a8f99; font-size: 22px; line-height: 1; cursor: pointer; }
.dsh-skill-guide-steps { margin: 16px 0 12px; padding-left: 20px; color: #4b5563; font-size: 12px; line-height: 1.8; }
.dsh-skill-guide-steps code, .dsh-skill-dir code { padding: 1px 4px; border-radius: 3px; background: #f2f3f5; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 11px; }
.dsh-skill-dir { margin-bottom: 12px; padding: 8px 10px; border-radius: 7px; background: #fafbfc; color: #6b7280; font-size: 11px; word-break: break-all; }
.dsh-skill-dir p { margin: 5px 0 0; color: #8a8f99; line-height: 1.5; }
.dsh-skill-block { margin-bottom: 12px; }
.dsh-skill-block-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 5px; color: #4b5563; font-size: 12px; }
.dsh-skill-link { padding: 0; border: 0; background: transparent; color: #1d4ed8; font-size: 11px; cursor: pointer; }
.dsh-skill-link:hover { text-decoration: underline; }
.dsh-skill-code {
    margin: 0; padding: 11px 12px; max-height: 220px; overflow: auto; box-sizing: border-box;
    border: 1px solid #e5e6eb; border-radius: 8px; background: #fafbfc; color: #1f2329;
    font: 11px/1.6 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    white-space: pre-wrap; word-break: break-word;
}
.dsh-skill-code.prompt { background: #f7f9ff; border-color: #dce6fb; }
.dsh-skill-guide-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px; }
@media (max-width: 900px) {
    .dsh-skill-layout { grid-template-columns: 1fr; }
    .dsh-skill-list { max-height: 220px; }
}
</style>
