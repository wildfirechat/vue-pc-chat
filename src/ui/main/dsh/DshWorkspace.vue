<template>
    <section class="dsh-workspace-page">
        <div class="dsh-workspace-main">
            <aside class="dsh-session-column">
                <div class="dsh-sidebar-head">
                    <div class="dsh-sidebar-brand">
                        <span class="dsh-brand-dot" :class="{online: hostStatus.state === 'running'}"></span>
                        <div>
                            <h1>DSH 助手</h1>
                            <p>工作区 / 会话 · 本机 Agent</p>
                        </div>
                    </div>
                    <div class="dsh-sidebar-actions">
                        <button class="dsh-sidebar-btn" title="新建工作区" :disabled="creating" @click="showCreate = true">＋</button>
                        <button class="dsh-sidebar-btn" title="DSH 设置" @click="openSettings">⚙</button>
                    </div>
                </div>
                <div class="dsh-session-search">
                    <input v-model="search" type="search" placeholder="搜索工作区 / 会话"/>
                </div>
                <div class="dsh-session-scroll">
                    <div v-if="!filteredWorkspaces.length" class="dsh-list-empty">
                        <strong>还没有工作区</strong>
                        <p>新建工作区后，机器人会创建第一个会话。</p>
                        <button class="dsh-top-btn" @click="showCreate = true">新建工作区</button>
                    </div>
                    <div v-for="ws in filteredWorkspaces" :key="ws.key" class="dsh-ws-block">
                        <div class="dsh-ws-head">
                            <button class="dsh-ws-toggle" @click="toggleWorkspace(ws.key)">
                                <span class="dsh-caret" :class="{collapsed: collapsed[ws.key]}">▾</span>
                                <span class="dsh-ws-name">{{ ws.name }}</span>
                                <span class="dsh-ws-count">{{ ws.sessions.length }}</span>
                            </button>
                            <button class="dsh-ws-add" title="在这个工作区新建会话" @click="createSession(ws)">＋</button>
                        </div>
                        <div v-if="!collapsed[ws.key]" class="dsh-session-list">
                            <button v-for="s in ws.sessions" :key="s.groupId"
                                    class="dsh-session-row" :class="{active: selectedGroupId === s.groupId}"
                                    @click="selectSession(s)">
                                <span class="dsh-session-status" :class="'state-' + (s.state && s.state.state || 'idle')"></span>
                                <span class="dsh-session-content">
                                    <span class="dsh-session-name">{{ s.name }}</span>
                                    <span class="dsh-session-preview">{{ s.preview || '暂无消息' }}</span>
                                </span>
                                <span class="dsh-session-side">
                                    <span v-if="s.unread" class="dsh-session-unread">{{ s.unread > 99 ? '99+' : s.unread }}</span>
                                    <span class="dsh-session-time">{{ s.time || '' }}</span>
                                </span>
                            </button>
                        </div>
                    </div>
                </div>
            </aside>

            <main class="dsh-chat-column">
                <template v-if="selectedSession">
                    <ConversationView class="dsh-embedded-chat" :dsh-mode="true" @toggle-dsh-detail="showDetail = !showDetail"/>
                </template>
                <div v-else class="dsh-chat-empty">
                    <div class="dsh-chat-empty-top">
                        <span>DSH 工作区</span>
                        <button class="dsh-detail-toggle" title="DSH 设置" @click="openSettings">⚙</button>
                    </div>
                    <div class="dsh-chat-empty-icon">◌</div>
                    <h2>选择一个 DSH 会话</h2>
                    <p>从左侧工作区选择会话，或新建一个工作区开始。</p>
                    <button class="dsh-top-btn" @click="showCreate = true">新建工作区</button>
                </div>
            </main>

            <DshPlanSidebar v-if="selectedSession && showDetail"
                            :conversation="selectedConversation" :robot-id="selectedRobotId"
                            @close="showDetail = false"/>
        </div>

        <div v-if="showCreate" class="dsh-modal-mask" @click.self="showCreate = false">
            <div class="dsh-modal">
                <h2>新建工作区</h2>
                <p class="dsh-modal-hint">工作区是一个本地目录；机器人会为该目录创建第一个会话群。</p>
                <label class="dsh-field">
                    <span>目录</span>
                    <div class="dsh-path-row">
                        <input v-model.trim="newWorkspacePath" placeholder="留空则由机器人自动分配；也可填绝对路径"/>
                        <button class="dsh-top-btn" type="button" @click="pickDirectory">选择…</button>
                    </div>
                </label>
                <p class="dsh-modal-tip">目录必须在机器人允许的工作区内；不存在时机器人会提示。</p>
                <div class="dsh-modal-actions">
                    <button class="dsh-top-btn ghost" :disabled="creating" @click="showCreate = false">取消</button>
                    <button class="dsh-top-btn" :disabled="creating" @click="createWorkspace">
                        {{ creating ? '正在创建…' : '创建工作区' }}
                    </button>
                </div>
            </div>
        </div>
    </section>
