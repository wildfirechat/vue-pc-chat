/*
 * Copyright (c) 2020 WildFireChat. All rights reserved.
 */

import MessageContentType from '../messageContentType.js';

import GroupNotificationContent from './groupNotification.js';
import PersistFlag from '../persistFlag.js';

export default class ModifyGroupAliasNotification extends GroupNotificationContent {
    persistFlag = PersistFlag.Persist;
    operator = '';
    alias = '';
    memberId = '';

    constructor(creator, alias) {
        super(MessageContentType.ModifyGroupAlias_Notification);
        this.operator = creator;
        this.alias = alias;
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
        notificationStr += '群昵称为';
        notificationStr += this.alias;

        return notificationStr;
    }

    encode() {
        let payload = super.encode();
        let obj = {
            g: this.groupId,
            n: this.alias,
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
        this.alias = obj.n;
        this.memberId = obj.m;
    }
}