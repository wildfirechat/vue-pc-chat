/*
 * Copyright (c) 2020 WildFireChat. All rights reserved.
 */

import NotificationMessageContent from './notificationMessageContent.js'
import MessageContentType from '../messageContentType.js';
import Long from 'long';
import PersistFlag from '../persistFlag.js';

export default class RecallMessageNotification extends NotificationMessageContent {
    persistFlag = PersistFlag.Persist;
    operatorId = '';
    messageUid = new Long(0);

    originalSender;
    originalContentType;
    originalSearchableContent;
    originalContent;
    originalExtra;
    originalMessageTimestamp;

    constructor(operatorId, messageUid) {
        super(MessageContentType.RecallMessage_Notification);
        this.operatorId = operatorId;
        this.messageUid = messageUid;
    }

    formatNotification(message) {
        if (this.operatorId === message.from){
            return "你撤回了一条消息";
        }
        return this.operatorId + "撤回了一条消息";
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

        try {
            this.setExtra(payload.extra);
        } catch (e) {
            console.error('decode recallMessage extra error', e)
        }
    }

    setExtra(extra) {
        if (extra) {
            extra =extra.replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t");
            let obj = JSON.parse(extra);
            this.originalSender = obj["s"];
            this.originalContentType = obj["t"];
            this.originalSearchableContent = obj["sc"];
            this.originalContent = obj["c"];
            this.originalExtra = obj["e"];
            this.originalMessageTimestamp = Long.fromValue(obj["ts"]);
        }
    }
}