<template>
    <div class="dsh-card"
         v-bind:class="{out: message.direction === 0}">
        <div class="dsh-card-title">🔐 工具审批</div>
        <div class="dsh-approval-tool">{{ content.toolName }}</div>
        <div class="dsh-approval-reason" v-if="content.reason">原因：{{ content.reason }}</div>
        <div class="dsh-approval-actions" v-if="!isLocked">
            <button class="dsh-btn approve" @click="decide('approve')">{{ $t('dsh.card.approve') }}</button>
            <button class="dsh-btn reject" @click="decide('reject')">{{ $t('dsh.card.reject') }}</button>
        </div>
        <div class="dsh-card-state" v-if="isLocked">{{ stateText }}</div>
    </div>
</template>

<script>
import Message from "../../../../../wfc/messages/message";
import {DshApprovalResultMessageContent} from "../../../../../wfc/messages/dshMessageContents";
import wfc from "../../../../../wfc/client/wfc";

export default {
    name: "DshApprovalContentView",
    props: {
        message: {
            type: Object,
            required: true,
        },
    },
    data() {
        return {
            locallyDecided: false,
        };
    },
    computed: {
        content() {
            return this.message.messageContent.content || {};
        },
        isLocked() {
            return this.locallyDecided || ["approved", "rejected", "expired"].indexOf(this.content.state) >= 0;
        },
        stateText() {
            if (this.locallyDecided || this.content.state === "approved") return this.$t('dsh.card.approved');
            if (this.content.state === "rejected") return this.$t('dsh.card.rejected');
            if (this.content.state === "expired") return this.$t('dsh.card.expired');
            return "";
        },
    },
    methods: {
        decide(action) {
            if (this.isLocked) return;
            const content = new DshApprovalResultMessageContent({aid: this.content.aid, action});
            const msg = new Message(this.message.conversation, content);
            wfc.sendMessage(msg);
            this.locallyDecided = true;
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
.dsh-card-title {
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 6px;
}
.dsh-approval-tool {
    color: var(--text-primary);
    font-size: var(--font-size-sm);
    font-family: monospace;
}
.dsh-approval-reason {
    color: var(--text-secondary);
    font-size: var(--font-size-xs);
    margin-top: 4px;
    word-break: break-word;
}
.dsh-approval-actions {
    display: flex;
    gap: 8px;
    margin-top: 10px;
}
.dsh-btn {
    padding: 5px 16px;
    border: none;
    border-radius: var(--radius-sm);
    cursor: pointer;
    color: var(--text-on-accent);
}
.dsh-btn.approve {
    background-color: var(--accent-color);
}
.dsh-btn.reject {
    background-color: var(--status-error);
}
.dsh-card-state {
    margin-top: 6px;
    color: var(--text-secondary);
    font-size: var(--font-size-xs);
}
</style>
