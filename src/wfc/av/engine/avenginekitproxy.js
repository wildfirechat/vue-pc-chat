/*
 * Copyright (c) 2020 WildFireChat. All rights reserved.
 */

import EventType from "../../client/wfcEvent";
import {BrowserWindow, ipcRenderer, isElectron, remote} from "../../../platform";
import ConversationType from "../../model/conversationType";
import MessageContentType from "../../messages/messageContentType";
import wfc from "../../client/wfc";
import MessageConfig from "../../client/messageConfig";
import DetectRTC from 'detectrtc';
import Config from "../../../config";
import {longValue, numberValue} from '../../util/longUtil'
import Conversation from "../../../wfc/model/conversation";

import CallEndReason from "./callEndReason";
import CallByeMessageContent from "../messages/callByeMessageContent";
import WfcAVEngineKit from "./avenginekit";

// main window renderer process -> main process -> voip window renderer process
// voip window renderer process -> main process -> main window renderer process
export class AvEngineKitProxy {
    wfc;
    queueEvents = [];
    callWin;
    callWindowId;
    isVoipWindowReady = false;
    type;

    conference = false;
    conversation;
    callId;
    inviteMessageUid;
    participants = [];
    isSupportVoip = false;
    hasMicrophone = false;
    hasSpeaker = false;
    hasWebcam = false;

    /**
     * 无法正常弹出音视频通话窗口是的回调
     * 回到参数说明：-1，有音视频通话正在进行中；-2，设备不支持音视频通话，可能原因是不支持webrtc，没有摄像头或麦克风等
     * @type {(Number) => {}}
     */
    onVoipCallErrorCallback;

    /**
     * 音视频通话通话状态回调
     */
    onVoipCallStatusCallback = (covnersation, ongonging) => {
    };

    /**
     * 应用初始化的时候调用
     * @param wfc
     */
    setup(wfc) {
        console.log('avengineProxy, setup');
        if (this.wfc === wfc) {
            console.log('re-setup, just ignore');
            return;
        }
        this.wfc = wfc;
        DetectRTC.load(() => {
            this.isSupportVoip = DetectRTC.isWebRTCSupported;
            this.hasMicrophone = DetectRTC.hasMicrophone;
            // Safari 14.0 版本，hasSpeakers一直为false，先全部置为true
            //this.hasSpeaker = DetectRTC.hasSpeakers;
            this.hasSpeaker = true;
            this.hasWebcam = DetectRTC.hasWebcam;
            console.log(`detectRTC, isWebRTCSupported: ${DetectRTC.isWebRTCSupported}, hasWebcam: ${DetectRTC.hasWebcam}, hasSpeakers: ${DetectRTC.hasSpeakers}, hasMicrophone: ${DetectRTC.hasMicrophone}`, this.isSupportVoip);
        });
        this.event = wfc.eventEmitter;
        this.event.on(EventType.ReceiveMessage, this.onReceiveMessage);
        this.event.on(EventType.ConferenceEvent, this.onReceiveConferenceEvent);
        this.event.on(EventType.ConnectionStatusChanged, this.onConnectionStatusChange)
        if (!isElectron()) {
            const EventEmitter = require("events").EventEmitter;
            this.events = new EventEmitter();
            this.events.on('voip-message', this.sendVoipListener)
            this.events.on('conference-request', this.sendConferenceRequestListener);
            this.events.on('update-call-start-message', this.updateCallStartMessageContentListener)
        }

    }

    updateCallStartMessageContentListener = (event, message) => {
        let messageUid = message.messageUid;
        let content = message.content;

        let msg = wfc.getMessageByUid(messageUid);
        if (!msg) {
            return
        }
        let orgContent = msg.messageContent;
        orgContent.connectTime = content.connectTime ? content.connectTime : orgContent.connectTime;
        orgContent.endTime = content.endTime ? content.endTime : orgContent.endTime;
        orgContent.status = content.status;
        orgContent.audioOnly = content.audioOnly;
        wfc.updateMessageContent(msg.messageId, orgContent);
    }

