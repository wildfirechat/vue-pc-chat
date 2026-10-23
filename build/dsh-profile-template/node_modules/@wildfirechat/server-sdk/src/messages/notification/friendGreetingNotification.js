/*
 * Copyright (c) 2022 WildFireChat. All rights reserved.
 */

import NotificationMessageContent from "./notificationMessageContent.js";
import MessageContentType from "../messageContentType.js";
import PersistFlag from '../persistFlag.js';

export default class FriendGreetingNotification extends NotificationMessageContent {
    persistFlag = PersistFlag.Persist;
    constructor() {
        super(MessageContentType.Friend_Greeting);
    }

    formatNotification(message) {
        return "以上是打招呼的内容";
    }
}