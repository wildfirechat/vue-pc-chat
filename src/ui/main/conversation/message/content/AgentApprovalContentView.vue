<template>
    <div class="agent-card"
         v-bind:class="{out: message.direction === 0}">
        <div class="agent-card-title">🔐 工具审批</div>
        <div class="agent-approval-tool">{{ content.toolName }}</div>
        <div class="agent-approval-reason" v-if="content.reason">原因：{{ content.reason }}</div>
        <div class="agent-approval-actions" v-if="!isLocked">
            <button class="agent-btn approve" @click="decide('approve')">{{ $t('agent.card.approve') }}</button>
            <button class="agent-btn reject" @click="decide('reject')">{{ $t('agent.card.reject') }}</button>
        </div>
        <div class="agent-card-state" v-if="isLocked">{{ stateText }}</div>
    </div>
</template>

<script>
import Message from "../../../../../wfc/messages/message";
import {AgentApprovalResultMessageContent} from "../../../../../wfc/messages/agentMessageContents";
import wfc from "../../../../../wfc/client/wfc";

export default {
    name: "AgentApprovalContentView",
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
            if (this.locallyDecided || this.content.state === "approved") return this.$t('agent.card.approved');
            if (this.content.state === "rejected") return this.$t('agent.card.rejected');
            if (this.content.state === "expired") return this.$t('agent.card.expired');
            return "";
        },
    },
    methods: {
        decide(action) {
            if (this.isLocked) return;
            const content = new AgentApprovalResultMessageContent({aid: this.content.aid, action});
            const msg = new Message(this.message.conversation, content);
            wfc.sendMessage(msg);
            this.locallyDecided = true;
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
.agent-card-title {
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 6px;
}
.agent-approval-tool {
    color: var(--text-primary);
    font-size: var(--font-size-sm);
    font-family: monospace;
}
.agent-approval-reason {
    color: var(--text-secondary);
    font-size: var(--font-size-xs);
    margin-top: 4px;
    word-break: break-word;
}
.agent-approval-actions {
    display: flex;
    gap: 8px;
    margin-top: 10px;
}
.agent-btn {
    padding: 5px 16px;
    border: none;
    border-radius: var(--radius-sm);
    cursor: pointer;
    color: var(--text-on-accent);
}
.agent-btn.approve {
    background-color: var(--accent-color);
}
.agent-btn.reject {
    background-color: var(--status-error);
}
.agent-card-state {
    margin-top: 6px;
    color: var(--text-secondary);
    font-size: var(--font-size-xs);
}
</style>