    sendConferenceRequestListener = (event, request) => {
        console.log('to send conference request', request)
        wfc.sendConferenceRequestEx(request.sessionId ? request.sessionId : 0, request.roomId ? request.roomId : '', request.request, request.data, request.advance, (errorCode, res) => {
            this.emitToVoip('sendConferenceRequestResult', {
                error: errorCode,
                sendConferenceRequestId: request.sendConferenceRequestId,
                response: res
            })
        });
    }

    // 发送消息时，返回的timestamp，已经过修正，后面使用时,不用考虑和服务器的时间差
    sendVoipListener = (event, msg) => {

        let contentClazz = MessageConfig.getMessageContentClazz(msg.content.type);

        let content = new contentClazz();
        content.decode(msg.content);
        console.log('to send voip message', content.type, content.callId, content);
        let delta = wfc.getServerDeltaTime();
        if (content.type === MessageContentType.VOIP_CONTENT_TYPE_ADD_PARTICIPANT) {
            this.participants.push(content.participants);
        } else if (content.type === MessageContentType.VOIP_CONTENT_TYPE_END) {
            console.log('to send end message', content.reason, content);
            // 窗口关闭时，会重置
            // this.conversation = null;
            // this.queueEvents = [];
            // this.callId = null;
            // this.inviteMessageUid = null;
            // this.participants = [];
            // 仅仅为了通知proxy，其他端已经接听电话了，关闭窗口时，不应当发送挂断信令
            if (!content.callId) {
                return;
            }
        }
        let conversation = new Conversation(msg.conversation.type, msg.conversation.target, msg.conversation.line)
        wfc.sendConversationMessage(conversation, content, msg.toUsers, (messageId, timestamp) => {

            // do nothing
        }, (uploaded, total) => {

            // do nothing
        }, (messageUid, timestamp) => {
            this.emitToVoip('sendMessageResult', {
                error: 0,
                sendMessageId: msg.sendMessageId,
                messageUid: messageUid,
                timestamp: longValue(numberValue(timestamp) - delta)
            })
            if (content.type === MessageContentType.VOIP_CONTENT_TYPE_START) {
                this.inviteMessageUid = messageUid;
            }
        }, (errorCode) => {
            this.emitToVoip('sendMessageResult', {error: errorCode, sendMessageId: msg.sendMessageId})
        });
    }

    onReceiveConferenceEvent = (event) => {
        this.emitToVoip("conferenceEvent", event);
    }

    onConnectionStatusChange = (status) => {
        this.emitToVoip('connectionStatus', status);
    }

