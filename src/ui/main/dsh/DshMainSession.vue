<template>
    <section class="dsh-ms-page">
        <div class="dsh-ms-head">
            <div>
                <h2>主会话</h2>
                <p>
                    owner 私聊与 line0 普通群（非 DSH 群）共用同一个会话：群消息只记录、按需私聊提醒；
                    owner 在群里 @ 机器人才回复。这里的开关保存后会重启 Host 生效。
                </p>
            </div>
            <span class="dsh-ms-state" :class="{ on: settings.enabled }">
                {{ settings.enabled ? '已启用' : '已关闭' }}
            </span>
        </div>

        <div class="dsh-ms-grid">
            <section class="dsh-ms-card">
                <h3>基础</h3>
                <label class="dsh-ms-check">
                    <input type="checkbox" v-model="settings.enabled"/>
                    <span>启用主会话（owner 私聊进入 AI 对话）</span>
                </label>
                <label class="dsh-ms-check">
                    <input type="checkbox" v-model="settings.notify"/>
                    <span>群里有相关消息时私聊提醒我</span>
                </label>
                <label class="dsh-ms-field">
                    <span>owner 在群里 @ 机器人时</span>
                    <select v-model="settings.groupReply">
                        <option value="group">在群里回复（默认）</option>
                        <option value="owner">私聊回复 owner</option>
                    </select>
                </label>
                <label class="dsh-ms-field">
                    <span>提醒冷却（分钟）</span>
                    <input v-model.number="cooldownMinutes" type="number" min="0" step="1"/>
                </label>
                <label class="dsh-ms-field">
                    <span>相关性关键词（逗号分隔，可选）</span>
                    <input v-model="keywordsText" placeholder="例如：部署, 报错, 上线"/>
                </label>
            </section>

            <section class="dsh-ms-card">
                <h3>群与上下文</h3>
                <label class="dsh-ms-field">
                    <span>旁观的群（每行或逗号分隔；留空 = 所有非 DSH 群）</span>
                    <textarea v-model="groupsText" rows="4" placeholder="groupId1&#10;groupId2"></textarea>
                </label>
                <label class="dsh-ms-field">
                    <span>主会话工作目录（留空 = 默认 main-workspace）</span>
                    <div class="dsh-ms-row">
                        <input v-model.trim="settings.workspace" placeholder="默认 <dshHome>/main-workspace"/>
                        <button class="dsh-ms-btn" type="button" @click="pickWorkspace">选择…</button>
                    </div>
                </label>
                <div class="dsh-ms-row">
                    <label class="dsh-ms-field grow">
                        <span>每群保留条数</span>
                        <input v-model.number="settings.bufferLimit" type="number" min="10" step="10"/>
                    </label>
                    <label class="dsh-ms-field grow">
                        <span>每回合注入条数</span>
                        <input v-model.number="settings.injectLimit" type="number" min="1" step="1"/>
                    </label>
                </div>
            </section>

            <section class="dsh-ms-card">
                <h3>历史文件</h3>
                <p class="dsh-ms-hint">
                    把旁观的群消息按「天/群」追加到 Markdown 文件，agent 可以用 grep/glob/read 检索更早的上下文。
                    默认永久保留。
                </p>
                <label class="dsh-ms-check">
                    <input type="checkbox" v-model="settings.history.enabled"/>
                    <span>写入历史文件</span>
                </label>
                <div class="dsh-ms-row">
                    <label class="dsh-ms-field grow">
                        <span>保留天数（0 = 永久）</span>
                        <input v-model.number="settings.history.retainDays" type="number" min="0" step="1"/>
                    </label>
                    <label class="dsh-ms-field grow">
                        <span>目录（留空 = 主会话目录下 group-history）</span>
                        <input v-model.trim="settings.history.dir" placeholder="默认 <workspace>/group-history"/>
                    </label>
                    <button class="dsh-ms-btn" type="button" @click="pickHistoryDir">选择…</button>
                </div>
                <p class="dsh-ms-hint">目录：{{ historyPathHint }}</p>
            </section>

            <section class="dsh-ms-card">
                <h3>会话预设（动态）</h3>
                <p class="dsh-ms-hint">
                    主会话当前使用 <strong>{{ currentPreset || '未知' }}</strong>。切换后立即生效：
                    机器人会重建该会话的 agent（上下文保留），不需要重启 Host。
                </p>
                <label class="dsh-ms-field">
                    <span>切换到预设</span>
                    <div class="dsh-ms-row">
                        <select v-model="selectedPreset">
                            <option value="" disabled>— 选择预设 —</option>
                            <option v-for="p in presets" :key="p.id" :value="p.id">
                                {{ p.name }}{{ p.source === 'user' ? '（自建）' : '' }}
                            </option>
                        </select>
                        <button class="dsh-ms-btn primary" :disabled="!selectedPreset || selectedPreset === currentPreset || switching"
                                @click="switchPreset">
                            {{ switching ? '切换中…' : '切换' }}
                        </button>
                    </div>
                </label>
                <div class="dsh-ms-row">
                    <button class="dsh-ms-btn" :disabled="loadingPreset" @click="refreshPreset">
                        {{ loadingPreset ? '读取中…' : '刷新当前预设' }}
                    </button>
                </div>
                <p class="dsh-ms-hint">预设列表来自「AI 设置 → 预设」（内置 + 自建）。</p>
            </section>
        </div>

        <p v-if="error" class="dsh-ms-error">{{ error }}</p>
        <div class="dsh-ms-actions">
            <button class="dsh-ms-btn primary" :disabled="saving" @click="save">
                {{ saving ? '保存中…' : '保存并重启 Host' }}
            </button>
            <span class="dsh-ms-hint">开关类设置需要重启 Host；预设切换不需要。</span>
        </div>
    </section>
