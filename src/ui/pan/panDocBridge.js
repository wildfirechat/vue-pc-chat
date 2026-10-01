/**
 * 在线文档 webview 的 preload：把服务端 H5 使用的 dsbridge 协议
 * （window._dsbridge.call(method, JSON{data,_dscbstub})）桥接到主窗口渲染进程。
 *
 * 页面在 `{PAN_SERVER}/doc/` 下，需要 getAuthCode 才能建立会话：
 * 认证码不放进 URL，由宿主（主窗口渲染进程，持有 IM 协议栈）通过 wfc.getAuthCode 获取后回传。
 *
 * 宿主页面：src/ui/pan/PanDocPanel.vue。
 */
(function () {
    'use strict';

    var ipcRenderer;
    try {
        ipcRenderer = require('electron').ipcRenderer;
    } catch (e) {
        console.error('panDocBridge: electron ipcRenderer unavailable', e);
        return;
    }

    // 宿主（PanDocPanel）能处理的方法；setPageHeader 也支持，用它替换页内标题栏
    var SUPPORTED = [
        'getAuthCode', 'setPageHeader', 'openUrl', 'downloadFile',
        'chooseContacts', 'chooseGroup', 'toast', 'close', 'config',
    ];

    var seq = 0;
    var callbacks = {};

    function parse(argString) {
        try {
            return JSON.parse(argString || '{}');
        } catch (e) {
            return {};
        }
    }

    function post(message) {
        try {
            ipcRenderer.sendToHost('pan-doc-bridge', message);
        } catch (e) {
            console.error('panDocBridge post error', e);
        }
    }

    window._dsbridge = {
        call: function (method, argString) {
            var arg = parse(argString);
            var data = arg.data;
            var stub = arg._dscbstub;

            // dsbridge 的同步能力探测
            if (method === '_dsb.hasNativeMethod') {
                var name = data && data.name;
                return JSON.stringify({code: 0, data: SUPPORTED.indexOf(name) >= 0});
            }

            var id = ++seq;
            if (stub) {
                callbacks[id] = stub;
            }
            post({kind: 'call', id: id, method: method, data: data, stub: stub || null});

            // 同步方法（openUrl/downloadFile）由宿主立即处理，这里不需要同步返回结果；
            // 异步方法的结果通过 window[stub] 回调。
            if (stub) {
                return '{}';
            }
            return JSON.stringify({code: 0});
        },
    };

    ipcRenderer.on('pan-doc-bridge-host', function (event, message) {
        if (!message) {
            return;
        }
        if (message.kind === 'reply') {
            var stub = callbacks[message.id];
            delete callbacks[message.id];
            if (stub && typeof window[stub] === 'function') {
                try {
                    window[stub](message.result);
                } catch (e) {
                    console.error('panDocBridge callback error', e);
                }
            }
        } else if (message.kind === 'notify') {
            // 多次回调（setPageHeader 的按钮点击）
            if (message.stub && typeof window[message.stub] === 'function') {
                try {
                    window[message.stub](message.data);
                } catch (e) {
                    console.error('panDocBridge notify error', e);
                }
            }
        }
    });
})();
