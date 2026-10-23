/*
 * Copyright (c) 2020 WildFireChat. All rights reserved.
 */

import MessageContentType from "../messageContentType.js";

import GroupNotificationContent from "./groupNotification.js";
import PersistFlag from '../persistFlag.js';

export default class ChangeGroupNameNotification extends GroupNotificationContent {
    persistFlag = PersistFlag.Persist;
    operator = '';
    name = '';

    constructor(operator, name) {
        super(MessageContentType.ChangeGroupName_Notification);
        this.operator = operator;
        this.name = name;
    }

    formatNotification() {
        if (this.fromSelf) {
            return '您修改群名称为：' + this.name;
        } else {
            return this.operator + '修改群名称为：' + this.name;
        }
    }

    encode() {
        let payload = super.encode();
        let obj = {
            g: this.groupId,
            n: this.name,
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
        this.name = obj.n;
    }

}