    // 收到消息时，timestamp已经过修正，后面使用时，不用考虑和服务器的时间差
    onReceiveMessage = (msg) => {
        console.log('avengineProxy, on receive message', msg);
        if (!Config.ENABLE_MULTI_VOIP_CALL && msg.conversation.type === ConversationType.Group) {
            console.log('not enable multi call ');
            return;
        }
        if (!Config.ENABLE_SINGLE_VOIP_CALL && msg.conversation.type === ConversationType.Single) {
            console.log('not enable multi call ');
            return;
        }
        if (!isElectron() && msg.messageContent === MessageContentType.VOIP_REMOTE_CONTROL_REQUEST) {
            console.log('only pc support remote control');
            return;
        }

        let now = (new Date()).valueOf();
        let delta = wfc.getServerDeltaTime();
        if (now - (numberValue(msg.timestamp) - delta) >= 90 * 1000) {
            // 消息已失效，不做处理
            console.log('avengineProxy, message outdated, just ignore', msg);
            return;
        }
        let content = msg.messageContent;
        if (this.callWin && this.conference && content.type !== MessageContentType.CONFERENCE_CONTENT_TYPE_COMMAND) {
            console.log('in conference, ignore all other msg');
            return;
        }
        if (content.notLoaded) {
            console.log('message not loaded, ignore');
            return;
        }
        if (msg.direction === 1 &&
            (content.type === MessageContentType.VOIP_CONTENT_TYPE_START || content.type === MessageContentType.VOIP_CONTENT_TYPE_ADD_PARTICIPANT)) {
            if (this.callWin) {
                if (content.type === MessageContentType.VOIP_CONTENT_TYPE_START
                    || (content.type === MessageContentType.VOIP_CONTENT_TYPE_ADD_PARTICIPANT && content.participants.indexOf(wfc.getUserId()) >= 0)) {
                    // 已在音视频通话中，其他的音视频通话，又邀请自己，这儿是只是让主界面提示一下，拒绝逻辑在 engine 里面
                    this.onVoipCallErrorCallback && this.onVoipCallErrorCallback(-1);
                }
            }
            if (!this.isSupportVoip || (!WfcAVEngineKit.ENABLE_VOIP_WHEN_NO_MIC_AND_SPEAKER && (!this.hasSpeaker || !this.hasMicrophone))) {
                this.onVoipCallErrorCallback && this.onVoipCallErrorCallback(-2);
                return;
            }
        }

        if ((msg.conversation.type === ConversationType.Single || msg.conversation.type === ConversationType.Group || (this.conference && msg.conversation.type === ConversationType.ChatRoom))) {
            if (content.type === MessageContentType.VOIP_CONTENT_TYPE_START
                || content.type === MessageContentType.VOIP_CONTENT_TYPE_END
                || content.type === MessageContentType.VOIP_CONTENT_TYPE_ACCEPT
                || content.type === MessageContentType.VOIP_CONTENT_TYPE_SIGNAL
                || content.type === MessageContentType.VOIP_CONTENT_TYPE_MODIFY
                || content.type === MessageContentType.VOIP_CONTENT_TYPE_ACCEPT_T
                || content.type === MessageContentType.VOIP_CONTENT_TYPE_ADD_PARTICIPANT
                || content.type === MessageContentType.VOIP_CONTENT_TYPE_MUTE_VIDEO
                || content.type === MessageContentType.VOIP_Join_Call_Request
                || content.type === MessageContentType.VOIP_REMOTE_CONTROL_INPUT_EVENT
                || content.type === MessageContentType.CONFERENCE_CONTENT_TYPE_KICKOFF_MEMBER
                || content.type === MessageContentType.CONFERENCE_CONTENT_TYPE_CHANGE_MODE
                || content.type === MessageContentType.CONFERENCE_CONTENT_TYPE_COMMAND
                || content.type === MessageContentType.VOIP_REMOTE_CONTROL_INVITE
                || content.type === MessageContentType.VOIP_REMOTE_CONTROL_ACCEPT_INVITE
                || content.type === MessageContentType.VOIP_REMOTE_CONTROL_REQUEST
                || content.type === MessageContentType.VOIP_REMOTE_CONTROL_ACCEPT_REQUEST
                || content.type === MessageContentType.VOIP_REMOTE_CONTROL_END
            ) {
                console.log("receive voip message", msg.messageContent.type, msg.messageContent.callId, msg.messageUid.toString(), msg);
                if (msg.direction === 0
                    && content.type !== MessageContentType.VOIP_CONTENT_TYPE_END
                    && content.type !== MessageContentType.VOIP_CONTENT_TYPE_ACCEPT
                    && content.type !== MessageContentType.VOIP_CONTENT_TYPE_ACCEPT
                    && content.type !== MessageContentType.VOIP_REMOTE_CONTROL_ACCEPT_INVITE
                    && content.type !== MessageContentType.VOIP_REMOTE_CONTROL_ACCEPT_REQUEST) {
                    return;
                }

                let participantUserInfos = [];
                let selfUserInfo = wfc.getUserInfo(wfc.getUserId());
                if (content.type === MessageContentType.VOIP_CONTENT_TYPE_START || content.type === MessageContentType.VOIP_REMOTE_CONTROL_REQUEST) {
                    this.conversation = msg.conversation;
                    this.callId = content.callId;
                    this.inviteMessageUid = msg.messageUid;
                    this.participants.push(...content.targetIds);
                    this.participants.push(msg.from);
                    // 参与者不包含自己
                    this.participants = this.participants.filter(uid => uid !== selfUserInfo.uid)

                    if (msg.conversation.type === ConversationType.Single) {
                        participantUserInfos = [wfc.getUserInfo(msg.from)];
                    } else {
                        let targetIds = content.targetIds.filter(id => id !== selfUserInfo.uid);
                        targetIds.push(msg.from);
                        participantUserInfos = wfc.getUserInfos(targetIds, msg.conversation.target);
                    }
                    if (!this.callWin) {
                        if (this.conversation) {
                            msg.participantUserInfos = participantUserInfos;
                            msg.selfUserInfo = selfUserInfo;
                            msg.timestamp = longValue(numberValue(msg.timestamp) - delta)
                            this.showCallUI(msg.conversation, false, {
                                event: 'message',
                                args: {
                                    ...msg,
                                    remoteControl: content.type === MessageContentType.VOIP_REMOTE_CONTROL_REQUEST
                                },
                            });
                        } else {
                            console.log('call ended')
                        }
                    }
                } else if (content.type === MessageContentType.VOIP_CONTENT_TYPE_ADD_PARTICIPANT) {
                    let participantIds = [...content.participants];
                    if (content.existParticipants) {
                        content.existParticipants.forEach(p => {
                            participantIds.push(p.userId);
                        });
                    }

                    this.conversation = msg.conversation;
                    this.callId = content.callId;
                    this.inviteMessageUid = msg.messageUid;
                    this.participants.push(...participantIds);

                    participantIds = participantIds.filter(u => u.uid !== selfUserInfo.uid);
                    participantUserInfos = wfc.getUserInfos(participantIds, msg.conversation.target);

                    if (!this.callWin && content.participants.indexOf(selfUserInfo.uid) > -1) {
                        if (this.conversation) {
                            this.showCallUI(msg.conversation, false, {
                                event: 'message',
                                args: msg
                            });
                        } else {
                            console.log('call ended')
                        }
                    }
                } else if (content.type === MessageContentType.VOIP_CONTENT_TYPE_END) {
                    if (content.callId !== this.callId) {
                        return;
                    }
                }

                if (msg.conversation.type === ConversationType.Group
                    && (content.type === MessageContentType.VOIP_CONTENT_TYPE_START
                        || content.type === MessageContentType.VOIP_CONTENT_TYPE_ADD_PARTICIPANT
                    )) {
                    let memberIds = wfc.getGroupMemberIds(msg.conversation.target);
                    msg.groupMemberUserInfos = wfc.getUserInfos(memberIds, msg.conversation.target);
                }

                msg.participantUserInfos = participantUserInfos;
                msg.selfUserInfo = selfUserInfo;
                msg.timestamp = longValue(numberValue(msg.timestamp) - delta)
                if (this.callWin) {
                    let ignore = false;
                    // start,add消息，显示 ui 的时候，会传过去，这儿就不用再次传了
                    if (MessageContentType.VOIP_CONTENT_TYPE_START === msg.messageContent.type || MessageContentType.VOIP_REMOTE_CONTROL_REQUEST === msg.messageContent.type) {
                        ignore = true
                    } else if (MessageContentType.VOIP_CONTENT_TYPE_ADD_PARTICIPANT === msg.messageContent.type && content.participants.indexOf(wfc.getUserId()) >= 0) {
                        ignore = true
                    }
                    if (!ignore) {
                        this.emitToVoip("message", msg);
                    }
                }
            }
        }
    };

