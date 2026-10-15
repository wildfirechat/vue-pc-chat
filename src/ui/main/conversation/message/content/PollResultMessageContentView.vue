<template>
    <div class="poll-card" :class="{out: message.direction === 0}" @click="onClick">
        <div class="poll-card-title">
            <i class="icon-ion-pie-graph"></i>
            <span>{{ content.title }}</span>
        </div>
        <p class="poll-card-meta">{{ statsText }}</p>
        <div class="poll-card-divider"></div>
        <p class="poll-card-action"><span>{{ content.status === 1 ? $t('poll.poll_ended') : $t('poll.poll_updated') }} · {{ $t('poll.view_result') }}</span><i class="icon-ion-ios-arrow-right"></i></p>
    </div>
</template>

<script>
import Message from "../../../../../wfc/messages/message";
import {showPollDetail} from "../../../../poll/pollUi";

/**
 * 投票结果消息：与投票消息同款气泡，点开进投票详情
 */
export default {
    name: "PollResultMessageContentView",
    props: {
        message: {
            type: Message,
            required: true,
        },
    },
    computed: {
        content() {
            return this.message.messageContent;
        },
        statsText() {
            return this.$t("poll.result_stats", {totalVotes: this.content.totalVotes || 0, voterCount: this.content.voterCount || 0});
        },
    },
    methods: {
        onClick() {
            showPollDetail(this, {
                pollId: this.content.pollId,
                groupId: this.content.groupId || this.message.conversation.target,
                fromMessage: true,
            });
        },
    },
};
</script>

<style scoped>
.poll-card {
    margin: 0 8px;
    /* 气泡箭头(.leftarrow/.rightarrow:before)以卡片为定位基准，否则会定位到整行，发出的消息箭头超出右边缘，会话列表出现横向滚动条 */
    position: relative;
    width: 220px;
    padding: 12px;
    box-sizing: border-box;
    border-radius: var(--radius-md);
    background-color: var(--background-message-in);
    color: var(--text-primary);
    cursor: pointer;
}

.poll-card.out {
    background-color: var(--background-message-out);
}

.poll-card p, .poll-card span, .poll-card i {
    color: inherit;
}

.poll-card-title {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    font-size: var(--font-size-base);
    font-weight: 600;
    line-height: 1.4;
}

.poll-card-title i {
    flex: 0 0 auto;
    font-size: 16px;
    line-height: 20px;
}

.poll-card-title span {
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    word-break: break-all;
}

.poll-card-meta {
    margin-top: 8px;
    font-size: var(--font-size-xs);
    opacity: .7;
}

.poll-card-divider {
    height: 0.5px;
    margin: 8px 0;
    background: currentColor;
    opacity: .25;
}

.poll-card-action {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: var(--font-size-xs);
    font-weight: 500;
}

.poll-card-action i {
    font-size: 12px;
    opacity: .6;
}
</style>
