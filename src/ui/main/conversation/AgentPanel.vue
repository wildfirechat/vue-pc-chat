<!--
  AgentPanel.vue — AI 会话设置面板（第一层 Agent 可改属性，UI 选择式交互）
  静默通道：打开面板发 AGENT_Command(207) query（组合查询）→ 插件聚合面板数据写
  scope=31 type=3 → 本组件读 type=3 渲染（模型/effort/沙箱/计划/cwd/preset/approval）。
  所有操作发 AGENT_Command(207) set（cmd=命令文本），插件执行后写 type=1 lastChange
  （变更可见）+ 刷新 type=3；本组件监听设置更新事件重读。207 为透明消息不显示。
  目录列表（工作目录选择）不再随 type=3 下发：打开弹窗时发 207 op=dirs（带 seq/robotId）
  → 插件回 209 Agent_Command_Result（透明消息）→ 本组件按 seq 关联 pending 渲染；
  缓存 TTL 60s；5s 超时重试 1 次；无应答（老插件）回退读 type=3 的 dirs（§10）。
  会话选择：顶部「会话」行，发 207 op=sessions（seq/robotId）→ 209 列出最近 10 个历史
  会话（按最近活跃倒序）；点选发 207 op=switch（sessionId）→ 恢复该会话上下文
  （工作目录随会话切换）。5s 无应答提示重试。