    emitToVoip(event, args) {
        console.log('emitToVoip', event, args)
        if (isElectron()) {
            // renderer/main to renderer
            if (this.isVoipWindowReady) {
                // fix object of long.js can be send inter-process
                args = JSON.stringify(args)
                if (!this.callWin.isDestroyed()) {
                    try {
                        this.callWin.webContents.send(event, args);
                    } catch (e) {
                        // ignore, do nothing
                        // Object has been destroyed
                    }
                }
            } else if (this.queueEvents) {
                this.queueEvents.push({event, args});
            }
        } else {
            if (this.events) {
                this.events.emit(event, event, args);
            } else if (this.queueEvents) {
                this.queueEvents.push({event, args});
            }
        }
    }

    emitToMain(event, args) {
        console.log('emit to main', event, args);
        if (isElectron()) {
            // renderer to main
            ipcRenderer.send(event, args);
        } else {
            this.events.emit(event, event, args);
        }
    }

    listenVoipEvent = (event, listener) => {
        console.log('listenVoipEvent ', event, listener)
        if (isElectron()) {
            // listen for event from renderer
            ipcRenderer.on(event, listener);
        } else {
            this.events.on(event, listener);
        }
    };

    /**
     *  请求远程控制，仅高级版音视频 SDK 支持
     * @param {Conversation} conversation 会话，支持单聊
     */
    requestRemoteControl(conversation) {
        if (conversation.type !== ConversationType.Single) {
            this.onVoipCallErrorCallback && this.onVoipCallErrorCallback(-1);
            return
        }
        this._startCall(conversation, false, [conversation.target], '', true)
    }

