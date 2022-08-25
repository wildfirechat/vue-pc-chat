import {ipcRenderer} from "../../platform";

export class ProtoRenderer {
    _requestId = 0;
    _requestCallbackMap = new Map();

    init() {
        ipcRenderer.on('async-callback', (event, args) => {
            let reqId = args.reqId;
            console.log('xxx async-callback', args)
            let callbacks = this._requestCallbackMap.get(reqId);
            if (callbacks) {
                let cbIndex = args.cbIndex;
                callbacks[cbIndex] && callbacks[cbIndex](...args.cbArgs);
                if (args.done) {
                    this._requestCallbackMap.delete(reqId);
                }
            }
        })
    }

    // getUserInfo(userId, refresh, groupId) {
    //     return ipcRenderer.invoke('getUserInfo', userId, refresh, groupId);
    // }
    //
    // updateMessage(messageId, messageContent) {
    //     return ipcRenderer.invoke('updateMessage', [messageId, messageContent]);
    // }
    //
    // insertMessage(conversation, messageContent, status, notify = false, serverTime = 0) {
    //     return ipcRenderer.invoke('insertMessage', conversation, messageContent, status, notify, serverTime);
    // }

    // sendSavedMessage(messageId, expireDuration, successCB, failCB) {
    //     let reqId = this.requestId();
    //     this._wrapCallback(reqId, successCB, failCB);
    //     ipcRenderer.send('sendSavedMessage', {reqId, messageId, expireDuration});
    // }
    //
    // getUploadMediaUrl(fileName, mediaType, contentType, successCB, failCB) {
    //     let reqId = this.requestId();
    //     this._wrapCallback(reqId, successCB, failCB);
    //     ipcRenderer.send('getUploadMediaUrl', {reqId, fileName, mediaType, contentType});
    // }

    requestId() {
        this._requestId++;
        return this._requestId;
    }

    invoke(methodName, ...args) {
        let channel = 'invokeProto';
        // invoke 是异步调用，返回的是 Promise，对应主进程是 handle
        // sendSync 是同步调用，返回的直接就是具体的返回值，对应主进程是 on
        return ipcRenderer.sendSync(channel, {
            methodName: methodName,
            methodArgs: [...args]
        });
    }

    invokeAsync(methodName, pArgs, ...callbacks) {
        let reqId = this.requestId();
        this._wrapCallback(reqId, ...callbacks);
        ipcRenderer.send('invokeProtoAsync', {
            reqId,
            methodName: methodName,
            methodArgs: pArgs,
        });
    }

    _wrapCallback(reqId, ...callbacks) {
        console.log('xxxx_wrapCallback', callbacks);
        this._requestCallbackMap.set(reqId, [...callbacks]);
    }
}

const self = new ProtoRenderer();
export default self;

