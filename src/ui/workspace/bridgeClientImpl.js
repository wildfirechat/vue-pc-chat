/**
 * 大概流程
 *  采用类 client-server 模式实现开发平台 js sdk，有两部分相关代码：
 * 1. client 运行在工作台所加载的 webview 里面
 * 2. server 直接运行在工作台页面里面，也就是主窗口的渲染进程
 * 3. client 和 server 之间的交互，通过 websocket 进行中转
 *
 */

let callbackMap = new Map();
let requestId = 0;
var client;

function init() {
    const WebSocket = require('ws');
    client = new WebSocket('ws://127.0.0.1:' + 7983 + '/');
    client.on('message', (data) => {
        let obj;
        try {
            obj = JSON.parse(data);
        }catch (e) {
            console.error('parse ws data error', e);
            return;
        }
        if (obj.type === 'wf-op-event') {

        } else if (obj.type === 'wf-op-response') {

        }
        console.log('receive data', obj);
    })

    window.__wf_bridge_ = {
        call: call,
        register: register,
    }
    console.log('bridgeImpl init')
}

function call(handlerName, args, callback) {
    requestId++;
    if (callback && typeof callback === 'function') {
        callbackMap.set(requestId, callback)
    }
    let obj = {type: 'wf-op-request', requestId, handlerName, args};
    client.send(JSON.stringify(obj));
}

function register(handlerName, callback) {
    // ipcRenderer.on('wf-op-event', (event, args) => {
    //     console.log('event e', event);
    //     console.log('event a', args)
    //     // TODO
    // })
}

init();
