<template>
    <section id="conversation-content" class="conversation-page">
        <ConversationListPanel class="conversation-list-panel"/>
        <ResizeBar/>
        <ConversationView class="conversation-view"/>
    </section>
</template>

<script>
import ConversationView from "./conversation/ConversationView";
import ConversationListPanel from "./ConversationListPanel.vue";
import ResizeBar from "../common/ResizeBar.vue";

export default {
    name: "ConversationPage",
    unmounted() {
        console.log('conversation page destroyed')
    },

    methods: {},
    components: {
        ConversationListPanel,
        ConversationView,
        ResizeBar,
    },
};
</script>

<style lang="css" scoped>
.conversation-page {
    flex: 1;
    display: flex;
    height: 100%;
    /* 自身是 .home flex 的子项，必须允许收缩，否则内部超宽内容会撑破整个主窗口布局 */
    min-width: 0;
}

.conversation-list-panel {
    width: var(--list-panel-width);
    height: 100%;
    flex: 0 0 var(--list-panel-width);
}

.conversation-view {
    flex: 1;
    /* 关键：消息行的宽度上限是相对本容器求百分比（max(400px, 75%)）。
       若本容器没有 min-width:0，超宽消息会把容器的 min-content 撑大，百分比随之变大，
       导致“内容区超宽、只显示一部分”，同进把列表栏挤窄。置 0 后容器宽度以窗口为准 */
    min-width: 0;
    overflow-x: hidden;
}

</style>
