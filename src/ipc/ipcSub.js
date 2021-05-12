import localStorageEmitter from "./localStorageEmitter";
import ConferenceInviteMessageContent from "../wfc/av/messages/conferenceInviteMessageContent";

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

    static inviteConferenceParticipant(callSession) {
        let inviteMessageContent = new ConferenceInviteMessageContent(callSession.callId, callSession.host, callSession.title, callSession.desc, callSession.startTime, callSession.audioOnly, callSession.audience, callSession.advance, callSession.pin)
        console.log('sss', callSession, inviteMessageContent)
        localStorageEmitter.send('inviteConferenceParticipant', {messagePayload: inviteMessageContent.encode()})
    }
}
