/*
 * Copyright (c) 2020 WildFireChat. All rights reserved.
 */

import NotificationMessageContent from "./notificationMessageContent.js";
import PersistFlag from '../persistFlag.js';

export default class ChatRoomWelcomeNotificationContent extends NotificationMessageContent {
    persistFlag = PersistFlag.Persist;
    welcome;


    formatNotification(message) {
        return this.welcome;
    }

    encode() {
        return super.encode();
    }

    decode(payload) {
        super.decode(payload);
    }
}