import localStorageEmitter from "./localStorageEmitter";

export default class IpcSub {
    static getUserInfos(userIds, groupId = '', callback) {
        localStorageEmitter.invoke('getUserInfos', {userIds: userIds, groupId: groupId}, callback)
    }

    static getUserId(callbak) {
        localStorageEmitter.invoke('getUserId', {}, callbak)
    }

    static sendMessage(conversation, messageContent) {
        localStorageEmitter.send('sendMessage', {conversation: conversation, messagePayload: messageContent.encode()});
    }
}
