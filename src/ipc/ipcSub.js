import localStorageEmitter from "./localStorageEmitter";

// 里面是一些通用的ipc方法，可以在不同的地方复用
export default class IpcSub {
    // TODO 由于现在协议栈是运行在主进程，其他进程都是通过 ipc 调用主进程的协议栈，故一下 4 个方法无效了，可以直接调用 wfc.js 里面的接口
    static getUserInfos(userIds, groupId = '', callback) {
        localStorageEmitter.invoke('getUserInfos', {userIds: userIds, groupId: groupId}, callback)
    }

    static getUserInfo(userId, groupId = '', refresh = false, callback) {
        localStorageEmitter.invoke('getUserInfo', {userId: userId, groupId: groupId, refresh: refresh}, callback)
    }

    static getUserId() {
        return localStorageEmitter.promiseInvoke('getUserId', {})
    }

    static sendMessage(conversation, messageContent) {
        localStorageEmitter.send('sendMessage', {conversation: conversation, messagePayload: messageContent.encode()});
    }

    static startConversation(conversation) {
        localStorageEmitter.send('startConversation', {
            conversation: conversation
        })
    }

    static startCall(conversation, audioOnly) {
        localStorageEmitter.send('startCall', {
            conversation: conversation,
            audioOnly: audioOnly,
        })
    }
}
