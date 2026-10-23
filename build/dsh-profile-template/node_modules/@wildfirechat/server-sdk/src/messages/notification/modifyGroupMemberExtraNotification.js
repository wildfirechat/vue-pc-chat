/*
 * Copyright (c) 2020 WildFireChat. All rights reserved.
 */

import MessageContentType from '../messageContentType.js';

import GroupNotificationContent from './groupNotification.js';
import PersistFlag from '../persistFlag.js';

export default class ModifyGroupMemberExtraNotification extends GroupNotificationContent {
    persistFlag = PersistFlag.No_Persist;
    operator = '';
    groupMemberExtra = '';
    memberId = '';

    constructor(creator, groupMemberExtra) {
        super(MessageContentType.ModifyGroupMemberExtra_Notification);
        this.operator = creator;
        this.groupMemberExtra = groupMemberExtra;
    }

    formatNotification() {
        let notificationStr = '';
        if (this.fromSelf) {
            notificationStr += '你';
        } else {
            notificationStr += this.operator;
        }
        notificationStr += '修改';
        if (this.memberId) {
            notificationStr += this.memberId;
            notificationStr += '的';
        }
        notificationStr += '群成员信息为';
        notificationStr += this.groupMemberExtra;

        return notificationStr;
    }

    encode() {
        let payload = super.encode();
        let obj = {
            g: this.groupId,
            n: this.groupMemberExtra,
            o: this.operator,
            m: this.memberId,
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
        this.groupMemberExtra = obj.n;
        this.memberId = obj.m;
    }
}