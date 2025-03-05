import {ipcRenderer} from "electron";

export class ProtoRendererProxy {
    init() {

    }

    invoke(methodName, ...args) {
        let channel = 'invokeRCMethod';
        // invoke 是异步调用，返回的是 Promise，对应主进程是 handle
        // sendSync 是同步调用，返回的直接就是具体的返回值，对应主进程是 on
        args = structuredClone(args);
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
}

const self = new ProtoRendererProxy();
export default self;
