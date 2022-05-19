import WebSocket from 'ws'
import Config from '../../config'
import vm from '../../main'
import wfc from "../../wfc/client/wfc";
import {shell} from "../../platform";
import PickUserView from "../main/pick/PickUserView";
import store from "../../store";

/**
 * 大概流程
 *  采用类 client-server 模式实现开发平台 js sdk，有两部分相关代码：
 * 1. client 运行在工作台所加载的 webview 里面
 * 2. server 直接运行在工作台页面里面，也就是主窗口的渲染进程
 * 3. client 和 server 之间的交互，通过 websocket 进行中转
 *
 */

export class BridgeServerImpl {

    handlers;
    client;
    appUrl;
    tabGroup;

    init(appUrl, tabGroup) {
        this.appUrl = appUrl;
        this.tabGroup = tabGroup;
        this.client = new WebSocket('ws://127.0.0.1:' + Config.OPEN_PLATFORM_SERVE_PORT + '/');
        this.client.on('message', (data) => {
            let obj;
            try {
                obj = JSON.parse(data);
            } catch (e) {
                console.error('parse ws data error', e);
                return;
            }
            //let obj = {type: 'wf-op-request', requestId, handlerName, args};
            if (obj.type === 'wf-op-request') {
                console.log('wf-op-request', obj)
                if (this.handlers[obj.handlerName]) {
                    this.handlers[obj.handlerName](obj.args, obj.requestId);
                } else {
                    console.log('wf-op-request, unknown handlerName', obj.handlerName);
                }
            }
        })

        this.handlers = {
            'toast': this.toast,
            'openUrl': this.openUrl,
            'getAuthCode': this.getAuthCode,
            'config': this.config,
            'chooseContacts': this.chooseContacts,
        }
    }

    openUrl = (url) => {
        // addTab or open new window?
        // 直接从工作台打开的，addTab
        // 从应用打开的，new window，添加 OpenPlatformAppPage.vue
        console.log('openUrl', this.appUrl, this.tabGroup, url)
        let tab = this.tabGroup.addTab({
            //title: "工作台",
            src: url,
            visible: true,
            active: true,
            closable: true,
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
        tab.webview.addEventListener('page-title-updated', (e) => {
            tab.setTitle(e.title);
        })
        tab.webview.addEventListener('dom-ready', (e) => {
            tab.webview.openDevTools();
        })
        if (process.env.NODE_ENV !== 'production') {
            tab.webview.preload = `file://${__dirname}/../../../../../../../../src/ui/workspace/bridgeClientImpl.js`;
        } else {
            tab.webview.preload = `file://${__dirname}/../preload.js`;
        }
    }

    getAuthCode = (args, requestId) => {
        let host = 'localhost';
        wfc.getAuthCode(args.appId, args.appType, host, (authCode) => {
            console.log('authCode', authCode);
            this._response('getAuthCode', requestId, 0, authCode);
        }, (err) => {
            console.log('getAuthCode error', err);
            this._response('getAuthCode', requestId, err)
        })
    }

    config = (args) => {
        wfc.configApplication(args.appId, args.appType, args.timestamp, args.nonceStr, args.signature, () => {
            console.log('config success');
            this._notify('ready')

        }, (err) => {
            console.log('config failed');
            this._notify('error', err)
        })
    }

    chooseContacts = (args, requestId) => {
        let beforeClose = (event) => {
            if (event.params.confirm) {
                let users = event.params.users;
                this._response('chooseContacts', requestId, 0, users);
            } else {
                this._response('chooseContacts', requestId, -1, 'user canceled');
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
    }

    toast(text) {
        vm.$notify({
            title: '提示',
            text: text,
            type: 'warn'
        });

    }

    setupTabGroup(tabGroup) {
        this.tabGroup = tabGroup;
    }

    _response(handlerName, requestId, code, data) {
        let obj = {
            type: 'wf-op-response',
            handlerName,
            requestId,
            args: {
                code,
                data
            },
        }
        console.log('send response', obj)
        this.client.send(JSON.stringify(obj));
    }

    _notify(handlerName, args) {
        let obj = {
            type: 'wf-op-event',
            handlerName,
            args
        }
        console.log('send event', obj)
        this.client.send(JSON.stringify(obj));
    }
}

let self = new BridgeServerImpl();
export default self;


