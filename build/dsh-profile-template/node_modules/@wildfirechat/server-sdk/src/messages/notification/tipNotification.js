/*
 * Copyright (c) 2020 WildFireChat. All rights reserved.
 */

import NotificationMessageContent from './notificationMessageContent.js'
import MessageContentType from '../messageContentType.js';
import PersistFlag from '../persistFlag.js';

export default class TipNotificationMessageContent extends NotificationMessageContent {
    persistFlag = PersistFlag.Persist;
    tip = '';

    constructor(tip) {
        super(MessageContentType.Tip_Notification);
        this.tip = tip;
    }

    formatNotification() {
        return this.tip;
    }

    digest() {
        return this.tip;
    }

    encode() {
        let payload = super.encode();
        payload.content = this.tip;
        return payload;
    };

    decode(payload) {
        super.decode(payload);
        this.tip = payload.content;
    }
}