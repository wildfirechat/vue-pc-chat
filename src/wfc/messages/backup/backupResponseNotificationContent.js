/*
 * Copyright (c) 2025 WildFireChat. All rights reserved.
 */

import MessageContentType from "../messageContentType";
import NotificationMessageContent from "../notification/notificationMessageContent";
import wfc from "../../client/wfc";

/**
 * 备份响应通知消息
 * PC端响应iOS端的备份请求
 */
export default class BackupResponseNotificationContent extends NotificationMessageContent {
    constructor(approved, serverIP, serverPort) {
        super(MessageContentType.MESSAGE_CONTENT_TYPE_BACKUP_RESPONSE);
        this.approved = approved;
        this.serverIP = serverIP;
        this.serverPort = serverPort;
    }

    /**
     * 创建拒绝消息
     */
    static createRejectedResponse() {
        return new BackupResponseNotificationContent(false, '', 0);
    }

    /**
     * 创建同意消息
     */
    static createApprovedResponse(serverIP, serverPort) {
        return new BackupResponseNotificationContent(true, serverIP, serverPort);
    }

    // 会话界面显示通知时，将显示本函数的返回值
    formatNotification() {
        return this.approved ? '已同意备份请求' : '已拒绝备份请求';
    }

    digest() {
        return this.formatNotification();
    }

    encode() {
        let payload = super.encode();
        let obj = {
            a: this.approved
        };

        if (this.approved) {
            obj.ip = this.serverIP || '';
            obj.p = this.serverPort || 0;
        }

        payload.binaryContent = wfc.utf8_to_b64(JSON.stringify(obj));
        return payload;
    }

    decode(payload) {
        super.decode(payload);
        let json = wfc.b64_to_utf8(payload.binaryContent);
        let obj = JSON.parse(json);

        this.approved = obj.a || false;

        if (this.approved) {
            this.serverIP = obj.ip || '';
            this.serverPort = obj.p || 0;
        }
    }
}
