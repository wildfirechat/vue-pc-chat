/*
 * Copyright (c) 2025 WildFireChat. All rights reserved.
 */

import MessageContentType from "../messageContentType";
import NotificationMessageContent from "../notification/notificationMessageContent";
import wfc from "../../client/wfc";

/**
 * 恢复请求通知消息
 * iOS端请求PC端提供恢复备份列表
 */
export default class RestoreRequestNotificationContent extends NotificationMessageContent {
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

        payload.binaryContent = wfc.utf8_to_b64(JSON.stringify(obj));
        return payload;
    }

    decode(payload) {
        super.decode(payload);
        let json = wfc.b64_to_utf8(payload.binaryContent);
        let obj = JSON.parse(json);

        this.timestamp = obj.t || 0;
    }
}