    /**
     * 发起音视频通话
     * @param {Conversation} conversation 会话
     * @param {Boolean} audioOnly 是否是音频通话
     * @param {[String]} participants 参与者用户id列表
     * @param {string} callExtra 通话附加信息，会议版有效
     */
    startCall(conversation, audioOnly, participants, callExtra = '') {
        this._startCall(conversation, audioOnly, participants, callExtra, false);
    }

    _startCall(conversation, audioOnly, participants, callExtra = '', remoteControl = false) {
        if (this.callWin) {
            console.log('voip call is ongoing');
            this.onVoipCallErrorCallback && this.onVoipCallErrorCallback(-1);
            return;
        }
        console.log(`startCall speaker、microphone、webcam检测结果分别为：${this.hasSpeaker} , ${this.hasMicrophone}, ${this.hasWebcam}，如果不全为true，请检查硬件设备是否正常，否则通话可能存在异常`)
        if (!this.isSupportVoip || (!WfcAVEngineKit.ENABLE_VOIP_WHEN_NO_MIC_AND_SPEAKER && (!this.hasSpeaker || !this.hasMicrophone))) {
            console.log('not support voip', this.isSupportVoip, this.hasSpeaker, this.hasMicrophone, this.hasWebcam);
            this.onVoipCallErrorCallback && this.onVoipCallErrorCallback(-2);
            return;
        }

        // vue3里面，delete property 会触发reactivity
        conversation = Object.assign(new Conversation(), conversation)
        delete conversation._target;

        let selfUserInfo = wfc.getUserInfo(wfc.getUserId());
        participants = participants.filter(uid => uid !== selfUserInfo.uid);
        let callId = conversation.target + Math.floor(Math.random() * 10000);
        this.conversation = conversation;
        this.participants.push(...participants)
        this.callId = callId;

        let participantUserInfos = wfc.getUserInfos(participants);
        let groupMemberUserInfos;
        if (conversation.type === ConversationType.Group) {
            let memberIds = wfc.getGroupMemberIds(conversation.target);
            groupMemberUserInfos = wfc.getUserInfos(memberIds, conversation.target);
        }
        this.showCallUI(conversation, false, {
            event: 'startCall',
            args: {
                conversation: conversation,
                audioOnly: audioOnly,
                callId: callId,
                selfUserInfo: selfUserInfo,
                groupMemberUserInfos: groupMemberUserInfos,
                participantUserInfos: participantUserInfos,
                callExtra: callExtra,
                remoteControl: remoteControl
            }
        });
    }

