import {BrowserWindow, ipcMain, } from 'electron';

let proto;
const ASYNC_CALLBACK = 'protoAsyncCallback';

const asyncProtoMethods = {
    getUserInfoEx: _asyncCall2('getUserInfoEx'),
    searchUser: _asyncCall2('searchUser'),
    setFavUser: _asyncCall2('setFavUser'),
    deleteFriend: _asyncCall2('deleteFriend'),
    handleFriendRequest: (event, args) => {
        let methodArgs = args.methodArgs;
        proto.handleFriendRequest(methodArgs[0], methodArgs[1],
            _genCallback(event, args.reqId, 0, true),
            _genCallback(event, args.reqId, 1, true),
            methodArgs[2])
    },
    setBlackList: _asyncCall2('setBlackList'),
    setFriendAlias: _asyncCall2('setFriendAlias'),
    createGroup: _asyncCall2('createGroup'),
    setGroupManager: _asyncCall2('setGroupManager'),
    allowGroupMember: _asyncCall2('allowGroupMember'),
    muteGroupMember: _asyncCall2('muteGroupMember'),
    setGroupRemark: _asyncCall2('setGroupRemark'),
    addMembers: _asyncCall2('addMembers'),
    getGroupMembersEx: _asyncCall2('getGroupMembersEx'),
    kickoffMembers: _asyncCall2('kickoffMembers'),
    dismissGroup: _asyncCall2('dismissGroup'),
    modifyGroupInfo: _asyncCall2('modifyGroupInfo'),
    modifyGroupAlias: _asyncCall2('modifyGroupAlias'),
    modifyGroupMemberAlias: _asyncCall2('modifyGroupMemberAlias'),
    modifyGroupMemberExtra: _asyncCall2('modifyGroupMemberExtra'),
    transferGroup: _asyncCall2('transferGroup'),
    setFavGroup: _asyncCall2('setFavGroup'),
    quitGroup: _asyncCall2('quitGroup'),
    getMyGroups: _asyncCall2('getMyGroups'),
    getCommonGroups: _asyncCall2('getCommonGroups'),
    setUserSetting: _asyncCall2('setUserSetting'),
    modifyMyInfo: _asyncCall2('modifyMyInfo'),
    setGlobalSlient: _asyncCall2('setGlobalSlient'),
    setHiddenNotificationDetail: _asyncCall2('setHiddenNotificationDetail'),
    setHiddenGroupMemberName: _asyncCall2('setHiddenGroupMemberName'),
    setUserReceiptEnable: _asyncCall2('setUserReceiptEnable'),
    joinChatroom: _asyncCall2('joinChatroom'),
    quitChatroom: _asyncCall2('quitChatroom'),
    getChatroomInfo: _asyncCall2('getChatroomInfo'),
    getChatroomMemberInfo: _asyncCall2('getChatroomMemberInfo'),
    createChannel: _asyncCall2('createChannel'),
    modifyChannelInfo: _asyncCall2('modifyChannelInfo'),
    searchChannel: _asyncCall2('searchChannel'),
    listenChannel: _asyncCall2('listenChannel'),
    getRemoteListenedChannels: _asyncCall2('getRemoteListenedChannels'),
    destoryChannel: _asyncCall2('destoryChannel'),
    setConversationTop: _asyncCall2('setConversationTop'),
    setConversationSlient: _asyncCall2('setConversationSlient'),
    sendFriendRequest: _asyncCall2('sendFriendRequest'),
    sendSavedMessage: (event, args) => {
        proto.sendSavedMessage(...args.methodArgs,
            (...cbArgs) => {
                let obj = {
                    code: 0,
                    reqId: args.reqId,
                    cbIndex: 0,
                    done: true,
                    cbArgs: cbArgs
                }
                let messageId = args.methodArgs[0];
                _notifyMessageStatusUpdate(messageId);
                event.sender.send(ASYNC_CALLBACK, obj);
            },
            (...cbArgs) => {
                let obj = {
                    code: 0,
                    reqId: args.reqId,
                    cbIndex: 1,
                    done: true,
                    cbArgs: cbArgs
                }
                let messageId = args.methodArgs[0];
                _notifyMessageStatusUpdate(messageId);
                event.sender.send(ASYNC_CALLBACK, obj);
            },
        )
    },
    recall: _asyncCall2('recall'),
    deleteRemoteMessage: _asyncCall2('deleteRemoteMessage'),
    updateRemoteMessageContent: _asyncCall2('updateRemoteMessageContent'),
    watchOnlineState: _asyncCall2('watchOnlineState'),
    unwatchOnlineState: _asyncCall2('unwatchOnlineState'),
    getUploadMediaUrl: _asyncCall2('getUploadMediaUrl'),
    getConversationFiles: _asyncCall2('getConversationFiles'),
    getMyFiles: _asyncCall2('getMyFiles'),
    deleteFileRecord: _asyncCall2('deleteFileRecord'),
    clearRemoteConversationMessages: _asyncCall2('clearRemoteConversationMessages'),
    uploadMedia: (event, args) => {
        proto.uploadMedia(...args.methodArgs, _genCallback(event, args.reqId, 0, true), _genCallback(event, args.reqId, 1, true), _genCallback(event, args.reqId, 2, false));
    },
    searchFiles: _asyncCall2('searchFiles'),
    searchMyFiles: _asyncCall2('searchMyFiles'),
    createSecretChat: _asyncCall2('createSecretChat'),
    destroySecretChat: _asyncCall2('destroySecretChat'),
    getAuthCode: _asyncCall2('getAuthCode'),
    configApplication: _asyncCall2('configApplication'),
    getRemoteMessage: _asyncCall2('getRemoteMessage'),
    sendConferenceRequest: (event, args) => {
        let methodArgs = args.methodArgs;
        proto.sendConferenceRequest(methodArgs[0], methodArgs[1], methodArgs[2], methodArgs[3],
            _genCallback(event, args.reqId, 0, true),
            _genCallback(event, args.reqId, 1, true),
            methodArgs[4])
    },
    getRemoteMessages: (event, args) => {
        let methodArgs = args.methodArgs;
        proto.getRemoteMessages(methodArgs[0], methodArgs[1], methodArgs[2],
            _genCallback(event, args.reqId, 0, true),
            _genCallback(event, args.reqId, 1, true),
            methodArgs[3])
    }
}

