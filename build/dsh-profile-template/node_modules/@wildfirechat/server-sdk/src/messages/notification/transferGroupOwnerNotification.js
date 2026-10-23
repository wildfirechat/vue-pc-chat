/*
 * Copyright (c) 2020 WildFireChat. All rights reserved.
 */

import MessageContentType from '../messageContentType.js';
import GroupNotificationContent from './groupNotification.js';
import PersistFlag from '../persistFlag.js';

export default class TransferGroupOwnerNotification extends GroupNotificationContent {
    persistFlag = PersistFlag.Persist;
    operator = '';
    newOwner = '';

    constructor(operator, newOwner) {
        super(MessageContentType.TransferGroupOwner_Notification);
        this.operator = operator;
        this.newOwner = newOwner;
    }

    formatNotification() {
        if (this.fromSelf) {
            return '您把群转让给了 ' + this.newOwner;
        } else {
            return this.operator + '把群转让给了 ' + this.newOwner
        }
    }

    encode() {
        let payload = super.encode();
        let obj = {
            g: this.groupId,
            o: this.operator,
            m: this.newOwner,
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
        this.newOwner = obj.m;
    }
}