    /**
     * 开始会议
     * @param {string} callId 会议id
     * @param {boolean} audioOnly 是否仅仅开启音频; true，音频会议；false，视频会议
     * @param {string} pin 入会pin码
     * @param {string} host 主持人用户id
     * @param {string} title 会议标题
     * @param {string} desc 会议描述
     * @param {boolean} audience 其他人加入会议时，是否默认为观众；true，默认为观众；false，默认为互动者
     * @param {boolean} advance 是否为高级会议，当预计参与人员很多的时候，开需要开启超级会议
     * @param {boolean} record 是否开启服务端录制
     * @param {Object} extra 一些额外信息，主要用于将信息传到音视频通话窗口，会议的其他参与者，无法看到该附加信息
     * @param {Object} callExtra  通话附件信息，会议的所有参与者都能看到该附加信息
     * @param {boolean} muteAudio 是否是静音加入会议
     * @param {boolean} muteVideo 是否是关闭摄像头加入会议
     */
    startConference(callId, audioOnly, pin, host, title, desc, audience, advance, record = false, extra, callExtra, muteAudio = false, muteVideo = false) {
        if (this.callWin) {
            console.log('voip call is ongoing');
            this.onVoipCallErrorCallback && this.onVoipCallErrorCallback(-1);
            return;
        }
        if (!this.isSupportVoip || (!WfcAVEngineKit.ENABLE_VOIP_WHEN_NO_MIC_AND_SPEAKER && (!this.hasSpeaker || !this.hasMicrophone))) {
            console.log('not support voip', this.isSupportVoip, this.hasSpeaker);
            this.onVoipCallErrorCallback && this.onVoipCallErrorCallback(-2);
            return;
        }

        callId = callId ? callId : wfc.getUserId() + Math.floor(Math.random() * 10000);
        this.callId = callId;
        this.conversation = null;
        this.conference = true;

        wfc.joinChatroom(callId, () => {
            console.log('join conference chatRoom success', callId)
        }, (err) => {
            console.error('join conference chatRoom fail', callId, err);
        });

        let selfUserInfo = wfc.getUserInfo(wfc.getUserId());
        this.showCallUI(null, true, {
            event: 'startConference',
            args: {
                audioOnly: audioOnly,
                callId: callId,
                pin: pin ? pin : Math.ceil(Math.random() * 1000000) + '',
                host: host,
                title: title,
                desc: desc,
                audience: audience,
                advance: advance,
                record: record,
                selfUserInfo: selfUserInfo,
                extra: extra,
                callExtra: callExtra,
                muteAudio: muteAudio,
                muteVideo: muteVideo,
            }
        });
    }

    /**
     * 加入会议
     * @param {string} callId 会议id
     * @param {string} audioOnly 是否只开启音频
     * @param {string} pin 会议pin码
     * @param {string} host 会议主持人
     * @param {string} title 会议标题
     * @param {string} desc 会议描述
     * @param {boolean} audience 是否是以观众角色入会
     * @param {string} advance 是否是高级会议
     * @param {boolean} muteAudio 是否是静音加入会议
     * @param {boolean} muteVideo 是否是关闭摄像头加入会议
     * @param {Object} extra 一些额外信息，主要用于将信息传到音视频通话窗口
     * @param {Object} callExtra 通话附加信息，会议的所有参与者都能看到该附加信息
     */
    joinConference(callId, audioOnly, pin, host, title, desc, audience, advance, muteAudio, muteVideo, extra = null, callExtra = null) {
        if (this.callWin) {
            console.log('voip call is ongoing');
            this.onVoipCallErrorCallback && this.onVoipCallErrorCallback(-1);
            return;
        }
        if (!this.isSupportVoip || (!WfcAVEngineKit.ENABLE_VOIP_WHEN_NO_MIC_AND_SPEAKER && (!this.hasSpeaker || !this.hasMicrophone))) {
            console.log('not support voip', this.isSupportVoip, this.hasSpeaker, this.hasMicrophone);
            this.onVoipCallErrorCallback && this.onVoipCallErrorCallback(-2);
            return;
        }

        this.conversation = null;
        this.conference = true;
        this.callId = callId;

        wfc.joinChatroom(callId, () => {
            console.log('join conference chatRoom success', callId)
        }, (err) => {
            console.error('join conference chatRoom fail', callId, err);
        });
        let selfUserInfo = wfc.getUserInfo(wfc.getUserId());
        this.showCallUI(null, true, {
            event: 'joinConference',
            args: {
                audioOnly: audioOnly,
                callId: callId,
                pin: pin,
                host: host,
                title: title,
                desc: desc,
                audience: audience,
                advance: advance,
                muteAudio: muteAudio,
                muteVideo: muteVideo,
                selfUserInfo: selfUserInfo,
                extra: extra,
                callExtra: callExtra,
            }
        });
    }

