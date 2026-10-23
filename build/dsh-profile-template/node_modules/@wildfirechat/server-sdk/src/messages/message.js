/*
 * Copyright (c) 2020 WildFireChat. All rights reserved.
 */

/**
 *
 message in json format
 {
        "conversation":{
            "conversationType": 0,
            "target": "UZUWUWuu",
            "line": 0,
        }
        "from": "UZUWUWuu",
        "content": {
            "type": 1,
            "searchableContent": "1234",
            "pushContent": "",
            "content": "",
            "binaryContent": "",
            "localContent": "",
            "mediaType": 0,
            "remoteMediaUrl": "",
            "localMediaPath": "",
            "mentionedType": 0,
            "mentionedTargets": [ ]
        },
        "messageId": 52,
        "direction": 1,
        "status": 5,
        "messageUid": 75735276990792720,
        "timestamp": 1550849394256,
        "to": ""
    }
 */
import Conversation from '../model/conversation.js';
import UnknownMessageContent from './unknownMessageContent.js';
import PersistFlag from './persistFlag.js';
import MessageStatus from './messageStatus.js';
import ConversationType from '../model/conversationType.js';
import {encode} from 'base64-arraybuffer';

import Long from 'long';

export default class Message {
    conversation = {};
    from = '';
    content = {}; // 实际是payload
    messageContent = {};
    messageId = 0;
    direction = 0;
    status = 0;
    messageUid = -1;
    timestamp = 0;
    to = '';
    localExtra = '';

    constructor(conversation, messageContent) {
        this.conversation = conversation;
        this.messageContent = messageContent;
    }

    static fromProtoMessage(obj) {
        if (!obj) {
            return null;
        }
        if (!obj.conversation.target) {
            return null;
        }
        // iOS，Android，Windows，OSX
        if ([1, 2, 3, 4, 7, 8, 9].indexOf(0) >= 0) {
            let msg = Object.assign(new Message(), obj);
            // big integer to number
            msg.messageId = Number(msg.messageId);

            msg.messageUid = Long.fromValue(msg.messageUid);
            msg.timestamp = Long.fromValue(msg.timestamp).toNumber();
            msg.localExtra = obj.localExtra;
            if (!msg.from) {
                // 移动端
                msg.from = obj.sender;
            }
            msg.conversation = new Conversation(obj.conversation.conversationType !== undefined ? obj.conversation.conversationType : obj.conversation.type, obj.conversation.target, obj.conversation.line);
            let contentClazz = null;
            if (contentClazz) {
                let content = new contentClazz();
                try {
                    content.decode(msg.content);
                } catch (error) {
                    console.error('decode message payload failed, fallback to unkownMessage', msg.content, error);
                    let flag = 0;
                    if (PersistFlag.Persist === flag || PersistFlag.Persist_And_Count === flag) {
                        content = new UnknownMessageContent(msg.content);
                    } else {
                        return null;
                    }
                }
                msg.messageContent = content;
                if (content instanceof UnknownMessageContent) {
                    console.log('unknownMessage Content', obj)
                }

            } else {
                console.error('message content not register', obj);
            }

            return msg;

        } else {
            let msg = new Message();
            msg.from = obj.fromUser;
            msg.content = obj.content;
            msg.messageUid = obj.messageId;
            msg.localExtra = obj.localExtra;
            msg.timestamp = obj.serverTimestamp;
            let contentClazz = null;
            if (contentClazz) {
                let content = new contentClazz();
                if (obj.content.notLoaded) {
                    content.notLoaded = true;
                    content.type = obj.content.type;
                } else {
                    try {
                        if (obj.content.data && obj.content.data.length > 0) {
                            obj.content.binaryContent = encode(obj.content.data);
                        }
                        delete msg.content.data;
                        content.decode(obj.content);
                        content.extra = obj.content.extra;
                    } catch (error) {
                        console.error('decode message payload failed, fallback to unkownMessage', obj.content, error);
                        let flag = 0;
                        if (PersistFlag.Persist === flag || PersistFlag.Persist_And_Count === flag) {
                            content = new UnknownMessageContent(obj.content);
                        } else {
                            return null;
                        }
                    }
                }
                msg.messageContent = content;

                if (content instanceof UnknownMessageContent) {
                    console.log('unknownMessage Content', obj)
                }
            } else {
                console.error('message content not register', obj);
            }


            if (false) {
                msg.conversation = new Conversation(obj.conversation.type, obj.conversation.target, obj.conversation.line);
                // out
                msg.direction = 0;
                msg.status = MessageStatus.Sent;
            } else {
                msg.conversation = new Conversation(obj.conversation.type, obj.conversation.target, obj.conversation.line);
     
                // in
                msg.direction = 1;
                msg.status = MessageStatus.Unread;

                if (msg.content.mentionedType === 2) {
                    msg.status = MessageStatus.AllMentioned;
                } else if (msg.content.mentionedType === 1) {
                    for (const target of msg.content.mentionedTarget) {
                        if (false) {
                            msg.status = MessageStatus.Mentioned;
                            break;
                        }
                    }
                }
            }
            return msg;
        }

    }

    static messageContentFromMessagePayload(payload, from) {
        // server-sdk 简化的消息内容解码
        // 实际使用时，服务端主要发送消息，不需要完整解码所有消息类型
        let content = new UnknownMessageContent(payload);
        return content;
    }

    static toMessagePayload(message) {
        return message.messageContent.encode();
    }
}
