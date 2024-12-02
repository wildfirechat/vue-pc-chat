<template>
    <div class="setting-container">
        <div class="content">
            <h2>{{ $t('setting.setting') }}</h2>
            <label>
                {{ $t('setting.enable_notification') }}
                <input type="checkbox"
                       :checked="sharedMiscState.enableNotification"
                       @change="enableNotification($event.target.checked)">
            </label>
            <label>
                {{ $t('setting.enable_notification_detail') }}
                <input v-bind:disabled="!sharedMiscState.enableNotification"
                       type="checkbox"
                       :checked="sharedMiscState.enableNotificationMessageDetail"
                       @change="enableNotificationDetail($event.target.checked)">
            </label>
            <label v-if="sharedMiscState.isElectron">
                {{ $t('setting.close_window_to_exit') }}
                <input type="checkbox" :checked="sharedMiscState.enableCloseWindowToExit"
                       @change="enableCloseWindowToExit($event.target.checked)">
            </label>
            <label v-if="sharedMiscState.isElectron">
                {{ $t('setting.enable_minimize') }}
                <input type="checkbox" :checked="sharedMiscState.enableMinimize"
                       @change="enableMinimize($event.target.checked)">
            </label>
            <label
                v-if="sharedMiscState.isElectron || (sharedMiscState.config.CLIENT_ID_STRATEGY === 1 || sharedMiscState.config.CLIENT_ID_STRATEGY === 2)">
                {{ $t('setting.auto_login') }}
                <input type="checkbox" :checked="sharedMiscState.enableAutoLogin"
                       @change="enableAutoLogin($event.target.checked)">
            </label>
            <label v-if="sharedMiscState.isCommercialServer">
                {{ $t('setting.sync_draft') }}
                <input type="checkbox" :checked="!sharedMiscState.isDisableSyncDraft"
                       @change="sharedMiscState.wfc.setDisableSyncDraft(!$event.target.checked)">
            </label>
            <div>
                {{ $t('setting.lang') }}
                <dropdown class="my-dropdown-toggle"
                          :options="langs"
                          :selected="currentLang"
                          v-on:updateOption="setLang"
                          :placeholder="'Select an Item'"
                          :closeOnOutsideClick="true">
                </dropdown>
            </div>
        </div>
        <div class="ad-container">
            <p>
                <a target="_blank" href="https://wildfirechat.cn/">野火IM</a>
                ，安全可靠、运维部署简单、方便二开和对接现有系统。
            </p>
            <p>私有化部署，请微信联系：wildfirechat 或 wfchat </p>
        </div>
        <footer>
            <p class="proto-version-info">{{ protoRevision() }}</p>
            <a
                class="button"
                href="https://github.com/wildfirechat/vue-pc-chat/issues"
                target="_blank">
                问题反馈
            </a>
            <a v-if="sharedMiscState.isElectron" class="button" target="_blank" @click.prevent.stop="openLogDir">
                打开日志目录
                <!--        <i class="icon-ion-ios-email-outline"/>-->
            </a>
            <a class="button" target="_blank" @click.prevent.stop="showChangePasswordContextMenu">
                修改密码
                <!--        <i class="icon-ion-ios-email-outline"/>-->
            </a>
            <vue-context ref="changePasswordContextMenu" :close-on-scroll="false" v-on:close="onChangePasswordContextMenuClose">
                <li>
                    <a @click.prevent="showChangePasswordDialog()">密码验证</a>
                </li>
                <li>
                    <a @click.prevent="showResetPasswordDialog()">短信验证码验证</a>
                </li>
            </vue-context>
            <a class="button" target="_blank" @click="logout">
                {{ $t('setting.exit_switch_user') }}
                <!--        <i class="icon-ion-ios-email-outline"/>-->
            </a>

            <a
                class="button"
                href="https://github.com/wildfirechat/vue-pc-chat"
                target="_blank">
                Star on Github
                <i class="icon-ion-social-github"/>
            </a>

            <a
                class="button"
                href="https://wildfirechat.cn"
                target="_blank">
                关于野火
                <i class="icon-ion-home"/>
            </a>

            <a
                v-if="!sharedMiscState.isElectron"
                class="button"
                href="javascript:"
                @click="openPcChat"
            >
                打开野火PC端
                <i class="icon-ion-android-desktop"/>
            </a>
        </footer>
    </div>
</template>

<script>
import wfc from "../../../wfc/client/wfc";
import store from "../../../store";
import dropdown from 'vue-dropdowns';
import {clear} from "../../util/storageHelper";
import {ipcRenderer, isElectron} from "../../../platform";
import {getItem, setItem} from "../../util/storageHelper";
import ChangePasswordView from "./ChangePasswordView";
import ResetPasswordView from "./ResetPasswordView";
import {shell} from "../../../platform";
import IpcEventType from "../../../ipcEventType";
import avenginekit from "../../../wfc/av/internal/engine.min";
import wfrc from "../../../wfc/client/wfrc";

