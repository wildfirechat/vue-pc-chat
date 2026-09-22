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
            // 全WSS模式设置，必须在wfc.init/connect之前调用
            // 使用websocket长连接，只有2026.9.11之后的服务才可以支持
            // wfc.setUseWebsocket(true)
            // // 使用TLS。域名连接走系统信任链校验公签证书；IP直连使用自签名证书。
            // // 扫描证书目录（开发：build/certs，打包：resources/extraResources/certs）下所有
            // // .crt/.pem/.cer/.der，支持多个域名/IP 各自的自签证书，支持一个文件里放多张证书。
            // // 注意传给原生层的是证书【文件路径】不是证书内容，mars 原生层在主进程运行，路径要主进程可见。
            // // 证书由主进程启动时加载并写成 PEM 文件（见 src/background.js），这里通过 IPC 同步取回文件路径。
            // // 不要在渲染进程直接调用 loadSelfSignedCertificates()：没有输出目录时它返回空数组，
            // // 协议栈会退回系统信任链校验，IP 直连的自签证书必然失败。
            // const selfSignedCertFiles = ipcRenderer.sendSync(IPCEventType.GET_SELF_SIGNED_CERT_FILES) || []
            // wfc.UseTls(false, selfSignedCertFiles)
            // // 双网：备选网络地址。策略0为自动选择，主网络不可用时切换到备选网络
            // wfc.setBackupAddress('101.35.103.221', 443)
            // wfc.setBackupAddressStrategy(0)

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
