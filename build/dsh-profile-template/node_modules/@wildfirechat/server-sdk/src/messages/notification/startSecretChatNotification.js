/*
 * Copyright (c) 2020 WildFireChat. All rights reserved.
 */

import NotificationMessageContent from './notificationMessageContent.js'
import MessageContentType from "../messageContentType.js";
import PersistFlag from '../persistFlag.js';

export default class StartSecretChatNotification extends NotificationMessageContent {
    persistFlag = PersistFlag.Persist;

    constructor() {
        super(MessageContentType.StartSecretChat_Notification);
    }

    formatNotification(message) {
        return "密聊会话";
    }

    encode() {
        return super.encode();
    }

    decode(payload) {
        super.decode(payload);
    }
}