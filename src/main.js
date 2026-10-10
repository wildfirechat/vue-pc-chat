import {createApp} from 'vue'
import App from './App.vue'
import {createRouter, createWebHashHistory} from 'vue-router'
import {createPinia} from 'pinia'
import routers from './routers'

import wfc from './wfc/client/wfc'
import VueTippy from 'vue-tippy'
import 'tippy.js/dist/tippy.css'
import 'tippy.js/themes/light.css'

import VueContext from '@madogai/vue-context/dist/vue-context';

import VModal from './vendor/vue-js-modal'
import './style/global.css'
import './style/wfc.css'
import './assets/fonts/icomoon/style.css'
import store from "./store";
import visibility from './vendor/vue-visibility-change';
import {ipcRenderer, isElectron} from "./platform";
import IPCEventType from "./ipcEventType";
import {getItem} from "./ui/util/storageHelper";
import {createI18n} from 'vue-i18n'
import Notifications from '@kyvg/vue3-notification'
import Alert from "./ui/common/Alert.js";
import Picker from "./ui/common/Picker";
import Forward from "./ui/common/Forward";
import Voip from "./ui/common/Voip";
import VirtualList from "vue3-virtual-scroll-list";
import xss from "xss";
import mitt from 'mitt'
import {plugin as CoolLightBox} from "./vendor/vue-cool-lightbox";
import CustomMessageConfig from "./wfc_custom_message/customMessageConfig";
import Config from "./config";

// Vue.config.productionTip = false

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(CoolLightBox)

// init
{
    // pc
    if (isElectron()) {
        let href = window.location.href;
        let path = href.substring(href.indexOf('#') + 1)
        console.log('init', href, path)
        if (path === '/'/*login*/ || path.startsWith('/home') || href.indexOf('#') === -1) {
            // 长连接协议与双网地址，必须在 wfc.init/connect 之前调用。取值来自 Config，
            // 可以被登录页「服务配置」的配置串覆盖（见 src/config.js applyServiceConfiguration）
            if (Config.IM_USE_WEBSOCKET) {
                // 使用 websocket 长连接，只有 2026.9.11 之后的服务才可以支持
                wfc.setUseWebsocket(true)
            }
            if (Config.IM_USE_TLS) {
                // 域名连接走系统信任链校验公签证书；IP 直连使用自签名证书。证书目录（开发：build/certs，
                // 打包：resources/extraResources/certs）下的证书由主进程加载，这里取回 PEM 文件路径传给原生层
                wfc.UseTls(false, ipcRenderer.sendSync(IPCEventType.GET_SELF_SIGNED_CERT_FILES) || [])
            }
            // 双网：备选网络地址。策略 0 为自动选择，主网络不可用时切换到备选网络
            if (Config.BACKUP_HOST) {
                wfc.setBackupAddress(Config.BACKUP_HOST, Config.BACKUP_IM_PORT)
            }
            wfc.setBackupAddressStrategy(Config.BACKUP_STRATEGY)

            wfc.init()
            CustomMessageConfig.registerCustomMessages()
            store.init(true);
        } else {
            wfc.attach()

            let subWindowLoadDataOptions = {
                loadFavGroupList: false,
                loadChannelList: false,
                loadFriendList: false,
                loadFavContactList: false,
                loadFriendRequestList: false,
                loadDefaultConversationList: false
            }
            // TODO 优化，有的窗口并不需要store，或者不需要加载所有默认数据
            if (path.startsWith('/files') || path.startsWith('/voip')) {
                subWindowLoadDataOptions.loadFriendList = true
                subWindowLoadDataOptions.loadDefaultConversationList = true
            }
            if (path.startsWith('/pan-doc')) {
                // 在线文档窗口要能「分享给联系人」，所以需要好友列表
                subWindowLoadDataOptions.loadFriendList = true
            }
            if ( path.startsWith('/workspace')) {
                subWindowLoadDataOptions.loadFriendList = true
            }
            store.init(false, subWindowLoadDataOptions);
        }
        // web
    } else {
        wfc.init();
        CustomMessageConfig.registerCustomMessages()
        // 双网环境配置
        // 可以根据访问网页的地址，配置是否切换备选网络策略
        // 比如公网，通过域名访问，采用默认的主网络；内网，通过ip访问，使用备选网络
        // 需要在wfc.connect之前调用
        // if (new URL(window.origin).host.startsWith('192.168.2.169')) {
        //     // 设置备选网络不走WSS
        //     Config.USE_WSS = false;
        //     // 设置网络策略
        //     wfc.setBackupAddressStrategy(2)
        //     // 设置备选网络
        //     wfc.setBackupAddress('192.168.10.11', 80)
        // }
        store.init(true);
    }
}
// init end

app.use(
    VueTippy,
    // optional
    {
        directive: 'tippy', // => v-tippy
        component: 'tippy', // => <tippy/>
        componentSingleton: 'tippy-singleton', // => <tippy-singleton/>,
        defaultProps: {
            theme: 'light',
            placement: 'auto-end',
            allowHTML: true,
        }, // => Global default options * see all props
    }
)

app.use(VueContext);
app.component("vue-context", VueContext)
app.component('virtual-list', VirtualList);

app.use(VModal);

app.use(visibility);

app.use(Alert)
app.use(Picker)
app.use(Forward)
app.use(Voip)

const i18n = createI18n({
    // 使用localStorage存储语言状态是为了保证页面刷新之后还是保持原来选择的语言状态
    locale: getItem('lang') ? getItem('lang') : 'zh-CN', // 定义默认语言为中文
    allowComposition: true,
    messages: {
        'zh-CN': require('@/assets/lang/zh-CN.json'),
        'zh-TW': require('@/assets/lang/zh-TW.json'),
        'en': require('@/assets/lang/en.json')
    }
})
app.use(i18n)

app.use(Notifications)
const router = createRouter({
    // mode: 'hash',
    history: createWebHashHistory(),
    routes: routers,
})
app.use(router)
app.config.globalProperties.$router = router

// 渲染进程崩溃的自动恢复由主进程处理（background.js 中的 render-process-gone/did-fail-load）。
// 这里的 JS 错误只记日志：资源加载失败（如头像 404）和普通网络请求失败也会走到这些回调，
app.config.errorHandler = (err, instance, info) => {
    console.error('[vue errorHandler]', info, err)
}

window.addEventListener('error', (event) => {
    console.error('[window.error]', event?.error || event?.message || event)
}, true)

window.addEventListener('unhandledrejection', (event) => {
    console.error('[unhandledrejection]', event?.reason)
}, true)

const eventBus = mitt()
eventBus.$on = eventBus.on
eventBus.$off = eventBus.off
eventBus.$emit = eventBus.emit
app.config.globalProperties.$eventBus = eventBus
const xssOptions = (() => {
    let whiteList = xss.getDefaultWhiteList();
    window.__whiteList = whiteList;
    //xss 处理的时候，默认会将 img 便签的class属性去除，导致 emoji 表情显示太大
    //这儿配置保留 img 标签的style、class、src、alt、id 属性
    whiteList.img = ["style", "class", "src", "alt", "id"];
    return {
        whiteList
    };
})();

app.config.globalProperties.$xss = (html) => {
    return xss(html, xssOptions);
};

app.config.globalProperties.$set = (obj, key, value) => obj[key] = value

app.mount('#app');
