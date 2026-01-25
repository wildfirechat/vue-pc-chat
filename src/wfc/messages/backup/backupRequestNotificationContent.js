/*
 * Copyright (c) 2025 WildFireChat. All rights reserved.
 */


import MessageContentType from "../messageContentType";
import NotificationMessageContent from "../notification/notificationMessageContent";
import wfc from "../../client/wfc";

/**
 * 备份请求通知消息
 * iOS端请求备份到PC端时发送此通知
 */
export default class BackupRequestNotificationContent extends NotificationMessageContent {
    constructor(conversationsJson, includeMedia, timestamp) {
        super(MessageContentType.MESSAGE_CONTENT_TYPE_BACKUP_REQUEST);
        this.conversationsJson = conversationsJson;
        this.includeMedia = includeMedia;
        this.timestamp = timestamp;
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
            c: this.conversationsJson || '',
            m: this.includeMedia || false,
            t: this.timestamp || 0
        };
        payload.binaryContent = wfc.utf8_to_b64(JSON.stringify(obj));
        return payload;
    }

    decode(payload) {
        super.decode(payload);
        let json = wfc.b64_to_utf8(payload.binaryContent);
        let obj = JSON.parse(json);
        this.conversationsJson = obj.c || '';
        this.includeMedia = obj.m || false;
        this.timestamp = obj.t || 0;
    }
}