-->
<template>
    <div class="agent-agent-panel" @click.stop>
        <header class="agent-agent-header">
            <span class="agent-agent-title">🤖 AI 设置<template v-if="robotShort"> · {{ robotShort }}</template></span>
            <button class="agent-agent-close" title="关闭" @click="$emit('close')">×</button>
        </header>

        <!-- body：固定最小高度，loading 与加载后不跳动 -->
        <div class="agent-agent-body">
            <div v-if="loading" class="agent-agent-loading">正在加载会话状态…</div>
            <template v-else>
                <!-- 会话（DSH 历史会话；选中恢复上下文） -->
                <div class="agent-agent-row">
                    <label class="agent-agent-label">会话</label>
                    <div class="agent-agent-row">
                        <span class="agent-agent-cwd-current">{{ currentSessionShort || '未激活' }}</span>
                        <button
                            class="agent-agent-btn agent-agent-btn-sm"
                            :disabled="applying || sessionLoading"
                            @click="openSessionPicker"
                        >选择</button>
                    </div>
                </div>

                <!-- 模型 -->
                <div class="agent-agent-row">
                    <label class="agent-agent-label">模型</label>
                    <select
                        class="agent-agent-select"
                        :value="currentModel"
                        :disabled="applying"
                        @change="selectModel($event.target.value)"
                    >
                        <option value="" disabled>— 选择模型 —</option>
                        <option v-for="m in modelOptions" :key="m.value" :value="m.value">{{ m.label }}</option>
                    </select>
                </div>

                <!-- 推理等级 -->
                <div v-if="effortOptions.length" class="agent-agent-row">
                    <label class="agent-agent-label">推理等级</label>
                    <select
                        class="agent-agent-select"
                        :value="currentEffort"
                        :disabled="applying"
                        @change="selectEffort($event.target.value)"
                    >
                        <option value="" disabled>— 选择等级 —</option>
                        <option v-for="e in effortOptions" :key="e.value" :value="e.value">{{ e.label }}</option>
                    </select>
                </div>

                <!-- 工作目录：点切换弹出独立选择窗口 -->
                <div class="agent-agent-row agent-agent-row-col">
                    <label class="agent-agent-label">工作目录</label>
                    <div class="agent-agent-row">
                        <span class="agent-agent-cwd-current">{{ currentCwd || '未设置' }}</span>
                        <button class="agent-agent-btn agent-agent-btn-sm" :disabled="applying" @click="openCwdPicker">切换</button>
                    </div>
                    <p class="agent-agent-hint">切换目录 = 切换会话（该目录上下文可恢复）</p>
                </div>

                <!-- 沙箱模式 -->
                <div class="agent-agent-row agent-agent-row-col">
                    <label class="agent-agent-label">沙箱模式</label>
                    <div class="agent-agent-radio-group">
                        <label v-for="s in sandboxModes" :key="s.value" class="agent-agent-radio">
                            <input
                                type="radio"
                                :value="s.value"
                                :checked="currentSandbox === s.value"
                                :disabled="applying"
                                @change="selectSandbox(s.value)"
                            />
                            <span>{{ s.label }}</span>
                        </label>
                    </div>
                </div>

                <!-- Agent 模式（preset）：options 为空=部署未提供 preset 服务 → 禁用但仍显示 current，不隐藏整行 -->
                <div class="agent-agent-row">
                    <label class="agent-agent-label">Agent 模式</label>
                    <select
                        class="agent-agent-select"
                        :value="currentPreset"
                        :disabled="applying || !presetOptions.length"
                        @change="selectPreset($event.target.value)"
                    >
                        <!-- current 不在 options 中（含 options 为空 / 字段整体缺失）：补 fallback 项保证当前值可见 -->
                        <option v-if="presetFallback" :value="currentPreset" disabled>{{ currentPreset }}</option>
                        <option v-for="p in presetOptions" :key="p.value" :value="p.value">{{ p.label }}</option>
                    </select>
                </div>

                <!-- 工具审批（approval）：同上，options 为空时禁用；字段缺失时控件为空且禁用 -->
                <div class="agent-agent-row">
                    <label class="agent-agent-label">工具审批</label>
                    <select
                        class="agent-agent-select"
                        :value="currentApproval"
                        :disabled="applying || !approvalOptions.length"
                        @change="selectApproval($event.target.value)"
                    >
                        <option v-if="approvalFallback" :value="currentApproval" disabled>{{ currentApproval }}</option>
                        <option v-for="a in approvalOptions" :key="a.value" :value="a.value">{{ a.label }}</option>
                    </select>
                </div>

                <!-- 计划模式 -->
                <div class="agent-agent-row">
                    <label class="agent-agent-label">计划模式</label>
                    <label class="agent-agent-switch">
                        <input type="checkbox" :checked="planOn" :disabled="applying" @change="togglePlan($event.target.checked)" />
                        <span class="agent-agent-slider"></span>
                    </label>
                    <span class="agent-agent-switch-text">{{ planOn ? '已开启（先审后做）' : '已关闭' }}</span>
                </div>

                <!-- 会话处理模式：interrupt=后到打断先到（默认） / queue=排队 -->
                <div class="agent-agent-row agent-agent-row-col">
                    <label class="agent-agent-label">会话模式</label>
                    <div class="agent-agent-radio-group">
                        <label class="agent-agent-radio">
                            <input type="radio" value="interrupt" :checked="convMode === 'interrupt'" :disabled="applying" @change="setMode('interrupt')" />
                            <span>打断（后到打断先到）</span>
                        </label>
                        <label class="agent-agent-radio">
                            <input type="radio" value="queue" :checked="convMode === 'queue'" :disabled="applying" @change="setMode('queue')" />
                            <span>排队（串行等待）</span>
                        </label>
                    </div>
                </div>
            </template>
        </div>

        <footer class="agent-agent-footer">
            <button class="agent-agent-btn" :disabled="applying || loading" @click="compact">压缩上下文</button>
            <button class="agent-agent-btn agent-agent-btn-danger" :disabled="applying || loading" @click="resetSession">重置会话</button>
            <!-- 销毁按钮不受 applying 限制：危险操作必须始终可点（点击后弹确认，确认才发送） -->
            <button class="agent-agent-btn agent-agent-btn-destroy" @click="destroyGroup">销毁会话</button>
        </footer>
        <!-- 指令提示区：常驻占位（min-height 固定），避免出现/消失导致高度跳动 -->
        <p class="agent-agent-applying">{{ applying ? '指令已发送…' : '' }}</p>

        <!-- 工作目录选择弹窗（独立窗口，数据来自 207 op=dirs → 209 应答；老插件回退 type=3 dirs） -->
        <Teleport to="body">
            <div v-if="cwdPickerOpen" class="agent-agent-picker-mask" @click="closeCwdPicker">
                <div class="agent-agent-picker" @click.stop>
                    <header class="agent-agent-header">
                        <span class="agent-agent-title">选择工作目录</span>
                        <button class="agent-agent-close" title="关闭" @click="closeCwdPicker">×</button>
                    </header>
                    <div class="agent-agent-picker-body">
                        <div v-if="cwdLoading" class="agent-agent-cwd-empty">正在获取目录列表…</div>
                        <template v-else>
                            <div v-if="cwdError" class="agent-agent-cwd-empty agent-agent-cwd-row agent-agent-cwd-error">
                                <span>{{ cwdError }}</span>
                                <button class="agent-agent-btn agent-agent-btn-sm" @click="requestDirs">重试</button>
                            </div>
                            <div v-else-if="!cwdCandidates.length" class="agent-agent-cwd-empty agent-agent-cwd-row">
                                <span>未获取到目录列表，可手动输入路径</span>
                                <button class="agent-agent-btn agent-agent-btn-sm" @click="requestDirs">重试</button>
                            </div>
                            <ul v-else class="agent-agent-cwd-list">
                                <li v-for="d in cwdCandidates" :key="d" class="agent-agent-cwd-item" @click="switchCwd(d)">
                                    📂 {{ d }}
                                </li>
                            </ul>
                        </template>
                    </div>
                    <!-- 手动输入兜底：/cwd <路径>（与目录候选同一命令） -->
                    <div class="agent-agent-picker-footer">
                        <input
                            v-model="manualCwd"
                            class="agent-agent-input"
                            type="text"
                            placeholder="手动输入目录路径"
                            @keydown.enter="switchCwdManual"
                        />
                        <button class="agent-agent-btn agent-agent-btn-sm" :disabled="!manualCwd.trim()" @click="switchCwdManual">切换</button>
                    </div>
                    <p v-if="cwdRoot" class="agent-agent-hint agent-agent-cwd-root">目录来源：{{ cwdRoot }}</p>
                </div>
            </div>
        </Teleport>

        <!-- 会话选择弹窗（207 op=sessions → 209 最近会话列表；op=switch 切换） -->
        <Teleport to="body">
            <div v-if="sessionPickerOpen" class="agent-agent-picker-mask" @click="closeSessionPicker">
                <div class="agent-agent-picker" @click.stop>
                    <header class="agent-agent-header">
                        <span class="agent-agent-title">选择会话</span>
                        <button class="agent-agent-close" title="关闭" @click="closeSessionPicker">×</button>
                    </header>
                    <div class="agent-agent-picker-body">
                        <div v-if="sessionLoading" class="agent-agent-cwd-empty">正在获取会话列表…</div>
                        <template v-else>
                            <div v-if="sessionError" class="agent-agent-cwd-empty agent-agent-cwd-row agent-agent-cwd-error">
                                <span>{{ sessionError }}</span>
                                <button class="agent-agent-btn agent-agent-btn-sm" @click="requestSessions">重试</button>
                            </div>
                            <div v-else-if="!sessionList.length" class="agent-agent-cwd-empty agent-agent-cwd-row">
                                <span>暂无历史会话</span>
                                <button class="agent-agent-btn agent-agent-btn-sm" @click="requestSessions">刷新</button>
                            </div>
                            <ul v-else class="agent-agent-cwd-list">
                                <li
                                    v-for="s in sessionList"
                                    :key="s.id"
                                    class="agent-agent-cwd-item agent-agent-session-item"
                                    @click="switchToSession(s)"
                                >
                                    <span class="agent-agent-session-time">{{ formatSessionTime(s.updatedAt) }}</span>
                                    <span class="agent-agent-session-id">{{ shortSessionId(s.id) }}</span>
                                    <span class="agent-agent-session-cwd">{{ s.cwd || '未记录工作目录' }}</span>
                                    <span v-if="s.current" class="agent-agent-session-current">当前</span>
                                </li>
                            </ul>
                        </template>
                    </div>
                    <p class="agent-agent-hint">切换会话 = 恢复该会话上下文（工作目录随会话切换）</p>
                </div>
            </div>
        </Teleport>
    </div>
