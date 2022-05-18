<template>
    <section class="workspace-page">
        <div class="workspace-container">
            <div class="etabs-tabgroup">
                <div class="etabs-tabs"></div>
                <div class="etabs-buttons"></div>
            </div>
            <div class="etabs-views"></div>
        </div>
    </section>
</template>

<script>
import ElectronTabs from 'electron-tabs'
import '../../../node_modules/electron-tabs/electron-tabs.css'
import IPCEventType from "../../ipc/ipcEventType";
import Conversation from "../../wfc/model/conversation";
import localStorageEmitter from "../../ipc/localStorageEmitter";
import {shell} from "../../platform";
import TextMessageContent from "../../wfc/messages/textMessageContent";
import IpcSub from "../../ipc/ipcSub";
import Config from "../../config";

let tabGroup = null;

export default {
    name: "WorkspacePage",
    data() {
        return {
            shouldShowWorkspacePortal: true,
        }
    },

    created() {
        const WebSocket = require('ws');
        let client = new WebSocket('ws://127.0.0.1:' + Config.OPEN_PLATFORM_SERVE_PORT + '/');
        client.on('message', (data) => {
            let obj;
            try {
                obj = JSON.parse(data);
            } catch (e) {
                console.error('parse ws data error', e);
                return;
            }
            if (obj.type === 'wf-op-request') {
                console.log('response')
                obj.type = 'wf-op-response';
                client.send(JSON.stringify(obj));
            }
            console.log('receive data', obj);
        })
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
            tab.webview.addEventListener('new-window', (e) => {
                // TODO 判断是否需要用默认浏览器打开
                shell.openExternal(e.url);
            });
            tab.webview.addEventListener('dom-ready', (e) => {
                tab.webview.openDevTools();
            })
            console.log('to preload')
            if (process.env.NODE_ENV !== 'production') {
                tab.webview.preload = `file:///Users/imndx/bitbucket/wildfirechat/vue-pc-chat/src/ui/workspace/bridgeClientImpl.js`;
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

        handleNewWindow(url) {

        }
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
