/**
 * 大概流程
 *  采用类 client-server 模式实现开放平台 js sdk，有两部分相关代码：
 * 1. client 运行在工作台所加载的 webview 里面
 * 2. server 直接运行在工作台页面里面，也就是主窗口的渲染进程
 * 3. client 和 server 之间的交互，通过 websocket 进行中转
 *
 */

let callbackMap = new Map();
let eventListeners = {};
let requestId = 0;
let client;
let windowId;
let initPromise;

// 主进程中转后，消息可能是 string、Blob 或 ArrayBuffer，统一转成文本
function readMessageData(data) {
    if (typeof data === 'string') {
        return Promise.resolve(data);
    }
    if (data && typeof data.text === 'function') {
        return data.text();
    }
    if (data instanceof ArrayBuffer) {
        return Promise.resolve(new TextDecoder().decode(data));
    }
    if (data && data.buffer instanceof ArrayBuffer) {
        return Promise.resolve(new TextDecoder().decode(
            new Uint8Array(data.buffer, data.byteOffset, data.byteLength)));
    }
    return Promise.resolve(String(data));
}

function init() {
    if (initPromise) {
        return initPromise;
    }
    initPromise = new Promise(async (resolve, reject) => {
        try {
            windowId = await require('electron').ipcRenderer.invoke('getMediaSourceId')

            client = new WebSocket('ws://127.0.0.1:' + 7983 + '/');
            client.onmessage = async (ev) => {
                let obj;
                try {
                    obj = JSON.parse(await readMessageData(ev.data));
                } catch (e) {
                    console.error('parse ws data error', e);
                    return;
                }
                if (obj.windowId !== windowId || obj.appUrl !== location.href) {
                    console.log('ignore wf-op data', obj);
                    return;
                }
                if (obj.type === 'wf-op-event') {
                    handleOpEvent(obj.handlerName, obj.args);
                } else if (obj.type === 'wf-op-response') {
                    handleOpResponse(obj.requestId, obj.args)
                }
            }
            client.onopen = () => {
                resolve();
            }
            client.onerror = (e) => {
                console.error('bridge websocket error', e);
                reject(new Error('bridge websocket error'));
            }
            client.onclose = () => {
                client = null;
                initPromise = null;
            }

            console.log('bridgeClientImpl init')
        } catch (e) {
            reject(e);
        }
    });
    // 初始化失败时允许下次调用重新初始化
    initPromise.catch(() => {
        client = null;
        initPromise = null;
    });
    return initPromise;
}

async function call(handlerName, args, callback) {
    const fail = (reason) => {
        if (callback && typeof callback === 'function') {
            callback({code: -1, data: reason});
        }
    };
    try {
        if (!client || client.readyState !== WebSocket.OPEN) {
            await init();
        }
    } catch (e) {
        console.error('bridge init failed', handlerName, e);
        fail('bridge init failed');
        return;
    }
    let reqId = 0;
    if (callback && typeof callback === 'function') {
        reqId = requestId++;
        callbackMap.set(reqId, callback)
    }
    let appUrl = location.href;
    let obj = {type: 'wf-op-request', requestId: reqId, windowId, appUrl, handlerName, args};
    try {
        console.log('wf-op-request', obj)
        client.send(JSON.stringify(obj));
    } catch (e) {
        console.error('bridge send failed', handlerName, e);
        if (callback && typeof callback === 'function') {
            callbackMap.delete(reqId);
        }
        fail('bridge send failed');
    }
}

function handleOpResponse(requestId, args) {
    console.log('handle op response', requestId, args)
    let cb = callbackMap.get(requestId);
    if (cb) {
        cb(args);
        callbackMap.delete(requestId);
    }
}

function handleOpEvent(handlerName, args) {
    eventListeners[handlerName] && eventListeners[handlerName](args);

}

function register(handlerName, callback) {
    eventListeners[handlerName] = callback;
}

window.__wf_bridge_ = {
    call: call,
    register: register,
}
console.log('export call and register')
