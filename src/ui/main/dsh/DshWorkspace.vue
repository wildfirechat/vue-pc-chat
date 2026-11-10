<template>
    <section class="dsh-workspace-page" :class="{ 'with-window-controls': reserveWindowControls }" :style="{ '--dsh-sidebar-width': sidebarWidth + 'px' }">
        <div class="dsh-workspace-main">
            <aside class="dsh-session-column" v-show="!sidebarCollapsed">
                <div class="dsh-sidebar-head">
                    <div class="dsh-sidebar-brand">
                        <span class="dsh-brand-dot" :class="{online: hostStatus.state === 'running'}"></span>
                        <div>
                            <h1>DSH 助手</h1>
                            <p>工作区 / 会话 · 本机 Agent</p>
                        </div>
                    </div>
                    <button class="dsh-sidebar-collapse" title="收起侧边栏" @click="collapseSidebar">
                        <i class="icon-ion-ios-arrow-back"></i>
                    </button>
                </div>
                <button class="dsh-new-session" :disabled="creating" @click="newSessionCurrent">
                    <i class="icon-ion-android-add"></i><span>新会话</span>
                </button>
                <div class="dsh-ws-section-head">
                    <span>工作区</span>
                    <div class="dsh-ws-section-actions">
                        <button class="dsh-sidebar-btn" title="搜索" @click="showSearch = !showSearch"><i class="icon-ion-ios-search"></i></button>
                        <button class="dsh-sidebar-btn" :class="{active: filterMode !== 'all'}" :title="'筛选：' + filterLabel" @click="cycleFilter"><i class="icon-ion-android-funnel"></i></button>
                        <button class="dsh-sidebar-btn" :title="'排序：' + (sortMode === 'name' ? '名称' : '最近')" @click="cycleSort"><i class="icon-ion-arrow-swap"></i></button>
                        <button class="dsh-sidebar-btn" title="新建工作区" :disabled="creating" @click="showCreate = true"><i class="icon-ion-android-add"></i></button>
                    </div>
                </div>
                <div v-if="showSearch" class="dsh-session-search">
                    <input v-model="search" type="search" placeholder="搜索工作区 / 会话" autofocus/>
                </div>
                <div class="dsh-session-scroll">
                    <div v-if="!filteredWorkspaces.length" class="dsh-list-empty">
                        <strong>还没有工作区</strong>
                        <p>新建工作区后，机器人会创建第一个会话。</p>
                        <button class="dsh-top-btn" @click="showCreate = true">新建工作区</button>
                    </div>
                    <div v-for="ws in filteredWorkspaces" :key="ws.key" class="dsh-ws-block">
                        <div class="dsh-ws-head" :class="{ 'menu-open': workspaceMenuKey === ws.key }">
                            <button class="dsh-ws-toggle" @click="toggleWorkspace(ws.key)">
                                <span class="dsh-ws-slot">
                                    <i class="icon-ion-folder dsh-ws-folder"></i>
                                    <i class="icon-ion-ios-arrow-forward dsh-ws-chevron" :class="{ open: expandedWorkspaceKey === ws.key }"></i>
                                </span>
                                <span class="dsh-ws-name">{{ ws.name }}</span>
                            </button>
                            <div class="dsh-row-actions">
                                <button class="dsh-row-action" title="更多" @click.stop="workspaceMore(ws)">
                                    <i class="icon-ion-android-more-horizontal"></i>
                                </button>
                            </div>
                            <div v-if="workspaceMenuKey === ws.key" class="dsh-row-menu" @click.stop>
                                <button @click="workspaceMenuKey = ''; openDraft(ws)">新建会话</button>
                                <button v-if="ws.path" @click="workspaceMenuKey = ''; renameWorkspace(ws)">重命名工作区</button>
                                <button v-if="ws.path" @click="workspaceMenuKey = ''; openWorkspaceDir(ws)">打开工作目录</button>
                            </div>
                        </div>
                        <div v-if="expandedWorkspaceKey === ws.key" class="dsh-session-list">
                            <div v-for="s in ws.sessions" :key="s.groupId"
                                    class="dsh-session-row" :class="{active: selectedGroupId === s.groupId, 'menu-open': sessionMenuId === s.groupId}"
                                    role="button" tabindex="0"
                                    @click="selectSession(s)"
                                    @keyup.enter="selectSession(s)">
                                <span class="dsh-session-status">
                                    <span v-if="isRunning(s)" class="dsh-session-running" title="执行中"></span>
                                </span>
                                <span class="dsh-session-name">{{ s.name }}<span v-if="s.robots && s.robots.length > 1" class="dsh-multi-badge">{{ s.robots.length }}B</span></span>
                                <span class="dsh-session-side">
                                    <span v-if="s.unread" class="dsh-session-unread">{{ s.unread > 99 ? '99+' : s.unread }}</span>
                                    <span v-else class="dsh-session-time">{{ sessionTimeText(s) }}</span>
                                </span>
                                <div class="dsh-row-actions">
                                    <button class="dsh-row-action" title="更多" @click.stop="sessionMore(s)">
                                        <i class="icon-ion-android-more-horizontal"></i>
                                    </button>
                                </div>
                                <div v-if="sessionMenuId === s.groupId" class="dsh-row-menu" @click.stop>
                                    <button @click="renameSession(s)">重命名</button>
                                    <button @click="openSessionInIm(s)">在消息中打开</button>
                                    <button @click="copySessionId(s)">复制群 ID</button>
                                    <div class="dsh-row-menu-sep"></div>
                                    <button class="danger" @click="deleteSession(s)">删除</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="dsh-sidebar-foot">
                    <button class="dsh-settings-entry" @click="openSettings">
                        <i class="icon-ion-android-settings"></i><span>设置</span>
                    </button>
                </div>
            </aside>

            <div v-if="!sidebarCollapsed" class="dsh-splitter" :class="{ dragging: resizingSidebar }"
                 title="拖动调整侧边栏宽度" @mousedown.prevent="startSidebarResize"></div>

            <main class="dsh-chat-column">
                <div v-if="draft" class="dsh-draft">
                    <div class="dsh-chat-empty-top">
                        <div class="dsh-chat-empty-top-left">
                            <button v-if="sidebarCollapsed" class="dsh-sidebar-expand" title="展开侧边栏" @click="expandSidebar">
                                <i class="icon-ion-ios-arrow-forward"></i>
                            </button>
                            <span>新会话</span>
                        </div>
                        <span class="dsh-empty-status">{{ draft.submitting ? '正在创建会话…' : (hostStatus.state === 'running' ? '发送后才会创建会话' : 'Agent 未启动') }}</span>
                    </div>
                    <div class="dsh-draft-body">
                        <div class="dsh-draft-hero">
                            <div class="dsh-empty-hint-mark">✦</div>
                            <h2>开始一个新会话</h2>
                            <p>描述你的问题或需求。发送后会创建会话并把内容交给 Agent，标题由内容自动整理。</p>
                        </div>
                        <div class="dsh-draft-composer">
                            <textarea ref="draftInput" v-model="draft.text" :disabled="draft.submitting"
                                      class="dsh-draft-input" rows="4"
                                      placeholder="例如：检查登录接口的报错日志并修复"
                                      @keydown="onDraftKeydown"></textarea>
                            <div class="dsh-draft-toolbar">
                                <div class="dsh-draft-tools-left">
                                    <div class="dsh-chip-wrap">
                                        <button class="dsh-chip" title="新会话所在的工作区" @click.stop="toggleDraftMenu('workspace')">
                                            <i class="icon-ion-folder"></i>
                                            <span>{{ draftWorkspaceLabel }}</span>
                                            <i class="icon-ion-chevron-down dsh-chip-caret"></i>
                                        </button>
                                        <div v-if="draftMenu === 'workspace'" class="dsh-pop" @click.stop>
                                            <button class="dsh-pop-item" :class="{active: !draft.workspaceKey && !draft.pendingPath}"
                                                    @click="pickDraftWorkspace('')">
                                                <span>自动分配新目录</span>
                                                <i v-if="!draft.workspaceKey && !draft.pendingPath" class="icon-ion-checkmark"></i>
                                            </button>
                                            <button v-for="ws in workspaces" :key="ws.key" class="dsh-pop-item"
                                                    :class="{active: draft.workspaceKey === ws.key}"
                                                    @click="pickDraftWorkspace(ws.key)">
                                                <span>{{ ws.name }}</span>
                                                <i v-if="draft.workspaceKey === ws.key" class="icon-ion-checkmark"></i>
                                            </button>
                                            <div class="dsh-pop-sep"></div>
                                            <button class="dsh-pop-item" @click="openNewWorkspaceFromDraft">
                                                <span>＋ 新建工作区…</span>
                                            </button>
                                        </div>
                                    </div>
                                    <div class="dsh-chip-wrap">
                                        <button class="dsh-chip" :disabled="!draftPresetOptions.length"
                                                :title="draftPresetOptions.length ? 'Agent 预设（能力档位）' : '当前 profile 未启用 agent preset 模式，暂不可选'"
                                                @click.stop="draftPresetOptions.length && toggleDraftMenu('preset')">
                                            <i class="icon-ion-cube"></i>
                                            <span>{{ draftPresetLabel }}</span>
                                            <i class="icon-ion-chevron-down dsh-chip-caret"></i>
                                        </button>
                                        <div v-if="draftMenu === 'preset'" class="dsh-pop" @click.stop>
                                            <button v-for="p in draftPresetOptions" :key="p.value" class="dsh-pop-item"
                                                    :class="{active: draft.preset === p.value}"
                                                    @click="pickDraftPreset(p.value)">
                                                <span>{{ p.label }}</span>
                                                <i v-if="draft.preset === p.value" class="icon-ion-checkmark"></i>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <div class="dsh-draft-tools-right">
                                    <div class="dsh-chip-wrap">
                                        <button class="dsh-chip" title="沙箱权限；与权限预设同名时同时对齐审批策略"
                                                @click.stop="toggleDraftMenu('permission')">
                                            <i class="icon-ion-android-lock"></i>
                                            <span>{{ draftPermissionLabel }}</span>
                                            <i class="icon-ion-chevron-down dsh-chip-caret"></i>
                                        </button>
                                        <div v-if="draftMenu === 'permission'" class="dsh-pop dsh-pop-right" @click.stop>
                                            <button v-for="s in sandboxOptions" :key="s.value" class="dsh-pop-item"
                                                    :class="{active: draft.sandbox === s.value}"
                                                    @click="pickDraftPermission(s.value)">
                                                <span>{{ s.label }}</span>
                                                <i v-if="draft.sandbox === s.value" class="icon-ion-checkmark"></i>
                                            </button>
                                        </div>
                                    </div>
                                    <div class="dsh-chip-wrap">
                                        <button class="dsh-chip dsh-chip-model" :disabled="!draftModelOptions.length"
                                                title="模型与思考等级" @click.stop="toggleDraftMenu('model')">
                                            <span>{{ draftModelLabel }}</span>
                                            <i class="icon-ion-chevron-down dsh-chip-caret"></i>
                                        </button>
                                        <div v-if="draftMenu === 'model'" class="dsh-pop dsh-pop-right dsh-pop-model" @click.stop>
                                            <div class="dsh-pop-title">模型</div>
                                            <button v-for="m in draftModelOptions" :key="m.value" class="dsh-pop-item"
                                                    :class="{active: draft.model === m.value}" @click="pickDraftModel(m.value)">
                                                <span>{{ m.label }}</span>
                                                <i v-if="draft.model === m.value" class="icon-ion-checkmark"></i>
                                            </button>
                                            <div class="dsh-pop-sep"></div>
                                            <div class="dsh-pop-title">思考等级</div>
                                            <button v-for="e in draftEffortOptions" :key="e" class="dsh-pop-item"
                                                    :class="{active: draft.effort === e}" @click="pickDraftEffort(e)">
                                                <span>{{ effortLabel(e) }}</span>
                                                <i v-if="draft.effort === e" class="icon-ion-checkmark"></i>
                                            </button>
                                            <p v-if="!draftEffortOptions.length" class="dsh-pop-empty">当前模型未声明思考等级</p>
                                        </div>
                                    </div>
                                    <button class="dsh-send-btn" :disabled="draft.submitting || !draft.text.trim()"
                                            :title="draft.submitting ? '正在创建会话…' : '发送（Enter）'" @click="submitDraft">
                                        <i v-if="!draft.submitting" class="icon-ion-ios-arrow-up"></i>
                                        <span v-else class="dsh-send-spinner"></span>
                                    </button>
                                </div>
                            </div>
                        </div>
                        <button class="dsh-draft-cancel" :disabled="draft.submitting" @click="closeDraft">取消</button>
                    </div>
                </div>
                <template v-else-if="selectedSession">
                    <ConversationView class="dsh-embedded-chat" :dsh-mode="true"
                                      :dsh-sidebar-collapsed="sidebarCollapsed"
                                      @toggle-dsh-file="showFilePreviewer = !showFilePreviewer"
                                      @expand-dsh-sidebar="expandSidebar"/>
                </template>
                <div v-else class="dsh-chat-empty">
                    <div class="dsh-chat-empty-top">
                        <div class="dsh-chat-empty-top-left">
                            <button v-if="sidebarCollapsed" class="dsh-sidebar-expand" title="展开侧边栏" @click="expandSidebar">
                                <i class="icon-ion-ios-arrow-forward"></i>
                            </button>
                            <span>DSH 工作区</span>
                        </div>
                        <span class="dsh-empty-status">{{ hostStatus.state === 'running' ? 'Agent 已就绪' : 'Agent 未启动' }}</span>
                    </div>
                    <div class="dsh-empty-hint">
                        <div class="dsh-empty-hint-mark">◈</div>
                        <h2>创建工作区或选择一个会话</h2>
                        <p>从左侧新建工作区，或点击已有会话开始。</p>
                        <button class="dsh-top-btn" @click="openDraft(currentWorkspace)">新会话</button>
                    </div>
                </div>
            </main>

            <DshFilePreviewer v-if="selectedSession && showFilePreviewer"
                              :conversation="selectedConversation"
                              :robot-id="selectedRobotId"
                              :session-path="selectedWorkspacePath"
                              @close="showFilePreviewer = false"/>
        </div>

        <div v-if="showCreate" class="dsh-modal-mask" @click.self="showCreate = false">
            <div class="dsh-modal">
                <h2>新建工作区</h2>
                <p class="dsh-modal-hint">工作区是一个本地目录。确认后会进入新会话页，输入第一条消息才真正创建会话。</p>
                <label class="dsh-field">
                    <span>工作区名称（可选）</span>
                    <input v-model.trim="newWorkspaceName" placeholder="例如：登录修复"/>
                </label>
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
                    <button class="dsh-top-btn" :disabled="!canCreate" @click="createWorkspace">
                        下一步：新会话
                    </button>
                </div>
            </div>
        </div>
    </section>
