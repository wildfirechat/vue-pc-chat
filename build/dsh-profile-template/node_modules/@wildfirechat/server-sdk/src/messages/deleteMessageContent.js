/*
 * Copyright (c) 2020 WildFireChat. All rights reserved.
 */

import MessageContent from './messageContent.js';
import MessageContentType from './messageContentType.js';
import Long from 'long';
import PersistFlag from './persistFlag.js';

// 本消息由调用server api删除消息触发，请勿直接发送本消息
export default class DeleteMessageContent extends MessageContent {
    persistFlag = PersistFlag.No_Persist;
    operatorId = '';
    messageUid = new Long(0);

    constructor(operatorId, messageUid) {
        super(MessageContentType.DeleteMessage_Notification);
        this.operatorId = operatorId;
        this.messageUid = messageUid;
    }

    formatNotification(message) {
        return "消息已删除";
    }

    encode() {
        let payload = super.encode();
        payload.content = this.operatorId;
        payload.binaryContent = Buffer.from(this.messageUid.toString()).toString('base64');
        return payload;
    }

    decode(payload) {
        super.decode(payload);
        this.operatorId = payload.content;
        this.messageUid = Long.fromString(Buffer.from(payload.binaryContent, 'base64').toString());
    }
}