</template>

<script>
import {
    getDshMainSession,
    listDshPresets,
    pickDshDirectory,
    setDshMainSession,
} from '../../../dsh/renderer/dshClient';
import { localRobotId } from '../../../dsh/renderer/state';
import { getAgentPanelDataFor } from '../../util/agentState';
import wfc from '../../../wfc/client/wfc';
import Conversation from '../../../wfc/model/conversation';
import AgentCommandMessageContent from '../../../wfc/messages/agentCommandMessageContent';

function emptySettings() {
    return {
        enabled: true,
        groups: [],
        workspace: '',
        bufferLimit: 200,
        injectLimit: 30,
        notify: true,
        notifyCooldownMs: 600000,
        notifyKeywords: [],
        groupReply: 'group',
        history: { enabled: true, dir: '', retainDays: 0 },
    };
}

export default {
    name: 'DshMainSession',
    data() {
        return {
            settings: emptySettings(),
            groupsText: '',
            keywordsText: '',
            cooldownMinutes: 10,
            presets: [],
            selectedPreset: '',
            currentPreset: '',
            loadingPreset: false,
            switching: false,
            saving: false,
            error: '',
        };
    },
    computed: {
        historyPathHint() {
            if (this.settings.history && this.settings.history.dir) return this.settings.history.dir;
            const base = this.settings.workspace || '（默认主会话目录）';
            return `${base}/group-history`;
        },
    },
    created() {
        this.load().then(() => this.refreshPreset());
        this.loadPresets();
    },
    methods: {
        async load() {
            const res = await getDshMainSession();
            if (!res || !res.ok) {
                this.error = (res && res.error) || '读取主会话设置失败';
                return;
            }
            const incoming = res.settings || {};
            this.settings = {
                ...emptySettings(),
                ...incoming,
                history: { ...emptySettings().history, ...(incoming.history || {}) },
            };
            this.groupsText = (this.settings.groups || []).join('\n');
            this.keywordsText = (this.settings.notifyKeywords || []).join(',');
            this.cooldownMinutes = Math.round((Number(this.settings.notifyCooldownMs) || 0) / 60000);
        },
        async loadPresets() {
            const res = await listDshPresets();
            if (res && res.ok) this.presets = res.items || [];
        },
        async pickWorkspace() {
            const result = await pickDshDirectory();
            if (result && result.ok && result.path) this.settings.workspace = result.path;
        },
        async pickHistoryDir() {
            const result = await pickDshDirectory();
            if (result && result.ok && result.path) this.settings.history.dir = result.path;
        },
        splitList(text) {
            return String(text || '')
                .split(/[\n,，;；\s]+/)
                .map((s) => s.trim())
                .filter(Boolean);
        },
        async save() {
            if (this.saving) return;
            this.error = '';
            this.saving = true;
            try {
                const mainSession = {
                    enabled: !!this.settings.enabled,
                    groups: this.splitList(this.groupsText),
                    workspace: String(this.settings.workspace || '').trim(),
                    bufferLimit: Math.max(10, Number(this.settings.bufferLimit) || 200),
                    injectLimit: Math.max(1, Number(this.settings.injectLimit) || 30),
                    notify: !!this.settings.notify,
                    notifyCooldownMs: Math.max(0, Math.round((Number(this.cooldownMinutes) || 0) * 60000)),
                    notifyKeywords: this.splitList(this.keywordsText),
                    groupReply: this.settings.groupReply === 'owner' ? 'owner' : 'group',
                    history: {
                        enabled: !!this.settings.history.enabled,
                        dir: String(this.settings.history.dir || '').trim(),
                        retainDays: Math.max(0, Number(this.settings.history.retainDays) || 0),
                    },
                };
                const res = await setDshMainSession(mainSession);
                if (!res || !res.ok) {
                    this.error = (res && res.error) || '保存失败';
                    return;
                }
                const applied = res.settings || mainSession;
                this.settings = {
                    ...emptySettings(),
                    ...applied,
                    history: { ...emptySettings().history, ...(applied.history || {}) },
                };
                this.$notify({ title: '主会话设置已保存', text: 'Host 已按新配置重启', type: 'success' });
            } finally {
                this.saving = false;
            }
        },
        sendPanelCommand(op, cmd) {
            return new Promise((resolve, reject) => {
                const robotId = localRobotId();
                if (!robotId) {
                    reject(new Error('机器人尚未开通'));
                    return;
                }
                const conv = new Conversation(0, robotId, 0);
                const content = new AgentCommandMessageContent(op, cmd, Date.now() % 100000, robotId,
                    undefined, '', '', null, op === 'set');
                wfc.sendConversationMessage(conv, content, [], null, null,
                    () => resolve(), (e) => reject(e));
            });
        },
        readPanel() {
            // 面板数据由插件按“消息发送者”的会话 key 写入：单聊里发送者是 owner
            // （也就是本机登录用户），因此读取时 target 用 ownerId，而不是机器人 id。
            const robotId = localRobotId();
            const ownerId = wfc.getUserId();
            if (!robotId || !ownerId) return null;
            const conv = new Conversation(0, ownerId, 0);
            return getAgentPanelDataFor(conv, robotId);
        },
        async refreshPreset() {
            if (this.loadingPreset) return;
            this.loadingPreset = true;
            this.error = '';
            try {
                await this.sendPanelCommand('query', '');
                for (let i = 0; i < 4; i++) {
                    await new Promise((r) => setTimeout(r, 400));
                    const panel = this.readPanel();
                    const preset = panel && panel.preset && panel.preset.current;
                    if (preset) {
                        this.currentPreset = String(preset);
                        if (!this.selectedPreset) this.selectedPreset = String(preset);
                        break;
                    }
                }
                if (!this.currentPreset) {
                    this.error = '暂时读不到主会话预设（Host 未运行或插件未响应）';
                }
            } catch (e) {
                this.error = (e && e.message) || '读取预设失败';
            } finally {
                this.loadingPreset = false;
            }
        },
        async switchPreset() {
            if (this.switching || !this.selectedPreset) return;
            this.switching = true;
            this.error = '';
            try {
                await this.sendPanelCommand('set', `/preset ${this.selectedPreset}`);
                this.currentPreset = this.selectedPreset;
                this.$notify({
                    title: '已切换主会话预设',
                    text: `${this.selectedPreset}：下一条消息生效（上下文保留）`,
                    type: 'success',
                });
            } catch (e) {
                this.error = (e && e.message) || '切换预设失败';
            } finally {
                this.switching = false;
            }
        },
    },
};
</script>

