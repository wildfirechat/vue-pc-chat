<template>
    <div class="ai-container">
        <iframe
            v-if="aiPortalUrl"
            :src="aiPortalUrl"
            class="ai-frame"
            frameborder="0"
            allow="microphone; camera"
        ></iframe>

        <div v-else class="dsh-panel">
            <header class="dsh-header">
                <div>
                    <div class="dsh-eyebrow">LOCAL AGENT</div>
                    <h1>DSH 助手</h1>
                    <p class="dsh-subtitle">内置本机 Agent · gateway 直连</p>
                </div>
                <div class="dsh-header-right">
                    <button class="dsh-back-btn" @click="$router.push('/home/dsh')">← 返回 DSH</button>
                    <span class="dsh-state" :class="stateClass">{{ stateText }}</span>
                    <button class="dsh-icon-btn" title="刷新" :disabled="loading" @click="refreshProvision(true)">↻</button>
                </div>
            </header>

            <div class="dsh-quick-actions">
                <button class="dsh-btn primary" :disabled="!robot.robotId" @click="openRobotChat">
                    打开单聊机器人
                </button>
                <button class="dsh-btn" :disabled="!robot.robotId || creatingSession" @click="createNewSession">
                    {{ creatingSession ? '正在创建…' : '创建新会话' }}
                </button>
                <button class="dsh-btn ghost" :disabled="loading || !robot.robotId" @click="restartHost">
                    重启 Host
                </button>
            </div>

            <div v-if="error" class="dsh-error">
                <strong>DSH 暂不可用</strong>
                <p>{{ error }}</p>
                <button class="dsh-btn primary" :disabled="loading" @click="refreshProvision">重试开通</button>
            </div>

            <div v-if="hostError && !error" class="dsh-error">
                <strong>DSH Host 启动失败</strong>
                <p>{{ hostError }}</p>
                <div class="dsh-actions">
                    <button class="dsh-btn primary" :disabled="loading" @click="restartHost">重启 Host</button>
                    <button class="dsh-btn" @click="openLog">打开日志</button>
                </div>
            </div>

            <template v-else>
                <nav class="dsh-tabs">
                    <button v-for="tab in tabs" :key="tab.id"
                            class="dsh-tab" :class="{active: activeTab === tab.id}"
                            @click="selectTab(tab.id)">
                        {{ tab.label }}
                        <span v-if="tab.count" class="dsh-tab-count">{{ tab.count }}</span>
                    </button>
                </nav>

                <!-- 概览 -->
                <section v-if="activeTab === 'overview'" class="dsh-section">
                    <div class="dsh-overview-grid">
                        <div class="dsh-stat">
                            <span class="dsh-stat-label">Host</span>
                            <strong :class="stateClass">{{ stateText }}</strong>
                            <span class="dsh-stat-sub">PID {{ hostStatus.pid || '-' }} · Gateway {{ gatewayText }}</span>
                        </div>
                        <div class="dsh-stat">
                            <span class="dsh-stat-label">工作区</span>
                            <strong>{{ workspaceCount }}</strong>
                            <span class="dsh-stat-sub">{{ groupCount }} 个群会话</span>
                        </div>
                        <div class="dsh-stat">
                            <span class="dsh-stat-label">模型</span>
                            <strong class="dsh-stat-model">{{ ai.model || '-' }}</strong>
                            <span class="dsh-stat-sub">{{ ai.reasoningEffort || '默认' }} · {{ ai.configured ? '已配置' : '未配置' }}</span>
                        </div>
                    </div>

                    <section class="dsh-card">
                        <div class="dsh-card-head">
                            <h2>最近会话</h2>
                            <button class="dsh-link-btn" @click="activeTab = 'workspaces'">查看全部</button>
                        </div>
                        <div v-if="!recentGroups.length" class="dsh-empty">
                            还没有工作区群。点击上方「创建新会话」，机器人会自动建群。
                        </div>
                        <ul v-else class="dsh-group-list">
                            <li v-for="g in recentGroups" :key="g.groupId" @click="openGroup(g)">
                                <div class="dsh-group-main">
                                    <span class="dsh-group-name">{{ g.name || g.groupId }}</span>
                                    <span class="dsh-group-ws">{{ g.workspaceName }}</span>
                                </div>
                                <span class="dsh-group-arrow">›</span>
                            </li>
                        </ul>
                    </section>

                    <section class="dsh-card dsh-robot-summary">
                        <div>
                            <h2>机器人</h2>
                            <p class="dsh-robot-name">{{ robot.displayName || 'DSH 助手' }}</p>
                            <p class="mono dsh-muted">{{ robot.robotId || '未开通' }}</p>
                        </div>
                        <div class="dsh-summary-actions">
                            <button class="dsh-btn" @click="copyRobotId">复制 ID</button>
                            <button class="dsh-btn" @click="activeTab = 'robot'">详情</button>
                        </div>
                    </section>
                </section>

                <!-- 工作区 -->
                <section v-else-if="activeTab === 'workspaces'" class="dsh-section">
                    <div class="dsh-section-head">
                        <div>
                            <h2>工作区 / 群会话</h2>
                            <p class="dsh-muted">一个工作区可对应多个群；群就是会话。</p>
                        </div>
                        <button class="dsh-btn primary" :disabled="!robot.robotId || creatingSession" @click="createNewSession">
                            新建会话
                        </button>
                    </div>
                    <div v-if="!workspaceGroups.length" class="dsh-empty-card">
                        <strong>还没有工作区群</strong>
                        <p>点击「新建会话」，机器人会在单聊里回复新群 ID；进群即可开始。</p>
                        <button class="dsh-btn primary" :disabled="!robot.robotId || creatingSession" @click="createNewSession">
                            创建新会话
                        </button>
                    </div>
                    <div v-for="ws in workspaceGroups" :key="ws.key" class="dsh-workspace">
                        <div class="dsh-workspace-title">
                            <div>
                                <span class="dsh-workspace-name">{{ ws.name }}</span>
                                <span class="dsh-workspace-meta">{{ ws.groups.length }} 个会话</span>
                            </div>
                            <button class="dsh-link-btn" @click="openGroup(ws.groups[0])">打开第一个</button>
                        </div>
                        <ul class="dsh-group-list dsh-group-list-card">
                            <li v-for="g in ws.groups" :key="g.groupId" @click="openGroup(g)">
                                <div class="dsh-group-main">
                                    <span class="dsh-group-name">{{ g.name || g.groupId }}</span>
                                    <span class="mono dsh-group-id">{{ g.groupId }}</span>
                                </div>
                                <span class="dsh-group-badge" v-if="g.remote">远程</span>
                                <span class="dsh-group-arrow">›</span>
                            </li>
                        </ul>
                    </div>
                </section>

                <!-- 群组 -->
                <section v-else-if="activeTab === 'groups'" class="dsh-section">
                    <div v-if="!allGroups.length" class="dsh-empty-card">
                        <strong>还没有群组</strong>
                        <p>创建新会话后，机器人会建立 line2 工作区群。</p>
                    </div>
                    <div v-for="g in allGroups" :key="g.groupId" class="dsh-group-card">
                        <div class="dsh-group-card-head">
                            <div>
                                <strong>{{ g.name || g.groupId }}</strong>
                                <span class="dsh-group-badge">{{ g.memberCount || '-' }} 人</span>
                            </div>
                            <div class="dsh-summary-actions">
                                <button class="dsh-link-btn" @click="openGroup(g)">打开</button>
                                <button class="dsh-link-btn" @click="renameGroup(g)">重命名</button>
                            </div>
                        </div>
                        <p class="mono dsh-group-id">{{ g.groupId }}</p>
                        <div class="dsh-meta-row">
                            <span class="dsh-meta-pill">工作区 {{ g.workspaceName }}</span>
                            <span class="dsh-meta-pill">line 2</span>
                            <span class="dsh-meta-pill">rev {{ g.rev || '-' }}</span>
                            <span class="dsh-meta-pill">broker {{ g.broker || '-' }}</span>
                        </div>
                        <div class="dsh-robot-list">
                            <div v-for="r in g.robots" :key="r.robotId" class="dsh-robot-row">
                                <span class="dsh-robot-dot" :class="{local: r.local}"></span>
                                <span class="mono">{{ r.robotId }}</span>
                                <span class="dsh-meta-pill">{{ r.role || 'member' }}</span>
                                <span v-if="r.sessionId" class="mono dsh-session-id">{{ r.sessionId }}</span>
                                <span class="dsh-remote-label">{{ r.local ? '本机' : '远程' }}</span>
                            </div>
                        </div>
                    </div>
                </section>

                <!-- 机器人 -->
                <section v-else-if="activeTab === 'robot'" class="dsh-section">
                    <section class="dsh-card">
                        <h2>机器人</h2>
                        <dl>
                            <dt>机器人 ID</dt>
                            <dd>
                                <span class="mono">{{ robot.robotId || '未开通' }}</span>
                                <button v-if="robot.robotId" class="dsh-mini-btn" @click="copyRobotId">复制</button>
                                <button v-if="robot.robotId" class="dsh-mini-btn" @click="openRobotChat">打开单聊</button>
                            </dd>
                            <dt>显示名</dt><dd>{{ robot.displayName || 'DSH 助手' }}</dd>
                            <dt>Owner</dt><dd class="mono">{{ robot.owner || '-' }}</dd>
                            <dt>Gateway</dt><dd class="mono">{{ robot.gatewayUrl || '-' }}</dd>
                            <dt>IM 地址</dt><dd class="mono">{{ robot.imServerUrl || '-' }}</dd>
                            <dt>Gateway 状态</dt><dd>{{ gatewayText }}</dd>
                        </dl>
                    </section>
                    <section class="dsh-card">
                        <h2>模型</h2>
                        <dl>
                            <dt>Provider</dt><dd>{{ ai.provider || '-' }}</dd>
                            <dt>模型</dt><dd>{{ ai.model || '-' }}</dd>
                            <dt>推理等级</dt><dd>{{ ai.reasoningEffort || '-' }}</dd>
                            <dt>AI 配置</dt><dd>{{ ai.configured ? '已配置' : '未配置' }}</dd>
                        </dl>
                    </section>
                </section>

                <!-- 模型 -->
                <section v-else-if="activeTab === 'models'" class="dsh-section">
                    <DshModelSettings :ai="ai"/>
                </section>

                <!-- 路由 -->
                <section v-else-if="activeTab === 'routing'" class="dsh-section">
                    <div class="dsh-section-head">
                        <div>
                            <h2>Owner 路由记录</h2>
                            <p class="dsh-muted">多机器人群里 owner 的裁决、指派和静默结果。</p>
                        </div>
                        <button class="dsh-btn" :disabled="routingLoading" @click="loadRouting">刷新</button>
                    </div>
                    <div v-if="!routingRecords.length" class="dsh-empty-card">
                        <strong>暂无路由记录</strong>
                        <p>多机器人 owner 处理无 @ 消息后会记录在这里；单机器人群不产生裁决。</p>
                    </div>
                    <div v-for="r in routingRecords" :key="r.ts + '-' + r.messageUid" class="dsh-route-row">
                        <span class="dsh-route-action" :class="'route-' + r.action">{{ routeActionText(r.action) }}</span>
                        <div class="dsh-route-main">
                            <div class="dsh-route-title">
                                <span class="mono">{{ shortGroup(r.groupId) }}</span>
                                <span class="dsh-muted">{{ formatTime(r.ts) }}</span>
                            </div>
                            <p class="dsh-route-desc">
                                {{ r.reason }}
                                <template v-if="r.targetRobotId"> → <span class="mono">{{ r.targetRobotId }}</span></template>
                            </p>
                            <p v-if="r.text" class="dsh-route-text">{{ r.text }}</p>
                        </div>
                    </div>
                </section>

                <!-- 日志 -->
                <section v-else-if="activeTab === 'logs'" class="dsh-section">
                    <div class="dsh-section-head">
                        <div>
                            <h2>Host 日志</h2>
                            <p class="dsh-muted">最近 400 行，按需刷新；完整日志可打开文件。</p>
                        </div>
                        <div class="dsh-summary-actions">
                            <button class="dsh-btn" :disabled="logLoading" @click="loadLog">刷新</button>
                            <button class="dsh-btn" @click="openLog">打开文件</button>
                        </div>
                    </div>
                    <pre class="dsh-log">{{ logText || '暂无日志' }}</pre>
                </section>

                <!-- 诊断 -->
                <section v-else class="dsh-section">
                    <section class="dsh-card">
                        <div class="dsh-card-head">
                            <h2>Host 状态</h2>
                            <button class="dsh-link-btn" @click="openLog">打开日志</button>
                        </div>
                        <dl>
                            <dt>进程</dt><dd>{{ hostStatus.pid || '-' }}</dd>
                            <dt>Profile</dt><dd>{{ hostStatus.profile || '-' }}</dd>
                            <dt>日志</dt><dd class="mono">{{ hostStatus.logPath || '-' }}</dd>
                            <dt>最近错误</dt><dd>{{ hostStatus.lastError || '-' }}</dd>
                        </dl>
                    </section>
                    <section class="dsh-card">
                        <h2>维护</h2>
                        <div class="dsh-actions">
                            <button class="dsh-btn primary" :disabled="loading" @click="refreshProvision(true)">刷新开通</button>
                            <button class="dsh-btn" :disabled="loading || !robot.robotId" @click="restartHost">重启 Host</button>
                            <button class="dsh-btn" @click="openLog">打开日志</button>
                            <button class="dsh-btn danger" :disabled="loading" @click="clearProvision">清除本地凭据</button>
                        </div>
                    </section>
                </section>

                <p v-if="loading" class="dsh-loading">正在处理…</p>
                <p v-if="lastUpdated" class="dsh-updated">更新于 {{ lastUpdated }}</p>
            </template>
        </div>
    </div>
