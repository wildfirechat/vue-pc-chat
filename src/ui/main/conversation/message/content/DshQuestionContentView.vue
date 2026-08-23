<template>
    <div class="dsh-card"
         v-bind:class="{out: message.direction === 0}">
        <div class="dsh-card-header" v-if="header">【{{ header }}】</div>
        <div class="dsh-card-question" v-for="(q, qi) in questions" :key="q.id">
            <div class="dsh-q-title">{{ qi + 1 }}. {{ q.question }}</div>
            <div class="dsh-q-detail" v-if="q.detail && !isPlanReview(q)">{{ q.detail }}</div>
            <details v-if="isPlanReview(q) && q.detail" class="dsh-plan-detail">
                <summary>{{ $t('dsh.plan.toggle') }}</summary>
                <pre>{{ q.detail }}</pre>
            </details>
            <div class="dsh-q-options" v-if="q.options && q.options.length">
                <template v-if="isPlanReview(q)">
                    <button v-for="(opt, oi) in q.options"
                            :key="oi"
                            class="dsh-btn"
                            :class="isApproveOption(q, opt) ? 'primary' : 'secondary'"
                            :disabled="isLocked"
                            @click="sendAnswer(q.id, [opt.label])">
                        {{ opt.label }}
                    </button>
                </template>
                <template v-else>
                    <div v-for="(opt, oi) in q.options"
                         :key="oi"
                         class="dsh-option"
                         :class="{selected: isSelected(q.id, opt.label), disabled: isLocked}"
                         @click="toggleOption(q, opt)">
                        {{ opt.label }}
                    </div>
                </template>
            </div>
        </div>
        <div class="dsh-custom-input" v-if="!isLocked">
            <input v-model="customText" :placeholder="$t('dsh.card.custom_placeholder')"
                   @keyup.enter="sendCustom" />
            <button v-if="hasMulti" class="dsh-btn" :disabled="selectedCount === 0" @click="sendSelected">
                {{ $t('dsh.card.submit') }}
            </button>
        </div>
        <div class="dsh-card-state" v-if="isLocked">
            <span>{{ stateText }}</span>
            <span v-if="mySelectionText" class="dsh-card-selection">{{ mySelectionText }}</span>
        </div>
    </div>
</template>

<script>
import Message from "../../../../../wfc/messages/message";
import {DshAnswerMessageContent} from "../../../../../wfc/messages/dshMessageContents";
import wfc from "../../../../../wfc/client/wfc";

export default {
    name: "DshQuestionContentView",
    props: {
        message: {
            type: Object,
            required: true,
        },
    },
    data() {
        return {
            customText: "",
            localSelected: {}, // qid -> array of labels
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
        hasMulti() {
            return this.questions.some(q => q.multiSelect);
        },
        isLocked() {
            return this.locallyAnswered || ["answered", "expired"].indexOf(this.content.state) >= 0;
        },
        stateText() {
            if (this.locallyAnswered) return this.$t('dsh.card.answered');
            if (this.content.state === "answered") return this.$t('dsh.card.answered');
            if (this.content.state === "expired") return this.$t('dsh.card.expired');
            return "";
        },
        // 服务端更新后的用户选择（插件 updateMessage 写入 content.answers）：
        // "你的选择：✅ 创建" / 自定义文本
        mySelectionText() {
            if (this.content.state !== "answered") return "";
            const answers = Array.isArray(this.content.answers) ? this.content.answers : [];
            const parts = answers.map(a => {
                if (a.selected && a.selected.length) return a.selected.join('、');
                if (a.custom) return a.custom;
                return '';
            }).filter(Boolean);
            return parts.length ? `（${parts.join('；')}）` : "";
        },
        selectedCount() {
            return Object.values(this.localSelected).reduce((n, arr) => n + (arr || []).length, 0);
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
        toggleOption(q, opt) {
            if (this.isLocked) return;
            const current = this.localSelected[q.id] || [];
            if (q.multiSelect) {
                this.localSelected[q.id] = current.indexOf(opt.label) >= 0
                    ? current.filter(l => l !== opt.label)
                    : [...current, opt.label];
            } else {
                // single-select: submit immediately
                this.sendAnswer(q.id, [opt.label]);
            }
        },
        sendSelected() {
            const answers = [];
            for (const q of this.questions) {
                const selected = this.localSelected[q.id] || [];
                if (selected.length) answers.push({id: q.id, selected});
            }
            if (answers.length) this.sendAnswerPayload(answers);
        },
        sendCustom() {
            const text = this.customText.trim();
            if (!text || this.isLocked) return;
            const answers = this.questions.map(q => ({id: q.id, selected: [], custom: text}));
            this.sendAnswerPayload(answers);
        },
        sendAnswer(qid, selected) {
            this.sendAnswerPayload([{id: qid, selected}]);
        },
        sendAnswerPayload(answers) {
            if (this.isLocked) return;
            const content = new DshAnswerMessageContent({qid: this.qid, answers});
            const msg = new Message(this.message.conversation, content);
            wfc.sendMessage(msg);
            this.locallyAnswered = true;
        },
    },
};
</script>

<style lang="css" scoped>
.dsh-card {
    margin: 4px 8px;
    padding: 10px;
    background-color: var(--background-primary);
    border-radius: var(--radius-md);
    max-width: 420px;
    border: 1px solid var(--background-tertiary);
}
.dsh-card.out {
    background-color: var(--background-message-out);
}
.dsh-card-header {
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 6px;
}
.dsh-card-question {
    margin-bottom: 8px;
}
.dsh-q-title {
    color: var(--text-primary);
    font-size: var(--font-size-sm);
}
.dsh-q-detail {
    color: var(--text-secondary);
    font-size: var(--font-size-xs);
    margin-top: 2px;
}
.dsh-q-options {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 6px;
}
.dsh-option {
    padding: 4px 12px;
    border: 1px solid var(--accent-color);
    border-radius: var(--radius-sm);
    color: var(--accent-color);
    font-size: var(--font-size-sm);
    cursor: pointer;
    user-select: none;
}
.dsh-option.selected {
    background-color: var(--accent-color);
    color: var(--text-on-accent);
}
.dsh-option.disabled {
    opacity: 0.5;
    cursor: not-allowed;
}
.dsh-custom-input {
    display: flex;
    gap: 6px;
    margin-top: 8px;
}
.dsh-custom-input input {
    flex: 1;
    border: 1px solid var(--background-tertiary);
    border-radius: var(--radius-sm);
    padding: 4px 8px;
    color: var(--text-primary);
    background-color: var(--background-primary);
}
.dsh-btn {
    padding: 4px 12px;
    border: none;
    border-radius: var(--radius-sm);
    background-color: var(--accent-color);
    color: var(--text-on-accent);
    cursor: pointer;
}
.dsh-btn.secondary {
    background-color: transparent;
    color: var(--text-secondary);
    border: 1px solid var(--background-tertiary);
}
.dsh-btn.primary {
    background-color: var(--accent-color);
    color: var(--text-on-accent);
}
.dsh-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}
.dsh-card-state {
    margin-top: 6px;
    color: var(--text-secondary);
    font-size: var(--font-size-xs);
}
.dsh-plan-detail {
    margin-top: 4px;
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
}
.dsh-plan-detail summary {
    cursor: pointer;
    user-select: none;
}
.dsh-plan-detail pre {
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
