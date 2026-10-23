/*
 * Copyright (c) 2025 WildFireChat. All rights reserved.
 */

import MessageContentType from "../messageContentType.js";
import NotificationMessageContent from "../notification/notificationMessageContent.js";
import PersistFlag from '../persistFlag.js';

/**
 * 恢复请求通知消息
 * iOS端请求PC端提供恢复备份列表
 */
export default class RestoreRequestNotificationContent extends NotificationMessageContent {
    persistFlag = PersistFlag.Transparent;
    constructor(timestamp) {
        super(MessageContentType.MESSAGE_CONTENT_TYPE_RESTORE_REQUEST);
        this.timestamp = timestamp || 0;
    }

    // 会话界面显示通知时，将显示本函数的返回值
    formatNotification() {
        return '请求从电脑端恢复备份';
    }

    digest() {
        return this.formatNotification();
    }

    encode() {
        let payload = super.encode();
        let obj = {
            t: this.timestamp || 0
        };

        payload.binaryContent = Buffer.from(JSON.stringify(obj)).toString('base64');
        return payload;
    }

    decode(payload) {
        super.decode(payload);
        let json = Buffer.from(payload.binaryContent, 'base64').toString();
        let obj = JSON.parse(json);

        this.timestamp = obj.t || 0;
    }
}