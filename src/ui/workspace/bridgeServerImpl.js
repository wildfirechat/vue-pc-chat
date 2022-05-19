import WebSocket from 'ws'

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
let mAppUrl;
let mTabGroup;
let mWfc;
let mHostPage;

export function init(appUrl, tabGroup, wfc, hostPage, wsPort) {
    mAppUrl = appUrl;
    mTabGroup = tabGroup;
    mWfc = wfc;
    mHostPage = hostPage;
    client = new WebSocket('ws://127.0.0.1:' + wsPort + '/');
    client.on('message', (data) => {
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
            if (handlers[obj.handlerName]) {
                handlers[obj.handlerName](obj.args, obj.requestId);
            } else {
                console.log('wf-op-request, unknown handlerName', obj.handlerName);
            }
        }
    })

    handlers = {
        'toast': toast,
        'openUrl': openUrl,
        'getAuthCode': getAuthCode,
        'config': config,
        'chooseContacts': chooseContacts,
    }
}

let openUrl = (url) => { // addTab or open new window?
    // 直接从工作台打开的，addTab
    // 从应用打开的，new window
    console.log('openUrl', mAppUrl, mTabGroup, url)
    let tab = mTabGroup.addTab({
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
        mHostPage.openExternal(e.url);
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

let getAuthCode = (args, requestId) => {
    let host = 'localhost';
    mWfc.getAuthCode(args.appId, args.appType, host, (authCode) => {
        console.log('authCode', authCode);
        _response('getAuthCode', requestId, 0, authCode);
    }, (err) => {
        console.log('getAuthCode error', err);
        _response('getAuthCode', requestId, err)
    })
}

let config = (args) => {
    mWfc.configApplication(args.appId, args.appType, args.timestamp, args.nonceStr, args.signature, () => {
        console.log('config success');
        _notify('ready')

    }, (err) => {
        console.log('config failed');
        _notify('error', err)
    })
}

let chooseContacts = (args, requestId) => {
    mHostPage.chooseContacts(args, (users) => {
        _response('chooseContacts', requestId, 0, users);
    }, (err) => {
        _response('chooseContacts', requestId, err, 'user canceled');
    })
}

let toast = (text) => {
    mHostPage.$notify({
        title: '提示',
        text: text,
        type: 'warn'
    });

}

let setupTabGroup = (tabGroup) => {
    mTabGroup = tabGroup;
}

function _response(handlerName, requestId, code, data) {
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
    client.send(JSON.stringify(obj));
}

function _notify(handlerName, args) {
    let obj = {
        type: 'wf-op-event',
        handlerName,
        args
    }
    console.log('send event', obj)
    client.send(JSON.stringify(obj));
}