    async showCallUI(conversation, isConference, options) {
        if (options.args.remoteControl && !isElectron()) {
            console.warn('web 端，不支持远程协助');
            return
        } else if (process && process.platform === 'linux' && options.args.remoteControl) {
            console.warn('远程协助功能，目前只支持 Windows 和 macOS');
            return
        }
        let type = isConference ? 'conference' : (options.args.remoteControl ? 'single-rc' : (conversation.type === ConversationType.Single ? 'single' : 'multi'));
        this.type = type;

        let width = 360;
        let height = 640;
        let minWidth = 360;
        let minHeight = 640;
        switch (type) {
            case 'single':
                width = 360;
                height = 640;
                break;
            case 'single-rc':
                width = 960;
                height = 600;
                minWidth = 800;
                minHeight = 480;
                break;
            case 'multi':
            case 'conference':
                width = 960;
                height = 600;
                minWidth = 800;
                minHeight = 480;
                break;
            default:
                break;
        }
        if (isElectron()) {

            // Load URL through main process
            let hash = window.location.hash;
            let url = window.location.origin;
            if (hash) {
                url = window.location.href.replace(hash, '#/voip');
            } else {
                url += "/voip"
            }
            url += '/' + type + '?t=' + new Date().getTime()
            let windowOptions = {
                width: width,
                height: height,
                minWidth: minWidth,
                minHeight: minHeight,
                resizable: true,
                maximizable: true,
                transparent: !!isConference,
                frame: !isConference,
                url: url,
                webPreferences: {
                    scrollBounce: false,
                    nativeWindowOpen: true,
                    nodeIntegration: true,
                    contextIsolation: false,
                },
            };

            console.log('create-voip-window')
            console.log('voip windows url', url)
            // We're now sending a request to the main process to create the window
            this.callWin = await BrowserWindow.new(windowOptions);

            this.isVoipWindowReady = false;

            if (localStorage.getItem("enable_voip_debug")) {
                this.callWin.webContents.openDevTools();
            }

            // this.callWin.show();
            // this.callWin.removeMenu();
            // this.emitToVoip(options.event, options.args);

            // Set up listener for window close
            ipcRenderer.once(`voip-window-closed`, () => {
                this.onVoipWindowClose();
            });

            ipcRenderer.once(`voip-window-webContents-did-finish-load`, () => {
                this.emitToVoip(options.event, options.args);
                this.onVoipWindowReady();
            });

        } else {
            this.callWin = window;
            console.log('windowEmitter subscribe events');
            this.events.once('close-voip-div', () => {
                console.log('on close-voip-div', this.conversation, this.onVoipCallStatusCallback)
                this.onVoipCallStatusCallback && this.onVoipCallStatusCallback(this.conversation, false)
                this.callWin = null;
                this.isVoipWindowReady = false;
                if (this.conference) {
                    wfc.quitChatroom(this.callId);
                    this.conference = false;
                }
                this.conference = false;
                this.callId = null;
                this.conversation = null;
                this.participants = [];
                this.queueEvents = [];
            })
            // 等 voip view mounted
            setTimeout(() => {
                this.isVoipWindowReady = true;
                this.emitToVoip(options.event, options.args);
            }, 200)
            this.onVoipCallStatusCallback && this.onVoipCallStatusCallback(this.conversation, true)
        }
    }

