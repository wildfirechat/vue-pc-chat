<!--
  AgentPanel.vue — AI 会话设置面板（第一层 Agent 可改属性，UI 选择式交互）
  静默通道：打开面板发 AGENT_Command(207) query（组合查询）→ 插件聚合面板数据写
  scope=31 type=3 → 本组件读 type=3 渲染（模型/effort/沙箱/计划/cwd/目录列表）。
  所有操作发 AGENT_Command(207) set（cmd=命令文本），插件执行后写 type=1 lastChange
  （变更可见）+ 刷新 type=3；本组件监听设置更新事件重读。207 为透明消息不显示。
-->
<template>
    <div class="agent-agent-panel" @click.stop>
        <header class="agent-agent-header">
            <span class="agent-agent-title">🤖 AI 会话设置<template v-if="robotShort"> · {{ robotShort }}</template></span>
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

        <!-- 工作目录选择弹窗（独立窗口，数据来自 type=3 dirs） -->
        <Teleport to="body">
            <div v-if="cwdPickerOpen" class="agent-agent-picker-mask" @click="closeCwdPicker">
                <div class="agent-agent-picker" @click.stop>
                    <header class="agent-agent-header">
                        <span class="agent-agent-title">选择工作目录</span>
                        <button class="agent-agent-close" title="关闭" @click="closeCwdPicker">×</button>
                    </header>
                    <div class="agent-agent-picker-body">
                        <div v-if="!cwdCandidates.length" class="agent-agent-cwd-empty">未获取到目录列表，可稍后重试</div>
                        <ul v-else class="agent-agent-cwd-list">
                            <li v-for="d in cwdCandidates" :key="d" class="agent-agent-cwd-item" @click="switchCwd(d)">
                                📂 {{ d }}
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </Teleport>
    </div>
</template>

<script>
import wfc from "../../../wfc/client/wfc";
import EventType from "../../../wfc/client/wfcEvent";
import AgentCommandMessageContent from "../../../wfc/messages/agentCommandMessageContent";
import {getAgentPanelDataFor, agentRobotName} from "../../util/agentState";

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
            return (this.panelData && this.panelData.cwd) || '';
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
            return (this.panelData && this.panelData.dirs) || [];
        },
    },
    async mounted() {
        // 设置更新事件：插件执行更新/查询后写 type=3，重读刷新
        wfc.eventEmitter.on(EventType.SettingUpdate, this.refreshPanelData);
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
        window.removeEventListener("keydown", this.onKeyDown);
        clearTimeout(this._flashTimer);
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
        openCwdPicker() {
            this.cwdPickerOpen = true;
            // 目录列表来自 type=3（组合查询已含）；若为空可再发一次 query 刷新
            if (!this.cwdCandidates.length) this.sendCommand("query");
        },
        closeCwdPicker() {
            this.cwdPickerOpen = false;
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
</style>