<style scoped>
.dsh-ms-page { display: flex; flex-direction: column; gap: 12px; }
.dsh-ms-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.dsh-ms-head h2 { margin: 0 0 3px; font-size: 15px; }
.dsh-ms-head p { margin: 0; max-width: 720px; color: #8a8f99; font-size: 12px; line-height: 1.6; }
.dsh-ms-state { flex: 0 0 auto; padding: 2px 8px; border-radius: 999px; background: #eef2f7; color: #475569; font-size: 11px; }
.dsh-ms-state.on { background: #e7f7ed; color: #1a7f37; }
.dsh-ms-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.dsh-ms-card { border: 1px solid #e5e6eb; border-radius: 10px; padding: 14px; background: #fafbfc; display: flex; flex-direction: column; gap: 10px; }
.dsh-ms-card h3 { margin: 0 0 2px; font-size: 13px; }
.dsh-ms-check { display: flex; align-items: center; gap: 8px; color: #1f2329; font-size: 12px; cursor: pointer; }
.dsh-ms-check input { width: auto; }
.dsh-ms-field { display: flex; flex-direction: column; gap: 5px; color: #4b5563; font-size: 12px; }
.dsh-ms-field.grow { flex: 1; }
.dsh-ms-field input, .dsh-ms-field select, .dsh-ms-field textarea {
    width: 100%; box-sizing: border-box; padding: 7px 9px; border: 1px solid #dfe3e8;
    border-radius: 7px; background: #fff; color: #1f2329; font-size: 12px; font-family: inherit; outline: none;
}
.dsh-ms-field textarea { resize: vertical; line-height: 1.5; }
.dsh-ms-row { display: flex; align-items: center; gap: 8px; }
.dsh-ms-row > input, .dsh-ms-row > select { flex: 1; min-width: 0; }
.dsh-ms-btn {
    height: 30px; padding: 0 12px; border: 1px solid #e1e4e8; border-radius: 7px;
    background: #fff; color: #1f2329; font-size: 12px; cursor: pointer; flex: 0 0 auto;
}
.dsh-ms-btn:hover { background: #f7f8fa; }
.dsh-ms-btn.primary { border-color: #1d4ed8; background: #1d4ed8; color: #fff; }
.dsh-ms-btn.primary:hover { background: #1e40af; }
.dsh-ms-btn:disabled { opacity: .55; cursor: default; }
.dsh-ms-hint { margin: 0; color: #8a8f99; font-size: 11px; line-height: 1.6; }
.dsh-ms-error { margin: 0; color: #b42318; font-size: 12px; }
.dsh-ms-actions { display: flex; align-items: center; gap: 10px; }
@media (max-width: 860px) { .dsh-ms-grid { grid-template-columns: 1fr; } }
</style>
