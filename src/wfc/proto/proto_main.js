import {BrowserWindow, ipcMain} from 'electron';

let proto;
const ASYNC_CALLBACK = 'protoAsyncCallback';

let lastActiveTime = 0; // 单位是秒
let connectionStatusEventListener;
let _friendIds = [];

const asyncProtoMethods = {
    getUserInfoEx: _asyncCall2('getUserInfoEx'),
    searchUser: _asyncCall2('searchUser'),
    searchUserEx: _asyncCall2('searchUserEx'),
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
    getGroupInfoEx: _asyncCall2('getGroupInfoEx'),
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
    requireLock: _asyncCall2('requireLock'),
    releaseLock: _asyncCall2('releaseLock'),
    getMessagesV2: _asyncCall2('getMessagesV2'),
    getMentionedMessages: _asyncCall2('getMentionedMessages'),
    getMessagesExV2: _asyncCall2('getMessagesExV2'),
    getMessagesEx2V2: _asyncCall2('getMessagesEx2V2'),
    getMessagesByTimestampV2: _asyncCall2('getMessagesByTimestampV2'),
    getMessagesByStatusV2: _asyncCall2('getMessagesByStatusV2'),
    getUserMessagesV2: _asyncCall2('getUserMessagesV2'),
    getUserMessagesExV2: _asyncCall2('getUserMessagesExV2'),
    loadRemoteDomains: _asyncCall2('loadRemoteDomains'),

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
                let msg = proto.getMessage(messageId);
                _genProtoEventListener('onSendMessage')(msg);
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
    getAuthorizedMediaUrl: _asyncCall2('getAuthorizedMediaUrl'),
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
    },
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