function _asyncCall2(methodName) {
    return (event, args) => {
        proto[methodName](...args.methodArgs, _genCallback(event, args.reqId, 0, true), _genCallback(event, args.reqId, 1, true));
    }
}

function _genCallback(event, reqId, index, done) {
    return (...cbArgs) => {
        // send back to renderer window
        //_asyncCallback(event, reqId, index, done, cbArgs);
        let obj = {
            code: 0,
            reqId,
            cbIndex: index,
            done,
            cbArgs: cbArgs
        }
        event.sender.send(ASYNC_CALLBACK, obj);
    }
}

export function init(wfcProto) {
    proto = wfcProto;

    setupProtoListener();

    ipcMain.on('invokeProtoMethod', (event, args) => {
        try {
            event.returnValue = {
                code: 0,
                value: proto[args.methodName](...args.methodArgs)
            };
            if (args.methodName === 'updateMessageStatus') {
                _notifyMessageStatusUpdate(args.methodArgs[0])
            }
        } catch (e) {
            console.log('invokeProtoMethod ' + args.methodName + ' error', args, e.message)
            event.returnValue = {
                code: -1,
                error: e.message
            };
            if (process.env.NODE_ENV !== 'production') {
                throw new Error(args.methodName + ' ' + e.message);
            }
        }
    })

    ipcMain.on('invokeProtoMethodAsync', (event, args) => {
        let func = asyncProtoMethods[args.methodName];
        if (func) {
            try {
                func(event, args);
            } catch (e) {
                console.log('invokeProtoMethodAsync ' + args.methodName + ' error', args)
                let obj = {
                    code: -1,
                    reqId: args.reqId,
                    message: e.message,
                    done: true
                }
                event.sender.send(ASYNC_CALLBACK, obj);
                if (process.env.NODE_ENV !== 'production') {
                    throw new Error(args.methodName + ' ' + e.message);
                }
            }
        } else {
            console.error('invokeProtoAsync cannot found method', args.methodName);
        }
    })

    ipcMain.on('sendMessage', (event, args) => {
        try {
            let messageId;
            let msg = proto.sendMessage(...args.methodArgs,
                (...cbArgs) => {
                    let obj = {
                        code: 0,
                        reqId: args.reqId,
                        cbIndex: 0,
                        done: false,
                        cbArgs: cbArgs
                    }
                    messageId = cbArgs[0];
                    _notifyMessageStatusUpdate(messageId)
                    event.sender.send(ASYNC_CALLBACK, obj);
                },
                (...cbArgs) => {
                    let obj = {
                        code: 0,
                        reqId: args.reqId,
                        cbIndex: 1,
                        done: false,
                        cbArgs: cbArgs
                    }
                    event.sender.send(ASYNC_CALLBACK, obj);
                    // progress 更新太频繁了
                    //_notifyMessageStatusUpdate(messageId)
                },
                (...cbArgs) => {
                    let obj = {
                        code: 0,
                        reqId: args.reqId,
                        cbIndex: 2,
                        done: true,
                        cbArgs: cbArgs
                    }
                    _notifyMessageStatusUpdate(messageId)
                    event.sender.send(ASYNC_CALLBACK, obj);
                },
                (...cbArgs) => {
                    let obj = {
                        code: 0,
                        reqId: args.reqId,
                        cbIndex: 3,
                        done: true,
                        cbArgs: cbArgs
                    }
                    _notifyMessageStatusUpdate(messageId)
                    event.sender.send(ASYNC_CALLBACK, obj);
                },
            );
            event.returnValue = {
                code: 0,
                value: msg,
            };
            _genProtoEventListener('onSendMessage')(msg);
        } catch (e) {
            event.returnValue = {
                code: -1,
                value: 'sendMessage ' + e.message,
            };
            if (process.env.NODE_ENV !== 'production') {
                throw new Error('sendMessage ' + e.message);
            }
        }
    })
}

