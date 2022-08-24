import {
    ipcMain,
} from 'electron';
import {ba} from "../../vendor/pinyin/data/dict-zi-web";

let proto;
const ASYNC_CALLBACK = 'async-callback';

export function init() {
    proto = global.sharedObj.proto;
    ipcMain.handle('getUserInfo', (event, userId, refresh = false, groupId = '') => {
        return proto.getUserInfo(userId, refresh, groupId);
    })

    ipcMain.handle('updateMessage', (event, args) => {
        console.log('updateMessage main', args);
        return proto.updateMessage(...args);
    })

    ipcMain.on('sendSavedMessage', (event, args) => {
        const {reqId, messageId, expireDuration} = args;
        proto.sendSavedMessage(messageId, expireDuration, (messageUid, timestamp) => {
            // send back to renderer window
            _asyncCallback(event, reqId, 0, true, messageUid, timestamp);
            console.log('sendSavedMessage main, sb', messageUid, timestamp);
        }, (err) => {
            _asyncCallback(event, reqId, 1, true, err);
        });
    })

    ipcMain.on('getUploadMediaUrl', (event, args) => {
        const {reqId, fileName, mediaType, contentType} = args;
        proto.getUploadMediaUrl(fileName, mediaType, contentType, (uploadUrl, remoteUrl, backUploadUrl, serverType) => {
            // send back to renderer window
            _asyncCallback(event, reqId, 0, true, uploadUrl, remoteUrl, backUploadUrl, serverType);
            console.log('getUploadMediaUrl main, sb', uploadUrl, remoteUrl, backUploadUrl, serverType);
        }, (err) => {
            _asyncCallback(event, reqId, 1, true, err);
        });
    })
}

function _asyncCallback(event, reqId, cbIndex, done, ...args) {
    let obj = {
        reqId,
        cbIndex,
        done,
        cbArgs: [...args]
    }
    event.sender.send(ASYNC_CALLBACK, obj);
}


