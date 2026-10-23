/*
 * Copyright (c) 2020 WildFireChat. All rights reserved.
 */

import MessageContentType from "../messageContentType.js";

import GroupNotificationContent from "./groupNotification.js";
import PersistFlag from '../persistFlag.js';

export default class ChangeGroupPortraitNotification extends GroupNotificationContent {
    persistFlag = PersistFlag.Persist;
    operator = '';

    constructor(operator) {
        super(MessageContentType.ChangeGroupPortrait_Notification);
        this.operator = operator;
    }

    formatNotification() {
        if (this.fromSelf) {
            return '您修改群头像';
        } else {
            return this.operator + '修改了群头像';
        }
    }

    encode() {
        let payload = super.encode();
        let obj = {
            g: this.groupId,
            n: this.name,
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
    }

}