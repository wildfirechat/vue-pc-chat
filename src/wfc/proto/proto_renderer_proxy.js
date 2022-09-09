import {ipcRenderer} from "electron";

export class ProtoRendererProxy {
    _requestId = 0;
    _requestCallbackMap = new Map();
    _protoEventListeners = new Map();

    init() {
        window._rcm = this._requestCallbackMap;
        window._pel = this._protoEventListeners;
        ipcRenderer.on('protoAsyncCallback', (event, args) => {
            let reqId = args.reqId;
            let code = args.code;
            if (code === 0) {
                let callbacks = this._requestCallbackMap.get(reqId);
                if (callbacks) {
                    let cbIndex = args.cbIndex;
                    callbacks[cbIndex] && callbacks[cbIndex](...args.cbArgs);
                    if (args.done) {
                        this._requestCallbackMap.delete(reqId);
                    }
                }
            } else {
                this._requestCallbackMap.delete(reqId);
                throw new Error(args.message);
            }
        })

        ipcRenderer.on('protoEvent', (event, args) => {
            let listener = this._protoEventListeners.get(args.eventName);
            if (listener) {
                listener(...args.eventArgs);
            } else {
                console.error('not found listener for', args.eventName);
            }
        })
    }

    requestId() {
        this._requestId++;
        return this._requestId;
    }

    invoke(methodName, ...args) {
        let channel = 'invokeProtoMethod';
        // invoke 是异步调用，返回的是 Promise，对应主进程是 handle
        // sendSync 是同步调用，返回的直接就是具体的返回值，对应主进程是 on
        let ret = ipcRenderer.sendSync(channel, {
            methodName: methodName,
            methodArgs: [...args]
        });
        if (ret.code === 0) {
            return ret.value;
        } else {
            throw new Error(ret.message);
        }
    }

    invokeAsync(methodName, ...args) {
        let reqId = this.requestId();
        let parsedArgs = this._parseArgs(args);
        this._wrapCallback(reqId, parsedArgs.funcArgs);
        ipcRenderer.send('invokeProtoMethodAsync', {
            reqId,
            methodName: methodName,
            methodArgs: parsedArgs.pArgs,
        });
    }

    setProtoEventListener(event, listener) {
        this._protoEventListeners.set(event, listener);
    }

    // 这个方法有点特殊
    // 同步方法，但又有异步回调
    sendMessage(...args) {
        let reqId = this.requestId();
        let parsedArgs = this._parseArgs(args);
        this._wrapCallback(reqId, parsedArgs.funcArgs);
        let ret = ipcRenderer.sendSync('sendMessage', {
            reqId,
            methodArgs: parsedArgs.pArgs,
        });
        if (ret.code === 0) {
            return ret.value;
        } else {
            throw new Error(ret.message)
        }
    }

    _parseArgs(args) {
        let parsedArgs = {}
        if (args) {
            let pArgs = [];
            let funcArgs = [];
            args.forEach(arg => {
                if (typeof arg === "function") {
                    funcArgs.push(arg);
                } else {
                    pArgs.push(arg);
                }
            })
            return {
                pArgs,
                funcArgs
            }
        }

        return parsedArgs;
    }

    _wrapCallback(reqId, callbacks) {
        this._requestCallbackMap.set(reqId, [...callbacks]);
    }
}

const self = new ProtoRendererProxy();
export default self;