</template>

<script>
import ConversationView from '../conversation/ConversationView.vue';
import DshPlanSidebar from './DshPlanSidebar.vue';
import store from '../../../store';
import wfc from '../../../wfc/client/wfc';
import Conversation from '../../../wfc/model/conversation';
import TextMessageContent from '../../../wfc/messages/textMessageContent';
import { getDshStatus, getDshWorkspaces, pickDshDirectory } from '../../../dsh/renderer/dshClient';
import { localRobotId } from '../../../dsh/renderer/state';
import { getAgentPanelDataFor, getAgentState } from '../../util/agentState';

export default {
    name: 'DshWorkspace',
    components: { ConversationView, DshPlanSidebar },
    data() {
        return {
            hostStatus: {},
            search: '',
            workspaces: [],
            workspacePaths: {},
            selectedGroupId: '',
            selectedRobotId: '',
            showDetail: false,
            collapsed: {},
            states: {},
            showCreate: false,
            newWorkspacePath: '',
            creating: false,
            statusTimer: null,
        };
    },
    computed: {
        localRobotId() {
            return localRobotId();
        },
        filteredWorkspaces() {
            const q = this.search.trim().toLowerCase();
            if (!q) return this.workspaces;
            return this.workspaces.map(ws => ({
                ...ws,
                sessions: ws.sessions.filter(s => (s.name || '').toLowerCase().includes(q) || (ws.name || '').toLowerCase().includes(q)),
            })).filter(ws => ws.sessions.length || (ws.name || '').toLowerCase().includes(q));
        },
        selectedSession() {
            for (const ws of this.workspaces) {
                const s = ws.sessions.find(x => x.groupId === this.selectedGroupId);
                if (s) return s;
            }
            return null;
        },
        selectedConversation() {
            return this.selectedSession ? this.selectedSession.conversation : null;
        },
        selectedWorkspaceName() {
            for (const ws of this.workspaces) {
                if (ws.sessions.some(s => s.groupId === this.selectedGroupId)) return ws.name;
            }
            return '';
        },
        selectedRobots() {
            const s = this.selectedSession;
            if (!s || !s.robots) return [];
            return s.robots;
        },
    },
    created() {
        window.addEventListener('dsh-provision-updated', this.load);
        try { wfc.eventEmitter.on('groupInfosUpdate', this.load); } catch (e) { /* ignore */ }
    },
    mounted() {
        this.loadPaths().then(() => this.load());
        this.statusTimer = setInterval(async () => {
            try { this.hostStatus = (await getDshStatus()) || {}; } catch (e) { /* ignore */ }
        }, 4000);
    },
    activated() {
        this.loadPaths().then(() => this.load());
    },
    beforeUnmount() {
        if (this.statusTimer) clearInterval(this.statusTimer);
        window.removeEventListener('dsh-provision-updated', this.load);
        try { wfc.eventEmitter.off('groupInfosUpdate', this.load); } catch (e) { /* ignore */ }
    },
    methods: {
        async loadPaths() {
            try { this.workspacePaths = (await getDshWorkspaces()) || {}; } catch (e) { this.workspacePaths = {}; }
        },
        async load() {
            const robotId = this.localRobotId;
            if (!robotId) { this.workspaces = []; return; }
            let list = [];
            try { list = wfc.getConversationList([1], [2]) || []; } catch (e) { list = []; }
            const byWs = new Map();
            for (const info of list) {
                const conv = info && info.conversation;
                if (!conv || conv.type !== 1 || conv.line !== 2) continue;
                let groupInfo = null;
                try { groupInfo = wfc.getGroupInfo(conv.target, true); } catch (e) { groupInfo = null; }
                let extra = null;
                try { extra = groupInfo && groupInfo.extra ? JSON.parse(groupInfo.extra) : null; } catch (e) { extra = null; }
                const wfds = (extra && extra.wfds) || {};
                const section = wfds.robots ? wfds.robots[robotId] : null;
                const mappedPath = this.workspacePaths[`wildfire:group:${conv.target}`] || '';
                // 目录映射优先：同一目录的多个群一定归到同一工作区；
                // 群 extra 同步有延迟时也不会先掉进“未归类”。
                const key = mappedPath ? `path:${mappedPath}` : (section && section.workspaceId ? section.workspaceId : '__shared__');
                const name = section && section.workspaceName
                    ? section.workspaceName
                    : (mappedPath ? mappedPath.split(/[\\/]/).filter(Boolean).pop() || mappedPath : '未归类');
                if (!byWs.has(key)) byWs.set(key, { key, name, path: mappedPath, sessions: [] });
                if (mappedPath && !byWs.get(key).path) byWs.get(key).path = mappedPath;
                const robots = Object.keys(wfds.robots || {}).map(id => ({
                    robotId: id,
                    local: id === robotId,
                }));
                const last = info.lastMessage;
                let preview = '';
                try { preview = last && last.messageContent ? last.messageContent.digest(last) : ''; } catch (e) { preview = ''; }
                byWs.get(key).sessions.push({
                    groupId: conv.target,
                    name: (groupInfo && groupInfo.name) || conv.target,
                    conversation: conv,
                    preview,
                    time: info._timeStr || '',
                    unread: info._unread || 0,
                    robots,
                    path: this.workspacePaths[`wildfire:group:${conv.target}`] || '',
                    state: this.states[conv.target] || null,
                });
            }
            this.workspaces = [...byWs.values()];
            await this.refreshStates();
            const wanted = (this.$route && this.$route.query && this.$route.query.session) || this.selectedGroupId;
            let target = null;
            for (const ws of this.workspaces) {
                target = ws.sessions.find(s => s.groupId === wanted) || target;
            }
            if (!target) {
                const first = this.workspaces.find(ws => ws.sessions.length);
                target = first ? first.sessions[0] : null;
            }
            if (target) this.selectSession(target, false);
            else this.selectedGroupId = '';
        },
        async refreshStates() {
            const entries = this.workspaces.flatMap(ws => ws.sessions);
            await Promise.all(entries.map(async s => {
                try { this.states[s.groupId] = await getAgentState(s.conversation); } catch (e) { this.states[s.groupId] = null; }
                s.state = this.states[s.groupId];
            }));
        },
        selectSession(s, updateRoute = true) {
            if (!s) return;
            this.selectedGroupId = s.groupId;
            this.selectedRobotId = this.localRobotId;
            store.setCurrentConversation(s.conversation);
            if (updateRoute && this.$route.path === '/home/dsh' && this.$route.query.session !== s.groupId) {
                this.$router.replace({ path: '/home/dsh', query: { session: s.groupId } }).catch(() => {});
            }
        },
        toggleWorkspace(key) {
            this.collapsed = { ...this.collapsed, [key]: !this.collapsed[key] };
        },
        openSettings() {
            this.$router.push('/home/ai');
        },
        shortId(id) {
            return id && id.length > 18 ? id.slice(0, 8) + '…' + id.slice(-6) : (id || '');
        },
        async sendControlCommand(text) {
            const robotId = this.localRobotId;
            if (!robotId) throw new Error('机器人未开通');
            const conv = new Conversation(0, robotId, 0);
            await new Promise((resolve, reject) => {
                wfc.sendConversationMessage(conv, new TextMessageContent(text), [], null, null,
                    () => resolve(), (e) => reject(e));
            });
        },
        async waitForNewGroup(before, expectedPath = '') {
            for (let i = 0; i < 15; i++) {
                await new Promise(r => setTimeout(r, 1000));
                await this.loadPaths();
                await this.load();
                const candidates = this.workspaces.flatMap(ws => ws.sessions).filter(s => !before.has(s.groupId));
                // 显式目录创建时，等 Host 的 workspace override 落盘后再选中；
                // 否则新群可能在 metadata 同步前短暂落到“未归类”。
                const found = expectedPath
                    ? (candidates.find(s => s.path === expectedPath) || (i >= 12 ? candidates[0] : null))
                    : candidates[0];
                if (found) {
                    this.selectSession(found);
                    return found;
                }
            }
            return null;
        },
        async pickDirectory() {
            const result = await pickDshDirectory();
            if (result && result.ok && result.path) this.newWorkspacePath = result.path;
        },
        async createWorkspace() {
            if (this.creating) return;
            this.creating = true;
            const before = new Set(this.workspaces.flatMap(ws => ws.sessions.map(s => s.groupId)));
            try {
                const path = this.newWorkspacePath || 'auto';
                await this.sendControlCommand(`/create ${path}`);
                this.showCreate = false;
                this.newWorkspacePath = '';
                const found = await this.waitForNewGroup(before, path === 'auto' ? '' : path);
                if (found) this.$notify({ title: '工作区已创建', type: 'success' });
                else this.$notify({ title: '未检测到新工作区', text: '创建请求已发送，请打开机器人单聊查看结果（目录无效/等待确认时会提示）。', type: 'info' });
            } catch (e) {
                this.$notify({ title: '创建工作区失败', text: (e && e.message) || '请确认机器人在线', type: 'error' });
            } finally {
                this.creating = false;
            }
        },
        async createSession(ws) {
            if (this.creating) return;
            let path = ws.path || (ws.sessions[0] && ws.sessions[0].path) || '';
            if (!path && ws.sessions[0]) {
                const panel = getAgentPanelDataFor(ws.sessions[0].conversation, this.localRobotId);
                path = (panel && panel.cwd) || '';
            }
            if (!path) path = 'auto';
            this.creating = true;
            const before = new Set(this.workspaces.flatMap(w => w.sessions.map(s => s.groupId)));
            try {
                await this.sendControlCommand(`/create ${path}`);
                const found = await this.waitForNewGroup(before, path === 'auto' ? '' : path);
                if (found) this.$notify({ title: '会话已创建', type: 'success' });
                else this.$notify({ title: '未检测到新会话', text: '创建请求已发送，请打开机器人单聊查看结果（目录无效/等待确认时会提示）。', type: 'info' });
            } catch (e) {
                this.$notify({ title: '创建会话失败', text: (e && e.message) || '请确认机器人在线', type: 'error' });
            } finally {
                this.creating = false;
            }
        },
    },
};
</script>

