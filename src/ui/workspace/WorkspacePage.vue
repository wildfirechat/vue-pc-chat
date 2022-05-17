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
// const TabGroup = require("electron-tabs");
import ElectronTabs from 'electron-tabs'
import '../../../node_modules/electron-tabs/electron-tabs.css'
import IPCEventType from "../../ipc/ipcEventType";
import Conversation from "../../wfc/model/conversation";
import localStorageEmitter from "../../ipc/localStorageEmitter";
import {remote, shell} from "../../platform";
import TextMessageContent from "../../wfc/messages/textMessageContent";
import IpcSub from "../../ipc/ipcSub";

let tabGroup = null;

export default {
    name: "WorkspacePage",
    data() {
        return {
            shouldShowWorkspacePortal: true,
        }
    },
    methods: {
        addInitialTab() {
            let tab = tabGroup.addTab({
                title: "工作台",
                src: "https://open.wildfirechat.cn/work.html",
                visible: true,
                active: true,
                closable: false,
                webviewAttributes: {
                    allowpopups: true,
                },
            });
            tab.webview.addEventListener('new-window', (e) => {
                // TODO 判断是否需要用默认浏览器打开
                shell.openExternal(e.url);
            })
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
