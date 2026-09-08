<!--
  AgentPanel.vue — AI 会话设置面板（第一层 Agent 可改属性，UI 选择式交互）
  静默通道：打开面板发 AGENT_Command(207) query（组合查询）→ 插件聚合面板数据写
  scope=31 type=3 → 本组件读 type=3 渲染（模型/effort/沙箱/计划/cwd）。
  所有操作发 AGENT_Command(207) set（cmd=命令文本），插件执行后写 type=1 lastChange
  （变更可见）+ 刷新 type=3；本组件监听设置更新事件重读。207 为透明消息不显示。
  目录列表（工作目录选择）不再随 type=3 下发：打开弹窗时发 207 op=dirs（带 seq/robotId）
  → 插件回 209 Agent_Command_Result（透明消息）→ 本组件按 seq 关联 pending 渲染；
  缓存 TTL 60s；5s 超时重试 1 次；无应答（老插件）回退读 type=3 的 dirs（§10）。
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
        cwdCandidates() {
            // 新插件：207 op=dirs → 209 应答（缓存 TTL 60s）；老插件：type=3 内联 dirs 回退
            return this.cwdDirs || [];
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
        // 组件销毁：清掉未完成的目录请求，避免定时器泄漏/回调打到已销毁实例
        this.cancelPendingDirs();
    },
    methods: {
        onKeyDown(e) {
            if (e.key !== "Escape") return;
            if (this.cwdPickerOpen) {
                this.closeCwdPicker();
            } else {
                this.$emit("close");
            }
        },
        async refreshPanelData() {
            try {
                const data = await getAgentPanelDataFor(this.conversation, this.robotUid);
                if (data) this.panelData = data;
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
            if (!data || data.op !== 'dirs') return;
            if (!this.isSameConversation(message.conversation)) return;
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
    width: 64px;
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
