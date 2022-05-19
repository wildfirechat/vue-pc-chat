// TODO
// 非工作台页面时，也就是开放平台应用打开独立窗口时，需要

<template>
    <div>
        <webview v-if="embedWebview" ref="webview"/>
    </div>
</template>

<script>
import vm from "../../main";
import PickUserView from "../main/pick/PickUserView";
import store from "../../store";
import {shell} from "../../platform";

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
        // TODO preload and init
        if (this.$refs.webview) {
            console.log('embed webview')
        }
    }
}
</script>

<style scoped>

</style>
