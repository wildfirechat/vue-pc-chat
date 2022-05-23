// TODO
// 非工作台页面时，也就是开放平台应用打开独立窗口时，需要

<template>
    <div>
        <webview v-if="embedWebview" ref="webview"/>
    </div>
</template>

<script>
import PickUserView from "../main/pick/PickUserView";
import store from "../../store";
import {ipcRenderer} from "../../platform";

export default {
    name: "OpenPlatformAppHostView",
    props: {
        embedWebview: {
            type: Boolean,
            default: false,
        }
    },

    methods: {
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

            ipcRenderer.send('show-open-platform-app-host-window', {url, appUrl: args.url})
        }
        // 开放平台相关方法 end
    },

    mounted() {
        if (this.$refs.webview) {
            if (process.env.NODE_ENV === 'development') {
                this.$refs.webview.preload = `file://${__dirname}/../../../../../../../../src/ui/workspace/bridgeClientImpl.js`;
            } else {
                this.$refs.webview.preload = `file://${__dirname}/preload.js`;
            }
        }
    }
}
</script>

<style scoped>

</style>
