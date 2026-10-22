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
    /* flex 子项默认 min-width: auto，内容（长频道描述、宽消息）会把会话界面撑得比窗口还宽 */
    min-width: 0;
    display: flex;
    height: 100%;
}

.conversation-list-panel {
    width: var(--list-panel-width);
    height: 100%;
    flex: 0 0 var(--list-panel-width);
}

.conversation-view {
    flex: 1;
    min-width: 0;
}

</style>
