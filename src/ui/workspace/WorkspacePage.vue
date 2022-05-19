<template>
    <section class="workspace-page">
        <div class="workspace-container">
            <div class="etabs-tabgroup">
                <div class="etabs-tabs"></div>
                <div class="etabs-buttons"></div>
            </div>
            <div class="etabs-views">
                <OpenPlatformAppHostView/>
            </div>
        </div>
    </section>
</template>

<script>
import ElectronTabs from 'electron-tabs'
import '../../../node_modules/electron-tabs/electron-tabs.css'
import IPCEventType from "../../ipc/ipcEventType";
import Conversation from "../../wfc/model/conversation";
import localStorageEmitter from "../../ipc/localStorageEmitter";
import TextMessageContent from "../../wfc/messages/textMessageContent";
import IpcSub from "../../ipc/ipcSub";
import {init} from './bridgeServerImpl'
import wfc from "../../wfc/client/wfc";
import vm from "../../main";
import PickUserView from "../main/pick/PickUserView";
import store from "../../store";
import {shell} from "../../platform";
import Config from "../../config";
import OpenPlatformAppHostView from "./OpenPlatformAppHostView";

let tabGroup = null;

export default {
    name: "WorkspacePage",
    components: {OpenPlatformAppHostView},
    data() {
        return {
            shouldShowWorkspacePortal: true,
        }
    },

    created() {
    },
    methods: {
        addInitialTab() {
            let tab = tabGroup.addTab({
                title: "工作台",
                src: "http://localhost:8081",
                visible: true,
                active: true,
                closable: false,
                webviewAttributes: {
                    allowpopups: true,
                    nodeintegration: true,
                    webpreferences: 'contextIsolation=false',
                },
            });
            // tab.webview.addEventListener('new-window', (e) => {
            //     // TODO 判断是否需要用默认浏览器打开
            //     shell.openExternal(e.url);
            // });
            tab.webview.addEventListener('dom-ready', (e) => {
                // for debug
                // tab.webview.openDevTools();
            })
            console.log('to preload')
            if (process.env.NODE_ENV !== 'production') {
                tab.webview.preload = `file://${__dirname}/../../../../../../../../src/ui/workspace/bridgeClientImpl.js`;
            } else {
                tab.webview.preload = `file://${__dirname}/../preload.js`;
            }
        },

        openConversation() {
            let conversation = new Conversation(0, 'FireRobot', 0)
            localStorageEmitter.send('wf-ipc-to-main', {type: IPCEventType.openConversation, value: conversation})
        },

        sendMessage() {
            let conversation = new Conversation(0, 'FireRobot', 0)
            let textMessageContent = new TextMessageContent(' 你好，小火。')
            IpcSub.sendMessage(conversation, textMessageContent);
        },

        onTabActive() {
            let tab = tabGroup.getActiveTab();
            console.log('onTabActive', tab)
            this.shouldShowWorkspacePortal = tab.id === 0;
        },

        onTabClose() {

        },

        // 开放平台相关方法 start
        chooseContacts(options, successCB, failCB) {
            let beforeClose = (event) => {
                if (event.params.confirm) {
                    let users = event.params.users;
                    successCB && successCB(users);
                } else {
                    failCB && failCB(-1);
                }
            };
            vm.$modal.show(
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

        openExternal(url) {
            shell.openExternal(url);
        }
        // 开放平台相关方法 end
    },

    mounted() {
        tabGroup = new ElectronTabs();
        tabGroup.on('tab-active', this.onTabActive)

        this.addInitialTab();
        init('http://localhost:8081', tabGroup, wfc, this, Config.OPEN_PLATFORM_SERVE_PORT);
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