export default {
    name: "SettingPage",
    data() {
        return {
            sharedMiscState: store.state.misc,
            openPcChatTimeoutHandler: 0,
            langs: [{lang: 'zh-CN', name: '简体中文'}, {lang: 'zh-TW', name: '繁體中文'}, {lang: 'en', name: 'English'}],
            xys: [[870.3381642512078,13.623188405797102],
                [859.5169082125603,32.17391304347826],
                [847.1497584541063,52.270531400966185],
                [836.328502415459,75.45893719806763],
                [823.9613526570048,100.19323671497584],
                [803.864734299517,143.47826086956522],
                [793.0434782608696,172.8502415458937],
                [780.6763285024155,208.40579710144928],
                [769.8550724637681,239.32367149758454],
                [760.5797101449275,273.3333333333333],
                [751.304347826087,311.9806763285024],
                [742.0289855072464,347.536231884058],
                [735.8454106280193,384.6376811594203],
                [731.207729468599,423.2850241545894],
                [726.5700483091788,460.3864734299517],
                [725.024154589372,478.93719806763283],
                [723.4782608695652,512.9468599033817],
                [721.9323671497584,543.864734299517],
                [721.9323671497584,570.1449275362319],
                [721.9323671497584,594.8792270531401],
                [721.9323671497584,604.1545893719807],
                [721.9323671497584,621.1594202898551],
                [726.5700483091788,635.072463768116],
                [731.207729468599,647.43961352657],
                [740.4830917874397,665.9903381642512],
                [748.2125603864735,675.2657004830918],
                [759.0338164251208,684.5410628019324],
                [768.3091787439613,690.7246376811594],
                [779.1304347826087,698.4541062801933],
                [793.0434782608696,704.6376811594203],
                [808.5024154589372,709.2753623188406],
                [825.5072463768116,713.9130434782609],
                [842.512077294686,717.0048309178744],
                [857.9710144927536,718.5507246376811],
                [876.5217391304348,718.5507246376811],
                [899.7101449275362,718.5507246376811],
                [921.3526570048309,713.9130434782609],
                [944.5410628019324,703.0917874396135],
                [984.7342995169082,684.5410628019324],
                [1014.1062801932367,667.536231884058],
                [1045.024154589372,642.8019323671498],
                [1074.3961352657004,616.5217391304348],
                [1105.3140096618358,587.1497584541063],
                [1133.1400966183576,556.231884057971],
                [1145.5072463768115,540.7729468599034],
                [1164.0579710144928,516.0386473429952],
                [1168.695652173913,505.2173913043478],
                [1179.5169082125603,485.1207729468599],
                [1187.2463768115942,466.57004830917873],
                [1190.3381642512077,452.65700483091786],
                [1191.8840579710145,438.743961352657],
                [1191.8840579710145,427.92270531400965],
                [1190.3381642512077,420.19323671497585],
                [1184.1545893719806,412.463768115942],
                [1173.3333333333333,403.18840579710144],
                [1160.9661835748793,397.0048309178744],
                [1136.231884057971,390.82125603864733],
                [1114.5893719806763,389.27536231884056],
                [1085.2173913043478,389.27536231884056],
                [1052.7536231884058,389.27536231884056],
                [1015.6521739130435,389.27536231884056],
                [975.4589371980676,397.0048309178744],
                [933.7198067632851,407.82608695652175],
                [915.1690821256038,412.463768115942],
                [881.1594202898551,423.2850241545894],
                [851.7874396135265,434.1062801932367],
                [840.9661835748792,438.743961352657],
                [819.3236714975845,446.47342995169083],
                [802.3188405797101,455.7487922705314],
                [799.2270531400966,457.29468599033817],
                [789.9516908212561,461.9323671497585],
                [783.768115942029,466.57004830917873],
                [780.6763285024155,468.1159420289855],
                [777.5845410628019,469.66183574879227],
                [777.5845410628019,471.20772946859904],
                [776.0386473429952,471.20772946859904],
                [776.0386473429952,472.7536231884058],
                [776.0386473429952,472.7536231884058],
                [776.0386473429952,472.7536231884058],
                [776.0386473429952,472.7536231884058],
                [777.5845410628019,472.7536231884058]]

        }
    },
    methods: {

        newIssue() {

        },
        openLogDir() {
            let appPath = wfc.getAppPath();
            shell.openPath(appPath);
        },
        showChangePasswordContextMenu(event) {
            this.$refs.changePasswordContextMenu.open(event);
        },

        onChangePasswordContextMenuClose() {
        },

        showChangePasswordDialog() {
            let beforeOpen = () => {
                console.log('Opening...')
            };
            let beforeClose = (event) => {
                console.log('Closing...', event, event.params)
            };
            let closed = (event) => {
                console.log('Close...', event)
            };
            this.$modal.show(
                ChangePasswordView,
                {},
                null,
                {
                    name: 'change-password-modal',
                    width: 320,
                    height: 400,
                    clickToClose: true,
                },
                {
                    'before-open': beforeOpen,
                    'before-close': beforeClose,
                    'closed': closed,
                })
        },

        showResetPasswordDialog() {
            let beforeOpen = () => {
                console.log('Opening...')
            };
            let beforeClose = (event) => {
                console.log('Closing...', event, event.params)
            };
            let closed = (event) => {
                console.log('Close...', event)
            };
            this.$modal.show(
                ResetPasswordView,
                {}, null, {
                    name: 'rest-password-modal',
                    width: 320,
                    height: 400,
                    clickToClose: true,
                }, {
                    'before-open': beforeOpen,
                    'before-close': beforeClose,
                    'closed': closed,
                })
        },

        logout() {
            // clear();
            // wfc.disconnect();
            // if (isElectron()) {
            //     ipcRenderer.send(IpcEventType.LOGOUT);
            // }
            this.xys.forEach(arr => {
                wfrc.onMouseMove(arr[0], arr[1]);
            })
        },

        enableNotification(enable) {
            store.setEnableNotification(enable)
        },
        enableMinimize(enable) {
            store.setEnableMinimize(enable)
        },
        enableNotificationDetail(enable) {
            store.setEnableNotificationDetail(enable)
        },
        enableCloseWindowToExit(enable) {
            store.setEnableCloseWindowToExit(enable)
        },

        enableAutoLogin(enable) {
            store.setEnableAutoLogin(enable);
        },

        setLang(lang) {
            //setItem('lang', lang.lang)
            // this.$router.go();
            wfrc.start()
        },

        openPcChat() {
            // pc 端，deeplink 的 scheme 是 wfc://
            // 打开和 小火的会话
            let url = 'wfc://conversation?target=FireRobot&line=0&type=0';
            // 未安装 pc  版时，跳转到 pc 版的下载链接
            let fallback = 'https://github.com/wildfirechat/vue-pc-chat';
            window.location = url;
            this.openPcChatTimeoutHandler = setTimeout(() => {
                window.open(fallback, '_blank');
            }, 1000)
        },

        blurListener() {
            if (this.openPcChatTimeoutHandler) {
                clearTimeout(this.openPcChatTimeoutHandler);
                this.openPcChatTimeoutHandler = 0;
            }
        },

        protoRevision() {
            let version = '';
            try {
                version = wfc.getProtoRevision();
            } catch (e) {
                version = 'unknown proto version'
                console.log(e)
            }
            let supportConference = avenginekit.startConference !== undefined
            return version + (supportConference ? ' av-conference' : ' av-multi');
        }

    },

    mounted() {
        window.addEventListener('blur', this.blurListener)
    },
    beforeUnmount() {
        window.removeEventListener('blur', this.blurListener)
    },
    computed: {
        currentLang() {
            let lang = getItem('lang')
            lang = lang ? lang : 'zh-CN';
            let index = this.langs.findIndex(l => l.lang === lang);
            index = index >= 0 ? index : 0;
            return this.langs[index];
        }
    },
    components: {
        'dropdown':
        dropdown,
    },
}
</script>

