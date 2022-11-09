<template>
    <section class="workspace-page">
        <div class="workspace-container">
            <div class="etabs-tabgroup">
                <div class="etabs-tabs"></div>
                <div class="etabs-buttons"></div>
            </div>
            <div class="etabs-views">
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
import {ipcRenderer, remote} from "../../platform";
import IpcEventType from "../../ipcEventType";

let tabGroup = null;

export default {
    name: "WorkspacePage",
    components: {},
    data() {
        return {
            shouldShowWorkspacePortal: true,
            url: Config.OPEN_PLATFORM_WORK_SPACE_URL,
        }
    },

    created() {
        let tmpUrl = this._getQuery(location.href, 'url');
        if (tmpUrl) {
            this.url = decodeURIComponent(tmpUrl);
        }

        ipcRenderer.on('new-open-platform-app-tab', (event, args) => {
            console.log('new-open-platform-app-tab', args)
            let tabUrl = this._getQuery(args.url, 'url');
            tabUrl = decodeURIComponent(tabUrl);
            console.log('new-open-platform-app-tab', args, tabUrl)
            this.addTab(tabUrl);
        })
    },
    methods: {
        _getQuery(url, key) {
            if (url.indexOf('?') > 0) {
                let query = url.substring(url.indexOf('?'));
                if (query && query.length > 1) {
                    let params = new URLSearchParams(query);
                    return params.get(key);
                }
            }
            return null;
        },

        onTabActive() {
            let tab = tabGroup.getActiveTab();
            console.log('onTabActive', tab)
            this.shouldShowWorkspacePortal = tab.id === 0;
        },

        onTabClose() {

        },

        // 开放平台UI相关方法 start
        chooseContacts(options, successCB, failCB) {
            this.$pickContact({
                successCB,
                failCB,
            });
        },

        openExternal(args) {
            let hash = window.location.hash;
            let url = window.location.origin;
            if (hash) {
                url = window.location.href.replace(hash, '#/workspace');
            } else {
                url += "/workspace"
            }

            url += '?url=' + encodeURIComponent(args.url);

            ipcRenderer.send(IpcEventType.OPEN_H5_APP_WINDOW, {url: url, hostUrl: args.hostUrl})
        },

        addTab(url, closable = true) {
            let tabs = tabGroup.getTabs();
            let found = false;
            for (let tab of tabs) {
                if (tab.webviewAttributes.src === url) {
                    tab.activate();
                    found = true;
                    return;
                }
            }
            let tab = tabGroup.addTab({
                title: "工作台",
                //src: args.url ? args.url : args,
                src: url,
                visible: true,
                active: true,
                closable: closable,
                webviewAttributes: {
                    allowpopups: true,
                    nodeintegration: true,
                    webpreferences: 'contextIsolation=false',
                    url: url,
                },
            });
            // tab.webview.addEventListener('new-window', (e) => {
            //     // TODO 判断是否需要用默认浏览器打开
            //     console.log('new-window', e.url)
            // });
            //
            // tab.webview.addEventListener('update-target-url', event => {
            //     console.log('update-target-url', event);
            // })
            //
            // tab.webview.addEventListener('will-navigate', event => {
            //     console.log('will-navigate', event)
            //     event.preventDefault();
            // })

            tab.webview.addEventListener('page-title-updated', (e) => {
                tab.setTitle(e.title);
            })
            tab.webview.addEventListener('dom-ready', (e) => {
                // tab.webview.openDevTools();
            })

            if (process.env.NODE_ENV === 'development') {
                tab.webview.preload = `file://${__dirname}/../../../../../../../../src/ui/workspace/bridgeClientImpl.js`;
            } else {
                tab.webview.preload = `file://${__dirname}/preload.js`;
            }
        }


        // 开放平台UI相关方法 end
    },

    mounted() {
        tabGroup = new ElectronTabs();
        tabGroup.on('tab-active', this.onTabActive)
        tabGroup.on('tab-removed', () => {
            let tabs = tabGroup.getTabs();
            if (!tabs || tabs.length === 0) {
                remote.getCurrentWindow().close();
            }
        })

        this.addTab(this.url, false);
        this.tabGroup = tabGroup;
        init(wfc, this, Config.OPEN_PLATFORM_SERVE_PORT);
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