</template>

<script>
import wfc from "../../../wfc/client/wfc";
import EventType from "../../../wfc/client/wfcEvent";
import AgentCommandMessageContent from "../../../wfc/messages/agentCommandMessageContent";
import MessageContentType from "../../../wfc/messages/messageContentType";
import {getAgentPanelDataFor, getAgentPanelDirsFor, agentRobotName} from "../../util/agentState";

/** 目录缓存 TTL：同一面板会话内 60s（§10.5） */
const DIRS_CACHE_TTL = 60 * 1000;
/** 目录请求超时：5s 未收到匹配 209 即重试/回退（§10.5） */
const DIRS_REQUEST_TIMEOUT = 5000;

export default {
    name: "AgentPanel",
    props: {
        conversation: {
            type: Object,
            required: true,
        },
        // 目标机器人（多机器人会话寻址；空=会话默认机器人）
        robotUid: {
            type: String,
            default: '',
        },
    },
    emits: ["close"],
    data() {
        return {
            loading: true,
            applying: false,
            panelData: null,
            cwdPickerOpen: false,
            _flashTimer: 0,
            // 会话处理模式（interrupt=后到打断 / queue=排队），选项发送 /mode
            convMode: 'interrupt',
            // ─── 目录列表（按需获取：207 op=dirs → 209 应答） ───
            cwdDirs: [],          // 目录候选（目录名）
            cwdRoot: '',          // 候选来源目录（项目根）
            cwdLoading: false,    // 请求中（弹窗内显示加载态）
            cwdError: '',         // 获取失败文案（空=无错误）
            manualCwd: '',        // 手动输入兜底（/cwd <路径>）
            cwdFallback: '',      // 209 应答里的 cwd（type=3 未就绪时兜底展示）
            _dirsCacheAt: 0,      // 目录缓存写入时间戳（TTL 60s）
            _dirSeq: 0,           // seq 自增（关联 207 请求与 209 应答）
            // ─── 会话选择（207 op=sessions/switch → 209 应答） ───
            sessionPickerOpen: false,
            sessionList: [],       // 最近会话（id/cwd/createdAt/updatedAt/eventCount/sizeBytes/current）
            sessionLoading: false,
            sessionError: '',
            currentSessionId: '',  // type=3 / 209 里的当前 session id
            _sessionSeq: 0,        // 会话列表 pending seq（0=无）
            _switchSeq: 0,         // 会话切换 pending seq
            _switchTimer: 0,
            _sessionTimer: 0,
            _seqBase: 0,           // 自增 seq 起点（首次用毫秒取模）
        };
    },
    computed: {
        robotShort() {
            return this.robotUid ? agentRobotName(this.robotUid) : '';
        },
        currentModel() {
            return (this.panelData && this.panelData.model && this.panelData.model.current) || '';
        },
        modelOptions() {
            return (this.panelData && this.panelData.model && this.panelData.model.options) || [];
        },
        currentEffort() {
            return (this.panelData && this.panelData.effort && this.panelData.effort.current) || '';
        },
        effortOptions() {
            const opts = (this.panelData && this.panelData.effort && this.panelData.effort.options) || [];
            return opts.map(v => ({value: v, label: v}));
        },
        currentCwd() {
            return (this.panelData && this.panelData.cwd) || this.cwdFallback || '';
        },
        currentSandbox() {
            return (this.panelData && this.panelData.sandbox && this.panelData.sandbox.current) || '';
        },
        sandboxModes() {
            const opts = (this.panelData && this.panelData.sandbox && this.panelData.sandbox.options) || [];
            const labels = {'read-only': '只读', 'workspace-write': '仅写工作区', 'danger-full-access': '完全放开'};
            const modes = opts.length ? opts : ['read-only', 'workspace-write', 'danger-full-access'];
            return modes.map(v => ({value: v, label: labels[v] || v}));
        },
        planOn() {
            return !!(this.panelData && this.panelData.plan && this.panelData.plan.on);
        },
        // preset（Agent 模式）/ approval（工具审批）：与 model.options 同构的 {value,label} 数组；
        // 字段整体缺失（旧插件）→ current=''、options=[]，控件禁用且不发请求。
        currentPreset() {
            return (this.panelData && this.panelData.preset && this.panelData.preset.current) || '';
        },
        presetOptions() {
            return this.panelOptions(this.panelData && this.panelData.preset && this.panelData.preset.options);
        },
        /** 非空表示 current 未出现在 options 中：用于补一条 fallback <option> 显示当前值。 */
        presetFallback() {
            return this.optionFallback(this.currentPreset, this.presetOptions);
        },
        currentApproval() {
            return (this.panelData && this.panelData.approval && this.panelData.approval.current) || '';
        },
        approvalOptions() {
            return this.panelOptions(this.panelData && this.panelData.approval && this.panelData.approval.options);
        },
        approvalFallback() {
            return this.optionFallback(this.currentApproval, this.approvalOptions);
        },
        cwdCandidates() {
            // 新插件：207 op=dirs → 209 应答（缓存 TTL 60s）；老插件：type=3 内联 dirs 回退
            return this.cwdDirs || [];
        },
        // 当前会话 id 缩短展示（前缀是会话哈希，展示无意义）
        currentSessionShort() {
            return this.currentSessionId ? this.shortSessionId(this.currentSessionId) : '';
        },
    },
    created() {
        // seq → {robotId, timer, attempt}：非响应式（内含定时器句柄，不放进 data 避免被代理）
        this._dirPending = new Map();
    },
    async mounted() {
        // 设置更新事件：插件执行更新/查询后写 type=3，重读刷新
        wfc.eventEmitter.on(EventType.SettingUpdate, this.refreshPanelData);
        // 209 应答：目录列表按需获取（透明消息，不显示在消息流）
        wfc.eventEmitter.on(EventType.ReceiveMessage, this.onReceiveMessage);
        // ESC 关闭面板（目录弹窗优先）
        window.addEventListener("keydown", this.onKeyDown);
        // 先读已有面板数据（若有），再发组合查询刷新
        await this.refreshPanelData();
        this.loading = false;
        // 组合查询：插件聚合面板数据写 type=3（不回复消息）
        this.sendCommand("query");
    },
    beforeUnmount() {
        wfc.eventEmitter.removeListener(EventType.SettingUpdate, this.refreshPanelData);
        wfc.eventEmitter.removeListener(EventType.ReceiveMessage, this.onReceiveMessage);
        window.removeEventListener("keydown", this.onKeyDown);
        clearTimeout(this._flashTimer);
        // 组件销毁：清掉未完成的目录/会话请求，避免定时器泄漏/回调打到已销毁实例
        this.cancelPendingDirs();
        this.cancelSessionRequest();
    },
    methods: {
        onKeyDown(e) {
            if (e.key !== "Escape") return;
            if (this.sessionPickerOpen) {
                this.closeSessionPicker();
            } else if (this.cwdPickerOpen) {
                this.closeCwdPicker();
            } else {
                this.$emit("close");
            }
        },
        async refreshPanelData() {
            try {
                const data = await getAgentPanelDataFor(this.conversation, this.robotUid);
                if (data) this.panelData = data;
                // 会话模式（interrupt/queue）回显：插件在 type=3 的 mode.current 下发，
                // 面板据此同步本地状态（此前只依赖本地默认值，切换后重开面板会显示回默认）。
                if (data && data.mode && data.mode.current) {
                    this.convMode = data.mode.current;
                }
                // 当前会话 id（type=3 sessionId；209 sessions 应答也会更新）
                if (data && data.sessionId) {
                    this.currentSessionId = data.sessionId;
                }
                // 兼容老插件：type=3 仍内联 dirs 时直接作为候选（新插件不含 dirs，走 207 op=dirs）
                if (data && Array.isArray(data.dirs) && data.dirs.length && !this.cwdDirs.length) {
                    this.applyDirs(data.dirs, data.root, true);
                }
            } catch (e) {
                // 忽略，保持旧数据
            }
        },
        /** 发送 207 面板指令（透明消息，不显示在消息流），带目标机器人 robotId。 */
        sendCommand(op, cmd) {
            const content = new AgentCommandMessageContent(op, cmd, Date.now() % 100000, this.robotUid || undefined);
            wfc.sendConversationMessage(this.conversation, content);
        },

        // ─── 操作：207 set（cmd=命令文本） ───
        selectModel(v) {
            if (!v) return;
            this.sendCommand("set", `/model ${v}`);
            this.flash();
        },
        selectEffort(v) {
            if (!v) return;
            this.sendCommand("set", `/effort ${v}`);
            this.flash();
        },
        selectSandbox(v) {
            this.sendCommand("set", `/sandbox ${v}`);
            this.flash();
        },
        /** Agent 模式：preset 服务未提供（options 为空）时选择器已禁用，此处再兜一层防空值。 */
        selectPreset(v) {
            if (!v) return;
            this.sendCommand("set", `/preset ${v}`);
            this.flash();
        },
        /** 工具审批策略：ask（需批准的操作弹卡片）/ never（自动拒绝，无人值守）。 */
        selectApproval(v) {
            if (!v) return;
            this.sendCommand("set", `/approval ${v}`);
            this.flash();
        },
        togglePlan(on) {
            this.sendCommand("set", `/plan ${on ? "on" : "off"}`);
            this.flash();
        },
        /** 会话处理模式：interrupt（后到打断先到，默认）/ queue（排队）。 */
        setMode(mode) {
            if (mode !== 'interrupt' && mode !== 'queue') return;
            this.convMode = mode;
            this.sendCommand("set", `/mode ${mode}`);
            this.flash();
        },
        compact() {
            if (!window.confirm("压缩会话上下文（折叠历史，减少 token 占用），继续？")) return;
            this.sendCommand("set", "/compact");
            this.flash();
        },
        resetSession() {
            if (!window.confirm("重置会话将清空全部上下文（工作目录保留），继续？")) return;
            this.sendCommand("set", "/reset");
            this.flash();
        },
        destroyGroup() {
            // 毁灭性操作：单次强警告确认（确认后即发请求）
            if (!window.confirm("⚠️ 销毁会话将解散本群、删除工作区目录及全部会话数据，且不可恢复！\n\n请确认是否销毁？")) return;
            this.sendCommand("set", "/destroy");
            this.flash();
        },
        switchCwd(dir) {
            if (!dir) return;
            this.sendCommand("set", `/cwd ${dir}`);
            this.closeCwdPicker();
            this.flash();
        },
        /** 手动输入兜底：目录名或路径都走 /cwd <路径> */
        switchCwdManual() {
            const v = (this.manualCwd || '').trim();
            if (!v) return;
            this.switchCwd(v);
        },
        openCwdPicker() {
            this.cwdPickerOpen = true;
            this.cwdError = '';
            this.manualCwd = '';
            // 1) 缓存命中（同一面板会话内 TTL 60s）直接用
            if (this.cwdDirs.length && Date.now() - this._dirsCacheAt < DIRS_CACHE_TTL) return;
            // 2) 兼容老插件：type=3 内联 dirs 直接使用（不请求 209）
            const legacy = getAgentPanelDirsFor(this.conversation, this.robotUid);
            if (legacy.dirs.length) {
                this.applyDirs(legacy.dirs, legacy.root, true);
                return;
            }
            // 3) 按需获取：207 op=dirs（带 seq/robotId）→ 等 209 应答
            this.requestDirs();
        },
        closeCwdPicker() {
            this.cwdPickerOpen = false;
            // 关闭弹窗：丢弃未完成的请求（避免定时器回调把错误态写到已关闭的弹窗）
            this.cancelPendingDirs();
            this.cwdLoading = false;
            this.cwdError = '';
        },

        // ─── 会话选择：207 op=sessions → 209 列表；op=switch 切换 ───
        nextSeq() {
            if (!this._seqBase) this._seqBase = Date.now() % 100000;
            this._seqBase = (this._seqBase + 1) % 100000;
            return this._seqBase;
        },
        shortSessionId(id) {
            const s = String(id || '');
            return s.length > 8 ? `…${s.slice(-8)}` : s;
        },
        formatSessionTime(ms) {
            if (!ms) return '';
            const d = new Date(ms);
            const p = (n) => (n < 10 ? `0${n}` : `${n}`);
            return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
        },
        openSessionPicker() {
            if (this.applying) return;
            this.sessionPickerOpen = true;
            this.sessionError = '';
            this.requestSessions();
        },
        closeSessionPicker() {
            this.sessionPickerOpen = false;
            clearTimeout(this._switchTimer);
            this._switchTimer = 0;
            this._switchSeq = 0;
            this.cancelSessionRequest();
            this.sessionLoading = false;
            this.sessionError = '';
        },
        /** 请求最近会话列表（207 op=sessions，透明消息；5s 无 209 应答提示重试）。 */
        requestSessions() {
            this.cancelSessionRequest();
            const seq = this.nextSeq();
            this._sessionSeq = seq;
            this.sessionLoading = true;
            this.sessionError = '';
            this.sendSessionCommand('sessions', seq);
            this._sessionTimer = setTimeout(() => {
                this._sessionSeq = 0;
                this.sessionLoading = false;
                this.sessionError = '获取会话列表超时，请重试';
            }, 5000);
        },
        cancelSessionRequest() {
            clearTimeout(this._sessionTimer);
            this._sessionTimer = 0;
            this._sessionSeq = 0;
        },
        sendSessionCommand(op, seq, sessionId) {
            const content = new AgentCommandMessageContent(op, undefined, seq, this.robotUid || undefined, sessionId);
            wfc.sendConversationMessage(this.conversation, content);
        },
        /** 切换到选中的历史会话（恢复其上下文；工作目录随会话切换）。 */
        switchToSession(s) {
            if (!s || !s.id || this.applying) return;
            if (s.current || s.id === this.currentSessionId) {
                this.closeSessionPicker();
                return;
            }
            const seq = this.nextSeq();
            this._switchSeq = seq;
            this.sendSessionCommand('switch', seq, s.id);
            clearTimeout(this._switchTimer);
            this._switchTimer = setTimeout(() => {
                if (this._switchSeq === seq) {
                    this._switchSeq = 0;
                    this.sessionError = '切换会话超时，请重试';
                }
            }, 10000);
            this.flash();
        },

        // ─── 目录列表：207 op=dirs 请求 → 209 Agent_Command_Result 应答 ───
        /** 发 207 op=dirs（透明消息），等待匹配 seq 的 209 应答。 */
        requestDirs() {
            if (!this.conversation) return;
            this.cancelPendingDirs();
            const seq = this.nextDirSeq();
            const pending = {robotId: this.robotUid || '', attempt: 0, timer: 0};
            this._dirPending.set(seq, pending);
            this.cwdLoading = true;
            this.cwdError = '';
            this.sendDirsCommand(seq);
            this.armDirsTimeout(seq);
        },
        /** seq：自增 + 毫秒取模起点，保证同一面板会话内多次请求不重复。 */
        nextDirSeq() {
            const base = this._dirSeq || (Date.now() % 100000);
            this._dirSeq = (base + 1) % 1000000;
            return this._dirSeq;
        },
        sendDirsCommand(seq) {
            const content = new AgentCommandMessageContent('dirs', undefined, seq, this.robotUid || undefined);
            wfc.sendConversationMessage(this.conversation, content);
        },
        armDirsTimeout(seq) {
            const pending = this._dirPending && this._dirPending.get(seq);
            if (!pending) return;
            clearTimeout(pending.timer);
            pending.timer = setTimeout(() => this.onDirsTimeout(seq), DIRS_REQUEST_TIMEOUT);
        },
        /** 5s 超时：第一次重试；仍无应答则回退 type=3 dirs，最后提示失败。 */
        onDirsTimeout(seq) {
            const pending = this._dirPending && this._dirPending.get(seq);
            if (!pending) return;
            if (pending.attempt === 0) {
                pending.attempt = 1;
                this.sendDirsCommand(seq);
                this.armDirsTimeout(seq);
                return;
            }
            this._dirPending.delete(seq);
            this.cwdLoading = false;
            // 兼容老插件（不识别 op=dirs，不会有 209 应答）：回退读 type=3 的 dirs（可能为空）
            const legacy = getAgentPanelDirsFor(this.conversation, this.robotUid);
            if (legacy.dirs.length) {
                this.applyDirs(legacy.dirs, legacy.root, true);
                return;
            }
            this.cwdDirs = [];
            this.cwdError = '获取目录失败，请重试';
        },
        cancelPendingDirs() {
            if (!this._dirPending) return;
            for (const pending of this._dirPending.values()) clearTimeout(pending.timer);
            this._dirPending.clear();
        },
        /** 写入目录候选（cache=true 时刷新 TTL）。 */
        applyDirs(dirs, root, cache) {
            this.cwdDirs = Array.isArray(dirs) ? dirs.filter(d => typeof d === 'string' && d) : [];
            if (root) this.cwdRoot = root;
            this.cwdLoading = false;
            this.cwdError = '';
            if (cache !== false) this._dirsCacheAt = Date.now();
        },
        /**
         * 209 应答（透明消息）：按 seq 关联 pending，校验会话与 robotId；
         * 未匹配（seq 未知/已超时）或校验失败的直接丢弃。
         */
        onReceiveMessage(message) {
            const content = message && message.messageContent;
            if (!content || content.type !== MessageContentType.AGENT_COMMAND_RESULT) return;
            const data = this.parseCommandResult(content);
            if (!data) return;
            if (!this.isSameConversation(message.conversation)) return;
            // 会话列表应答：只接受当前 pending 的 seq（透明消息可能乱序/重复）
            if (data.op === 'sessions') {
                if (!this._sessionSeq || data.seq !== this._sessionSeq) return;
                clearTimeout(this._sessionTimer);
                this._sessionSeq = 0;
                this.sessionLoading = false;
                this.sessionError = '';
                this.sessionList = Array.isArray(data.sessions) ? data.sessions : [];
                if (data.sessionId) this.currentSessionId = data.sessionId;
                return;
            }
            // 会话切换应答：成功关闭弹窗并刷新面板；失败展示原因
            if (data.op === 'switch') {
                if (!this._switchSeq || data.seq !== this._switchSeq) return;
                clearTimeout(this._switchTimer);
                this._switchTimer = 0;
                this._switchSeq = 0;
                if (data.ok) {
                    if (data.sessionId) this.currentSessionId = data.sessionId;
                    this.closeSessionPicker();
                    this.refreshPanelData();
                    this.sendCommand('query');
                } else {
                    this.sessionError = data.error || '切换会话失败';
                }
                return;
            }
            if (data.op !== 'dirs') return;
            const hit = this.findPendingDirs(data.seq);
            if (!hit) return;
            const pending = hit.pending;
            // robotId 校验：请求指定了目标机器人而应答带了不同的 robotId → 丢弃
            if (pending.robotId && data.robotId && pending.robotId !== data.robotId) return;
            clearTimeout(pending.timer);
            this._dirPending.delete(hit.key);
            this.applyDirs(data.dirs, data.root, true);
            if (data.cwd && !this.currentCwd) this.cwdFallback = data.cwd;
        },
        /** 按 seq 找 pending（容忍应答 seq 为字符串的序列化差异）。 */
        findPendingDirs(seq) {
            if (!this._dirPending) return null;
            const candidates = [seq, Number(seq), String(seq)];
            for (const key of candidates) {
                if (key === undefined || key === null || (typeof key === 'number' && Number.isNaN(key))) continue;
                const pending = this._dirPending.get(key);
                if (pending) return {key, pending};
            }
            return null;
        },
        /** 取应答载荷（SDK 已 decode 时直接用字段；否则容错解析 content JSON）。 */
        parseCommandResult(content) {
            if (content.op) {
                return {
                    op: content.op,
                    seq: content.seq,
                    robotId: content.robotId,
                    dirs: Array.isArray(content.dirs) ? content.dirs : [],
                    root: content.root,
                    cwd: content.cwd,
                    sessions: Array.isArray(content.sessions) ? content.sessions : [],
                    sessionId: content.sessionId,
                    ok: content.ok,
                    error: content.error,
                };
            }
            try {
                const d = JSON.parse(content.content);
                if (!d || typeof d !== 'object') return null;
                return {
                    op: d.op,
                    seq: d.seq,
                    robotId: d.robotId,
                    dirs: Array.isArray(d.dirs) ? d.dirs : [],
                    root: d.root,
                    cwd: d.cwd,
                    sessions: Array.isArray(d.sessions) ? d.sessions : [],
                    sessionId: d.sessionId,
                    ok: d.ok,
                    error: d.error,
                };
            } catch (e) {
                return null;
            }
        },
        /** 会话匹配：优先 Conversation.equal，异常时回退字段比较。 */
        isSameConversation(conv) {
            if (!conv || !this.conversation) return false;
            try {
                if (typeof conv.equal === 'function') return conv.equal(this.conversation);
                if (typeof this.conversation.equal === 'function') return this.conversation.equal(conv);
            } catch (e) {
                // 回退到字段比较
            }
            return conv.type === this.conversation.type
                && conv.line === this.conversation.line
                && conv.target === this.conversation.target;
        },
        /** 面板选项归一化：协议为 [{value,label}]（兼容字符串数组），丢弃非法项；非数组/缺失→[]。 */
        panelOptions(opts) {
            if (!Array.isArray(opts)) return [];
            const out = [];
            for (const o of opts) {
                const value = (o && typeof o === 'object') ? o.value : o;
                if (value === undefined || value === null || value === '') continue;
                const label = (o && typeof o === 'object' && o.label) ? o.label : value;
                out.push({value, label});
            }
            return out;
        },
        /** current 未出现在 options 中时返回 current（供 fallback <option> 显示）；已包含或为空则返回 ''。 */
        optionFallback(current, options) {
            if (!current) return '';
            return options.some(o => o.value === current) ? '' : current;
        },
        flash() {
            this.applying = true;
            clearTimeout(this._flashTimer);
            this._flashTimer = setTimeout(() => {
                this.applying = false;
            }, 1500);
        },
    },
};
</script>

