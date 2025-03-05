import {ipcMain} from 'electron';

let proto;

export function init(rcProto) {
    proto = rcProto;

    ipcMain.on('invokeRCMethod', (event, args) => {
        try {
            event.returnValue = {
                code: 0,
                value: proto[args.methodName](...args.methodArgs)
            };
        } catch (e) {
            console.log('invokeRCMethod ' + args.methodName + ' error', args, e.message)
            event.returnValue = {
                code: -1,
                error: e.message
            };
            if (process.env.NODE_ENV !== 'production') {
                throw new Error(args.methodName + ' ' + e.message);
            }
        }
    })
}