    onVoipWindowClose = (event) => {
        if (event && event.srcElement && event.srcElement.URL === 'about:blank') {
            // fix safari bug: safari 浏览器，页面刚打开的时候，也会走到这个地方
            return;
        }
        // 让voip内部先处理关闭事件，内部处理时，可能还需要发消息
        console.log('onVoipWindowClose')
        if (!this.callWin) {
            return;
        }
        this.isVoipWindowReady = false;
        setTimeout(() => {
            this.onVoipCallStatusCallback && this.onVoipCallStatusCallback(this.conversation, false);
            this.conversation = null;
            if (this.conference) {
                wfc.quitChatroom(this.callId);
                this.conference = false;
            }
            this.callId = null;
            this.participants = [];
            this.queueEvents = [];
            this.callWin = null;
            this.voipEventRemoveAllListeners('voip-message', 'conference-request', 'update-call-start-message', 'start-screen-share');
        }, 2000);
    }

    onVoipWindowReady() {
        if (!this.callId) {
            return;
        }
        this.isVoipWindowReady = true;
        console.log('onVoipWindowReady', this.onVoipCallStatusCallback)
        this.onVoipCallStatusCallback && this.onVoipCallStatusCallback(this.conversation, true);
        if (!isElectron()) {
            // 启动页面的时候就监听，不然太慢了，会丢事件
        } else {
            console.log('ipcRenderer subscribe events');
            ipcRenderer.on('voip-message', this.sendVoipListener);
            ipcRenderer.on('conference-request', this.sendConferenceRequestListener);
            ipcRenderer.on('update-call-start-message', this.updateCallStartMessageContentListener)
            ipcRenderer.on(/*IPCEventType.START_SCREEN_SHARE*/'start-screen-share', (event, args) => {
                console.log('start-screen-share args', args, this.callWin);
                if (this.callWin) {
                    let screenWidth = args.width;
                    this.callWin.resizable = true;
                    this.callWin.closable = true;
                    this.callWin.maximizable = !!args.rc;
                    this.callWin.transparent = true;
                    let mw = args.rc ? 800 : 800
                    let mh = args.rc ? 200 : 800
                    this.callWin.setMinimumSize(mw, mh);
                    this.callWin.setSize(mw, mh);
                    // console.log('screen width', screen, screen.width);
                    if (args.rc) {
                        this.callWin.minimize()
                    } else {
                        this.callWin.setPosition((screenWidth - 800) / 2, 0, true);
                    }
                }
            });
            ipcRenderer.on(/*IPCEventType.STOP_SCREEN_SHARE*/'stop-screen-share', (event, args) => {
                if (this.callWin) {
                    let type = args.type;
                    let width = 360;
                    let height = 640;
                    switch (type) {
                        case 'single':
                            width = 360;
                            height = 640;
                            break;
                        case 'multi':
                        case 'conference':
                            width = 1024;
                            height = 800;
                            break;
                        default:
                            break;
                    }
                    this.callWin.resizable = true;
                    this.callWin.closable = true;
                    this.callWin.maximizable = true;
                    this.callWin.setMinimumSize(width, height);
                    this.callWin.setSize(width, height);
                    this.callWin.center();
                }
            })

        }
        if (this.queueEvents.length > 0) {
            this.queueEvents.forEach((eventArgs) => {
                console.log('process queued event', eventArgs);
                this.emitToVoip(eventArgs.event, eventArgs.args);
            })
        }
    }

    voipEventRemoveAllListeners(...events) {
        if (isElectron()) {
            // renderer
            events.forEach(e => ipcRenderer.removeAllListeners(e));
        }
    }

    forceCloseVoipWindow() {
        if (isElectron() && this.callWin) {
            this.callWin.close();
        }
        this.callId = null;
        this.callWin = null;
    }

    // 仅 web 端，单人、多人通话有效
    forceCloseVoipWindowAndHangup() {
        if (this.callWin && !this.conference) {
            let byeMessage = new CallByeMessageContent();
            // 处理用户没有主动挂断，而是直接返回页面时，补偿一个挂断消息
            // 现在还无法处理会议的情况，会议只能等待超时
            byeMessage.callId = this.callId;
            byeMessage.inviteMsgUid = this.inviteMessageUid;
            byeMessage.reason = CallEndReason.REASON_Hangup;
            wfc.sendConversationMessage(this.conversation, byeMessage);

            this.onVoipWindowClose()
        }
    }
}

const self = new AvEngineKitProxy();
export default self;
