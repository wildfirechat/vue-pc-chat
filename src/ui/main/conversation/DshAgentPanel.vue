<!--
  DshAgentPanel.vue — AI 会话设置面板（第一层 Agent 可改属性，UI 选择式交互）
  打开时读取 scope=31 状态（当前模型/推理等级/工作目录）并发送查询命令
  （/model /effort /sandbox /plan）解析可选值与当前值；所有操作以命令形式
  发送到会话（与手打命令等价，插件端逻辑不变）。
  工作目录：点"切换"弹出独立窗口（/ls 目录列表）选择，选中后发 /cwd。
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
                    <p class="dsh-agent-hint">切换目录 = 新会话（上下文清空）</p>
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
        </footer>
        <p v-if="applying" class="dsh-agent-applying">指令已发送…</p>

        <!-- 工作目录选择弹窗（独立窗口） -->
        <Teleport to="body">
            <div v-if="cwdPickerOpen" class="dsh-agent-picker-mask" @click="closeCwdPicker">
                <div class="dsh-agent-picker" @click.stop>
                    <header class="dsh-agent-header">
                        <span class="dsh-agent-title">选择工作目录</span>
                        <button class="dsh-agent-close" title="关闭" @click="closeCwdPicker">×</button>
                    </header>
                    <div class="dsh-agent-picker-body">
                        <div v-if="cwdLoading" class="dsh-agent-cwd-empty">正在获取目录列表…</div>
                        <div v-else-if="cwdTimedOut" class="dsh-agent-cwd-empty">获取目录列表超时，请重试</div>
                        <div v-else-if="!cwdCandidates.length" class="dsh-agent-cwd-empty">未获取到目录列表，可稍后重试</div>
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
import TextMessageContent from "../../../wfc/messages/textMessageContent";
import {getDshState} from "../../util/dshState";

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
            currentModel: "",
            currentEffort: "",
            currentCwd: "",
            currentSandbox: "",
            planOn: false,
            modelOptions: [],
            effortOptions: [],
            sandboxModes: [
                {value: "read-only", label: "只读"},
                {value: "workspace-write", label: "仅写工作区"},
                {value: "danger-full-access", label: "完全放开"},
            ],
            // 工作目录选择弹窗
            cwdPickerOpen: false,
            cwdCandidates: [],
            cwdLoading: false,
            cwdTimedOut: false,
            _cwdTimeoutTimer: 0,
            _flashTimer: 0,
        };
    },
    async mounted() {
        wfc.eventEmitter.on(EventType.ReceiveMessage, this.onReceiveMessage);
        // ESC 关闭面板（目录弹窗优先）
        window.addEventListener("keydown", this.onKeyDown);
        // 当前值直接读 scope=31 状态（零解析）
        const state = await this.readState();
        this.setCurrentFromState(state);
        this.loading = false;
        // 查询可选值（回复经 ReceiveMessage 解析）
        this.send("/model");
        this.send("/effort");
        this.send("/sandbox");
        this.send("/plan");
    },
    beforeUnmount() {
        wfc.eventEmitter.removeListener(EventType.ReceiveMessage, this.onReceiveMessage);
        window.removeEventListener("keydown", this.onKeyDown);
        clearTimeout(this._cwdTimeoutTimer);
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
        async readState() {
            try {
                return await getDshState(this.conversation);
            } catch (e) {
                return null;
            }
        },
        setCurrentFromState(state) {
            if (!state) return;
            this.currentModel = state.model || "";
            this.currentEffort = state.reasoningEffort || "";
            this.currentCwd = state.cwd || "";
        },
        /** 向会话发送命令文本（与手打命令等价）。 */
        send(cmd) {
            wfc.sendConversationMessage(this.conversation, new TextMessageContent(cmd));
        },
        /** 解析机器人对查询命令的回复（按文本特征前缀匹配，不依赖发送者）。 */
        onReceiveMessage(message) {
            if (!message || !message.conversation || !message.conversation.equal(this.conversation)) return;
            const content = message.messageContent;
            if (!content || typeof content.content !== "string") return;
            const text = content.content;
            if (text.includes("当前模型:")) this.parseModelReply(text);
            else if (text.includes("当前推理等级:")) this.parseEffortReply(text);
            else if (text.includes("当前沙箱模式:")) this.parseSandboxReply(text);
            else if (text.includes("当前计划模式:")) this.parsePlanReply(text);
            else if (text.includes("用法: /ls") || text.includes("项目根目录")) this.parseLsReply(text);
            else if (text.includes("工作目录已绑定:") || text.includes("目录已创建并绑定:")) this.parseCwdReply(text);
            else if (text.includes("已清除自定义工作目录")) this.currentCwd = "";
        },
        parseModelReply(text) {
            for (const line of text.split("\n")) {
                if (line.startsWith("当前模型:")) {
                    this.currentModel = line
                        .replace(/^当前模型:\s*/, "")
                        .replace(/\s*\(推理等级=.*\)\s*$/, "")
                        .trim();
                }
            }
            if (!text.includes("可用模型（运行时目录）")) return;
            const options = [];
            for (const line of text.split("\n")) {
                const m = line.match(/^\s{4}([A-Za-z0-9_-]+\/[A-Za-z0-9._-]+)\s*（(.+?)）\s*$/);
                if (m) options.push({value: m[1], label: `${m[1]}（${m[2]}）`});
            }
            // 当前模型可能不在 DSH 模型目录里（如 agent-default-model 配了目录外的模型），
            // 必须补进候选，否则下拉无法选中/显示当前值。
            if (this.currentModel && !options.some((o) => o.value === this.currentModel)) {
                options.unshift({value: this.currentModel, label: `${this.currentModel}（当前）`});
            }
            if (options.length > 0) this.modelOptions = options;
        },
        parseEffortReply(text) {
            for (const line of text.split("\n")) {
                if (line.startsWith("当前推理等级:")) {
                    this.currentEffort = line.replace(/^当前推理等级:\s*/, "").replace(/（.*/, "").trim();
                }
                if (line.startsWith("当前模型支持:")) {
                    const list = line
                        .replace(/^当前模型支持:\s*/, "")
                        .replace(/（默认:.*/, "")
                        .split("/")
                        .map((s) => s.trim())
                        .filter(Boolean);
                    if (list.length > 0) this.effortOptions = list.map((v) => ({value: v, label: v}));
                }
            }
        },
        parseSandboxReply(text) {
            for (const line of text.split("\n")) {
                if (line.startsWith("当前沙箱模式:")) {
                    this.currentSandbox = line.replace(/^当前沙箱模式:\s*/, "").replace(/（.*/, "").trim();
                }
            }
        },
        parsePlanReply(text) {
            const m = text.match(/当前计划模式:\s*已(开启|关闭)/);
            if (m) this.planOn = m[1] === "开启";
        },
        /** /cwd 切换成功回复 → 刷新当前工作目录（避免依赖 scope=31 状态的旧值）。 */
        parseCwdReply(text) {
            // 回复形如 "群 xxx 工作目录已绑定: /abs/path（已持久化，会话上下文已重置）"
            // 路径与全角括号之间无空格，须以 [^\s（] 精确截到括号前。
            const m = text.match(/(?:工作目录已绑定|目录已创建并绑定):\s*([^\s（]+)/);
            if (m) this.currentCwd = m[1];
        },
        /** /ls 回复 → 解析项目根目录的子目录。 */
        parseLsReply(text) {
            const dirs = [];
            for (const line of text.split("\n")) {
                const m = line.match(/^\s*📂\s+([^/]+)\//);
                if (m) dirs.push(m[1]);
            }
            this.cwdCandidates = dirs;
            this.cwdLoading = false;
            this.cwdTimedOut = false;
        },

        // ─── 工作目录选择弹窗 ───
        openCwdPicker() {
            this.cwdPickerOpen = true;
            this.cwdCandidates = [];
            this.cwdLoading = true;
            this.cwdTimedOut = false;
            this.send("/ls");
            clearTimeout(this._cwdTimeoutTimer);
            this._cwdTimeoutTimer = setTimeout(() => {
                this.cwdLoading = false;
                this.cwdTimedOut = true;
            }, 8000);
        },
        closeCwdPicker() {
            this.cwdPickerOpen = false;
            clearTimeout(this._cwdTimeoutTimer);
        },
        switchCwd(dir) {
            if (!dir) return;
            this.send(`/cwd ${dir}`);
            this.closeCwdPicker();
            this.flash();
        },

        // ─── 其它操作 ───
        selectModel(v) {
            if (!v) return;
            this.currentModel = v;
            this.send(`/model ${v}`);
            this.flash();
        },
        selectEffort(v) {
            if (!v) return;
            this.currentEffort = v;
            this.send(`/effort ${v}`);
            this.flash();
        },
        selectSandbox(v) {
            this.currentSandbox = v;
            this.send(`/sandbox ${v}`);
            this.flash();
        },
        togglePlan(on) {
            this.planOn = on;
            this.send(`/plan ${on ? "on" : "off"}`);
            this.flash();
        },
        compact() {
            if (!window.confirm("压缩会话上下文（折叠历史，减少 token 占用），继续？")) return;
            this.send("/compact");
            this.flash();
        },
        resetSession() {
            if (!window.confirm("重置会话将清空全部上下文（工作目录保留），继续？")) return;
            this.send("/reset");
            this.flash();
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

.dsh-agent-loading {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-secondary, #888);
}

.dsh-agent-applying {
    margin: 8px 0 0;
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