</template>

<script>
import ConversationView from '../conversation/ConversationView.vue';
import EventType from '../../../wfc/client/wfcEvent';
import TextMessageContent from '../../../wfc/messages/textMessageContent';
import DshFilePreviewer from './DshFilePreviewer.vue';
import store from '../../../store';
import wfc from '../../../wfc/client/wfc';
import Conversation from '../../../wfc/model/conversation';
import ModifyGroupInfoType from '../../../wfc/model/modifyGroupInfoType';
import AgentCommandMessageContent from '../../../wfc/messages/agentCommandMessageContent';
import ConnectionStatus from '../../../wfc/client/connectionStatus';
import { getDshStatus, getDshWorkspaces, openDshPath, pickDshDirectory, generateDshTitle, getDshModelCatalog } from '../../../dsh/renderer/dshClient';
import { dshState, localRobotId } from '../../../dsh/renderer/state';
import { getAgentPanelDataFor, getAgentState } from '../../util/agentState';

export default {
    name: 'DshWorkspace',
    components: { ConversationView, DshFilePreviewer },
    data() {
        return {
            hostStatus: {},
            search: '',
            workspaces: [],
            workspacePaths: {},
            workspaceAliases: {},
            lastRobotId: '',
            selectedGroupId: '',
            selectedRobotId: '',
            showFilePreviewer: false,
            expandedWorkspaceKey: '',
            showSearch: false,
            filterMode: 'all',
            states: {},
            showCreate: false,
            newWorkspacePath: '',
            newWorkspaceName: '',
            draft: null,
            draftMenu: '',
            draftCatalog: [],
            draftPresets: [],
            sandboxOptions: [
                { value: 'workspace-write', label: '工作区可写' },
                { value: 'read-only', label: '只读' },
                { value: 'danger-full-access', label: '完全访问' },
            ],
            sessionMenuId: '',
            workspaceMenuKey: '',
            autoTitled: {},
            autoTitlePending: {},
            autoTitleSeq: {},
            stateRefreshTimer: null,
            receiveRefreshTimer: null,
            nowTick: Date.now(),
            nowTimer: null,
            sidebarWidth: 300,
            sidebarCollapsed: false,
            resizingSidebar: false,
            resizeStartX: 0,
            resizeStartWidth: 300,
            sortMode: 'recent',
            creating: false,
            statusTimer: null,
        };
    },
    computed: {
        reserveWindowControls() {
            // Windows/Linux 主窗口右上角是自绘的最小化/最大化/关闭按钮，页面顶部右侧的内容
            // （如新建会话/空状态的状态文字）需要让开，否则会显示在按钮下面。
            const misc = store.state.misc;
            return !!(misc.isElectron && (misc.isElectronWindowsOrLinux || misc.isOhos));
        },
        localRobotId() {
            return localRobotId();
        },
        filteredWorkspaces() {
            const q = this.search.trim().toLowerCase();
            return this.workspaces.map(ws => {
                let sessions = ws.sessions;
                if (this.filterMode === 'unread') sessions = sessions.filter(s => s.unread > 0);
                if (this.filterMode === 'running') sessions = sessions.filter(s => s.state && s.state.state === 'running');
                if (q) sessions = sessions.filter(s => (s.name || '').toLowerCase().includes(q) || (ws.name || '').toLowerCase().includes(q));
                return { ...ws, sessions };
            }).filter(ws => ws.sessions.length || (q && (ws.name || '').toLowerCase().includes(q)))
              .sort((a, b) => this.sortMode === 'name'
                  ? String(a.name).localeCompare(String(b.name), 'zh-CN')
                  : (b.sortAt || 0) - (a.sortAt || 0));
        },
        filterLabel() {
            return ({ all: '全部', unread: '未读', running: '运行中' })[this.filterMode] || '全部';
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
        draftPresetOptions() {
            return this.draftPresets.map(p => ({ value: p.value, label: p.label }));
        },
        draftWorkspaceLabel() {
            if (!this.draft) return '';
            if (this.draft.pendingPath) {
                if (this.draft.pendingName) return `新建：${this.draft.pendingName}`;
                if (this.draft.pendingPath === 'auto') return '新建工作区（自动目录）';
                const parts = String(this.draft.pendingPath).split(/[\\/]/).filter(Boolean);
                return `新建：${parts[parts.length - 1] || this.draft.pendingPath}`;
            }
            const ws = this.workspaces.find(w => w.key === this.draft.workspaceKey);
            return ws ? ws.name : '自动分配';
        },
        draftPermissionLabel() {
            const value = this.draft ? this.draft.sandbox : '';
            const hit = this.sandboxOptions.find(o => o.value === value);
            return hit ? hit.label : '权限';
        },
        draftModelLabel() {
            const draft = this.draft;
            if (!draft) return '';
            const model = this.draftCatalog.find(m => `${m.provider}/${m.id}` === draft.model);
            if (!model) return '模型';
            const name = String(model.name || model.id);
            return draft.effort ? `${name} · ${this.effortShort(draft.effort)}` : name;
        },
        draftPresetLabel() {
            const value = this.draft ? this.draft.preset : '';
            const hit = this.draftPresetOptions.find(p => p.value === value);
            return hit ? hit.label : 'Agent 预设';
        },
        draftModelOptions() {
            return this.draftCatalog.map(m => ({
                value: `${m.provider}/${m.id}`,
                label: this.modelOptionLabel(m),
            }));
        },
        draftEffortOptions() {
            if (!this.draft) return [];
            const selected = this.draftCatalog.find(m => `${m.provider}/${m.id}` === this.draft.model);
            return selected && Array.isArray(selected.efforts) ? selected.efforts : [];
        },
        selectedWorkspacePath() {
            if (this.selectedSession && this.selectedSession.path) return this.selectedSession.path;
            const ws = this.currentWorkspace;
            if (ws && ws.path) return ws.path;
            return (this.hostStatus && this.hostStatus.permissions && this.hostStatus.permissions.workspaceRoot) || '';
        },
        currentWorkspace() {
            if (this.selectedSession) {
                return this.workspaces.find(ws => ws.sessions.some(s => s.groupId === this.selectedGroupId)) || null;
            }
            return this.workspaces.find(ws => ws.key === this.expandedWorkspaceKey) || null;
        },
        imConnected() {
            return wfc.getConnectionStatus() === ConnectionStatus.ConnectionStatusConnected
                || wfc.getConnectionStatus() === ConnectionStatus.ConnectionStatusReceiveing;
        },
        gatewayState() {
            const g = (this.hostStatus && this.hostStatus.gateway) || {};
            return g.connected ? 'connected' : (g.state || 'unknown');
        },
        canCreate() {
            return !!this.localRobotId
                && this.imConnected
                && this.hostStatus.state === 'running'
                && this.gatewayState !== 'disconnected';
        },
    },
    created() {
        this.workspaceAliases = this.loadWorkspaceAliases();
        this.autoTitled = this.loadAutoTitled();
        this.loadSidebarState();
        this.nowTimer = setInterval(() => { this.nowTick = Date.now(); }, 30000);
        wfc.eventEmitter.on(EventType.SendMessage, this.onDshMessageSent);
        wfc.eventEmitter.on(EventType.ConversationInfoUpdate, this.onDshConversationInfoUpdate);
        wfc.eventEmitter.on(EventType.ReceiveMessage, this.onDshReceiveMessage);
        wfc.eventEmitter.on(EventType.SettingUpdate, this.onDshSettingUpdate);
        window.addEventListener('dsh-provision-updated', this.load);
        try { wfc.eventEmitter.on('groupInfosUpdate', this.load); } catch (e) { /* ignore */ }
    },
    mounted() {
        this.loadPaths().then(() => this.load());
        document.addEventListener('click', this.closeRowMenus);
        document.addEventListener('click', this.closeDraftMenu);
        this.statusTimer = setInterval(async () => {
            try { this.hostStatus = (await getDshStatus()) || {}; } catch (e) { /* ignore */ }
            try { await this.refreshStates(); } catch (e) { /* ignore */ }
        }, 4000);
    },
    activated() {
        this.loadPaths().then(() => this.load());
    },
    beforeUnmount() {
        document.removeEventListener('click', this.closeRowMenus);
        document.removeEventListener('click', this.closeDraftMenu);
        wfc.eventEmitter.off(EventType.SendMessage, this.onDshMessageSent);
        wfc.eventEmitter.off(EventType.ConversationInfoUpdate, this.onDshConversationInfoUpdate);
        wfc.eventEmitter.off(EventType.ReceiveMessage, this.onDshReceiveMessage);
        wfc.eventEmitter.off(EventType.SettingUpdate, this.onDshSettingUpdate);
        if (this.statusTimer) clearInterval(this.statusTimer);
        if (this.stateRefreshTimer) clearTimeout(this.stateRefreshTimer);
        if (this.receiveRefreshTimer) clearTimeout(this.receiveRefreshTimer);
        if (this.nowTimer) clearInterval(this.nowTimer);
        if (this.resizingSidebar) {
            document.removeEventListener('mousemove', this.onSidebarResize);
            document.removeEventListener('mouseup', this.stopSidebarResize);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }
        window.removeEventListener('dsh-provision-updated', this.load);
        try { wfc.eventEmitter.off('groupInfosUpdate', this.load); } catch (e) { /* ignore */ }
    },
    methods: {
        async loadPaths() {
            try { this.workspacePaths = (await getDshWorkspaces()) || {}; } catch (e) { this.workspacePaths = {}; }
        },
        async load() {
            const robotId = this.localRobotId;
            if (robotId !== this.lastRobotId) {
                this.lastRobotId = robotId;
                this.workspaces = [];
                this.selectedGroupId = '';
                this.selectedRobotId = '';
                this.expandedWorkspaceKey = '';
                this.draft = null;
                store.setCurrentConversation(null);
            }
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
                const baseName = section && section.workspaceName
                    ? section.workspaceName
                    : (mappedPath ? mappedPath.split(/[\\/]/).filter(Boolean).pop() || mappedPath : '未归类');
                const name = (mappedPath && this.workspaceAliases[mappedPath]) || baseName;
                if (!byWs.has(key)) byWs.set(key, { key, name, path: mappedPath, sessions: [] });
                if (mappedPath && !byWs.get(key).path) byWs.get(key).path = mappedPath;
                const robots = Object.keys(wfds.robots || {}).map(id => ({
                    robotId: id,
                    local: id === robotId,
                }));
                const last = info.lastMessage;
                let preview = '';
                try { preview = last && last.messageContent ? last.messageContent.digest(last) : ''; } catch (e) { preview = ''; }
                const wsEntry = byWs.get(key);
                const sessionAt = Number(info.timestamp || 0);
                if (sessionAt > (wsEntry.sortAt || 0)) wsEntry.sortAt = sessionAt;
                const unread = this.unreadFor(conv, info);
                wsEntry.sessions.push({
                    groupId: conv.target,
                    name: (groupInfo && groupInfo.name) || conv.target,
                    conversation: conv,
                    preview,
                    time: info._timeStr || '',
                    sortAt: Number(info.timestamp || (last && last.timestamp) || 0),
                    unread,
                    robots,
                    path: this.workspacePaths[`wildfire:group:${conv.target}`] || '',
                    state: this.states[conv.target] || null,
                });
            }
            this.workspaces = [...byWs.values()];
            await this.refreshStates();
            const wanted = this.draft
                ? ''
                : ((this.$route && this.$route.query && this.$route.query.session) || this.selectedGroupId);
            let target = null;
            for (const ws of this.workspaces) {
                target = ws.sessions.find(s => s.groupId === wanted) || target;
            }
            if (!target) {
                // 首次进入不自动打开会话，显示“创建工作区或选择一个会话”提示。
                this.selectedGroupId = '';
                this.selectedRobotId = '';
            } else {
                this.selectSession(target, false);
            }
            const first = this.workspaces.find(ws => ws.sessions.length);
            if (!this.expandedWorkspaceKey && first) this.expandedWorkspaceKey = first.key;
            if (this.expandedWorkspaceKey && !this.workspaces.some(ws => ws.key === this.expandedWorkspaceKey)) {
                this.expandedWorkspaceKey = first ? first.key : '';
            }
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
            this.draft = null;
            this.selectedGroupId = s.groupId;
            this.selectedRobotId = this.localRobotId;
            this.sessionMenuId = '';
            this.workspaceMenuKey = '';
            const ws = this.workspaces.find(w => w.sessions.some(x => x.groupId === s.groupId));
            if (ws) this.expandedWorkspaceKey = ws.key;
            store.setCurrentConversation(s.conversation);
            if (updateRoute && this.$route.path === '/home/dsh' && this.$route.query.session !== s.groupId) {
                this.$router.replace({ path: '/home/dsh', query: { session: s.groupId } }).catch(() => {});
            }
        },
        toggleWorkspace(key) {
            this.expandedWorkspaceKey = this.expandedWorkspaceKey === key ? '' : key;
        },
        cycleFilter() {
            this.filterMode = this.filterMode === 'all' ? 'unread' : (this.filterMode === 'unread' ? 'running' : 'all');
        },
        cycleSort() {
            this.sortMode = this.sortMode === 'recent' ? 'name' : 'recent';
        },
        newSessionCurrent() {
            this.openDraft(this.currentWorkspace);
        },
        openDraft(ws) {
            this.sessionMenuId = '';
            this.workspaceMenuKey = '';
            this.showFilePreviewer = false;
            this.draftMenu = '';
            if (ws) this.expandedWorkspaceKey = ws.key;
            const perm = (this.hostStatus && this.hostStatus.permissions
                && this.hostStatus.permissions.sandbox) || 'workspace-write';
            this.draft = {
                text: '',
                workspaceKey: ws ? ws.key : '',
                submitting: false,
                // 模型/等级等默认值来自运行时目录（loadDraftCatalog），宿主未启动时留空
                model: '',
                effort: '',
                sandbox: perm,
                preset: '',
                // 新建工作区时暂存的目录/名称：输入第一条消息后才真正创建
                pendingPath: '',
                pendingName: '',
            };
            this.loadDraftCatalog();
            this.selectedGroupId = '';
            this.selectedRobotId = '';
            store.setCurrentConversation(null);
            // 草稿不属于任何会话：清掉路由里的 session，避免 load() 把旧会话重新选中。
            if (this.$route && this.$route.path === '/home/dsh' && this.$route.query.session) {
                this.$router.replace({ path: '/home/dsh' }).catch(() => {});
            }
            this.$nextTick(() => {
                if (this.$refs.draftInput) this.$refs.draftInput.focus();
            });
        },
        closeDraft() {
            if (this.draft && this.draft.submitting) return;
            this.draft = null;
            this.draftMenu = '';
        },
        onDraftKeydown(e) {
            if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return;
            e.preventDefault();
            this.submitDraft();
        },
        async loadDraftCatalog() {
            const catalog = await getDshModelCatalog();
            const models = Array.isArray(catalog) ? catalog : ((catalog && catalog.models) || []);
            const presets = Array.isArray(catalog) ? [] : ((catalog && catalog.presets) || []);
            const defaultPreset = Array.isArray(catalog) ? '' : ((catalog && catalog.defaultPreset) || '');
            this.draftCatalog = Array.isArray(models) ? models : [];
            this.draftPresets = Array.isArray(presets) ? presets : [];
            const draft = this.draft;
            if (!draft) return;
            if (!draft.preset) draft.preset = defaultPreset;
            if (draft.model) return;
            const def = this.draftCatalog.find(m => m.isDefault) || this.draftCatalog[0];
            if (def) {
                draft.model = `${def.provider}/${def.id}`;
                draft.effort = def.defaultEffort || (def.efforts && def.efforts[0]) || '';
            }
        },
        toggleDraftMenu(menu) {
            this.draftMenu = this.draftMenu === menu ? '' : menu;
        },
        closeDraftMenu() {
            this.draftMenu = '';
        },
        pickDraftWorkspace(key) {
            if (this.draft) {
                this.draft.workspaceKey = key;
                // 手动选了已有工作区/自动目录，就不再沿用“新建工作区”的暂存目录
                this.draft.pendingPath = '';
                this.draft.pendingName = '';
            }
            this.draftMenu = '';
        },
        openNewWorkspaceFromDraft() {
            this.draftMenu = '';
            this.newWorkspacePath = '';
            this.newWorkspaceName = '';
            this.showCreate = true;
        },
        pickDraftPreset(id) {
            if (this.draft) this.draft.preset = id;
            this.draftMenu = '';
        },
        pickDraftPermission(value) {
            if (this.draft) this.draft.sandbox = value;
            this.draftMenu = '';
        },
        pickDraftModel(value) {
            if (!this.draft) return;
            this.draft.model = value;
            this.onDraftModelChange();
            // 弹层不关闭：模型和思考等级在同一面板里分别设置
        },
        pickDraftEffort(level) {
            if (this.draft) this.draft.effort = level;
            this.draftMenu = '';
        },
        effortShort(level) {
            return ({
                minimal: '极低',
                low: '低',
                medium: '中',
                high: '高',
                xhigh: '很高',
                max: '最高',
            })[level] || level;
        },
        onDraftModelChange() {
            const draft = this.draft;
            if (!draft) return;
            const selected = this.draftCatalog.find(m => `${m.provider}/${m.id}` === draft.model);
            draft.effort = selected
                ? (selected.defaultEffort || (selected.efforts && selected.efforts[0]) || '')
                : '';
        },
        effortLabel(level) {
            const labels = {
                minimal: '极低（minimal）',
                low: '低（low）',
                medium: '中（medium）',
                high: '高（high）',
                xhigh: '很高（xhigh）',
                max: '最高（max）',
            };
            return labels[level] || level;
        },
        modelOptionLabel(model) {
            const base = model.provider === 'default'
                ? String(model.name || model.id)
                : `${model.name || model.id}（${model.provider}/${model.id}）`;
            return model.isDefault ? `${base} · 默认` : base;
        },
        async submitDraft() {
            const draft = this.draft;
            if (!draft || draft.submitting) return;
            const text = String(draft.text || '').trim();
            if (!text) {
                if (this.$refs.draftInput) this.$refs.draftInput.focus();
                return;
            }
            if (!this.ensureCreateReady()) return;
            this.draftMenu = '';
            const ws = this.workspaces.find(w => w.key === draft.workspaceKey) || null;
            let path = draft.pendingPath || '';
            if (!path && ws) {
                path = ws.path || (ws.sessions[0] && ws.sessions[0].path) || '';
                if (!path && ws.sessions[0]) {
                    const panel = getAgentPanelDataFor(ws.sessions[0].conversation, this.localRobotId);
                    path = (panel && panel.cwd) || '';
                }
            }
            if (!path) path = 'auto';
            draft.submitting = true;
            const before = new Set(this.workspaces.flatMap(w => w.sessions.map(s => s.groupId)));
            try {
                await this.sendCreateCommand(path, this.fallbackTitle(text) || '新会话', {
                    model: draft.model,
                    effort: draft.effort,
                    sandbox: draft.sandbox,
                    preset: draft.preset,
                });
                const found = await this.waitForNewGroup(before, path === 'auto' ? '' : path);
                if (!found) {
                    draft.submitting = false;
                    this.$notify({ title: '未检测到新会话', text: '创建请求已发送，请打开机器人单聊查看结果（目录无效/等待确认时会提示）。', type: 'info' });
                    return;
                }
                // 新建工作区：把用户填的名称记为目录别名（同一目录下的会话共用）。
                const pendingName = String(draft.pendingName || '').trim();
                if (pendingName && found.path) {
                    this.workspaceAliases = { ...this.workspaceAliases, [found.path]: pendingName };
                    this.saveWorkspaceAliases();
                }
                // 把草稿内容作为第一条消息发给 Agent；waitForNewGroup 已选中新会话并清掉草稿。
                try {
                    await this.sendTextMessage(found.conversation, text);
                } catch (e) {
                    this.$notify({ title: '会话已创建，但首条消息发送失败', text: (e && e.message) || '请重新输入后发送', type: 'error' });
                    return;
                }
                // 兜底：即使没有收到发送回调，也按内容生成会话标题（已开始生成则跳过）。
                const groupId = found.conversation ? found.conversation.target : '';
                if (groupId && !this.autoTitled[groupId] && !this.autoTitlePending[groupId]) {
                    this.autoTitleGroup(groupId, text);
                }
            } catch (e) {
                if (this.draft) this.draft.submitting = false;
                this.$notify({ title: '创建会话失败', text: (e && e.message) || '请确认机器人在线', type: 'error' });
            }
        },
        sendTextMessage(conversation, text) {
            return new Promise((resolve, reject) => {
                wfc.sendConversationMessage(conversation, new TextMessageContent(text), [], null, null,
                    () => resolve(), (e) => reject(e));
            });
        },
        loadWorkspaceAliases() {
            try { return JSON.parse(localStorage.getItem('dsh-workspace-aliases') || '{}') || {}; } catch (e) { return {}; }
        },
        saveWorkspaceAliases() {
            try { localStorage.setItem('dsh-workspace-aliases', JSON.stringify(this.workspaceAliases)); } catch (e) { /* ignore */ }
        },
        async renameWorkspace(ws) {
            if (!ws || !ws.path) return;
            const name = window.prompt('工作区名称', ws.name || '');
            if (name === null || !name.trim() || name.trim() === ws.name) return;
            this.workspaceAliases = { ...this.workspaceAliases, [ws.path]: name.trim() };
            this.saveWorkspaceAliases();
            ws.name = name.trim();
        },
        openSettings() {
            this.$router.push('/home/ai');
        },
        shortId(id) {
            return id && id.length > 18 ? id.slice(0, 8) + '…' + id.slice(-6) : (id || '');
        },
        ensureCreateReady() {
            if (!this.localRobotId) {
                this.$notify({ title: '无法新建会话', text: '机器人尚未开通', type: 'error' });
                return false;
            }
            if (!this.imConnected) {
                this.$notify({ title: '无法新建会话', text: 'IM 未连接，请检查网络后重试', type: 'error' });
                return false;
            }
            if (this.hostStatus.state !== 'running') {
                this.$notify({ title: '无法新建会话', text: 'DSH Host 未运行，请先在设置页启动 Host', type: 'error' });
                return false;
            }
            if (this.gatewayState === 'disconnected') {
                this.$notify({ title: '无法新建会话', text: '机器人网关离线，请检查 Host 日志', type: 'error' });
                return false;
            }
            return true;
        },
        async sendCreateCommand(path, name, options = null) {
            const robotId = this.localRobotId;
            if (!robotId) throw new Error('机器人未开通');
            const conv = new Conversation(0, robotId, 0);
            const content = new AgentCommandMessageContent('create', undefined, Date.now(), robotId, undefined, path, name, options);
            await new Promise((resolve, reject) => {
                wfc.sendConversationMessage(conv, content, [], null, null,
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
        createWorkspace() {
            if (!this.ensureCreateReady()) return;
            const path = this.newWorkspacePath.trim() || 'auto';
            const name = this.newWorkspaceName.trim();
            this.showCreate = false;
            this.newWorkspacePath = '';
            this.newWorkspaceName = '';
            // 不立即建群：进入新会话页，等第一条消息再创建（和「新会话」一致）。
            if (!this.draft) this.openDraft(null);
            if (!this.draft) return;
            this.draft.pendingPath = path;
            this.draft.pendingName = name;
            this.draft.workspaceKey = '';
            this.$nextTick(() => {
                if (this.$refs.draftInput) this.$refs.draftInput.focus();
            });
        },
        async applyGroupName(s, name) {
            const clean = String(name || '').trim();
            if (!clean) return false;
            try {
                await this.modifyGroupName(s.groupId, clean);
                s.name = clean;
                return true;
            } catch (e) {
                this.$notify({ title: '会话重命名失败', text: (e && e.message) || '', type: 'error' });
                return false;
            }
        },
        modifyGroupName(groupId, name) {
            return new Promise((resolve, reject) => {
                wfc.modifyGroupInfo(groupId, ModifyGroupInfoType.Modify_Group_Name, name, [2], null,
                    () => resolve(), (e) => reject(e));
            });
        },
        loadAutoTitled() {
            try { return JSON.parse(localStorage.getItem('dsh-auto-titled-sessions') || '{}') || {}; } catch (e) { return {}; }
        },
        saveAutoTitled() {
            try { localStorage.setItem('dsh-auto-titled-sessions', JSON.stringify(this.autoTitled)); } catch (e) { /* ignore */ }
        },
        markAutoTitled(groupId) {
            if (!groupId) return;
            this.autoTitled[groupId] = true;
            this.saveAutoTitled();
        },
        cleanTitle(input) {
            return String(input || '')
                .replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/g, ' ')
                .replace(/\s+/g, ' ')
                .replace(/^["'`“”‘’]+|["'`“”‘’]+$/g, '')
                .trim();
        },
        truncateUtf8(input, maxBytes) {
            let out = '';
            let used = 0;
            for (const ch of String(input || '')) {
                const bytes = new TextEncoder().encode(ch).length;
                if (used + bytes > maxBytes) break;
                out += ch;
                used += bytes;
            }
            return out.trimEnd();
        },
        fallbackTitle(input) {
            const clean = this.cleanTitle(input);
            if (!clean) return '';
            return this.truncateUtf8(clean.split(' ').filter(Boolean).slice(0, 5).join(' '), 40);
        },
        loadSidebarState() {
            try {
                const saved = Number(localStorage.getItem('dsh-sidebar-width'));
                const maxWidth = this.sidebarMaxWidth();
                if (Number.isFinite(saved) && saved > 0) {
                    this.sidebarWidth = Math.max(220, Math.min(maxWidth, saved));
                }
                this.sidebarCollapsed = localStorage.getItem('dsh-sidebar-collapsed') === '1';
            } catch (e) { /* ignore */ }
        },
        sidebarMaxWidth() {
            return Math.max(260, Math.min(520, window.innerWidth - 360));
        },
        startSidebarResize(e) {
            this.resizingSidebar = true;
            this.resizeStartX = e.clientX;
            this.resizeStartWidth = this.sidebarWidth;
            document.addEventListener('mousemove', this.onSidebarResize);
            document.addEventListener('mouseup', this.stopSidebarResize);
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        },
        onSidebarResize(e) {
            if (!this.resizingSidebar) return;
            const next = this.resizeStartWidth + e.clientX - this.resizeStartX;
            this.sidebarWidth = Math.max(220, Math.min(this.sidebarMaxWidth(), next));
        },
        stopSidebarResize() {
            if (!this.resizingSidebar) return;
            this.resizingSidebar = false;
            document.removeEventListener('mousemove', this.onSidebarResize);
            document.removeEventListener('mouseup', this.stopSidebarResize);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            this.persistSidebarState();
        },
        persistSidebarState() {
            try {
                localStorage.setItem('dsh-sidebar-width', String(this.sidebarWidth));
                localStorage.setItem('dsh-sidebar-collapsed', this.sidebarCollapsed ? '1' : '0');
            } catch (e) { /* ignore */ }
        },
        collapseSidebar() {
            this.sidebarCollapsed = true;
            this.closeRowMenus();
            this.persistSidebarState();
        },
        expandSidebar() {
            this.sidebarCollapsed = false;
            this.persistSidebarState();
        },
        sessionTimeText(s) {
            if (!s) return '';
            if (this.isRunning(s)) return '刚刚';
            const ts = Number(s.sortAt) || 0;
            if (!ts) return s.time || '';
            // Read nowTick so the 30s timer actually triggers a re-render.
            const now = Number(this.nowTick) || Date.now();
            const diff = Math.max(0, now - ts);
            if (diff < 3 * 60 * 1000) return '刚刚';
            if (diff < 60 * 60 * 1000) return Math.floor(diff / 60000) + '分';
            if (diff < 24 * 60 * 60 * 1000) return Math.floor(diff / 3600000) + '小时';
            return Math.floor(diff / 86400000) + '天';
        },
        isRunning(s) {
            return !!(s && s.state && s.state.state === 'running');
        },
        onDshSettingUpdate() {
            clearTimeout(this.stateRefreshTimer);
            this.stateRefreshTimer = setTimeout(() => this.refreshStates(), 150);
        },
        findSession(groupId) {
            for (const ws of this.workspaces) {
                const s = ws.sessions.find(x => x.groupId === groupId);
                if (s) return s;
            }
            return null;
        },
        onDshReceiveMessage(message) {
            const conv = message && message.conversation;
            if (!conv || conv.type !== 1 || conv.line !== 2) return;
            const s = this.findSession(conv.target);
            if (s) {
                // The store's ReceiveMessage handler has already updated
                // conversationInfoList._unread; reflect it immediately.
                this.$nextTick(() => {
                    const current = this.findSession(conv.target);
                    if (current) current.unread = this.unreadFor(conv, null);
                });
            }
            // Debounced reload updates preview/time/order as well.
            clearTimeout(this.receiveRefreshTimer);
            this.receiveRefreshTimer = setTimeout(() => this.load(), 300);
        },
        unreadFor(conv, info) {
            // The message list/store keeps the authoritative _unread count;
            // wfc.getConversationList can return a separate raw object without
            // it (or with stale unreadCount), which used to reset the badge.
            try {
                const list = store.state.conversation.conversationInfoList || [];
                const ci = list.find(x => x && x.conversation && x.conversation.equal(conv));
                if (ci && ci._unread != null) return Number(ci._unread) || 0;
            } catch (e) { /* ignore */ }
            const uc = info && info.unreadCount;
            if (uc) {
                return (Number(uc.unread) || 0)
                    + (Number(uc.unreadMention) || 0)
                    + (Number(uc.unreadMentionAll) || 0);
            }
            return Number(info && info._unread) || 0;
        },
        onDshConversationInfoUpdate(info) {
            if (!info || !info.conversation) return;
            const conv = info.conversation;
            if (conv.type !== 1 || conv.line !== 2) return;
            const s = this.findSession(conv.target);
            if (!s) return;
            if (!info.unreadCount) return;
            const u = info.unreadCount;
            s.unread = (Number(u.unread) || 0)
                + (Number(u.unreadMention) || 0)
                + (Number(u.unreadMentionAll) || 0);
        },
        onDshMessageSent(message) {
            if (!message || !message.conversation) return;
            const conv = message.conversation;
            if (conv.type !== 1 || conv.line !== 2) return;
            if (message.from && message.from !== wfc.getUserId()) return;
            const content = message.messageContent;
            if (!(content instanceof TextMessageContent)) return;
            const text = String(content.content || '').trim();
            if (!text || text.startsWith('/')) return;
            const groupId = conv.target;
            if (!groupId || this.autoTitled[groupId] || this.autoTitlePending[groupId]) return;
            this.autoTitleGroup(groupId, text);
        },
        async autoTitleGroup(groupId, text) {
            this.autoTitlePending[groupId] = true;
            const seq = this.autoTitleSeq[groupId] = (this.autoTitleSeq[groupId] || 0) + 1;
            try {
                const fallback = this.fallbackTitle(text);
                if (!fallback) return;
                await this.modifyGroupName(groupId, fallback);
                this.markAutoTitled(groupId);
                this.updateLocalGroupName(groupId, fallback);
                try {
                    const input = this.truncateUtf8(text, 4096);
                    const result = await generateDshTitle(wfc.getUserId(), input);
                    if (this.autoTitleSeq[groupId] !== seq) return;
                    if (result && result.ok && result.title) {
                        const title = this.truncateUtf8(this.cleanTitle(result.title), 80);
                        if (title && title !== fallback) {
                            await this.modifyGroupName(groupId, title);
                            this.updateLocalGroupName(groupId, title);
                        }
                    }
                } catch (e) {
                    console.warn('[dsh] title generation failed', e);
                }
                this.load();
            } catch (e) {
                console.warn('[dsh] auto session title failed', e);
            } finally {
                delete this.autoTitlePending[groupId];
            }
        },
        updateLocalGroupName(groupId, name) {
            for (const ws of this.workspaces) {
                const s = ws.sessions.find(x => x.groupId === groupId);
                if (s) { s.name = name; break; }
            }
        },
        sessionMore(s) {
            this.workspaceMenuKey = '';
            this.sessionMenuId = this.sessionMenuId === s.groupId ? '' : s.groupId;
        },
        workspaceMore(ws) {
            this.sessionMenuId = '';
            this.workspaceMenuKey = this.workspaceMenuKey === ws.key ? '' : ws.key;
        },
        closeRowMenus() {
            this.workspaceMenuKey = '';
            this.sessionMenuId = '';
        },
        async renameSession(s) {
            this.sessionMenuId = '';
            const name = window.prompt('重命名会话', s.name || '');
            if (name === null || !name.trim() || name.trim() === s.name) return;
            const ok = await this.applyGroupName(s, name);
            if (ok) {
                this.autoTitleSeq[s.groupId] = (this.autoTitleSeq[s.groupId] || 0) + 1;
                this.markAutoTitled(s.groupId);
            }
        },
        deleteSession(s) {
            this.sessionMenuId = '';
            if (!s || !s.groupId) return;
            const ok = window.confirm('删除会话会解散该群组并销毁会话，工作区目录和文件会保留。确定删除？');
            if (!ok) return;
            const conversation = s.conversation || new Conversation(1, s.groupId, 2);
            const content = new AgentCommandMessageContent('set', '/destroy', Date.now() % 100000,
                this.localRobotId || undefined);
            wfc.sendConversationMessage(conversation, content, [], null, null, () => {
                if (this.selectedGroupId === s.groupId) {
                    this.selectedGroupId = '';
                    this.selectedRobotId = '';
                    this.showFilePreviewer = false;
                    store.setCurrentConversation(null);
                }
                for (const ws of this.workspaces) {
                    const index = ws.sessions.findIndex(x => x.groupId === s.groupId);
                    if (index >= 0) { ws.sessions.splice(index, 1); break; }
                }
                this.workspaces = this.workspaces.filter(ws => ws.sessions.length > 0);
                this.$notify({ title: '正在删除会话', text: '机器人会解散群组并删除工作区目录', type: 'info' });
                setTimeout(async () => {
                    await this.load();
                    const still = this.workspaces.some(ws => ws.sessions.some(x => x.groupId === s.groupId));
                    if (still) {
                        this.$notify({ title: '删除失败', text: '群组仍然存在，可能没有权限或机器人未响应', type: 'error' });
                    }
                }, 2200);
            }, (e) => {
                this.$notify({ title: '删除失败', text: (e && e.message) || '无法发送删除指令', type: 'error' });
            });
        },
        openSessionInIm(s) {
            this.sessionMenuId = '';
            store.setCurrentConversation(s.conversation);
            this.$router.push('/home');
        },
        async copySessionId(s) {
            try { await navigator.clipboard.writeText(s.groupId); } catch (e) { /* ignore */ }
            this.sessionMenuId = '';
            this.$notify({ title: '群 ID 已复制', type: 'info' });
        },
        async openWorkspaceDir(ws) {
            if (ws && ws.path) await openDshPath(ws.path);
        },
    },
};
</script>

<style scoped>
.dsh-workspace-page { --dsh-sidebar-width: 300px; flex: 1; width: 100%; min-width: 0; height: 100%; display: flex; flex-direction: column; background: var(--background-primary, #fff); overflow: hidden; }
.dsh-sidebar-head { flex: 0 0 52px; height: 52px; display: flex; align-items: center; justify-content: space-between; padding: 0 10px 0 14px; border-bottom: 1px solid #ececec; box-sizing: border-box; }
.dsh-sidebar-brand { display: flex; align-items: center; gap: 9px; min-width: 0; }
.dsh-brand-dot { width: 8px; height: 8px; border-radius: 50%; background: #b0b5bd; flex: 0 0 auto; }
.dsh-brand-dot.online { background: #1a7f37; box-shadow: 0 0 0 3px #e7f7ed; }
.dsh-sidebar-brand h1 { margin: 0; font-size: 18px; font-weight: 600; letter-spacing: .02em; white-space: nowrap; }
.dsh-sidebar-brand p { margin: 1px 0 0; font-size: 10px; color: var(--text-secondary, #8a8f99); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dsh-sidebar-actions { display: flex; align-items: center; gap: 2px; flex: 0 0 auto; }
.dsh-sidebar-btn { width: 24px; height: 24px; border: 0; background: transparent; border-radius: 5px; color: #8a8f99; cursor: pointer; font-size: 14px; line-height: 1; display: inline-flex; align-items: center; justify-content: center; }
.dsh-sidebar-btn i { font-size: 16px; }
.dsh-sidebar-btn:hover { background: #f2f3f5; color: #1f2329; }
.dsh-sidebar-btn:disabled { opacity: .45; cursor: default; }
.dsh-sidebar-btn.active { background: #e9eef7; color: #1d4ed8; }
.dsh-workspace-main { flex: 1; min-height: 0; display: flex; }
.dsh-session-column { flex: 0 0 var(--dsh-sidebar-width); width: var(--dsh-sidebar-width); min-width: var(--dsh-sidebar-width); max-width: var(--dsh-sidebar-width); display: flex; flex-direction: column; border-right: 1px solid #ececec; background: #fbfbfa; color: #1f2329; font-size: 14px; box-sizing: border-box; }
.dsh-splitter { flex: 0 0 5px; align-self: stretch; cursor: col-resize; position: relative; z-index: 6; background: transparent; }
.dsh-splitter:hover, .dsh-splitter.dragging { background: #eef2f7; }
.dsh-sidebar-collapse { width: 28px; height: 28px; border: 0; border-radius: 6px; background: transparent; color: #8a8f99; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; flex: 0 0 auto; }
.dsh-sidebar-collapse:hover { background: #f2f3f5; color: #1f2329; }
.dsh-sidebar-collapse i { font-size: 18px; }
.dsh-sidebar-expand { width: 28px; height: 28px; border: 0; border-radius: 6px; background: transparent; color: #6b7280; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; flex: 0 0 auto; }
.dsh-sidebar-expand:hover { background: #f2f3f5; color: #1f2329; }
.dsh-sidebar-expand i { font-size: 18px; }
.dsh-chat-empty-top-left { display: flex; align-items: center; gap: 6px; min-width: 0; }

.dsh-new-session {
    margin: 8px 2px 10px; height: 38px; border: .5px solid #e1e3e6;
    border-radius: 8px; background: #fff; color: #1f2329; font-size: 14px;
    font-weight: 500; cursor: pointer; display: flex; align-items: center;
    justify-content: center; gap: 6px;
}
.dsh-new-session i { font-size: 16px; }
.dsh-new-session:hover { background: #f5f6f8; border-color: #d6d9dd; color: #1f2329; }
.dsh-new-session:disabled { opacity: .5; cursor: default; }
.dsh-ws-section-head {
    display: flex; align-items: center; justify-content: space-between;
    padding: 8px 8px 4px; color: #8a8f99; font-size: 14px;
    font-weight: 500; letter-spacing: 0;
}
.dsh-ws-section-head > div { display: flex; gap: 0; align-items: center; }
.dsh-sidebar-foot { flex: 0 0 auto; border-top: 1px solid #ececec; padding: 6px 4px 4px; }
.dsh-settings-entry {
    width: 100%; height: 36px; border: 0; border-radius: 8px; background: transparent;
    color: #1f2329; font-size: 14px; text-align: left; padding: 0 8px;
    display: flex; align-items: center; gap: 8px; cursor: pointer;
}
.dsh-settings-entry { justify-content: center; }
.dsh-settings-entry i { color: #8a8f99; font-size: 15px; }
.dsh-settings-entry:hover { background: #f2f3f5; color: #1f2329; }
.dsh-empty-status { font-size: 10px; font-weight: 400; color: #9aa0a8; }
.dsh-empty-hint { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 8px; padding: 0 24px; }
.dsh-empty-hint-mark {
    width: 48px; height: 48px; border-radius: 14px; background: #f2f5fa;
    color: #1d4ed8; display: flex; align-items: center; justify-content: center;
    font-size: 24px; margin-bottom: 6px;
}
.dsh-empty-hint h2 { margin: 0; font-size: 18px; font-weight: 600; color: #1f2329; }
.dsh-empty-hint p { margin: 0; font-size: 13px; color: #8a8f99; }
.dsh-draft { flex: 1; min-width: 0; display: flex; flex-direction: column; position: relative; background: var(--background-primary, #fff); }
.dsh-draft-body { flex: 1; min-height: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; padding: 72px 24px 40px; box-sizing: border-box; overflow-y: auto; }
.dsh-draft-hero { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 8px; }
.dsh-draft-hero h2 { margin: 0; font-size: 20px; font-weight: 600; color: #1f2329; }
.dsh-draft-hero p { margin: 0; max-width: 520px; font-size: 13px; line-height: 1.6; color: #8a8f99; }
.dsh-draft-composer {
    width: 100%; max-width: 720px; padding: 10px 12px; box-sizing: border-box;
    border: 1px solid #e3e5e8; border-radius: 14px; background: #fff;
    box-shadow: 0 6px 24px rgba(15, 23, 42, .06);
}
.dsh-draft-input {
    width: 100%; min-height: 92px; max-height: 40vh; padding: 4px 2px 8px;
    border: 0; outline: none; resize: none; background: transparent;
    font-family: inherit; font-size: 14px; line-height: 1.6; color: #1f2329; box-sizing: border-box;
}
.dsh-draft-input::placeholder { color: #a8adb5; }
.dsh-draft-toolbar {
    display: flex; align-items: center; gap: 6px;
    padding: 4px 0 0; border-top: 1px solid #f1f2f4;
}
.dsh-draft-tools-left, .dsh-draft-tools-right { display: flex; align-items: center; gap: 2px; min-width: 0; }
.dsh-draft-tools-right { margin-left: auto; }
.dsh-chip-wrap { position: relative; min-width: 0; }
.dsh-chip {
    display: inline-flex; align-items: center; gap: 5px; max-width: 260px; height: 30px;
    padding: 0 8px; border: 0; border-radius: 8px; background: transparent;
    color: #4b5563; font-size: 12px; cursor: pointer;
}
.dsh-chip:hover { background: #f2f3f5; color: #1f2329; }
.dsh-chip:disabled { opacity: .5; cursor: default; }
.dsh-chip:disabled:hover { background: transparent; color: #4b5563; }
.dsh-chip > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsh-chip i { flex: 0 0 auto; font-size: 14px; color: #8a8f99; }
.dsh-chip .dsh-chip-caret { font-size: 11px; }
.dsh-chip-model { color: #1f2329; font-weight: 500; }
.dsh-pop {
    position: absolute; left: 0; bottom: calc(100% + 6px); z-index: 40;
    min-width: 200px; max-width: 320px; max-height: 320px; overflow-y: auto;
    padding: 5px; background: #fff; border: 1px solid #e5e6e8; border-radius: 10px;
    box-shadow: 0 10px 30px rgba(15, 23, 42, .14);
}
.dsh-pop-right { left: auto; right: 0; }
.dsh-pop-model { min-width: 280px; }
.dsh-pop-title { padding: 5px 8px 3px; color: #8a8f99; font-size: 11px; }
.dsh-pop-sep { height: 1px; margin: 4px; background: #f0f1f3; }
.dsh-pop-item {
    width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 10px;
    padding: 7px 8px; border: 0; border-radius: 7px; background: transparent;
    color: #1f2329; font-size: 12px; text-align: left; cursor: pointer;
}
.dsh-pop-item:hover { background: #f5f6f8; }
.dsh-pop-item.active { color: #1d4ed8; }
.dsh-pop-item > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsh-pop-item i { flex: 0 0 auto; font-size: 13px; color: #1d4ed8; }
.dsh-pop-empty { margin: 4px 8px 6px; color: #a8adb5; font-size: 11px; }
.dsh-send-btn {
    width: 34px; height: 34px; margin-left: 4px; flex: 0 0 auto;
    display: inline-flex; align-items: center; justify-content: center;
    border: 0; border-radius: 50%; background: #1d4ed8; color: #fff; cursor: pointer;
}
.dsh-send-btn i { font-size: 18px; }
.dsh-send-btn:hover { background: #1e40af; }
.dsh-send-btn:disabled { background: #e5e7eb; color: #9aa0a8; cursor: default; }
.dsh-send-spinner {
    width: 14px; height: 14px; border-radius: 50%;
    border: 2px solid rgba(255, 255, 255, .45); border-top-color: #fff;
    animation: dsh-spin .8s linear infinite;
}
@keyframes dsh-spin { to { transform: rotate(360deg); } }
.dsh-draft-cancel { padding: 4px 8px; border: 0; border-radius: 6px; background: transparent; color: #8a8f99; font-size: 12px; cursor: pointer; }
.dsh-draft-cancel:hover { background: #f2f3f5; color: #1f2329; }

.dsh-session-search { padding: 4px 8px 8px; }
.dsh-session-search input { width: 100%; box-sizing: border-box; border: .5px solid #e1e4e8; border-radius: 8px; background: #fff; padding: 7px 9px; font-size: 13px; outline: none; }
.dsh-session-scroll { flex: 1; overflow-y: auto; padding: 2px 8px 20px; }
.dsh-list-empty { padding: 40px 16px; text-align: center; color: #8a8f99; font-size: 13px; }
.dsh-list-empty strong { display: block; color: #4b5563; margin-bottom: 6px; font-size: 14px; }
.dsh-list-empty p { margin: 0 0 12px; line-height: 1.5; }
.dsh-ws-block { margin-bottom: 2px; }
.dsh-ws-head { position: relative; display: flex; align-items: center; height: 34px; border-radius: 8px; padding: 0 6px 0 0; color: #1f2329; }
.dsh-ws-head:hover, .dsh-ws-head.menu-open { background: #f2f3f5; }
.dsh-ws-toggle { display: flex; align-items: center; justify-content: flex-start; gap: 6px; flex: 1; min-width: 0; height: 100%; border: 0; background: transparent; color: inherit; font-size: 16px; font-weight: 500; line-height: 20px; padding: 0; cursor: pointer; text-align: left; }
.dsh-ws-slot { width: 18px; height: 20px; display: inline-flex; align-items: center; justify-content: flex-start; flex: 0 0 auto; color: #8a8f99; font-size: 16px; }
.dsh-ws-folder { display: inline-flex; color: #fff; -webkit-text-stroke: .8px #a0a5ad; }
.dsh-ws-chevron { display: none; font-size: 12px; transition: transform .15s; }
.dsh-ws-chevron.open { transform: rotate(90deg); }
.dsh-ws-head:hover .dsh-ws-folder, .dsh-ws-head:focus-within .dsh-ws-folder { display: none; }
.dsh-ws-head:hover .dsh-ws-chevron, .dsh-ws-head:focus-within .dsh-ws-chevron { display: inline-flex; }
.dsh-ws-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsh-row-actions { display: none; align-items: center; gap: 10px; flex: 0 0 auto; }
.dsh-ws-head:hover .dsh-row-actions, .dsh-ws-head.menu-open .dsh-row-actions, .dsh-ws-head:focus-within .dsh-row-actions,
.dsh-session-row:hover .dsh-row-actions, .dsh-session-row.menu-open .dsh-row-actions, .dsh-session-row:focus-within .dsh-row-actions { display: inline-flex; }
.dsh-row-action { width: 20px; height: 20px; border: 0; border-radius: 4px; background: transparent; color: #8a8f99; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; padding: 0; font-size: 15px; line-height: 1; }
.dsh-row-action:hover { color: #1f2329; background: #e6e7e9; }
.dsh-row-menu { position: absolute; right: 4px; top: 30px; z-index: 20; background: #fff; border: 1px solid #e5e6e8; border-radius: 8px; box-shadow: 0 8px 24px rgba(15,23,42,.12); padding: 4px; min-width: 140px; }
.dsh-row-menu button { display: block; width: 100%; border: 0; background: transparent; text-align: left; padding: 7px 9px; border-radius: 5px; font-size: 13px; line-height: 18px; color: #1f2329; cursor: pointer; }
.dsh-row-menu button:hover { background: #f2f3f5; }
.dsh-row-menu button:disabled { opacity: .45; cursor: default; }
.dsh-row-menu-sep { height: 1px; margin: 4px 2px; background: #ececec; }
.dsh-row-menu button.danger { color: #b42318; }
.dsh-row-menu button.danger:hover { background: #fdecec; color: #b42318; }
.dsh-session-list { display: flex; flex-direction: column; gap: 1px; }
.dsh-session-row { position: relative; display: flex; align-items: center; height: 32px; padding: 0 6px 0 24px; gap: 6px; border-radius: 8px; cursor: pointer; color: #1f2329; }
.dsh-session-row:hover, .dsh-session-row.menu-open { background: #f2f3f5; }
.dsh-session-row.active { background: #eef1f5; }
.dsh-session-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; line-height: 20px; }
.dsh-session-status {
    position: absolute; left: 2px; top: 50%; transform: translateY(-50%);
    width: 20px; height: 20px; display: inline-flex; align-items: center;
    justify-content: flex-end; gap: 1px; flex: 0 0 auto;
}
.dsh-session-running {
    width: 9px; height: 9px; border: 1.5px solid #dbe3ef; border-top-color: #1d4ed8;
    border-radius: 50%; animation: dsh-session-spin .8s linear infinite; flex: 0 0 auto;
}
@keyframes dsh-session-spin { to { transform: rotate(360deg); } }
.dsh-multi-badge { margin-left: 4px; padding: 0 4px; border-radius: 999px; background: #eef2f7; color: #64748b; font-size: 9px; font-weight: 500; }
.dsh-session-side { flex: 0 0 auto; display: inline-flex; align-items: center; gap: 6px; }
.dsh-session-time { font-size: 10px; line-height: 16px; color: #a0a5ad; }
.dsh-session-row:hover .dsh-session-side, .dsh-session-row.menu-open .dsh-session-side, .dsh-session-row:focus-within .dsh-session-side { display: none; }
.dsh-session-unread { min-width: 14px; height: 14px; padding: 0 4px; border-radius: 999px; background: #e5484d; color: #fff; font-size: 9px; line-height: 14px; text-align: center; }
.dsh-chat-column { flex: 1; min-width: 0; display: flex; flex-direction: column; background: #fff; }
.dsh-detail-toggle { width: 26px; height: 24px; border: 1px solid #e1e4e8; border-radius: 5px; background: #fff; color: #6b7280; cursor: pointer; font-size: 14px; line-height: 1; }
.dsh-detail-toggle:hover { color: #1d4ed8; border-color: #b8c9f5; background: #eef4ff; }
.dsh-embedded-chat { flex: 1; min-height: 0; }
.dsh-embedded-chat :deep(.conversation-container) { height: 100%; }
.dsh-chat-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #8a8f99; gap: 8px; position: relative; }
.dsh-chat-empty-top { position: absolute; top: 0; left: 0; right: 0; height: 56px; display: flex; align-items: center; justify-content: space-between; padding: 0 12px 0 16px; border-bottom: 1px solid #f0f1f3; box-sizing: border-box; color: #4b5563; font-size: 13px; font-weight: 600; }
/* Windows/Linux：右上角是自绘的窗口按钮，状态文字向左让开，避免重叠 */
.dsh-workspace-page.with-window-controls .dsh-chat-empty-top {
    padding-right: calc(12px + var(--window-controls-width, 0px));
}
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
    .dsh-session-column { flex-basis: var(--dsh-sidebar-width); min-width: var(--dsh-sidebar-width); }
}
</style>
