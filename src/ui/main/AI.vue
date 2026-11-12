<template>
    <div class="ai-container">
        <iframe
            v-if="aiPortalUrl"
            :src="aiPortalUrl"
            class="ai-frame"
            frameborder="0"
            allow="microphone; camera"
        ></iframe>

        <div v-else class="dsh-panel" :class="{ 'with-window-controls': reserveWindowControls }">
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

            <div v-if="error" class="dsh-error">
                <strong>DSH 暂不可用</strong>
                <p>{{ error }}</p>
                <div class="dsh-actions">
                    <button class="dsh-btn primary" :disabled="loading" @click="refreshProvision(true)">重试开通</button>
                    <button class="dsh-btn" @click="openAiAgentSettings">查看 AI 服务</button>
                </div>
            </div>

            <div v-if="insecureGateway" class="dsh-warn">
                <strong>网关使用未加密连接</strong>
                <p class="mono">{{ robot.gatewayUrl }}</p>
                <p>生产环境请改用 <code>wss://</code>；<code>ws://</code> 仅建议用于本机或可信内网。</p>
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

                <div class="dsh-content" :class="{ 'dsh-content-logs': activeTab === 'logs' }">
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

                    <section class="dsh-card dsh-my-stats" v-if="myStats">
                        <div class="dsh-card-head">
                            <h2>我的用量</h2>
                            <button class="dsh-link-btn" :disabled="statsLoading" @click="loadMyStats">
                                {{ statsLoading ? '刷新中…' : '刷新' }}
                            </button>
                        </div>
                        <div class="dsh-overview-grid">
                            <div class="dsh-stat">
                                <span class="dsh-stat-label">今日请求</span>
                                <strong>{{ myStats.today.requests || 0 }}</strong>
                                <span class="dsh-stat-sub">{{ myStats.today.errors || 0 }} 个错误 · {{ myStats.today.avgLatencyMs || 0 }} ms</span>
                            </div>
                            <div class="dsh-stat">
                                <span class="dsh-stat-label">今日 Tokens</span>
                                <strong>{{ formatToken(myStats.today.totalTokens) }}</strong>
                                <span class="dsh-stat-sub">缓存 {{ formatToken(myStats.today.cachedInputTokens) }} · 输出 {{ formatToken(myStats.today.outputTokens) }}</span>
                            </div>
                            <div class="dsh-stat">
                                <span class="dsh-stat-label">今日费用</span>
                                <strong>{{ formatCost(myStats.today.cost) }}</strong>
                                <span class="dsh-stat-sub">按人民币单价</span>
                            </div>
                            <div class="dsh-stat">
                                <span class="dsh-stat-label">额度</span>
                                <strong>{{ quotaText(myStats.quota) }}</strong>
                                <span class="dsh-stat-sub">今日剩余 {{ myStats.quota.dailyTokenRemaining < 0 ? '不限' : formatToken(myStats.quota.dailyTokenRemaining) }} tokens</span>
                            </div>
                            <div class="dsh-stat">
                                <span class="dsh-stat-label">本月 Tokens</span>
                                <strong>{{ formatToken(myStats.month.totalTokens) }}</strong>
                                <span class="dsh-stat-sub">输入 {{ formatToken(myStats.month.inputTokens) }} · 输出 {{ formatToken(myStats.month.outputTokens) }}</span>
                            </div>
                            <div class="dsh-stat">
                                <span class="dsh-stat-label">本月费用</span>
                                <strong>{{ formatCost(myStats.month.cost) }}</strong>
                                <span class="dsh-stat-sub">按服务器本月统计</span>
                            </div>
                        </div>
                    </section>

                    <section class="dsh-card">
                        <div class="dsh-card-head">
                            <h2>最近会话</h2>
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
                            <dt>显示名</dt>
                            <dd>
                                <template v-if="robotNameEditing">
                                    <input v-model.trim="robotNameDraft" class="dsh-inline-input" maxlength="64"
                                           @keyup.enter="saveRobotName" @keyup.esc="cancelRenameRobot">
                                    <button class="dsh-mini-btn" :disabled="robotNameSaving" @click="saveRobotName">
                                        {{ robotNameSaving ? '保存中…' : '保存' }}
                                    </button>
                                    <button class="dsh-mini-btn" :disabled="robotNameSaving" @click="cancelRenameRobot">取消</button>
                                </template>
                                <template v-else>
                                    {{ robot.displayName || 'DSH 助手' }}
                                    <button v-if="robot.robotId" class="dsh-mini-btn" @click="startRenameRobot">修改</button>
                                </template>
                            </dd>
                            <dt>Owner</dt><dd class="mono">{{ robot.owner || '-' }}</dd>
                            <dt>Gateway</dt><dd class="mono">{{ robot.gatewayUrl || '-' }}</dd>
                            <dt>Gateway 状态</dt><dd>{{ gatewayText }}</dd>
                        </dl>
                    </section>
                    <section class="dsh-card">
                        <h2>模型</h2>
                        <dl>
                            <dt>Provider</dt><dd>{{ ai.provider || '-' }}</dd>
                            <dt>模型</dt><dd>{{ ai.model || '-' }}</dd>
                            <dt>推理等级</dt><dd>{{ ai.reasoningEffort || '-' }}</dd>
                            <dt>AI 配置</dt><dd>{{ aiStateText }}</dd>
                            <dt>AI 凭证</dt>
                            <dd :class="{ 'dsh-token-expired': aiTokenExpired }">
                                {{ ai.expiresAt ? ('代理 token，' + formatTime(ai.expiresAt) + ' 到期') : '服务端直连 key' }}
                            </dd>
                        </dl>
                    </section>
                </section>

                <!-- AI 服务 -->
                <section v-else-if="activeTab === 'aiAgent'" class="dsh-section">
                    <div class="dsh-section-head">
                        <div>
                            <h2>AI Agent 服务</h2>
                            <p class="dsh-muted">独立 AI 网关：服务地址由部署配置提供，此处只读，展示当前连接、客户端 Key 与模型。</p>
                        </div>
                    </div>

                    <section v-if="aiAgentView" class="dsh-card">
                        <div class="dsh-card-head">
                            <h2>{{ aiAgentView.configured ? '当前连接' : '已保存的服务地址' }}</h2>
                            <span class="dsh-perm-pill" :class="aiAgentView.configured ? 'safe' : 'warn'">
                                {{ aiAgentView.configured ? '已配置' : '待配置' }}
                            </span>
                        </div>
                        <dl>
                            <dt>服务地址</dt><dd class="mono">{{ aiAgentView.serverUrl || '-' }}</dd>
                            <dt>用户</dt><dd>{{ aiAgentView.user && aiAgentView.user.name || '-' }}</dd>
                            <dt>模型</dt><dd class="mono">{{ aiAgentView.model || '-' }}</dd>
                            <dt>客户端 Key</dt><dd class="mono">{{ aiAgentView.apiKeyMasked || '-' }}</dd>
                            <dt>配置来源</dt>
                            <dd>
                                模型 {{ aiAgentView.source && aiAgentView.source.model || '-' }} ·
                                Key {{ aiAgentView.source && aiAgentView.source.providerApiKey || '-' }}
                            </dd>
                            <dt>凭证到期</dt>
                            <dd :class="{ 'dsh-token-expired': aiAgentView.expiresAt && aiAgentView.expiresAt < Date.now() }">
                                {{ aiAgentView.expiresAt ? formatTime(aiAgentView.expiresAt) : '-' }}
                            </dd>
                        </dl>
                        <div class="dsh-actions">
                            <button class="dsh-btn" @click="loadAiAgent">刷新</button>
                        </div>
                    </section>
                    <div v-else class="dsh-empty-card">
                        <strong>尚未连接 AI 服务</strong>
                        <p>服务地址由部署配置提供，无法在此修改；配置完成后重新登录或刷新即可。</p>
                    </div>

                    <section class="dsh-card">
                        <div class="dsh-card-head">
                            <h2>语音消息转文字</h2>
                            <span class="dsh-perm-pill" :class="asrServer ? 'safe' : 'warn'">
                                {{ asrServer ? '已开启' : '未开启' }}
                            </span>
                        </div>
                        <p class="dsh-muted">
                            群里的语音消息会先转成文字再交给 DSH。默认取客户端配置的 ASR 地址（asr-api）。
                            该接口需要关闭鉴权（asr-api 的 <code>server.need_auth=false</code>），否则插件请求会被 401 拒绝；
                            留空则关闭，语音消息按文件处理。
                        </p>
                        <label class="dsh-field">
                            <span>ASR 服务地址</span>
                            <input v-model.trim="asrServerDraft" placeholder="http://127.0.0.1:8300/asr"/>
                        </label>
                        <div class="dsh-actions">
                            <button class="dsh-btn primary" :disabled="savingAsr" @click="saveAsr">
                                {{ savingAsr ? '保存中…' : '保存并重启 Host' }}
                            </button>
                            <button class="dsh-btn" :disabled="savingAsr || !asrServer" @click="clearAsr">关闭</button>
                        </div>
                    </section>

                </section>

                <!-- 权限 -->
                <section v-else-if="activeTab === 'permissions'" class="dsh-section">
                    <div class="dsh-section-head">
                        <div>
                            <h2>权限</h2>
                            <p class="dsh-muted">应用注入的默认策略；会话内可单独切换沙箱与审批。</p>
                        </div>
                    </div>
                    <div v-if="!permissions" class="dsh-empty-card">
                        <strong>Host 尚未启动</strong>
                        <p>Host 运行后会在这里显示实际生效的权限策略。</p>
                    </div>
                    <template v-else>
                        <section class="dsh-card">
                            <h2>默认策略</h2>
                            <dl>
                                <dt>文件沙箱</dt>
                                <dd><span class="dsh-perm-pill" :class="sandboxClass">{{ sandboxLabel }}</span></dd>
                                <dt>工具审批</dt><dd>{{ approvalLabel }}</dd>
                                <dt>私聊</dt>
                                <dd>{{ permissions.privateOwnerOnly ? '仅 owner / 管理员' : '所有能添加机器人的人' }}</dd>
                                <dt>群内审批</dt>
                                <dd>{{ permissions.approvalOwnerOnly ? '敏感操作由机器人 owner 审批' : '由任务发起人审批' }}</dd>
                                <dt>成员发起任务</dt>
                                <dd>{{ permissions.allowGuestTurns ? '允许（群成员可对话）' : '仅 owner / 管理员' }}</dd>
                                <dt>未注册群</dt><dd>忽略（只服务本机创建的 DSH 群）</dd>
                                <dt>管理员</dt>
                                <dd class="mono">{{ (permissions.adminUsers || []).join(', ') || '-' }}</dd>
                                <dt>工作区根</dt>
                                <dd class="mono">{{ permissions.workspaceRoot || '-' }}</dd>
                            </dl>
                        </section>
                        <section class="dsh-card">
                            <h2>会话级权限</h2>
                            <p class="dsh-muted">在会话输入框的 AI 面板中切换，或直接发送命令（仅群创建者/管理员）：</p>
                            <ul class="dsh-perm-list">
                                <li><code>/sandbox read-only</code><span>只读，不修改文件</span></li>
                                <li><code>/sandbox workspace-write</code><span>仅可写当前工作区（默认）</span></li>
                                <li><code>/sandbox danger-full-access</code><span>不限制文件写入，谨慎使用</span></li>
                                <li><code>/approval ask</code><span>需要审批的操作弹卡片（默认）</span></li>
                                <li><code>/approval never</code><span>不弹卡片，需要审批的操作直接拒绝</span></li>
                            </ul>
                        </section>
                        <section class="dsh-card">
                            <div class="dsh-card-head">
                                <h2>最近权限事件</h2>
                                <button class="dsh-btn" :disabled="auditLoading" @click="loadAudit">刷新</button>
                            </div>
                            <div v-if="!auditRecords.length" class="dsh-empty">
                                暂无记录。准入拒绝、管理命令、审批与权限变更会写入本机审计日志（dsh-home/wildfire-audit.jsonl）。
                            </div>
                            <ul v-else class="dsh-audit-list">
                                <li v-for="(e, i) in auditRecords" :key="e.ts + '-' + i">
                                    <span class="dsh-audit-kind" :class="auditClass(e.kind)">{{ auditKindText(e.kind) }}</span>
                                    <div class="dsh-audit-main">
                                        <div class="dsh-audit-title">
                                            <span class="mono">{{ auditName(e.actor) }}</span>
                                            <span class="dsh-muted">{{ formatTime(e.ts) }}</span>
                                        </div>
                                        <p class="dsh-audit-desc">{{ auditText(e) }}</p>
                                    </div>
                                </li>
                            </ul>
                        </section>
                    </template>
                </section>

                <!-- 模型 -->
                <section v-else-if="activeTab === 'models'" class="dsh-section">
                    <DshModelSettings :ai="ai"/>
                </section>

                <!-- Agent 预设 -->
                <section v-else-if="activeTab === 'presets'" class="dsh-section">
                    <DshPresets/>
                </section>

                <!-- 技能 -->
                <section v-else-if="activeTab === 'skills'" class="dsh-section">
                    <DshSkills/>
                </section>

                <!-- 主会话 -->
                <section v-else-if="activeTab === 'mainSession'" class="dsh-section">
                    <DshMainSession/>
                </section>

                <!-- 插件 -->
                <section v-else-if="activeTab === 'plugins'" class="dsh-section">
                    <DshPlugins embedded/>
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
                </div>
            </template>
        </div>
    </div>
