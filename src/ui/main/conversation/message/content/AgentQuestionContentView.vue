<template>
    <div class="agent-card"
         v-bind:class="{out: message.direction === 0}">
        <div class="agent-card-header" v-if="header">【{{ header }}】</div>
        <!-- 一张卡片 = Agent 一次 ask() 的全部题目；多题时必须全部作答后一次性提交 201，
             点单个选项只记录本地选择，绝不立即提交（服务器 pending 每会话仅一个） -->
        <div class="agent-card-question" v-for="(q, qi) in questions" :key="q.id || qi">
            <div class="agent-q-title">{{ qi + 1 }}. {{ q.question }}</div>
            <div class="agent-q-detail" v-if="q.detail && !isPlanReview(q)">{{ q.detail }}</div>
            <details v-if="isPlanReview(q) && q.detail" class="agent-plan-detail">
                <summary>{{ $t('agent.plan.toggle') }}</summary>
                <pre>{{ q.detail }}</pre>
            </details>
            <template v-if="isPlanReview(q)">
                <div class="agent-q-options" v-if="q.options && q.options.length">
                    <button v-for="(opt, oi) in q.options"
                            :key="oi"
                            class="agent-btn"
                            :class="[isApproveOption(q, opt) ? 'primary' : 'secondary', {selected: isSelected(q.id, opt.label)}]"
                            :disabled="isLocked"
                            @click="clickOption(q, opt)">
                        {{ opt.label }}
                    </button>
                </div>
            </template>
            <template v-else-if="q.options && q.options.length">
                <div class="agent-q-options">
                    <div v-for="(opt, oi) in q.options"
                         :key="oi"
                         class="agent-option"
                         :class="{selected: isSelected(q.id, opt.label), disabled: isLocked}"
                         @click="clickOption(q, opt)">
                        {{ opt.label }}
                    </div>
                </div>
            </template>
            <!-- 无选项 = 开放回答题，逐题作答 -->
            <div class="agent-q-custom" v-else>
                <input v-model="customByQ[q.id]"
                       class="agent-text-input"
                       :placeholder="$t('agent.card.custom_placeholder')"
                       :disabled="isLocked"
                       @keyup.enter="submitAll" />
            </div>
        </div>
        <!-- 卡片操作区：多题必须全部答完才能提交；按钮显示已答/总数 -->
        <div class="agent-card-actions" v-if="!isLocked">
            <button v-if="!singleImmediate" class="agent-btn" :disabled="!allAnswered" @click="submitAll">
                {{ $t('agent.card.submit') }}<span v-if="questions.length > 1">（{{ answeredCount }}/{{ questions.length }}）</span>
            </button>
            <input v-if="singleHasOptions" v-model="customText"
                   class="agent-text-input agent-text-input-flex"
                   :placeholder="$t('agent.card.custom_placeholder')"
                   @keyup.enter="submitTextAnswer" />
            <span v-if="questions.length > 1 && !allAnswered" class="agent-pending-tip">{{ $t('agent.card.pending_tip') }}</span>
        </div>
        <div class="agent-card-state" v-if="isLocked">
            <span>{{ stateText }}</span>
            <span v-if="mySelectionText" class="agent-card-selection">{{ mySelectionText }}</span>
        </div>
    </div>
</template>

<script>
import Message from "../../../../../wfc/messages/message";
import {AgentAnswerMessageContent} from "../../../../../wfc/messages/agentMessageContents";
import wfc from "../../../../../wfc/client/wfc";

