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
import PickUserView from "../main/pick/PickUserView";
import store from "../../store";

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
        let query = window.location.href.split('?');
        if (query && query.length > 1) {
            let params = new URLSearchParams(query[1]);
            this.url = params.get('url');
        }
        let tmpUrl = this._getQuery(location.href, 'url');
        if (tmpUrl) {
            this.url = tmpUrl;
        }

        ipcRenderer.on('new-open-platform-app-tab', (event, args) => {
            console.log('new-open-platform-app-tab', args)
            let tabUrl = this._getQuery(args.url, 'url');
            let tabs = tabGroup.getTabs();
            let found = false;
            for (let tab of tabs) {
                if (tab.webviewAttributes.src === tabUrl) {
                    tab.activate();
                    found = true;
                }
            }
            if (!found) {
                this.addTab(tabUrl);
            }
        })
    },
    methods: {
        _getQuery(url, key) {
            let query = url.split('?');
            if (query && query.length > 1) {
                let params = new URLSearchParams(query[1]);
                return params.get(key);
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
            let beforeClose = (event) => {
                if (event.params.confirm) {
                    let users = event.params.users;
                    successCB && successCB(users);
                } else {
                    failCB && failCB(-1);
                }
            };
            this.$modal.show(
                PickUserView,
                {
                    users: store.state.contact.favContactList.concat(store.state.contact.friendList),
                    // initialCheckedUsers: [...this.session.participantUserInfos, this.session.selfUserInfo],
                    // uncheckableUsers: [...this.session.participantUserInfos, this.session.selfUserInfo],
                    showCategoryLabel: true,
                    confirmTitle: '确定',
                }, {
                    name: 'pick-user-modal',
                    width: 600,
                    height: 480,
                    clickToClose: false,
                }, {
                    // 'before-open': this.beforeOpen,
                    'before-close': beforeClose,
                    // 'closed': this.closed,
                })
        },

        openExternal(args) {
            let hash = window.location.hash;
            let url = window.location.origin;
            if (hash) {
                url = window.location.href.replace(hash, '#/workspace');
            } else {
                url += "/workspace"
            }

            url += '?url=' + args.url;

            ipcRenderer.send('show-open-platform-app-host-window', {url, hostUrl: args.hostUrl})
        },

        addTab(args) {
            console.log('addTab', args)
            let tab = tabGroup.addTab({
                title: "工作台",
                //src: args.url ? args.url : args,
                src: args,
                visible: true,
                active: true,
                closable: true,
                webviewAttributes: {
                    allowpopups: true,
                    nodeintegration: true,
                    webpreferences: 'contextIsolation=false',
                    url: args,
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
                tab.webview.openDevTools();
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

        this.addTab(this.url);
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
