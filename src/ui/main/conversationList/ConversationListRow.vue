<template>
    <div v-if="source && source._dshHeader" class="dsh-conversation-header">
        <span class="dsh-conversation-header-name">{{ source.name }}</span>
        <span class="dsh-conversation-header-count">{{ source.count }}</span>
    </div>
    <ConversationItemView v-else :source="source"/>
</template>

<script>
import ConversationItemView from "./ConversationItemView.vue";

export default {
    name: "ConversationListRow",
    components: { ConversationItemView },
    props: {
        source: {
            type: Object,
            required: true,
        },
    },
};
</script>

<style scoped>
.dsh-conversation-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 7px 14px 5px;
    font-size: 11px;
    font-weight: 600;
    color: var(--text-secondary, #8a8f99);
    background: var(--background-primary, #fff);
    border-bottom: 1px solid var(--border-separator, #f0f1f3);
    box-sizing: border-box;
}
.dsh-conversation-header-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.dsh-conversation-header-count {
    flex: 0 0 auto;
    min-width: 18px;
    padding: 0 5px;
    border-radius: 999px;
    background: var(--background-secondary, #f2f3f5);
    font-size: 10px;
    line-height: 18px;
    text-align: center;
}
</style>
