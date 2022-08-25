import {
    BrowserWindow,
    ipcMain,
} from 'electron';

let proto;
const ASYNC_CALLBACK = 'protoAsyncCallback';

const asyncProtoMethods = {
    getUploadMediaUrl: (event, args) => {
        proto.getUploadMediaUrl(...args.methodArgs, (...cbArgs) => {
            // send back to renderer window
            _asyncCallback(event, args.reqId, 0, true, cbArgs);
            console.log('getUploadMediaUrl main async, sb', cbArgs);
        }, (err) => {
            _asyncCallback(event, args.reqId, 1, true, err);
        });
    },
    sendSavedMessage: (event, args) => {
        proto.sendSavedMessage(...args.methodArgs, (...cbArgs) => {
            // send back to renderer window
            _asyncCallback(event, args.reqId, 0, true, cbArgs);
            console.log('sendSavedMessage main, sb', cbArgs);
        }, (...err) => {
            console.log('sendSavedMessage main, eb', err)
            _asyncCallback(event, args.reqId, 1, true, err);
        });
    }
}

export function init() {
    proto = global.sharedObj.proto;

    // ipcMain.handle('invokeProto', (event, args) => {
    //     console.log('invokeProto main', args);
    //     return proto[args.methodName](...args.args);
    // })

    initProtoListener();

    ipcMain.on('invokeProtoMethod', (event, args) => {
        console.log('invokeProto main', args);
        event.returnValue = proto[args.methodName](...args.methodArgs);
    })

    ipcMain.on('invokeProtoMethodAsync', (event, args) => {
        console.log('invokeProtoAsync main', args);
        let func = asyncProtoMethods[args.methodName];
        if (func) {
            func(event, args);
        } else {
            console.error('invokeProtoAsync cannot found method', args.methodName);
        }
    })

    // ipcMain.on('sendSavedMessage', (event, args) => {
    //     const {reqId, messageId, expireDuration} = args;
    //     proto.sendSavedMessage(messageId, expireDuration, (messageUid, timestamp) => {
    //         // send back to renderer window
    //         _asyncCallback(event, reqId, 0, true, messageUid, timestamp);
    //         console.log('sendSavedMessage main, sb', messageUid, timestamp);
    //     }, (...err) => {
    //         console.log('sendSavedMessage main, eb', ...err)
    //         _asyncCallback(event, reqId, 1, true, ...err);
    //     });
    // })

    // ipcMain.on('getUploadMediaUrl', (event, args) => {
    //     const {reqId, fileName, mediaType, contentType} = args;
    //     proto.getUploadMediaUrl(fileName, mediaType, contentType, (...args) => {
    //         // send back to renderer window
    //         _asyncCallback(event, reqId, 0, true, ...args);
    //         console.log('getUploadMediaUrl main, sb', ...args);
    //     }, (err) => {
    //         _asyncCallback(event, reqId, 1, true, err);
    //     });
    // })
}

function initProtoListener() {

    proto.setConnectionStatusListener((...args) => {
        _forwardProtoEventToAllWindow('connectionStatus', args)
    });
    proto.setConnectToServerListener((...args) => {
        _forwardProtoEventToAllWindow('connectToServer', args)
    });
    //proto.setReceiveMessageListener(self.onReceiveMessage, self.onRecallMessage, self.onDeleteRemoteMessage, self.onUserReceivedMessage, self.onUserReadedMessage);
    proto.setReceiveMessageListener((...args) => {
        // onReceiveMessage
        _forwardProtoEventToAllWindow('onReceiveMessage', args)

    }, (...args) => {
        // onRecallMessage
        _forwardProtoEventToAllWindow('onRecallMessage', args)

    }, (...args) => {
        // onDeleteRemoteMessage
        _forwardProtoEventToAllWindow('onDeleteRemoteMessage', args)

    }, (...args) => {
        // onUserReceivedMessage
        _forwardProtoEventToAllWindow('onUserReceivedMessage', args)

    }, (...args) => {
        // onUserReadedMessage
        _forwardProtoEventToAllWindow('onUserReadedMessage', args)

    });
    //proto.setConferenceEventListener(self.onConferenceEvent);
    proto.setConferenceEventListener((...args) => {
        _forwardProtoEventToAllWindow('conferenceEvent', args)
    });
    // proto.setOnlineEventListener(self.onOnlineEvent);
    proto.setOnlineEventListener((...args) => {
        _forwardProtoEventToAllWindow('onlineEvent', args)
    });
    // proto.setUserInfoUpdateListener(self.onUserInfoUpdate);
    proto.setUserInfoUpdateListener((...args) => {
        _forwardProtoEventToAllWindow('userInfoUpdate', args)
    });

    // proto.setFriendUpdateListener(self.onFriendListUpdate);
    proto.setFriendUpdateListener((...args) => {
        _forwardProtoEventToAllWindow('friendUpdate', args)
    });

    // proto.setFriendRequestListener(self.onFriendRequestUpdate);
    proto.setFriendRequestListener((...args) => {
        _forwardProtoEventToAllWindow('friendRequestUpdate', args)
    });
    // proto.setGroupInfoUpdateListener(self.onGroupInfoUpdate);
    proto.setGroupInfoUpdateListener((...args) => {
        _forwardProtoEventToAllWindow('groupInfoUpdate', args)
    });
    // proto.setSettingUpdateListener(self.onSettingUpdate);
    proto.setSettingUpdateListener((...args) => {
        _forwardProtoEventToAllWindow('settingUpdate', args)
    });
    // proto.setChannelInfoUpdateListener(self.onChannelInfoUpdate);
    proto.setChannelInfoUpdateListener((...args) => {
        _forwardProtoEventToAllWindow('channelInfoUpdate', args)
    });
    // proto.setGroupMemberUpdateListener(self.onGroupMemberUpdateListener);
    proto.setGroupMemberUpdateListener((...args) => {
        _forwardProtoEventToAllWindow('groupMemberUpdate', args)
    });

    proto.setSecretChatStateListener((...args) => {
        _forwardProtoEventToAllWindow('secretChatStateChange', args)
    });
    proto.setSecretMessageBurnStateListener((...args) => {
        _forwardProtoEventToAllWindow('secretMessageStartBurn', args)
    }, (...args) => {
        _forwardProtoEventToAllWindow('secretMessageBurned', args)
    });
}

function _asyncCallback(event, reqId, cbIndex, done, args) {
    let obj = {
        reqId,
        cbIndex,
        done,
        cbArgs: args
    }
    event.sender.send(ASYNC_CALLBACK, obj);
}

function _forwardProtoEventToAllWindow(protoEventName, args) {
    let windows = BrowserWindow.getAllWindows();
    if (windows) {
        windows.forEach(win => {
            win.webContents.send('protoEvent', {
                eventName: protoEventName,
                eventArgs: args,
            })
        })
    }
}


