/*
 * Copyright (c) 2020 WildFireChat. All rights reserved.
 */

import MessageContent from "../messageContent.js";
import PersistFlag from "../persistFlag.js";

export default class NotificationMessageContent extends MessageContent {
    // message#protoMessageToMessage时设置
    fromSelf = false;
    persistFlag = PersistFlag.Persist;

    constructor(type) {
        super(type);
    }

    digest(message) {
        var desc = '';
        try {
            desc = this.formatNotification(message);
        } catch (error) {
            console.log('disgest', error);
        }
        return desc;
    }

    formatNotification(message) {
        return '..nofication..';
    }
}
