<template>
    <section class="workspace-page">
        <div class="workspace-container">
            <div class="etabs-tabgroup">
                <div class="etabs-tabs"></div>
                <div class="etabs-buttons"></div>
            </div>
            <div class="etabs-views">
                <OpenPlatformAppHostView ref="opAppHost"/>
            </div>
        </div>
    </section>
</template>

<script>
import ElectronTabs from 'electron-tabs'
import '../../../node_modules/electron-tabs/electron-tabs.css'
import {init} from './bridgeServerImpl'
import wfc from "../../wfc/client/wfc";
import Config from "../../config";
import OpenPlatformAppHostView from "./OpenPlatformAppHostView";

let tabGroup = null;

export default {
    name: "WorkspacePage",
    components: {OpenPlatformAppHostView},
    data() {
        return {
            shouldShowWorkspacePortal: true,
            url: Config.OPEN_PLATFORM_WORK_SPACE_URL,
        }
    },

    created() {
        let query = window.location.href.split('?');
        if (query && query.length > 1) {
            let params = new URLSearchParams(query[1]);
            this.url = params.get('url');
        }
    },
    methods: {
        addInitialTab() {
            let tab = tabGroup.addTab({
                title: "工作台",
                src: this.url,
                visible: true,
                active: true,
                closable: false,
                webviewAttributes: {
                    allowpopups: true,
                    nodeintegration: true,
                    webpreferences: 'contextIsolation=false',
                },
            });
            tab.webview.addEventListener('dom-ready', (e) => {
                // for debug
                tab.webview.openDevTools();
            });
            tab.webview.addEventListener('page-title-updated', event => {
                tab.setTitle(event.title);
            })
            console.log('to preload', process.env.NODE_ENV)
            if (process.env.NODE_ENV === 'development') {
                tab.webview.preload = `file://${__dirname}/../../../../../../../../src/ui/workspace/bridgeClientImpl.js`;
            } else {
                tab.webview.preload = `file://${__dirname}/preload.js`;
            }
        },

        onTabActive() {
            let tab = tabGroup.getActiveTab();
            console.log('onTabActive', tab)
            this.shouldShowWorkspacePortal = tab.id === 0;
        },

        onTabClose() {

        },

    },

    mounted() {
        tabGroup = new ElectronTabs();
        tabGroup.on('tab-active', this.onTabActive)

        this.addInitialTab();
        init(this.url, tabGroup, wfc, this.$refs.opAppHost, Config.OPEN_PLATFORM_SERVE_PORT);
    },

    computed: {}
}
</script>

<style scoped>
.workspace-page {
    display: flex;
    flex: 1;
    height: 100%;
    position: relative;
}

.workspace-container {
    width: 100%;
    height: 100%;
}

.workspace-portal button {
    padding: 10px;
    margin: 20px;
    border-radius: 3px;
}

>>> .etabs-tab {
    height: 32px;
}

</style>