<style scoped>
.agent-agent-panel {
    width: 360px;
    background: var(--background-secondary, #fff);
    border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
    border-radius: 10px;
    box-shadow: 0 6px 24px rgba(0, 0, 0, 0.18);
    padding: 12px 14px;
    color: var(--text-primary, #222);
    font-size: 13px;
}

.agent-agent-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
}

.agent-agent-title {
    font-weight: 600;
    font-size: 14px;
}

.agent-agent-close {
    border: none;
    background: transparent;
    font-size: 18px;
    line-height: 1;
    cursor: pointer;
    color: var(--text-secondary, #666);
    padding: 0 4px;
}

.agent-agent-close:hover {
    color: var(--text-primary, #222);
}

.agent-agent-body {
    /* 固定最小高度：loading 与加载后一致，避免界面跳动 */
    min-height: 220px;
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.agent-agent-row {
    display: flex;
    align-items: center;
    gap: 10px;
}

.agent-agent-row-col {
    flex-direction: column;
    align-items: stretch;
    gap: 6px;
}

.agent-agent-label {
    flex: 0 0 auto;
    /* min-width 取代固定宽度：「Agent 模式」等较长标签不换行；原有短标签仍为 64px，布局不变 */
    min-width: 64px;
    white-space: nowrap;
    color: var(--text-secondary, #666);
}

.agent-agent-select {
    flex: 1;
    min-width: 0;
    padding: 4px 8px;
    border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.15));
    border-radius: 6px;
    background: var(--background-tertiary, #f5f5f5);
    color: var(--text-primary, #222);
    font-size: 13px;
}

.agent-agent-cwd-current {
    flex: 1;
    min-width: 0;
    color: var(--text-primary, #222);
    word-break: break-all;
}

.agent-agent-hint {
    margin: 0;
    font-size: 11px;
    color: var(--text-secondary, #888);
}

.agent-agent-radio-group {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
}

.agent-agent-radio {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    cursor: pointer;
    color: var(--text-primary, #222);
}

.agent-agent-radio input {
    accent-color: var(--accent-color, #4f8ff7);
    cursor: pointer;
}

.agent-agent-switch {
    position: relative;
    display: inline-block;
    width: 36px;
    height: 20px;
    flex: 0 0 auto;
}

.agent-agent-switch input {
    opacity: 0;
    width: 0;
    height: 0;
}

.agent-agent-slider {
    position: absolute;
    inset: 0;
    background: var(--background-tertiary, #ccc);
    border-radius: 10px;
    transition: 0.2s;
    cursor: pointer;
}

.agent-agent-slider::before {
    content: "";
    position: absolute;
    width: 16px;
    height: 16px;
    left: 2px;
    top: 2px;
    background: #fff;
    border-radius: 50%;
    transition: 0.2s;
}

.agent-agent-switch input:checked + .agent-agent-slider {
    background: var(--accent-color, #4f8ff7);
}

.agent-agent-switch input:checked + .agent-agent-slider::before {
    transform: translateX(16px);
}

.agent-agent-switch-text {
    color: var(--text-secondary, #666);
    font-size: 12px;
}

.agent-agent-footer {
    display: flex;
    gap: 8px;
    margin-top: 12px;
    padding-top: 10px;
    border-top: 1px solid var(--divider-color, rgba(0, 0, 0, 0.08));
}

.agent-agent-btn {
    padding: 4px 12px;
    border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.15));
    border-radius: 6px;
    background: var(--background-tertiary, #f0f0f0);
    color: var(--text-primary, #222);
    font-size: 12px;
    cursor: pointer;
}

.agent-agent-btn:hover:not(:disabled) {
    background: var(--background-quaternary, #e5e5e5);
}

.agent-agent-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.agent-agent-btn-sm {
    flex: 0 0 auto;
}

.agent-agent-btn-danger {
    border-color: var(--status-error, #e5484d);
    color: var(--status-error, #e5484d);
    background: transparent;
}

.agent-agent-btn-danger:hover:not(:disabled) {
    background: rgba(229, 72, 77, 0.08);
}

.agent-agent-btn-destroy {
    border-color: var(--status-error, #e5484d);
    background: var(--status-error, #e5484d);
    color: #fff;
}

.agent-agent-btn-destroy:hover:not(:disabled) {
    opacity: 0.85;
}

.agent-agent-loading {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-secondary, #888);
}

.agent-agent-applying {
    margin: 8px 0 0;
    min-height: 16px; /* 常驻占位：不随提示出现/消失改变面板高度 */
    font-size: 11px;
    color: var(--accent-color, #4f8ff7);
}

/* ─── 目录选择弹窗（独立窗口） ─── */
.agent-agent-picker-mask {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    z-index: 100001;
    display: flex;
    align-items: center;
    justify-content: center;
}

.agent-agent-picker {
    width: 320px;
    max-height: 60vh;
    background: var(--background-secondary, #fff);
    border-radius: 10px;
    box-shadow: 0 6px 24px rgba(0, 0, 0, 0.22);
    padding: 12px 14px;
    color: var(--text-primary, #222);
    font-size: 13px;
}

.agent-agent-picker-body {
    max-height: 46vh;
    overflow-y: auto;
}

.agent-agent-cwd-list {
    list-style: none;
    margin: 0;
    padding: 4px;
}

.agent-agent-cwd-item {
    padding: 6px 8px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 13px;
}

.agent-agent-cwd-item:hover {
    background: var(--background-quaternary, #e5e5e5);
}

/* 会话列表行：时间 · 短id · cwd · 当前标记 */
.agent-agent-session-item {
    display: flex;
    align-items: center;
    gap: 8px;
}

.agent-agent-session-time {
    color: var(--text-secondary, #888);
    font-size: 12px;
    white-space: nowrap;
}

.agent-agent-session-id {
    color: var(--text-primary);
    font-size: 12px;
    font-family: var(--font-mono, monospace);
    white-space: nowrap;
}

.agent-agent-session-cwd {
    flex: 1;
    min-width: 0;
    color: var(--text-secondary, #888);
    font-size: 12px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.agent-agent-session-current {
    flex: none;
    padding: 1px 6px;
    border-radius: 8px;
    font-size: 11px;
    color: var(--text-on-accent, #fff);
    background: var(--accent-color);
}

.agent-agent-cwd-empty {
    padding: 12px 0;
    text-align: center;
    color: var(--text-secondary, #888);
    font-size: 12px;
}

/* 空态/失败态：文案 + 重试按钮同行 */
.agent-agent-cwd-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
}

.agent-agent-cwd-error {
    color: var(--status-error, #e5484d);
}

/* 手动输入兜底：/cwd <路径> */
.agent-agent-picker-footer {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px solid var(--divider-color, rgba(0, 0, 0, 0.08));
}

.agent-agent-input {
    flex: 1;
    min-width: 0;
    padding: 4px 8px;
    border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.15));
    border-radius: 6px;
    background: var(--background-tertiary, #f5f5f5);
    color: var(--text-primary, #222);
    font-size: 12px;
}

.agent-agent-cwd-root {
    margin: 6px 0 0;
    word-break: break-all;
}
</style>
