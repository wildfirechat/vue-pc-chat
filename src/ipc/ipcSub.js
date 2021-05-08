import localStorageEmitter from "./localStorageEmitter";

export default class IpcSub {
    static getUserInfos(userIds, groupId = '', callback) {
        localStorageEmitter.invoke('getUserInfos', {userIds: userIds, groupId: groupId}, callback)
    }
}