export default {
    name: "AgentQuestionContentView",
    props: {
        message: {
            type: Object,
            required: true,
        },
    },
    data() {
        return {
            customText: "",      // 单题卡片的整卡自定义文本作答
            localSelected: {},   // qid -> array of labels（本地暂存，全部答完才提交）
            customByQ: {},       // qid -> 逐题文本作答（无选项题目）
            locallyAnswered: false,
        };
    },
    computed: {
        content() {
            return this.message.messageContent.content || {};
        },
        qid() {
            return this.content.qid;
        },
        questions() {
            return Array.isArray(this.content.questions) ? this.content.questions : [];
        },
        header() {
            const first = this.questions[0];
            return first && first.header ? first.header : "";
        },
        isLocked() {
            return this.locallyAnswered || ["answered", "expired"].indexOf(this.content.state) >= 0;
        },
        stateText() {
            if (this.locallyAnswered) return this.$t('agent.card.answered');
            if (this.content.state === "answered") return this.$t('agent.card.answered');
            if (this.content.state === "expired") return this.$t('agent.card.expired');
            return "";
        },
        // 服务端更新后的用户选择（插件 updateMessage 写入 content.answers）：
        // "你的选择：✅ 创建" / 自定义文本
        mySelectionText() {
            if (this.content.state !== "answered") return "";
            const answers = Array.isArray(this.content.answers) ? this.content.answers : [];
            // 按题目顺序对齐答案，多题卡片可读性更好
            const byId = {};
            answers.forEach(a => { byId[a.id] = a; });
            const parts = this.questions.map(q => {
                const a = byId[q.id];
                if (!a) return '';
                if (a.selected && a.selected.length) return a.selected.join('、');
                if (a.custom) return a.custom;
                return '';
            }).filter(Boolean);
            return parts.length ? `（${parts.join('；')}）` : "";
        },
        // 单题 + 有选项 + 非多选：点选即答（保持原有快捷体验）
        singleImmediate() {
            if (this.questions.length !== 1) return false;
            const q = this.questions[0];
            return Array.isArray(q.options) && q.options.length > 0 && !q.multiSelect;
        },
        // 单题 + 有选项：允许直接输入文字作为该题答案
        singleHasOptions() {
            if (this.questions.length !== 1) return false;
            const q = this.questions[0];
            return Array.isArray(q.options) && q.options.length > 0;
        },
        answeredCount() {
            return this.questions.filter(q => this.isQuestionAnswered(q)).length;
        },
        // 多题卡片：必须所有问题都作答后才能提交
        allAnswered() {
            return this.questions.length > 0 && this.answeredCount === this.questions.length;
        },
    },
    methods: {
        isPlanReview(q) {
            return !!(q.intent && q.intent.kind === 'plan-review');
        },
        isApproveOption(q, opt) {
            // plan-review：intent.approve 命中的选项为主按钮（批准），其余为次按钮（拒绝/修改）
            return !!(q.intent && q.intent.approve) && opt.label === q.intent.approve;
        },
        isSelected(qid, label) {
            const arr = this.localSelected[qid];
            return !!arr && arr.indexOf(label) >= 0;
        },
        isQuestionAnswered(q) {
            if (Array.isArray(q.options) && q.options.length > 0) {
                return (this.localSelected[q.id] || []).length > 0;
            }
            return !!((this.customByQ[q.id] || '').trim());
        },
        // 点击选项只更新本地选择；整卡答完由提交按钮统一发送（多题），
        // 单题单选（含 plan-review）保持点击即答的快捷方式
        clickOption(q, opt) {
            if (this.isLocked) return;
            const key = q.id;
            const current = this.localSelected[key] || [];
            let next;
            if (q.multiSelect) {
                next = current.indexOf(opt.label) >= 0
                    ? current.filter(l => l !== opt.label)
                    : [...current, opt.label];
            } else {
                next = current.indexOf(opt.label) >= 0 ? [] : [opt.label];
            }
            this.localSelected[key] = next;
            if (this.singleImmediate && next.length) {
                this.submitAll();
            }
        },
        // 组装全部题目的答案并一次性发送 201（每会话 pending 仅一个，必须整卡一次提交）
        submitAll() {
            if (this.isLocked || !this.allAnswered) return;
            const answers = [];
            for (const q of this.questions) {
                const hasOptions = Array.isArray(q.options) && q.options.length > 0;
                const selected = hasOptions ? (this.localSelected[q.id] || []) : [];
                const custom = (this.customByQ[q.id] || '').trim();
                const ans = {id: q.id, selected};
                if (custom) ans.custom = custom;
                answers.push(ans);
            }
            this.sendAnswerPayload(answers);
        },
        // 单题卡片：直接输入文字作为该题的自定义答案
        submitTextAnswer() {
            const text = (this.customText || '').trim();
            if (!text || this.isLocked || this.questions.length !== 1) return;
            const q = this.questions[0];
            this.sendAnswerPayload([{id: q.id, selected: [], custom: text}]);
        },
        sendAnswerPayload(answers) {
            if (this.isLocked || !answers.length) return;
            const content = new AgentAnswerMessageContent({qid: this.qid, answers});
            const msg = new Message(this.message.conversation, content);
            wfc.sendMessage(msg);
            this.locallyAnswered = true;
        },
    },
};
</script>

