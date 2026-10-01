<template>
    <!-- 独立窗口里的在线文档：铺满窗口，只有一个文档 -->
    <PanDocPanel ref="panel" window-mode/>
</template>

<script>
import PanDocPanel from './PanDocPanel.vue';

/**
 * 在线文档独立窗口（#/pan-doc?url=&title=）。
 * 由主窗口通过 SHOW_PAN_DOC_WINDOW 打开，一个文档一个窗口。
 */
export default {
    name: 'PanDocWindow',
    components: {PanDocPanel},
    mounted() {
        const query = this.$route.query || {};
        const url = query.url;
        if (!url) {
            return;
        }
        const title = query.title || query.name || '在线文档';
        // 窗口标题（Electron 窗口标题跟随 document.title）
        document.title = title;
        this.$refs.panel.open({url, title});
    },
};
</script>