function _notifyMessageStatusUpdate(messageId) {
    // 聊天室消息，本地不存储
    if (messageId <= 0){
        return;
    }
    let msg = proto.getMessage(messageId);
    _genProtoEventListener('onMessageStatusUpdate')(msg);
}

function setupProtoListener() {

    proto.setConnectionStatusListener(_genProtoEventListener('connectionStatus'));
    proto.setConnectToServerListener(_genProtoEventListener('connectToServer'));
    //proto.setReceiveMessageListener(self.onReceiveMessage, self.onRecallMessage, self.onDeleteRemoteMessage, self.onUserReceivedMessage, self.onUserReadedMessage);
    proto.setReceiveMessageListener(_genProtoEventListener('onReceiveMessage'),
        _genProtoEventListener('onRecallMessage'),
        _genProtoEventListener('onDeleteRemoteMessage'),
        _genProtoEventListener('onUserReceivedMessage'),
        _genProtoEventListener('onUserReadedMessage')
    );
    proto.setConferenceEventListener(_genProtoEventListener('conferenceEvent'));
    proto.setOnlineEventListener(_genProtoEventListener('onlineEvent'));
    proto.setUserInfoUpdateListener(_genProtoEventListener('userInfoUpdate'));

    proto.setFriendUpdateListener(_genProtoEventListener('friendUpdate'));

    proto.setFriendRequestListener(_genProtoEventListener('friendRequestUpdate'));
    proto.setGroupInfoUpdateListener(_genProtoEventListener('groupInfoUpdate'));
    proto.setSettingUpdateListener(_genProtoEventListener('settingUpdate'));
    proto.setChannelInfoUpdateListener(_genProtoEventListener('channelInfoUpdate'));
    proto.setGroupMemberUpdateListener(_genProtoEventListener('groupMemberUpdate'));

    proto.setSecretChatStateListener(_genProtoEventListener('secretChatStateChange'));
    proto.setSecretMessageBurnStateListener(_genProtoEventListener('secretMessageStartBurn'),
        _genProtoEventListener('secretMessageBurned')
    );
}

function _genProtoEventListener(protoEventName) {
    return (...args) => {
        //_forwardProtoEventToAllWindow('secretMessageStartBurn', args)
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
}