<style lang="css" scoped>
.agent-card {
    margin: 4px 8px;
    padding: 10px;
    background-color: var(--background-primary);
    border-radius: var(--radius-md);
    max-width: 420px;
    border: 1px solid var(--background-tertiary);
}
.agent-card.out {
    background-color: var(--background-message-out);
}
.agent-card-header {
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 6px;
}
.agent-card-question {
    margin-bottom: 8px;
}
.agent-q-title {
    color: var(--text-primary);
    font-size: var(--font-size-sm);
}
.agent-q-detail {
    color: var(--text-secondary);
    font-size: var(--font-size-xs);
    margin-top: 2px;
}
.agent-q-options {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 6px;
}
.agent-option {
    padding: 4px 12px;
    border: 1px solid var(--accent-color);
    border-radius: var(--radius-sm);
    color: var(--accent-color);
    font-size: var(--font-size-sm);
    cursor: pointer;
    user-select: none;
}
.agent-option.selected {
    background-color: var(--accent-color);
    color: var(--text-on-accent);
}
.agent-option.disabled {
    opacity: 0.5;
    cursor: not-allowed;
}
.agent-q-custom {
    margin-top: 6px;
}
.agent-text-input {
    border: 1px solid var(--background-tertiary);
    border-radius: var(--radius-sm);
    padding: 4px 8px;
    color: var(--text-primary);
    background-color: var(--background-primary);
    min-width: 0;
}
.agent-q-custom .agent-text-input {
    width: 100%;
    box-sizing: border-box;
}
.agent-card-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    margin-top: 8px;
}
.agent-text-input-flex {
    flex: 1;
}
.agent-pending-tip {
    color: var(--text-secondary);
    font-size: var(--font-size-xs);
}
.agent-btn {
    padding: 4px 12px;
    border: none;
    border-radius: var(--radius-sm);
    background-color: var(--accent-color);
    color: var(--text-on-accent);
    cursor: pointer;
}
.agent-btn.secondary {
    background-color: transparent;
    color: var(--text-secondary);
    border: 1px solid var(--background-tertiary);
}
.agent-btn.primary {
    background-color: var(--accent-color);
    color: var(--text-on-accent);
}
.agent-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}
.agent-btn.selected {
    outline: 1px solid var(--text-primary);
    outline-offset: 2px;
}
.agent-card-state {
    margin-top: 6px;
    color: var(--text-secondary);
    font-size: var(--font-size-xs);
}
.agent-plan-detail {
    margin-top: 4px;
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
}
.agent-plan-detail summary {
    cursor: pointer;
    user-select: none;
}
.agent-plan-detail pre {
    margin: 6px 0 0;
    padding: 8px;
    max-height: 240px;
    overflow: auto;
    white-space: pre-wrap;
    word-break: break-word;
    background-color: var(--background-tertiary);
    border-radius: var(--radius-sm);
    color: var(--text-primary);
}
</style>
