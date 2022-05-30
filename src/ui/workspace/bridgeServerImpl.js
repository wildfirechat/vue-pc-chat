import WebSocket from 'ws'
import {remote} from "../../platform";

/**
 * 大概流程
 *  采用类 client-server 模式实现开发平台 js sdk，有两部分相关代码：
 * 1. client 运行在工作台所加载的 webview 里面
 * 2. server 直接运行在工作台页面里面，也就是主窗口的渲染进程
 * 3. client 和 server 之间的交互，通过 websocket 进行中转
 *
 */


let handlers;
let client;
let mWfc;
let mHostPage;

export function init(wfc, hostPage, wsPort) {

    mWfc = wfc;
    mHostPage = hostPage;
    if (client){
        return;
    }

    client = new WebSocket('ws://127.0.0.1:' + wsPort + '/');
    client.on('message', (data) => {
        let obj;
        try {
            obj = JSON.parse(data);
        } catch (e) {
            console.error('parse ws data error', e);
            return;
        }
        if (remote.getCurrentWindow().getMediaSourceId() !== obj.windowId) {
            return;
        }
        //let obj = {type: 'wf-op-request', requestId, handlerName, args};
        console.log('wf-op-request', obj)
        if (obj.type === 'wf-op-request') {
            if (handlers[obj.handlerName]) {
                handlers[obj.handlerName](obj.args, obj.appUrl, obj.requestId);
            } else {
                console.log('wf-op-request, unknown handlerName', obj.handlerName);
            }
        }
    });

    handlers = {
        'toast': toast,
        'openUrl': openUrl,
        'getAuthCode': getAuthCode,
        'config': config,
        'chooseContacts': chooseContacts,
        'close': close,
    }
}

let openUrl = (args) => { // addTab or open new window?
    console.log('openUrl', args)
    // 直接从工作台打开的，addTab
    // 从应用打开的，new window
    if (args.external) {
        args.hostUrl = location.href;
        mHostPage.openExternal(args);
        return;
    }
    mHostPage.addTab(args.url)
}

let getAuthCode = (args, appUrl, requestId) => {
    let host = new URL(appUrl).host;
    if (host.indexOf(':') > 0) {
        host = host.substring(0, host.indexOf(':'))
    }
    mWfc.getAuthCode(args.appId, args.appType, host, (authCode) => {
        console.log('authCode', authCode);
        _response('getAuthCode', appUrl, requestId, 0, authCode);
    }, (err) => {
        console.log('getAuthCode error', err);
        _response('getAuthCode', appUrl, requestId, err)
    })
}

let config = (args, appUrl) => {
    mWfc.configApplication(args.appId, args.appType, args.timestamp, args.nonceStr, args.signature, () => {
        console.log('config success');
        _notify('ready', appUrl)

    }, (err) => {
        console.log('config failed');
        _notify('error', appUrl, err)
    })
}

let chooseContacts = (args, appUrl, requestId) => {
    mHostPage.chooseContacts(args, (users) => {
        _response('chooseContacts', appUrl, requestId, 0, users);
    }, (err) => {
        _response('chooseContacts', appUrl, requestId, err, 'user canceled');
    })
}

let close = (args, appUrl) => {
    // 关闭当前 tab
    console.log('close---', location.href)
    let tabs = mHostPage.tabGroup.getTabs();
    for (let tab of tabs) {
        if (tab.webviewAttributes.src === appUrl) {
            tab.close(true);
        }
    }
}

let toast = (text) => {
    mHostPage.$notify({
        title: '提示',
        text: text,
        type: 'warn'
    });

}

function _response(handlerName, appUrl, requestId, code, data) {
    let obj = {
        type: 'wf-op-response',
        handlerName,
        appUrl,
        requestId,
        windowId: remote.getCurrentWindow().getMediaSourceId(),
        args: {
            code,
            data
        },
    }
    console.log('send response', obj)
    client.send(JSON.stringify(obj));
}

function _notify(handlerName, appUrl, args) {
    let obj = {
        type: 'wf-op-event',
        handlerName,
        appUrl,
        windowId: remote.getCurrentWindow().getMediaSourceId(),
        args
    }
    console.log('send event', obj)
    client.send(JSON.stringify(obj));
}