</template>

<script>
import Config from "../../config";
import {
    clearDshProvision,
    getDshLog,
    getDshRouting,
    getDshStatus,
    isDshSupported,
    onDshStatus,
    openDshLog,
    provisionDsh,
    restartDsh,
} from "../../dsh/renderer/dshClient";
import wfc from "../../wfc/client/wfc";
import store from "../../store";
import Conversation from "../../wfc/model/conversation";
import TextMessageContent from "../../wfc/messages/textMessageContent";
import ModifyGroupInfoType from "../../wfc/model/modifyGroupInfoType";
import DshModelSettings from "./dsh/DshModelSettings.vue";

export default {
    name: 'AI',
    components: { DshModelSettings },
    computed: {
        aiPortalUrl() {
            return Config.AI_PORTAL_URL;
        },
        stateText() {
            const map = {
                stopped: '未启动',
                starting: '启动中',
                running: '运行中',
                restarting: '重启中',
                error: '启动失败',
                crashed: '已崩溃',
            };
            return map[this.hostStatus.state] || this.hostStatus.state || '未启动';
        },
        stateClass() {
            return `dsh-state-${this.hostStatus.state || 'stopped'}`;
        },
        robot() {
            return (this.provision && this.provision.robot) || {};
        },
        ai() {
            return (this.provision && this.provision.ai) || {};
        },
        hostError() {
            const s = this.hostStatus || {};
            if (s.state === 'error' || s.state === 'crashed') return s.lastError || 'Host 进程异常退出';
            return '';
        },
        hostId() {
            return this.hostStatus && this.hostStatus.hostId ? this.hostStatus.hostId : '';
        },
        gatewayText() {
            const g = (this.hostStatus && this.hostStatus.gateway) || {};
            if (g.connected) return g.stale ? '在线（状态较旧）' : '在线';
            if (g.state === 'unknown') return '未知';
            return '离线';
        },
        workspaceCount() {
            return this.workspaceGroups.length;
        },
        groupCount() {
            return this.workspaceGroups.reduce((n, ws) => n + ws.groups.length, 0);
        },
        recentGroups() {
            return this.workspaceGroups
                .flatMap(ws => ws.groups.map(g => ({ ...g, workspaceName: ws.name })))
                .slice(0, 5);
        },
        allGroups() {
            return this.workspaceGroups.flatMap(ws => ws.groups.map(g => ({ ...g, workspaceName: ws.name })));
        },
        tabs() {
            return [
                { id: 'overview', label: '概览' },
                { id: 'workspaces', label: '工作区', count: this.workspaceCount },
                { id: 'groups', label: '群组', count: this.groupCount },
                { id: 'robot', label: '机器人' },
                { id: 'models', label: '模型' },
                { id: 'routing', label: '路由' },
                { id: 'logs', label: '日志' },
                { id: 'diagnostics', label: '诊断' },
            ];
        },
    },
    data() {
        return {
            provision: null,
            hostStatus: {},
            loading: false,
            error: '',
            lastUpdated: '',
            offStatus: null,
            workspaceGroups: [],
            creatingSession: false,
            activeTab: 'overview',
            logText: '',
            routingRecords: [],
            logLoading: false,
            routingLoading: false,
            statusTimer: null,
        };
    },
    mounted() {
        if (!isDshSupported() || this.aiPortalUrl) return;
        this.offStatus = onDshStatus(status => {
            this.hostStatus = status || {};
        });
        this.statusTimer = setInterval(async () => {
            try { this.hostStatus = (await getDshStatus()) || {}; } catch (e) { /* ignore */ }
        }, 4000);
        this.bootstrap();
    },
    beforeUnmount() {
        if (this.offStatus) this.offStatus();
        if (this.statusTimer) clearInterval(this.statusTimer);
    },
    methods: {
        selectTab(id) {
            this.activeTab = id;
            if (id === 'logs') this.loadLog();
            if (id === 'routing') this.loadRouting();
        },
        async loadLog() {
            this.logLoading = true;
            try { this.logText = await getDshLog(400); } catch (e) { this.logText = '读取日志失败: ' + (e.message || e); }
            finally { this.logLoading = false; }
        },
        async loadRouting() {
            this.routingLoading = true;
            try { this.routingRecords = await getDshRouting(100); } catch (e) { this.routingRecords = []; }
            finally { this.routingLoading = false; }
        },
        routeActionText(action) {
            return ({ assign: '指派', reply: '自己回', mention: '@ 指定', none: '静默', ignore: '忽略' })[action] || action || '-';
        },
        shortGroup(id) {
            if (!id) return '-';
            return id.length > 18 ? id.slice(0, 8) + '…' + id.slice(-6) : id;
        },
        formatTime(ts) {
            if (!ts) return '-';
            try { return new Date(ts).toLocaleString(); } catch (e) { return '-'; }
        },
        async bootstrap() {
            try {
                this.hostStatus = (await getDshStatus()) || {};
            } catch (e) { /* ignore */ }
            if (!wfc.getUserId()) return;
            await this.refreshProvision(false);
        },
        async refreshProvision(forceRefresh = false) {
            if (!isDshSupported()) return;
            this.loading = true;
            this.error = '';
            try {
                const result = await provisionDsh(forceRefresh);
                if (!result || !result.ok) {
                    this.error = (result && result.error) || '开通失败';
                    return;
                }
                this.provision = result.provision;
                this.hostStatus = result.hostStatus || (await getDshStatus()) || {};
                this.lastUpdated = new Date().toLocaleString();
                this.loadWorkspaces();
            } catch (e) {
                this.error = e && e.message ? e.message : String(e);
            } finally {
                this.loading = false;
            }
        },
        async copyRobotId() {
            try {
                await navigator.clipboard.writeText(this.robot.robotId || '');
            } catch (e) {
                const input = document.createElement('input');
                input.value = this.robot.robotId || '';
                document.body.appendChild(input);
                input.select();
                document.execCommand('copy');
                document.body.removeChild(input);
            }
        },
        openRobotChat() {
            if (!this.robot.robotId) return;
            const conv = new Conversation(0, this.robot.robotId, 0);
            store.setCurrentConversation(conv);
            this.$router.push('/home');
        },
        async createNewSession() {
            if (!this.robot.robotId || this.creatingSession) return;
            this.creatingSession = true;
            const conv = new Conversation(0, this.robot.robotId, 0);
            try {
                const content = new TextMessageContent('/create auto');
                await new Promise((resolve, reject) => {
                    wfc.sendConversationMessage(conv, content, [], null, null,
                        () => resolve(),
                        (e) => reject(e));
                });
                store.setCurrentConversation(conv);
                this.$router.push('/home');
                this.$notify({
                    title: '已发送创建请求',
                    text: '机器人会在单聊里回复新群 ID，进群即可开始新会话。',
                    type: 'info'
                });
            } catch (e) {
                this.$notify({
                    title: '创建新会话失败',
                    text: (e && e.message) ? e.message : '请确认机器人已在线，并在单聊里重试 /create auto',
                    type: 'error'
                });
            } finally {
                this.creatingSession = false;
            }
        },
        loadWorkspaces() {
            const robotId = this.robot.robotId;
            if (!robotId) { this.workspaceGroups = []; return; }
            let list = [];
            try {
                list = wfc.getConversationList([1], [2]) || [];
            } catch (e) {
                list = [];
            }
            const byWorkspace = new Map();
            for (const info of list) {
                const conv = info && info.conversation;
                if (!conv || conv.type !== 1) continue;
                let groupInfo = null;
                try { groupInfo = wfc.getGroupInfo(conv.target, true); } catch (e) { groupInfo = null; }
                let extra = null;
                try { extra = groupInfo && groupInfo.extra ? JSON.parse(groupInfo.extra) : null; } catch (e) { extra = null; }
                const section = extra && extra.wfds && extra.wfds.robots ? extra.wfds.robots[robotId] : null;
                const key = section && section.workspaceId ? `${robotId}:${section.workspaceId}` : 'shared';
                const name = section && section.workspaceName ? section.workspaceName : '共享群 / 未归类';
                if (!byWorkspace.has(key)) byWorkspace.set(key, { key, name, groups: [] });
                const wfds = (extra && extra.wfds) || {};
                const robotMap = wfds.robots || {};
                const robots = Object.keys(robotMap).map(id => {
                    const rs = robotMap[id] || {};
                    return {
                        robotId: id,
                        role: rs.role || '',
                        hostId: rs.hostId || '',
                        sessionId: rs.sessionId || '',
                        local: !rs.hostId || rs.hostId === this.hostId,
                    };
                });
                byWorkspace.get(key).groups.push({
                    groupId: conv.target,
                    name: (groupInfo && groupInfo.name) || conv.target,
                    workspaceName: name,
                    memberCount: groupInfo ? groupInfo.memberCount : 0,
                    rev: wfds.rev || '',
                    broker: typeof wfds.broker === 'string' ? wfds.broker : (wfds.broker && wfds.broker.robotId) || '',
                    robots,
                    remote: !!section && section.hostId && section.hostId !== this.hostId,
                });
            }
            this.workspaceGroups = Array.from(byWorkspace.values());
        },
        openGroup(g) {
            const conv = new Conversation(1, g.groupId, 2);
            store.setCurrentConversation(conv);
            this.$router.push('/home');
        },
        async renameGroup(g) {
            const name = window.prompt('新的群名称', g.name || '');
            if (!name || !name.trim() || name.trim() === g.name) return;
            try {
                await new Promise((resolve, reject) => {
                    wfc.modifyGroupInfo(g.groupId, ModifyGroupInfoType.Modify_Group_Name, name.trim(), [2], null,
                        () => resolve(), (e) => reject(e));
                });
                g.name = name.trim();
                this.$notify({ title: '群名称已更新', type: 'success' });
                this.loadWorkspaces();
            } catch (e) {
                this.$notify({ title: '重命名失败', text: (e && e.message) || '请稍后重试', type: 'error' });
            }
        },
        async restartHost() {
            this.loading = true;
            try {
                const result = await restartDsh();
                if (result && result.status) this.hostStatus = result.status;
                if (result && !result.ok) this.error = result.error || '重启失败';
            } finally {
                this.loading = false;
            }
        },
        async openLog() {
            await openDshLog();
        },
        async clearProvision() {
            if (!window.confirm('清除本机机器人凭据后需要重新开通，确定继续？')) return;
            this.loading = true;
            try {
                await clearDshProvision();
                this.provision = null;
                this.workspaceGroups = [];
                this.hostStatus = (await getDshStatus()) || {};
            } finally {
                this.loading = false;
            }
        },
    },
}
</script>

