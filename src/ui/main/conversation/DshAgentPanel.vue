<!--
  DshAgentPanel.vue — AI 会话设置面板（第一层 Agent 可改属性，UI 选择式交互）
  静默通道：打开面板发 DSH_Command(207) query（组合查询）→ 插件聚合面板数据写
  scope=31 type=3 → 本组件读 type=3 渲染（模型/effort/沙箱/计划/cwd/目录列表）。
  所有操作发 DSH_Command(207) set（cmd=命令文本），插件执行后写 type=1 lastChange
  （变更可见）+ 刷新 type=3；本组件监听设置更新事件重读。207 为透明消息不显示。
-->
<template>
    <div class="dsh-agent-panel" @click.stop>
        <header class="dsh-agent-header">
            <span class="dsh-agent-title">🤖 AI 会话设置</span>
            <button class="dsh-agent-close" title="关闭" @click="$emit('close')">×</button>
        </header>

        <!-- body：固定最小高度，loading 与加载后不跳动 -->
        <div class="dsh-agent-body">
            <div v-if="loading" class="dsh-agent-loading">正在加载会话状态…</div>
            <template v-else>
                <!-- 模型 -->
                <div class="dsh-agent-row">
                    <label class="dsh-agent-label">模型</label>
                    <select
                        class="dsh-agent-select"
                        :value="currentModel"
                        :disabled="applying"
                        @change="selectModel($event.target.value)"
                    >
                        <option value="" disabled>— 选择模型 —</option>
                        <option v-for="m in modelOptions" :key="m.value" :value="m.value">{{ m.label }}</option>
                    </select>
                </div>

                <!-- 推理等级 -->
                <div v-if="effortOptions.length" class="dsh-agent-row">
                    <label class="dsh-agent-label">推理等级</label>
                    <select
                        class="dsh-agent-select"
                        :value="currentEffort"
                        :disabled="applying"
                        @change="selectEffort($event.target.value)"
                    >
                        <option value="" disabled>— 选择等级 —</option>
                        <option v-for="e in effortOptions" :key="e.value" :value="e.value">{{ e.label }}</option>
                    </select>
                </div>

                <!-- 工作目录：点切换弹出独立选择窗口 -->
                <div class="dsh-agent-row dsh-agent-row-col">
                    <label class="dsh-agent-label">工作目录</label>
                    <div class="dsh-agent-row">
                        <span class="dsh-agent-cwd-current">{{ currentCwd || '未设置' }}</span>
                        <button class="dsh-agent-btn dsh-agent-btn-sm" :disabled="applying" @click="openCwdPicker">切换</button>
                    </div>
                    <p class="dsh-agent-hint">切换目录 = 切换会话（该目录上下文可恢复）</p>
                </div>

                <!-- 沙箱模式 -->
                <div class="dsh-agent-row dsh-agent-row-col">
                    <label class="dsh-agent-label">沙箱模式</label>
                    <div class="dsh-agent-radio-group">
                        <label v-for="s in sandboxModes" :key="s.value" class="dsh-agent-radio">
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
                <div class="dsh-agent-row">
                    <label class="dsh-agent-label">计划模式</label>
                    <label class="dsh-agent-switch">
                        <input type="checkbox" :checked="planOn" :disabled="applying" @change="togglePlan($event.target.checked)" />
                        <span class="dsh-agent-slider"></span>
                    </label>
                    <span class="dsh-agent-switch-text">{{ planOn ? '已开启（先审后做）' : '已关闭' }}</span>
                </div>
            </template>
        </div>

        <footer class="dsh-agent-footer">
            <button class="dsh-agent-btn" :disabled="applying || loading" @click="compact">压缩上下文</button>
            <button class="dsh-agent-btn dsh-agent-btn-danger" :disabled="applying || loading" @click="resetSession">重置会话</button>
            <!-- 销毁按钮不受 applying 限制：危险操作必须始终可点（点击后弹确认，确认才发送） -->
            <button class="dsh-agent-btn dsh-agent-btn-destroy" @click="destroyGroup">销毁会话</button>
        </footer>
        <!-- 指令提示区：常驻占位（min-height 固定），避免出现/消失导致高度跳动 -->
        <p class="dsh-agent-applying">{{ applying ? '指令已发送…' : '' }}</p>

        <!-- 工作目录选择弹窗（独立窗口，数据来自 type=3 dirs） -->
        <Teleport to="body">
            <div v-if="cwdPickerOpen" class="dsh-agent-picker-mask" @click="closeCwdPicker">
                <div class="dsh-agent-picker" @click.stop>
                    <header class="dsh-agent-header">
                        <span class="dsh-agent-title">选择工作目录</span>
                        <button class="dsh-agent-close" title="关闭" @click="closeCwdPicker">×</button>
                    </header>
                    <div class="dsh-agent-picker-body">
                        <div v-if="!cwdCandidates.length" class="dsh-agent-cwd-empty">未获取到目录列表，可稍后重试</div>
                        <ul v-else class="dsh-agent-cwd-list">
                            <li v-for="d in cwdCandidates" :key="d" class="dsh-agent-cwd-item" @click="switchCwd(d)">
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
import AgentCommandMessageContent from "../../../wfc/messages/dshCommandMessageContent";
import {getDshPanelData} from "../../util/dshState";

