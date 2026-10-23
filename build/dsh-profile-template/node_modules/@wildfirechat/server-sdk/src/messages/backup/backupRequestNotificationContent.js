/*
 * Copyright (c) 2025 WildFireChat. All rights reserved.
 */


import MessageContentType from "../messageContentType.js";
import NotificationMessageContent from "../notification/notificationMessageContent.js";
import PersistFlag from '../persistFlag.js';

/**
 * 备份请求通知消息
 * iOS端请求备份到PC端时发送此通知
 */
export default class BackupRequestNotificationContent extends NotificationMessageContent {
    persistFlag = PersistFlag.Transparent;
    conversationCount = 0;
    messageCount = 0;
    timestamp = 0;
    includeMedia = false;

    constructor() {
        super(MessageContentType.MESSAGE_CONTENT_TYPE_BACKUP_REQUEST);
    }

    // 会话界面显示通知时，将显示本函数的返回值
    formatNotification() {
        return '请求备份到电脑端';
    }

    digest() {
        return this.formatNotification();
    }

    encode() {
        let payload = super.encode();
        let obj = {
            cc: this.conversationCount || 0,
            mc: this.conversationCount || 0,
            m: this.includeMedia || false,
            t: this.timestamp || 0
        };
        payload.binaryContent = Buffer.from(JSON.stringify(obj)).toString('base64');
        return payload;
    }

    decode(payload) {
        super.decode(payload);
        let json = Buffer.from(payload.binaryContent, 'base64').toString();
        let obj = JSON.parse(json);
        this.conversationCount = obj.cc || 0;
        this.messageCount = obj.mc || 0;
        this.includeMedia = obj.m || false;
        this.timestamp = obj.t || 0;
    }
}