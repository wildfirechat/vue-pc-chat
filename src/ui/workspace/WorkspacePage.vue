<template>
    <section>
        <div class="workspace-container">
            <div class="etabs-tabgroup">
                <div class="etabs-tabs"></div>
                <div class="etabs-buttons"></div>
            </div>
            <div class="etabs-views"></div>
        </div>
        <div v-if="shouldShowWorkspacePortal" class="workspace-portal">
            <div>
                <button @click="showWFCHome">show wfc home</button>
            </div>
            <div>
                <button @click="showDevDocs">show wfc dev</button>
            </div>
        </div>
    </section>
</template>

<script>
// const TabGroup = require("electron-tabs");
import ElectronTabs from 'electron-tabs'
import '../../../node_modules/electron-tabs/electron-tabs.css'

let tabGroup = null;

export default {
    name: "WorkspacePage",
    data() {
        return {
            shouldShowWorkspacePortal: true,
        }
    },
    methods: {
        tab() {
            // window.open('www.baidu.com')
            // let tabGroup = new ElectronTabs();
            let tab = tabGroup.addTab({
                title: "野火IM",
                src: "https://www.wildfirechat.cn",
                visible: true
            });
            let tab2 = tabGroup.addTab({
                title: "野火IM开发文档",
                src: "https://docs.wildfirechat.cn",
                visible: true,
                active: true
            });
        },
        showWFCHome() {
            tabGroup.addTab({
                title: "野火IM",
                src: "https://www.wildfirechat.cn",
                visible: true,
                active: true,
            });
            this.shouldShowWorkspacePortal = false;
        },
        showDevDocs() {
            tabGroup.addTab({
                title: "野火IM开发文档",
                src: "https://docs.wildfirechat.cn",
                visible: true,
                active: true
            });
            this.shouldShowWorkspacePortal = false;
        },
        addInitialTab() {
            tabGroup.addTab({
                title: "野火IM工作空间",
                // src: url,
                visible: true
            });
        },

        showWorkspacePortal() {
            if (!tabGroup) {
                return true;
            }
            let activeTab = tabGroup.getActiveTab();
            return activeTab ? activeTab.getPosition() === 0 : true
        },

        onTabActive() {
            let tab = tabGroup.getActiveTab();
            console.log('onTabActive', tab)
            this.shouldShowWorkspacePortal = tab.id === 0;
        },

        onTabClose() {

        }
    },

    created() {
        document.title = '工作空间';
    },

    mounted() {
        tabGroup = new ElectronTabs();
        tabGroup.on('tab-active', this.onTabActive)

        this.addInitialTab();
    },

    computed: {}
}
</script>

<style scoped>
.workspace-container {
    width: 100%;
    height: 100%;
}

.workspace-portal {
    position: absolute;
    left: 0;
    top: 32px;
    background: #98ea70;
    width: 100%;
    height: calc(100% - 32px);
    display: flex;
    flex-direction: column;
}

.workspace-portal button {
}

>>> .etabs-tab {
    height: 32px;
}

</style>