export default {
    name: "DshAgentPanel",
    props: {
        conversation: {
            type: Object,
            required: true,
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
        };
    },
    computed: {
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
                const data = await getDshPanelData(this.conversation);
                if (data) this.panelData = data;
            } catch (e) {
                // 忽略，保持旧数据
            }
        },
        /** 发送 207 面板指令（透明消息，不显示在消息流）。 */
        sendCommand(op, cmd) {
            const content = new AgentCommandMessageContent(op, cmd, Date.now() % 100000);
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
.dsh-agent-panel {
    width: 360px;
    background: var(--background-secondary, #fff);
    border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
    border-radius: 10px;
    box-shadow: 0 6px 24px rgba(0, 0, 0, 0.18);
    padding: 12px 14px;
    color: var(--text-primary, #222);
    font-size: 13px;
}

.dsh-agent-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
}

.dsh-agent-title {
    font-weight: 600;
    font-size: 14px;
}

.dsh-agent-close {
    border: none;
    background: transparent;
    font-size: 18px;
    line-height: 1;
    cursor: pointer;
    color: var(--text-secondary, #666);
    padding: 0 4px;
}

.dsh-agent-close:hover {
    color: var(--text-primary, #222);
}

.dsh-agent-body {
    /* 固定最小高度：loading 与加载后一致，避免界面跳动 */
    min-height: 220px;
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.dsh-agent-row {
    display: flex;
    align-items: center;
    gap: 10px;
}

.dsh-agent-row-col {
    flex-direction: column;
    align-items: stretch;
    gap: 6px;
}

.dsh-agent-label {
    flex: 0 0 auto;
    width: 64px;
    color: var(--text-secondary, #666);
}

.dsh-agent-select {
    flex: 1;
    min-width: 0;
    padding: 4px 8px;
    border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.15));
    border-radius: 6px;
    background: var(--background-tertiary, #f5f5f5);
    color: var(--text-primary, #222);
    font-size: 13px;
}

.dsh-agent-cwd-current {
    flex: 1;
    min-width: 0;
    color: var(--text-primary, #222);
    word-break: break-all;
}

.dsh-agent-hint {
    margin: 0;
    font-size: 11px;
    color: var(--text-secondary, #888);
}

.dsh-agent-radio-group {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
}

.dsh-agent-radio {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    cursor: pointer;
    color: var(--text-primary, #222);
}

.dsh-agent-radio input {
    accent-color: var(--accent-color, #4f8ff7);
    cursor: pointer;
}

.dsh-agent-switch {
    position: relative;
    display: inline-block;
    width: 36px;
    height: 20px;
    flex: 0 0 auto;
}

.dsh-agent-switch input {
    opacity: 0;
    width: 0;
    height: 0;
}

.dsh-agent-slider {
    position: absolute;
    inset: 0;
    background: var(--background-tertiary, #ccc);
    border-radius: 10px;
    transition: 0.2s;
    cursor: pointer;
}

.dsh-agent-slider::before {
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

.dsh-agent-switch input:checked + .dsh-agent-slider {
    background: var(--accent-color, #4f8ff7);
}

.dsh-agent-switch input:checked + .dsh-agent-slider::before {
    transform: translateX(16px);
}

.dsh-agent-switch-text {
    color: var(--text-secondary, #666);
    font-size: 12px;
}

.dsh-agent-footer {
    display: flex;
    gap: 8px;
    margin-top: 12px;
    padding-top: 10px;
    border-top: 1px solid var(--divider-color, rgba(0, 0, 0, 0.08));
}

.dsh-agent-btn {
    padding: 4px 12px;
    border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.15));
    border-radius: 6px;
    background: var(--background-tertiary, #f0f0f0);
    color: var(--text-primary, #222);
    font-size: 12px;
    cursor: pointer;
}

.dsh-agent-btn:hover:not(:disabled) {
    background: var(--background-quaternary, #e5e5e5);
}

.dsh-agent-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.dsh-agent-btn-sm {
    flex: 0 0 auto;
}

.dsh-agent-btn-danger {
    border-color: var(--status-error, #e5484d);
    color: var(--status-error, #e5484d);
    background: transparent;
}

.dsh-agent-btn-danger:hover:not(:disabled) {
    background: rgba(229, 72, 77, 0.08);
}

.dsh-agent-btn-destroy {
    border-color: var(--status-error, #e5484d);
    background: var(--status-error, #e5484d);
    color: #fff;
}

.dsh-agent-btn-destroy:hover:not(:disabled) {
    opacity: 0.85;
}

.dsh-agent-loading {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-secondary, #888);
}

.dsh-agent-applying {
    margin: 8px 0 0;
    min-height: 16px; /* 常驻占位：不随提示出现/消失改变面板高度 */
    font-size: 11px;
    color: var(--accent-color, #4f8ff7);
}

/* ─── 目录选择弹窗（独立窗口） ─── */
.dsh-agent-picker-mask {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    z-index: 100001;
    display: flex;
    align-items: center;
    justify-content: center;
}

.dsh-agent-picker {
    width: 320px;
    max-height: 60vh;
    background: var(--background-secondary, #fff);
    border-radius: 10px;
    box-shadow: 0 6px 24px rgba(0, 0, 0, 0.22);
    padding: 12px 14px;
    color: var(--text-primary, #222);
    font-size: 13px;
}

.dsh-agent-picker-body {
    max-height: 46vh;
    overflow-y: auto;
}

.dsh-agent-cwd-list {
    list-style: none;
    margin: 0;
    padding: 4px;
}

.dsh-agent-cwd-item {
    padding: 6px 8px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 13px;
}

.dsh-agent-cwd-item:hover {
    background: var(--background-quaternary, #e5e5e5);
}

.dsh-agent-cwd-empty {
    padding: 12px 0;
    text-align: center;
    color: var(--text-secondary, #888);
    font-size: 12px;
}
</style>
