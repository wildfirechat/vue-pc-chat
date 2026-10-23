/*
 * Copyright (c) 2020 WildFireChat. All rights reserved.
 */

import MessageContentType from '../messageContentType.js';

import GroupNotificationContent from './groupNotification.js';
import PersistFlag from '../persistFlag.js';

export default class ModifyGroupExtraNotification extends GroupNotificationContent {
    persistFlag = PersistFlag.No_Persist;
    operator = '';
    groupExtra = '';

    constructor(creator, groupExtra) {
        super(MessageContentType.ModifyGroupExtra_Notification);
        this.operator = creator;
        this.groupExtra = groupExtra;
    }

    formatNotification() {
        let notificationStr = '';
        if (this.fromSelf) {
            notificationStr += '你';
        } else {
            notificationStr += this.operator;
        }
        notificationStr += '修改';
        notificationStr += '群附加信息为';
        notificationStr += this.groupExtra;

        return notificationStr;
    }

    encode() {
        let payload = super.encode();
        let obj = {
            g: this.groupId,
            n: this.groupExtra,
            o: this.operator,
        };
        payload.binaryContent = Buffer.from(JSON.stringify(obj)).toString('base64');
        return payload;
    }

    decode(payload) {
        super.decode(payload);
        let json = Buffer.from(payload.binaryContent, 'base64').toString()
        let obj = JSON.parse(json);
        this.groupId = obj.g;
        this.operator = obj.o;
        this.groupExtra = obj.n;
    }
}