function _sync2async(event, reqId) {
    return (...cbArgs) => {
        // send back to renderer window
        //_asyncCallback(event, reqId, index, done, cbArgs);
        let obj = {
            code: 0,
            reqId,
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
            let protoRetValue = proto[args.methodName](...args.methodArgs)
            event.returnValue = {
                code: 0,
                value: protoRetValue
            };
            if (args.methodName === 'updateMessageStatus') {
                _notifyMessageStatusUpdate(args.methodArgs[0])
            } else if (args.methodName === 'connect') {
                lastActiveTime = protoRetValue;
                console.log('lastActiveTime', lastActiveTime);
            } else if (args.methodName === 'disconnect') {
                lastActiveTime = 0
                _friendIds = [];
                _preloadedUserIds = new Set();
                _preloadedGroupIds = new Set();
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
            /**
             * 添加同步方法转异步的处理
             * 一些约定
             * 1. 方法名为原始的同步方法的方法名
             * 2. 最后一个参数为callback，前面的参数为同步方法的参数。需要注意同步方法本身没有参数的情况
             * 参考：searchMessageByTypesAsync
             */

            let result = proto[args.methodName](...args.methodArgs.slice(0, args.methodArgs.length - 1));
            _genCallback(event, args.reqId, 0, true)(result);

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
                    // onPrepare 时，不应当触发状态更新
                    // _notifyMessageStatusUpdate(messageId)
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
    if (messageId <= 0) {
        return;
    }
    let msg = proto.getMessage(messageId);
    _genProtoEventListener('onMessageStatusUpdate')(msg);
}

function setupProtoListener() {

    proto.setConnectionStatusListener((status) => {
        connectionStatusEventListener = _genProtoEventListener("connectionStatus");
        if (lastActiveTime === 0 && status === 1) {
            let delayTime = 0;
            try {
                delayTime = _preloadDefaultData();
                lastActiveTime = Math.ceil(new Date().getTime() / 1000);
                console.log("wait preloadDefaultData", delayTime);
            } catch (e) {
                console.error("preloadDefaultData exception ", e, e.message);
            }
            setTimeout(() => {
                console.log("connectionStatus ", status);
                connectionStatusEventListener(status);
            }, delayTime)
        } else {
            connectionStatusEventListener(status);
        }
    });
    proto.setConnectToServerListener(_genProtoEventListener('connectToServer'), _genProtoEventListener('connectedToServer'));
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
    proto.setDomainInfoCallback(_genProtoEventListener('domainInfoUpdate'));
    proto.setSettingUpdateListener(_genProtoEventListener('settingUpdate'));
    proto.setChannelInfoUpdateListener(_genProtoEventListener('channelInfoUpdate'));
    proto.setGroupMemberUpdateListener((groupId, groupMembersStr) => {
        _preloadGroupMemberUserInfos(groupId, groupMembersStr);
        _genProtoEventListener("groupMemberUpdate")(groupId, groupMembersStr);
    });

    proto.setSecretChatStateListener(_genProtoEventListener('secretChatStateChange'));
    proto.setSecretMessageBurnStateListener(_genProtoEventListener('secretMessageStartBurn'),
        _genProtoEventListener('secretMessageBurned')
    );

    try {
        proto.setTrafficDataListener(_genProtoEventListener('trafficDataEvent'));
        proto.setErrorEventListener(_genProtoEventListener('errorEventCallback'));
    } catch (error) {
        //可能SDK不支持
    }
}

// 预加载数据
// 拉取会话相关用户、群信息
// 自己的用户信息
// 获取所有好友、好友请求的用户信息
function _preloadDefaultData() {
    console.log('preloadDefaultData');
    let requests = _getIncommingFriendRequest();
    let userIdSet = new Set();
    requests.forEach((fr) => {
        userIdSet.add(fr.target);
    });
    requests = _getOutgoingFriendRequest();
    requests.forEach((fr) => {
        userIdSet.add(fr.target);
    });

    let friendIds = _getMyFriendList(false);
    friendIds.forEach(uid => userIdSet.add(uid));

    let conversationInfoList = _getConversationList([0, 1, 3], [0, 1, 2]);
    let groupIdIds = [];
    let channelIds = [];
    conversationInfoList.forEach(info => {
        if (info.conversationType === 0) {
            userIdSet.add(info.target);
        } else if (info.conversationType === 1) {
            groupIdIds.push(info.target);
        } else if (info.conversationType === 3) {
            channelIds.push(info.target);
        }
        if (info.lastMessage && info.lastMessage.fromUser) {
            userIdSet.add(info.lastMessage.fromUser);
        }
    })
    let uids = Array.from(userIdSet);
    for (let i = 0; i < uids.length / 2000; i++) {
        _getUserInfos(uids.slice(2000 * i, (i + 1) * 2000), '');
    }
    let newUserCount = uids.length;

    let newGroupCount = groupIdIds.length;
    _getGroupInfos(groupIdIds, false);

    // groupIdIds.forEach(groupId => {
    //     _getGroupMembers(groupId, false);
    // })
    // channelIds.forEach(channelId => {
    //     self.getChannelInfo(channelId)
    // })

    console.log('preloadDefaultData summary', newUserCount, newGroupCount);
    let estimatedTime = 0;
    // 超过一周没有活跃，就预加载数据
    if (new Date().getTime() / 1000 - lastActiveTime > 7 * 24 * 60 * 60) {
        // 每 2000 人 4 秒
        estimatedTime += Math.round(newUserCount / 2000) * 4
        // 每 10 个群 2 秒
        estimatedTime += Math.round(newGroupCount / 10) * 2

        return Math.min(60, estimatedTime) * 1000;
    } else {
        return 0;
    }
}

let _preloadedUserIds = new Set();
let _preloadedGroupIds = new Set();

function _preloadGroupMemberUserInfos(groupId, groupMembersStr) {
    // console.log('preloadGroupMemberUserInfos', groupId);
    let memberIds = [];
    let arr = JSON.parse(groupMembersStr);
    arr.forEach((e) => {
        memberIds.push(e.memberId);
    });
    for (let i = 0; i < memberIds.length / 2000; i++) {
        _getUserInfos(memberIds.slice(2000 * i, (i + 1) * 2000), "");
    }
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

function _getIncommingFriendRequest() {
    let result = proto.getIncommingFriendRequest();
    return JSON.parse(result);
}

function _getOutgoingFriendRequest() {
    let result = proto.getOutgoingFriendRequest();
    return JSON.parse(result);
}

function _getMyFriendList(fresh = false) {
    if (!fresh && _friendIds.length > 0) {
        return _friendIds;
    }
    let idsStr = proto.getMyFriendList(fresh);
    if (idsStr !== '') {
        _friendIds = JSON.parse(idsStr);
    }
    return _friendIds;
}

function _getConversationList(types, lines) {
    let conversationListStr = proto.getConversationInfos(types, lines);
    return JSON.parse(conversationListStr);
}

function _getUserInfos(userIds, groupId = '') {
    userIds = userIds.filter(uid => !_preloadedUserIds.has(uid))
    if (userIds.length === 0) {
        return [];
    }
    userIds.forEach(uid => {
        _preloadedUserIds.add(uid);
    })
    console.log("preloadUserInfos", userIds.length);
    let userInfoStrs = proto.getUserInfos(userIds, groupId);
    if (userInfoStrs && userInfoStrs !== '') {
        return JSON.parse(userInfoStrs);
    }
    return [];
}

function _getGroupInfos(groupIds, fresh = false) {
    groupIds = groupIds.filter(gid => !_preloadedGroupIds.has(gid));
    if (groupIds.length === 0) {
        return [];
    }
    groupIds.forEach((gid) => {
        _preloadedGroupIds.add(gid);
    });
    console.log("preloadGroupInfos", groupIds.length);
    let groupInfoStrs = proto.getGroupInfos(groupIds, fresh);
    if (groupInfoStrs && groupInfoStrs !== '') {
        return JSON.parse(groupInfoStrs);
    }
    return [];
}

function _getGroupMembers(groupId, fresh = false) {
    console.log('preloadGroupMembers', groupId.length);
    let memberIdsStr = proto.getGroupMembers(groupId, fresh);
    if (memberIdsStr && memberIdsStr.length > 0) {
        return JSON.parse(memberIdsStr);
    }
    return [];
}