<style scoped>
.dsh-workspace-page { flex: 1; width: 100%; min-width: 0; height: 100%; display: flex; flex-direction: column; background: var(--background-primary, #fff); overflow: hidden; }
.dsh-sidebar-head { flex: 0 0 56px; height: 56px; display: flex; align-items: center; justify-content: space-between; padding: 0 10px 0 14px; border-bottom: 1px solid var(--border-separator, #eceef1); box-sizing: border-box; }
.dsh-sidebar-brand { display: flex; align-items: center; gap: 8px; min-width: 0; }
.dsh-brand-dot { width: 7px; height: 7px; border-radius: 50%; background: #b0b5bd; flex: 0 0 auto; }
.dsh-brand-dot.online { background: #1a7f37; box-shadow: 0 0 0 3px #e7f7ed; }
.dsh-sidebar-brand h1 { margin: 0; font-size: 14px; font-weight: 650; white-space: nowrap; }
.dsh-sidebar-brand p { margin: 2px 0 0; font-size: 9px; color: var(--text-secondary, #8a8f99); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dsh-sidebar-actions { display: flex; align-items: center; gap: 2px; flex: 0 0 auto; }
.dsh-sidebar-btn { width: 22px; height: 22px; border: 0; background: transparent; border-radius: 5px; color: #6b7280; cursor: pointer; font-size: 14px; line-height: 1; }
.dsh-sidebar-btn:hover { background: #eef1f5; color: #1d4ed8; }
.dsh-sidebar-btn:disabled { opacity: .45; cursor: default; }
.dsh-workspace-main { flex: 1; min-height: 0; display: flex; }
.dsh-session-column { flex: 0 0 var(--list-panel-width); width: var(--list-panel-width); min-width: var(--list-panel-width); max-width: var(--list-panel-width); display: flex; flex-direction: column; border-right: 1px solid var(--border-separator, #eceef1); background: #fafbfc; box-sizing: border-box; }
.dsh-session-search { padding: 10px 10px 6px; }
.dsh-session-search input { width: 100%; box-sizing: border-box; border: 1px solid #e1e4e8; border-radius: 7px; background: #fff; padding: 7px 9px; font-size: 12px; outline: none; }
.dsh-session-scroll { flex: 1; overflow-y: auto; padding: 4px 6px 20px; }
.dsh-list-empty { padding: 40px 16px; text-align: center; color: #8a8f99; font-size: 12px; }
.dsh-list-empty strong { display: block; color: #4b5563; margin-bottom: 6px; }
.dsh-list-empty p { margin: 0 0 12px; line-height: 1.5; }
.dsh-ws-block { margin-bottom: 8px; }
.dsh-ws-head { display: flex; align-items: center; justify-content: space-between; padding: 5px 4px; }
.dsh-ws-toggle { display: flex; align-items: center; gap: 5px; min-width: 0; border: 0; background: transparent; color: #6b7280; font-size: 11px; font-weight: 650; cursor: pointer; padding: 0; }
.dsh-caret { width: 12px; display: inline-block; transition: transform .15s; }
.dsh-caret.collapsed { transform: rotate(-90deg); }
.dsh-ws-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsh-ws-count { color: #a0a5ad; font-weight: 400; }
.dsh-ws-add { border: 0; background: transparent; color: #8a8f99; font-size: 15px; cursor: pointer; padding: 0 4px; }
.dsh-session-list { display: flex; flex-direction: column; gap: 2px; }
.dsh-session-row { width: 100%; display: flex; align-items: center; gap: 7px; border: 0; border-radius: 7px; background: transparent; text-align: left; padding: 7px 7px; cursor: pointer; color: inherit; }
.dsh-session-row:hover { background: #eef1f5; }
.dsh-session-row.active { background: #e8f1ff; }
.dsh-session-status { width: 6px; height: 6px; border-radius: 50%; background: #b0b5bd; flex: 0 0 auto; }
.dsh-session-status.state-running { background: #1a7f37; }
.dsh-session-status.state-waiting_user { background: #d97706; }
.dsh-session-status.state-error { background: #b42318; }
.dsh-session-content { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 2px; }
.dsh-session-name { font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsh-session-preview { font-size: 10px; color: #9aa0a8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsh-session-side { flex: 0 0 auto; display: flex; flex-direction: column; align-items: flex-end; gap: 3px; }
.dsh-session-time { font-size: 9px; color: #a0a5ad; }
.dsh-session-unread { min-width: 14px; height: 14px; padding: 0 4px; border-radius: 999px; background: #e5484d; color: #fff; font-size: 9px; line-height: 14px; text-align: center; }
.dsh-chat-column { flex: 1; min-width: 0; display: flex; flex-direction: column; background: #fff; }
.dsh-detail-toggle { width: 26px; height: 24px; border: 1px solid #e1e4e8; border-radius: 5px; background: #fff; color: #6b7280; cursor: pointer; font-size: 14px; line-height: 1; }
.dsh-detail-toggle:hover { color: #1d4ed8; border-color: #b8c9f5; background: #eef4ff; }
.dsh-embedded-chat { flex: 1; min-height: 0; }
.dsh-embedded-chat :deep(.conversation-container) { height: 100%; }
.dsh-chat-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #8a8f99; gap: 8px; position: relative; }
.dsh-chat-empty-top { position: absolute; top: 0; left: 0; right: 0; height: 56px; display: flex; align-items: center; justify-content: space-between; padding: 0 12px 0 16px; border-bottom: 1px solid #f0f1f3; box-sizing: border-box; color: #4b5563; font-size: 13px; font-weight: 600; }
.dsh-chat-empty-icon { font-size: 34px; color: #c7ccd3; }
.dsh-chat-empty h2 { margin: 0; font-size: 15px; color: #4b5563; }
.dsh-chat-empty p { margin: 0 0 8px; font-size: 12px; }
.dsh-modal-mask { position: fixed; inset: 0; background: rgba(15, 23, 42, .28); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.dsh-modal { width: 460px; max-width: calc(100vw - 40px); background: #fff; border-radius: 12px; padding: 20px; box-shadow: 0 20px 60px rgba(15, 23, 42, .2); box-sizing: border-box; }
.dsh-modal h2 { margin: 0 0 6px; font-size: 17px; }
.dsh-modal-hint { margin: 0 0 14px; color: #6b7280; font-size: 12px; line-height: 1.5; }
.dsh-field { display: flex; flex-direction: column; gap: 5px; margin-bottom: 12px; font-size: 12px; color: #4b5563; }
.dsh-field input { border: 1px solid #dfe3e8; border-radius: 7px; padding: 8px 9px; font-size: 12px; outline: none; }
.dsh-path-row { display: flex; gap: 6px; }
.dsh-path-row input { flex: 1; min-width: 0; }
.dsh-field input:focus { border-color: #1d4ed8; }
.dsh-modal-tip { font-size: 11px; color: #9aa0a8; margin: -4px 0 14px; }
.dsh-modal-actions { display: flex; justify-content: flex-end; gap: 8px; }
@media (max-width: 900px) {
    .dsh-session-column { flex-basis: var(--list-panel-width); min-width: var(--list-panel-width); }
}
</style>