</template>

<script>
import Config from "../../config";
import {
    clearDshProvision,
    getDshAiAgent,
    getDshAiAgentStats,
    getDshAudit,
    getDshLocalSettings,
    getDshLog,
    getDshRouting,
    setDshAsrServer,
    getDshStatus,
    renameDshRobot,
    isDshSupported,
    onDshStatus,
    openDshLog,
    provisionDsh,
    restartDsh,
} from "../../dsh/renderer/dshClient";
import wfc from "../../wfc/client/wfc";
import { agentRobotName } from "../util/agentState";
import store from "../../store";
import Conversation from "../../wfc/model/conversation";
import TextMessageContent from "../../wfc/messages/textMessageContent";
import ModifyGroupInfoType from "../../wfc/model/modifyGroupInfoType";
import DshModelSettings from "./dsh/DshModelSettings.vue";
import DshPresets from "./dsh/DshPresets.vue";
import DshSkills from "./dsh/DshSkills.vue";
import DshMainSession from "./dsh/DshMainSession.vue";
import DshPlugins from "./dsh/DshPlugins.vue";

export default {
    name: 'AI',
    components: { DshModelSettings, DshPlugins, DshPresets, DshSkills, DshMainSession },
    computed: {
        aiPortalUrl() {
            return Config.AI_PORTAL_URL;
        },
        reserveWindowControls() {
            // Windows/Linux 主窗口右上角是自绘的最小化/最大化/关闭按钮；
            // 设置页顶部内容需要从按钮下方开始，避免“返回 DSH”等按钮被压住。
            const misc = store.state.misc;
            return !!(misc.isElectron && (misc.isElectronWindowsOrLinux || misc.isOhos));
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
        aiStateText() {
            const ai = this.ai;
            if (!ai || (!ai.baseUrl && !ai.model)) return '未配置';
            if (ai.enabled === false) return '已停用';
            return ai.configured ? '已配置' : '未配置';
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
        insecureGateway() {
            const url = this.robot.gatewayUrl || '';
            if (!url.startsWith('ws://')) return false;
            try {
                const host = new URL(url).hostname;
                return !['localhost', '127.0.0.1', '::1', '[::1]'].includes(host);
            } catch (e) {
                return true;
            }
        },
        workspaceCount() {
            return this.workspaceGroups.length;
        },
        groupCount() {
            return this.workspaceGroups.reduce((n, ws) => n + ws.groups.length, 0);
        },
        permissions() {
            return (this.hostStatus && this.hostStatus.permissions) || null;
        },
        aiTokenExpired() {
            return !!(this.ai && this.ai.expiresAt && Number(this.ai.expiresAt) < Date.now());
        },
        aiAgentView() {
            return (this.aiAgent && this.aiAgent.view) || null;
        },
        sandboxLabel() {
            const v = this.permissions && this.permissions.sandbox;
            return ({
                'read-only': '只读',
                'workspace-write': '仅工作区可写',
                'danger-full-access': '完全放开',
            })[v] || v || '-';
        },
        sandboxClass() {
            const v = this.permissions && this.permissions.sandbox;
            if (v === 'danger-full-access') return 'danger';
            if (v === 'workspace-write') return 'warn';
            return 'safe';
        },
        approvalLabel() {
            const v = this.permissions && this.permissions.approval;
            return v === 'ask' ? '每次询问' : v === 'never' ? '不询问（直接拒绝）' : (v || '-');
        },
        recentGroups() {
            return this.workspaceGroups
                .flatMap(ws => ws.groups.map(g => ({ ...g, workspaceName: ws.name })))
                .slice(0, 5);
        },
        tabs() {
            return [
                { id: 'overview', label: '概览' },
                { id: 'robot', label: '机器人' },
                { id: 'aiAgent', label: 'AI 服务' },
                { id: 'permissions', label: '权限' },
                { id: 'models', label: '模型' },
                { id: 'presets', label: '预设' },
                { id: 'skills', label: '技能' },
                { id: 'mainSession', label: '主会话' },
                { id: 'plugins', label: '插件' },
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
            offStatus: null,
            workspaceGroups: [],
            creatingSession: false,
            asrServer: '',
            asrServerDraft: '',
            asrServerDefault: '',
            savingAsr: false,
            activeTab: 'overview',
            logText: '',
            aiAgent: null,
            robotNameEditing: false,
            robotNameDraft: '',
            robotNameSaving: false,
            myStats: null,
            statsLoading: false,
            routingRecords: [],
            auditRecords: [],
            logLoading: false,
            routingLoading: false,
            auditLoading: false,
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
            if (id === 'overview') this.loadMyStats();
            if (id === 'logs') this.loadLog();
            if (id === 'routing') this.loadRouting();
            if (id === 'aiAgent') {
                this.loadAiAgent();
                this.loadAsrSettings();
            }
            if (id === 'permissions') this.loadAudit();
            if (id === 'models') this.refreshProvision(true);
        },
        async loadAsrSettings() {
            // 客户端已配置的 ASR 地址（src/config.js 的 ASR_SERVER）：作为默认值预填，
            // 用户点保存后才真正启用（会重启 Host 并把 asrServer 写进插件配置）。
            this.asrServerDefault = Config.getAsrServer() || '';
            try {
                const res = await getDshLocalSettings();
                const saved = (res && res.ok && res.settings && res.settings.asrServer) || '';
                this.asrServer = saved;
                this.asrServerDraft = saved || this.asrServerDefault;
            } catch (e) {
                this.asrServer = '';
                this.asrServerDraft = this.asrServerDefault;
            }
        },
        async saveAsr() {
            if (this.savingAsr) return;
            this.savingAsr = true;
            try {
                const res = await setDshAsrServer(this.asrServerDraft || '');
                if (!res || !res.ok) {
                    this.$notify({ title: '保存失败', text: (res && res.error) || '', type: 'error' });
                    return;
                }
                this.asrServer = (res.settings && res.settings.asrServer) || '';
                this.asrServerDraft = this.asrServer;
                this.$notify({
                    title: this.asrServer ? '语音转文字已开启' : '语音转文字已关闭',
                    text: this.asrServer ? '新消息生效' : '',
                    type: 'success',
                });
            } finally {
                this.savingAsr = false;
            }
        },
        async clearAsr() {
            this.asrServerDraft = '';
            await this.saveAsr();
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
        openAiAgentSettings() {
            this.error = '';
            this.activeTab = 'aiAgent';
            this.loadAiAgent();
        },
        async loadMyStats() {
            if (!isDshSupported() || !wfc.getUserId()) return;
            this.statsLoading = true;
            try {
                const result = await getDshAiAgentStats(wfc.getUserId());
                this.myStats = result && result.ok ? result.stats : null;
            } catch (e) {
                this.myStats = null;
            } finally {
                this.statsLoading = false;
            }
        },
        formatCost(value) {
            return '¥' + (Number(value) || 0).toFixed(2);
        },
        formatToken(value) {
            const n = Number(value) || 0;
            const abs = Math.abs(n);
            if (abs < 10000) return n.toLocaleString('zh-CN');
            const units = [[1e12, '万亿'], [1e8, '亿'], [1e4, '万']];
            for (const [base, unit] of units) {
                if (abs >= base) {
                    const text = (n / base).toFixed(2).replace(/\.?0+$/, '');
                    if (unit === '万' && Number(text) >= 10000) {
                        return (n / 1e8).toFixed(2).replace(/\.?0+$/, '') + '亿';
                    }
                    return text + unit;
                }
            }
            return n.toLocaleString('zh-CN');
        },
        quotaText(quota) {
            if (!quota) return '-';
            if (quota.monthlyBudgetCny > 0) return '¥' + Math.max(0, quota.monthRemainingCny).toFixed(2);
            if (quota.dailyTokenLimit > 0) return this.formatToken(Math.max(0, quota.dailyTokenRemaining)) + ' tokens';
            return '不限';
        },
        startRenameRobot() {
            this.robotNameDraft = this.robot.displayName || 'DSH 助手';
            this.robotNameEditing = true;
        },
        cancelRenameRobot() {
            if (this.robotNameSaving) return;
            this.robotNameEditing = false;
            this.robotNameDraft = '';
        },
        async saveRobotName() {
            if (this.robotNameSaving) return;
            const displayName = (this.robotNameDraft || '').trim();
            if (!displayName) {
                this.$notify({ title: '显示名不能为空', type: 'error' });
                return;
            }
            if (displayName.length > 64) {
                this.$notify({ title: '显示名过长', text: '最多 64 个字符', type: 'error' });
                return;
            }
            this.robotNameSaving = true;
            try {
                const result = await renameDshRobot(wfc.getUserId(), displayName);
                if (!result || !result.ok) throw new Error((result && result.error) || '修改失败');
                if (result.provision) this.provision = result.provision;
                // Force-refresh the IM user cache so the robot name updates in
                // conversations/sidebars instead of waiting for a later sync.
                const robotId = (result.provision && result.provision.robot && result.provision.robot.robotId)
                    || (this.robot && this.robot.robotId);
                if (robotId) wfc.getUserInfo(robotId, true);
                this.robotNameEditing = false;
                this.robotNameDraft = '';
                this.$notify({ title: '机器人显示名已修改', text: displayName, type: 'success' });
            } catch (e) {
                this.$notify({ title: '修改失败', text: e.message || String(e), type: 'error' });
            } finally {
                this.robotNameSaving = false;
            }
        },
        async loadAiAgent() {
            try {
                const result = await getDshAiAgent(wfc.getUserId());
                this.aiAgent = result && result.ok ? result : null;
            } catch (e) {
                this.aiAgent = null;
            }
        },
        async loadAudit() {
            this.auditLoading = true;
            try { this.auditRecords = await getDshAudit(80); } catch (e) { this.auditRecords = []; }
            finally { this.auditLoading = false; }
        },
        auditKindText(kind) {
            return ({
                'admission.denied': '准入拒绝',
                'command.executed': '管理命令',
                'command.denied': '命令拒绝',
                'permission.changed': '权限变更',
                'approval.requested': '审批请求',
                'approval.decided': '审批结果',
                'approval.timeout': '审批超时',
                'interaction.denied': '越权作答',
            })[kind] || kind || '-';
        },
        auditClass(kind) {
            if (kind === 'admission.denied' || kind === 'command.denied' || kind === 'interaction.denied' || kind === 'approval.timeout') return 'audit-danger';
            if (kind === 'permission.changed' || kind === 'approval.requested') return 'audit-warn';
            return 'audit-ok';
        },
        auditName(uid) {
            return uid ? agentRobotName(String(uid)) : '-';
        },
        auditText(e) {
            if (!e) return '-';
            const bits = [];
            if (e.command) bits.push(`/${e.command}${e.arg ? ' ' + e.arg : ''}`);
            if (e.toolName) bits.push(`工具 ${e.toolName}`);
            if (e.outcome) bits.push(e.outcome === 'allowed-once' ? '同意' : '拒绝');
            if (e.policy) bits.push(`审批 ${e.policy === 'ask' ? '每次询问' : e.policy === 'never' ? '不询问' : e.policy}`);
            if (e.approval && !e.policy) bits.push(`审批 ${e.approval === 'ask' ? '每次询问' : e.approval === 'never' ? '不询问' : e.approval}`);
            if (e.sandbox) bits.push(`沙箱 ${({ 'read-only': '只读', 'workspace-write': '工作区可写', 'danger-full-access': '完全访问' })[e.sandbox] || e.sandbox}`);
            if (e.preset) bits.push(`预设 ${e.preset}`);
            if (e.requestedBy && e.approver && e.requestedBy !== e.approver) {
                bits.push(`发起人 ${this.auditName(e.requestedBy)} / 审批人 ${this.auditName(e.approver)}`);
            }
            if (e.reason) {
                const reasonText = ({
                    'private-owner-only': '私聊非 owner',
                    whitelist: '白名单拒绝',
                    'not-creator-or-admin': '非群创建者/管理员',
                    'not-owner-or-admin': '非 owner/管理员',
                    'not-turn-owner-or-admin': '非任务发起人',
                    'panel-authorization': '面板权限不足',
                })[e.reason] || e.reason;
                bits.push(`原因 ${reasonText}`);
            }
            if (e.target) bits.push(`会话 ${this.shortGroup(e.target)}`);
            return bits.join(' · ') || '-';
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
                if (result.robotError) {
                    this.$notify({ title: 'AI 配置已更新，但机器人开通失败', text: result.robotError, type: 'error' });
                }
                this.hostStatus = result.hostStatus || (await getDshStatus()) || {};
                this.loadWorkspaces();
                this.loadAiAgent();
                this.loadMyStats();
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
    display: flex;
    flex-direction: column;
    overflow: hidden;
    padding: 28px 32px 40px;
    background: var(--background-primary, #fff);
    color: var(--text-primary, #1f2329);
}
/* Windows/Linux 上避开右上角 30px 高的自绘窗口按钮 */
.dsh-panel.with-window-controls {
    padding-top: calc(var(--height-titlebar, 30px) + 6px);
}

.dsh-inline-input {
    width: 180px; box-sizing: border-box; margin-right: 6px; padding: 4px 8px;
    border: 1px solid var(--border-color, #e5e6eb); border-radius: 6px;
    background: var(--background-primary, #fff); color: inherit; font-size: 13px;
}
.dsh-inline-input:focus { outline: none; border-color: #1d4ed8; }

.dsh-header, .dsh-tabs { flex: 0 0 auto; }
.dsh-content {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
}
.dsh-content.dsh-content-logs {
    display: flex;
    flex-direction: column;
    overflow: hidden;
}
.dsh-content-logs > .dsh-section {
    flex: 1 1 auto;
    min-height: 0;
}
.dsh-content-logs .dsh-section-head { flex: 0 0 auto; }
.dsh-content-logs .dsh-log {
    flex: 1 1 auto;
    min-height: 0;
    height: auto;
    max-height: none;
}

.dsh-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 24px;
    flex-wrap: wrap;
    margin-bottom: 20px;
}
.dsh-header > div:first-child { min-width: 0; }

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
.dsh-perm-pill {
    display: inline-block; padding: 2px 9px; border-radius: 999px;
    font-size: 11px; background: #eef2f7; color: #475569;
}
.dsh-perm-pill.safe { background: #e8f5ec; color: #1a7f37; }
.dsh-perm-pill.warn { background: #fff4e5; color: #a15c00; }
.dsh-perm-pill.danger { background: #fdecec; color: #b42318; }
.dsh-perm-list { margin: 8px 0 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 7px; }
.dsh-perm-list li { display: flex; gap: 10px; align-items: baseline; font-size: 12px; color: var(--text-secondary, #6b7280); }
.dsh-agent-form { display: flex; gap: 10px; align-items: flex-end; flex-wrap: wrap; }
.dsh-agent-form label { display: flex; flex-direction: column; gap: 4px; flex: 1 1 220px; }
.dsh-agent-form label span { font-size: 11px; color: var(--text-secondary, #8a8f99); }
.dsh-agent-form input {
    height: 34px; border: 1px solid var(--border-color, #e5e6eb); border-radius: 7px;
    padding: 0 10px; font-size: 12px; background: #fff; color: var(--text-primary, #1f2329);
}
.dsh-agent-form input:focus { outline: none; border-color: #9db4e8; }
.dsh-perm-list code {
    flex: 0 0 250px; font-size: 11px; color: var(--text-primary, #1f2329);
    background: var(--background-primary, #fff); border: 1px solid var(--border-color, #e5e6eb);
    border-radius: 4px; padding: 2px 6px;
}
.dsh-audit-list { list-style: none; margin: 8px 0 0; padding: 0; display: flex; flex-direction: column; gap: 9px; }
.dsh-audit-list li { display: flex; gap: 10px; align-items: flex-start; }
.dsh-audit-kind {
    flex: 0 0 auto; font-size: 10px; padding: 2px 7px; border-radius: 999px;
    background: #eef2f7; color: #475569; margin-top: 1px;
}
.dsh-audit-kind.audit-danger { background: #fdecec; color: #b42318; }
.dsh-audit-kind.audit-warn { background: #fff4e5; color: #a15c00; }
.dsh-audit-kind.audit-ok { background: #e8f5ec; color: #1a7f37; }
.dsh-audit-main { min-width: 0; flex: 1; }
.dsh-audit-title { display: flex; justify-content: space-between; gap: 10px; font-size: 11px; }
.dsh-audit-desc { margin: 2px 0 0; font-size: 11px; line-height: 1.5; color: var(--text-secondary, #6b7280); word-break: break-word; }
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
.dsh-warn {
    border: 1px solid #f0c987;
    background: #fffaf0;
    border-radius: 10px;
    padding: 12px 16px;
    color: #8a4b00;
    margin-bottom: 16px;
}
.dsh-warn p { margin: 4px 0 0; font-size: 12px; color: #8a5a1a; }
.dsh-warn code { background: #fff; border: 1px solid #eadcc2; border-radius: 3px; padding: 0 3px; }
.dsh-token-expired { color: #b42318; }
.dsh-loading { font-size: 12px; color: var(--text-secondary, #8a8f99); margin-top: 10px; }
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
.dsh-header-right { display: flex; align-items: center; justify-content: flex-end; gap: 8px; flex: 0 0 auto; flex-wrap: wrap; }
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
    margin: 0; padding: 14px; height: max(180px, calc(100vh - 280px)); max-height: none; overflow: auto;
    background: #0f172a; color: #dbe4f0; border-radius: 10px;
    font: 11px/1.55 ui-monospace, SFMono-Regular, Menlo, monospace;
    white-space: pre-wrap; word-break: break-all;
    user-select: text; -webkit-user-select: text; cursor: text;
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
