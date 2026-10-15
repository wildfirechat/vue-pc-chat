<template>
    <div class="poll-card" :class="{out: message.direction === 0}" @click="onClick">
        <div class="poll-card-title">
            <i class="icon-ion-stats-bars"></i>
            <span>{{ content.title }}</span>
        </div>
        <p v-if="content.desc" class="poll-card-desc">{{ content.desc }}</p>
        <p class="poll-card-meta">{{ metaText }}</p>
        <div class="poll-card-divider"></div>
        <p class="poll-card-action"><span>{{ isEnded ? $t('poll.view_result') : $t('poll.join_action') }}</span><i class="icon-ion-ios-arrow-right"></i></p>
    </div>
</template>

<script>
import Message from "../../../../../wfc/messages/message";
import {showPollDetail} from "../../../../poll/pollUi";
import {pollRemainingText} from "../../../../poll/pollUtil";

/**
 * 投票消息气泡（对齐 wf-enterprise-chat 的 PollCellBuilder）：气泡内一律用气泡的文字色，层级靠字重 / 透明度，不用色相。
 */
export default {
    name: "PollMessageContentView",
    props: {
        message: {
            type: Message,
            required: true,
        }
    },
    computed: {
        content() {
            return this.message.messageContent;
        },
        isEnded() {
            return this.content.status === 1 || (this.content.endTime > 0 && this.content.endTime < Date.now());
        },
        // 票数 · 状态 · 剩余时间，合成一行
        metaText() {
            let parts = [
                this.$t('poll.vote_count', {count: this.content.totalVotes || 0}),
                this.isEnded ? this.$t('poll.poll_ended') : this.$t('poll.poll_in_progress'),
            ];
            if (!this.isEnded) {
                let remaining = pollRemainingText(this, this.content);
                remaining && parts.push(remaining);
            }
            return parts.join(' · ');
        },
    },
    methods: {
        onClick() {
            // 从消息进入是投票模式；带上 messageId，详情拉到新状态后回写这条消息
            showPollDetail(this, {
                pollId: this.content.pollId,
                groupId: this.content.groupId || this.message.conversation.target,
                fromMessage: true,
                messageId: this.message.messageId,
            });
        },
    },
}
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

.poll-card-desc {
    margin-top: 4px;
    font-size: var(--font-size-xs);
    line-height: 1.4;
    opacity: .7;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
}

.poll-card-meta {
    margin-top: 8px;
    font-size: var(--font-size-xs);
    opacity: .7;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
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