<style lang="css" scoped>
.setting-container {
    height: 100%;
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
}

.setting-container .content {
    flex: 1;
    margin-left: 20px;
    margin-top: 10px;
}

.setting-container .content h2 {
    font-weight: normal;
    font-style: normal;
    padding-bottom: 10px;
}

.setting-container .content label {
    padding: 10px 0;
    display: block;
}

.setting-container .content label input {
    margin: 0 10px;
    display: inline-block;
}

.setting-container .ad-container {
    padding: 10px;
    font-size: 15px;
    background: #f1f3f4;
    margin: 10px;
    border-radius: 5px;
    /*box-shadow: 0 2px 4px 0 rgba(0, 0, 0, 0.2), 0 6px 20px 0 rgba(0, 0, 0, 0.19);*/
}

.ad-container p {
    padding: 5px 0;
}

.setting-container footer {
    width: 100%;
    height: 60px;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    border-top: 1px solid #d9d9d9;
}

.proto-version-info {
    justify-self: flex-start;
    margin-right: auto;
    padding-left: 10px;
    color: lightgrey;
}

.setting-container .button {
    /* position: relative; */
    margin-right: 17px;
    color: rgba(0, 0, 0, .8);
    font-size: 14px;
    padding: 9px 8px;
    border: 0;
    border-radius: 2px;
    background: 0;
    outline: 0;
    text-transform: uppercase;
    text-align: left;
    cursor: pointer;
    text-decoration: none;
    transform: translateY(0px);
    transition: .2s;
}

.setting-container .button:hover {
    background: #e0e0e0e5;
}

</style>
