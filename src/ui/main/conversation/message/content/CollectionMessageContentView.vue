<template>
    <div class="collection-card" :class="{out: message.direction === 0}" @click="onClick">
        <div class="collection-card-title">
            <i class="icon-ion-ios-list-outline"></i>
            <span class="title">{{ content.title }}</span>
            <span class="count">{{ $t('collection.people_count', {count: entries.length}) }}</span>
        </div>
        <p v-if="content.desc" class="collection-card-desc">{{ content.desc }}</p>
        <div class="collection-card-divider"></div>
        <p v-if="!preview.length" class="collection-card-hint">{{ $t('collection.collection_empty_hint') }}</p>
        <template v-else>
            <p v-for="(entry, index) in preview" :key="index" class="collection-card-entry">{{ index + 1 }}. {{ entry.content }}</p>
            <p v-if="remaining > 0" class="collection-card-hint more">{{ $t('collection.more_participants', {count: remaining}) }}</p>
        </template>
        <div class="collection-card-divider"></div>
        <p class="collection-card-action"><span>{{ actionText }}</span><i class="icon-ion-ios-arrow-right"></i></p>
    </div>
</template>

<script>
import Message from "../../../../../wfc/messages/message";
import {showCollectionDetail} from "../../../../collection/collectionUi";

const MAX_PREVIEW = 5;

/**
 * 接龙消息气泡（对齐 wf-enterprise-chat 的 CollectionCellBuilder）：标题 + 前 5 条参与记录。
 * 与投票气泡同一条规则：气泡内一律用气泡的文字色，层级靠字重 / 透明度。
 */
export default {
    name: "CollectionMessageContentView",
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
        entries() {
            return (this.content.entries || []).filter(e => !e.deleted);
        },
        preview() {
            return this.entries.slice(0, MAX_PREVIEW);
        },
        remaining() {
            return this.entries.length - this.preview.length;
        },
        actionText() {
            if (this.content.status === 1) {
                return this.$t('collection.collection_status_ended');
            }
            if (this.content.status === 2) {
                return this.$t('collection.collection_status_cancelled');
            }
            return this.$t('collection.collection_join_action');
        },
    },
    methods: {
        onClick() {
            showCollectionDetail(this, {
                collectionId: this.content.collectionId,
                groupId: this.content.groupId || this.message.conversation.target,
            });
        },
    },
}
</script>

<style scoped>
.collection-card {
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

.collection-card.out {
    background-color: var(--background-message-out);
}

.collection-card p, .collection-card span, .collection-card i {
    color: inherit;
}

.collection-card-title {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    line-height: 1.4;
}

.collection-card-title i {
    flex: 0 0 auto;
    font-size: 16px;
    line-height: 20px;
}

.collection-card-title .title {
    flex: 1;
    min-width: 0;
    font-size: var(--font-size-base);
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    word-break: break-all;
}

.collection-card-title .count {
    flex: 0 0 auto;
    font-size: var(--font-size-xs);
    line-height: 20px;
    opacity: .7;
}

.collection-card-desc {
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

.collection-card-divider {
    height: 0.5px;
    margin: 8px 0;
    background: currentColor;
    opacity: .25;
}

.collection-card-entry {
    padding: 2px 0;
    font-size: var(--font-size-xs);
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
}

.collection-card-hint {
    font-size: var(--font-size-xs);
    opacity: .7;
}

.collection-card-hint.more {
    margin-top: 4px;
}

.collection-card-action {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: var(--font-size-xs);
    font-weight: 500;
}

.collection-card-action i {
    font-size: 12px;
    opacity: .6;
}
</style>
