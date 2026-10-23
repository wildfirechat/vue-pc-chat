/*
 * Copyright (c) 2025 WildFireChat. All rights reserved.
 */

import MessageContentType from "../messageContentType.js";
import NotificationMessageContent from "../notification/notificationMessageContent.js";
import PersistFlag from '../persistFlag.js';

/**
 * 恢复响应通知消息
 * PC端响应iOS端的恢复请求
 */
export default class RestoreResponseNotificationContent extends NotificationMessageContent {
    persistFlag = PersistFlag.Transparent;
    constructor(approved, serverIP, serverPort) {
        super(MessageContentType.MESSAGE_CONTENT_TYPE_RESTORE_RESPONSE);
        this.approved = approved;
        this.serverIP = serverIP;
        this.serverPort = serverPort;
    }

    /**
     * 创建拒绝消息
     */
    static createRejectedResponse() {
        return new RestoreResponseNotificationContent(false, '', 0);
    }

    /**
     * 创建同意消息
     */
    static createApprovedResponse(serverIP, serverPort) {
        return new RestoreResponseNotificationContent(true, serverIP, serverPort);
    }

    // 会话界面显示通知时，将显示本函数的返回值
    formatNotification() {
        return this.approved ? '已同意从电脑端恢复' : '已拒绝从电脑端恢复';
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

        payload.binaryContent = Buffer.from(JSON.stringify(obj)).toString('base64');
        return payload;
    }

    decode(payload) {
        super.decode(payload);
        let json = Buffer.from(payload.binaryContent, 'base64').toString();
        let obj = JSON.parse(json);

        this.approved = obj.a || false;

        if (this.approved) {
            this.serverIP = obj.ip || '';
            this.serverPort = obj.p || 0;
        }
    }
}