<style scoped>
.ai-container {
    width: 100%;
    height: 100%;
    overflow: hidden;
}

.ai-frame {
    width: 100%;
    height: 100%;
    border: none;
}

.dsh-panel {
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    overflow-y: auto;
    padding: 28px 32px 40px;
    background: var(--background-primary, #fff);
    color: var(--text-primary, #1f2329);
}

.dsh-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 20px;
}

.dsh-header h1 {
    margin: 0;
    font-size: 22px;
    font-weight: 600;
}

.dsh-subtitle {
    margin: 4px 0 0;
    font-size: 12px;
    color: var(--text-secondary, #8a8f99);
}

.dsh-state {
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 12px;
    background: #eee;
    color: #666;
}

.dsh-state-running { background: #e7f7ed; color: #1a7f37; }
.dsh-state-starting, .dsh-state-restarting { background: #e8f1ff; color: #1d4ed8; }
.dsh-state-error, .dsh-state-crashed { background: #fdecec; color: #b42318; }

.dsh-card {
    border: 1px solid var(--border-color, #e5e6eb);
    border-radius: 10px;
    padding: 16px 18px;
    margin-bottom: 14px;
    background: var(--background-secondary, #fafbfc);
}

.dsh-card h2 {
    margin: 0 0 10px;
    font-size: 14px;
    font-weight: 600;
}

.dsh-card dl {
    display: grid;
    grid-template-columns: 110px 1fr;
    gap: 6px 12px;
    margin: 0;
    font-size: 13px;
}

.dsh-card dt { color: var(--text-secondary, #8a8f99); }
.dsh-card dd { margin: 0; word-break: break-all; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }

.dsh-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 8px;
}

.dsh-btn {
    border: 1px solid var(--border-color, #d0d3d9);
    background: #fff;
    color: inherit;
    border-radius: 6px;
    padding: 7px 12px;
    font-size: 13px;
    cursor: pointer;
}

.dsh-btn.primary { background: #1d4ed8; border-color: #1d4ed8; color: #fff; }
.dsh-btn.danger { color: #b42318; border-color: #f1b5b0; }
.dsh-btn:disabled { opacity: .55; cursor: default; }

.dsh-error {
    border: 1px solid #f1b5b0;
    background: #fff6f5;
    border-radius: 10px;
    padding: 16px 18px;
    color: #b42318;
    margin-bottom: 16px;
}

.dsh-error p { margin: 6px 0 12px; color: #7a271a; font-size: 13px; }
.dsh-loading, .dsh-updated { font-size: 12px; color: var(--text-secondary, #8a8f99); margin-top: 10px; }
.dsh-empty { font-size: 13px; color: var(--text-secondary, #8a8f99); }
.dsh-workspace { margin-bottom: 12px; }
.dsh-workspace-title { display: flex; justify-content: space-between; font-size: 13px; font-weight: 600; margin-bottom: 6px; }
.dsh-workspace-meta { font-weight: 400; color: var(--text-secondary, #8a8f99); }
.dsh-group-list { list-style: none; margin: 0; padding: 0; }
.dsh-group-list li { display: flex; align-items: center; justify-content: space-between; padding: 7px 8px; border-radius: 6px; cursor: pointer; font-size: 13px; }
.dsh-group-list li:hover { background: rgba(29, 78, 216, .08); }
.dsh-group-badge { font-size: 11px; color: #8a8f99; border: 1px solid #e5e6eb; border-radius: 999px; padding: 1px 6px; }
.dsh-mini-btn {
    margin-left: 6px;
    padding: 1px 7px;
    border: 1px solid var(--border-color, #d0d3d9);
    border-radius: 4px;
    background: #fff;
    color: inherit;
    font-size: 11px;
    cursor: pointer;
}
.dsh-empty code {
    padding: 1px 4px;
    border-radius: 3px;
    background: #eef0f3;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
.dsh-quick-actions {
    display: flex;
    gap: 8px;
    margin: 0 0 16px;
}

.dsh-header-right { display: flex; align-items: center; gap: 8px; }
.dsh-icon-btn {
    width: 28px; height: 28px; border-radius: 50%;
    border: 1px solid var(--border-color, #e5e6eb);
    background: transparent; color: inherit; cursor: pointer; font-size: 16px;
}
.dsh-icon-btn:hover { background: var(--background-item-hover, #f2f3f5); }
.dsh-eyebrow {
    font-size: 10px; letter-spacing: .12em; font-weight: 700;
    color: #1d4ed8; margin-bottom: 2px;
}
.dsh-quick-actions {
    display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 16px;
}
.dsh-btn.ghost { background: transparent; color: var(--text-secondary, #6b7280); }
.dsh-tabs {
    display: flex; gap: 4px; padding: 4px; margin-bottom: 16px;
    border-radius: 8px; background: var(--background-secondary, #f5f6f8);
}
.dsh-tab {
    flex: 1; border: 0; background: transparent; color: var(--text-secondary, #6b7280);
    border-radius: 6px; padding: 7px 10px; font-size: 13px; cursor: pointer;
    display: inline-flex; align-items: center; justify-content: center; gap: 6px;
}
.dsh-tab:hover { color: var(--text-primary, #1f2329); }
.dsh-tab.active {
    background: #fff; color: #1d4ed8; font-weight: 600;
    box-shadow: 0 1px 3px rgba(15, 23, 42, .08);
}
.dsh-tab-count {
    min-width: 18px; padding: 0 5px; border-radius: 999px;
    background: #e8edf7; color: #1d4ed8; font-size: 10px; line-height: 18px;
}
.dsh-section { display: flex; flex-direction: column; gap: 14px; }
.dsh-overview-grid {
    display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px;
}
.dsh-stat {
    display: flex; flex-direction: column; gap: 4px; padding: 14px;
    border: 1px solid var(--border-color, #e5e6eb); border-radius: 10px;
    background: var(--background-secondary, #fafbfc);
}
.dsh-stat-label { font-size: 11px; color: var(--text-secondary, #8a8f99); }
.dsh-stat strong { font-size: 18px; font-weight: 650; }
.dsh-stat .dsh-stat-model { font-size: 14px; word-break: break-all; }
.dsh-stat-sub { font-size: 11px; color: var(--text-secondary, #8a8f99); }
.dsh-stat .dsh-state { align-self: flex-start; padding: 2px 8px; font-size: 11px; }
.dsh-card-head, .dsh-section-head {
    display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;
    margin-bottom: 10px;
}
.dsh-card-head h2, .dsh-section-head h2 { margin: 0; }
.dsh-section-head h2 { font-size: 16px; }
.dsh-link-btn {
    border: 0; background: transparent; color: #1d4ed8;
    font-size: 12px; cursor: pointer; padding: 2px 0;
}
.dsh-card-head { margin-bottom: 4px; }
.dsh-group-list-card {
    border: 1px solid var(--border-color, #e5e6eb); border-radius: 8px;
    overflow: hidden; background: #fff;
}
.dsh-group-list-card li { border-bottom: 1px solid var(--border-color, #f0f1f3); }
.dsh-group-list-card li:last-child { border-bottom: 0; }
.dsh-group-main { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.dsh-group-ws { font-size: 11px; color: var(--text-secondary, #8a8f99); }
.dsh-group-id { font-size: 10px; color: var(--text-secondary, #a0a5ad); max-width: 360px; overflow: hidden; text-overflow: ellipsis; }
.dsh-group-arrow { color: #b0b5bd; font-size: 18px; margin-left: 8px; }
.dsh-robot-summary {
    display: flex; align-items: center; justify-content: space-between; gap: 16px;
}
.dsh-robot-summary h2 { margin-bottom: 6px; }
.dsh-robot-name { margin: 0; font-size: 15px; font-weight: 600; }
.dsh-muted { color: var(--text-secondary, #8a8f99); font-size: 12px; margin: 2px 0 0; }
.dsh-summary-actions { display: flex; gap: 8px; flex-shrink: 0; }
.dsh-empty-card {
    border: 1px dashed var(--border-color, #d0d3d9); border-radius: 10px;
    padding: 32px 20px; text-align: center; background: var(--background-secondary, #fafbfc);
}
.dsh-empty-card strong { display: block; margin-bottom: 6px; }
.dsh-empty-card p { color: var(--text-secondary, #8a8f99); font-size: 13px; margin: 0 0 14px; }
.dsh-workspace {
    border: 1px solid var(--border-color, #e5e6eb); border-radius: 10px;
    padding: 14px; background: var(--background-secondary, #fafbfc);
}
.dsh-workspace-title {
    display: flex; align-items: center; justify-content: space-between;
    gap: 12px; margin-bottom: 8px;
}
.dsh-workspace-name { font-size: 14px; font-weight: 600; }
.dsh-workspace-meta { margin-left: 8px; font-size: 11px; font-weight: 400; color: var(--text-secondary, #8a8f99); }
.dsh-actions { margin-top: 0; }
@media (max-width: 720px) {
    .dsh-panel { padding: 18px 16px 32px; }
    .dsh-overview-grid { grid-template-columns: 1fr; }
    .dsh-quick-actions .dsh-btn { flex: 1; }
}

.dsh-group-card {
    border: 1px solid var(--border-color, #e5e6eb); border-radius: 10px;
    padding: 14px; background: var(--background-secondary, #fafbfc);
}
.dsh-group-card-head {
    display: flex; align-items: center; justify-content: space-between; gap: 10px;
    margin-bottom: 4px;
}
.dsh-group-card-head > div:first-child { display: flex; align-items: center; gap: 8px; min-width: 0; }
.dsh-group-card-head strong { font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsh-meta-row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.dsh-meta-pill {
    padding: 1px 7px; border-radius: 999px; border: 1px solid var(--border-color, #e5e6eb);
    color: var(--text-secondary, #8a8f99); font-size: 10px; white-space: nowrap;
}
.dsh-robot-list { margin-top: 10px; display: flex; flex-direction: column; gap: 5px; }
.dsh-robot-row {
    display: flex; align-items: center; gap: 6px; min-width: 0;
    font-size: 11px; padding: 5px 7px; border-radius: 6px;
    background: var(--background-primary, #fff); border: 1px solid var(--border-color, #f0f1f3);
}
.dsh-robot-dot { width: 6px; height: 6px; border-radius: 50%; background: #b0b5bd; flex: 0 0 auto; }
.dsh-robot-dot.local { background: #1a7f37; }
.dsh-session-id { color: var(--text-secondary, #8a8f99); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsh-remote-label { margin-left: auto; color: var(--text-secondary, #8a8f99); flex: 0 0 auto; }

.dsh-tabs { flex-wrap: wrap; }
.dsh-tab { flex: 1 0 80px; }
.dsh-log {
    margin: 0; padding: 14px; max-height: 520px; overflow: auto;
    background: #0f172a; color: #dbe4f0; border-radius: 10px;
    font: 11px/1.55 ui-monospace, SFMono-Regular, Menlo, monospace;
    white-space: pre-wrap; word-break: break-all;
}
.dsh-route-row {
    display: flex; gap: 10px; padding: 12px 14px;
    border: 1px solid var(--border-color, #e5e6eb); border-radius: 10px;
    background: var(--background-secondary, #fafbfc);
}
.dsh-route-action {
    flex: 0 0 auto; align-self: flex-start; padding: 2px 8px; border-radius: 999px;
    font-size: 10px; font-weight: 600; background: #eef2f7; color: #475569;
}
.dsh-route-action.route-assign { background: #e8f1ff; color: #1d4ed8; }
.dsh-route-action.route-reply { background: #e7f7ed; color: #1a7f37; }
.dsh-route-action.route-none { background: #f2f3f5; color: #6b7280; }
.dsh-route-main { min-width: 0; flex: 1; }
.dsh-route-title { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 11px; }
.dsh-route-desc { margin: 3px 0 0; font-size: 12px; color: var(--text-secondary, #6b7280); }
.dsh-route-text { margin: 4px 0 0; font-size: 12px; color: var(--text-primary, #1f2329); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsh-back-btn {
    border: 0; background: transparent; color: #6b7280; font-size: 12px;
    cursor: pointer; padding: 4px 6px;
}
.dsh-back-btn:hover { color: #1d4ed8; }
</style>
