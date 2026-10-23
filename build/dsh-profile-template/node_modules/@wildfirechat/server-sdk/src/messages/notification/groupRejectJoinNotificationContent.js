/*
 * Copyright (c) 2020 WildFireChat. All rights reserved.
 */

import GroupNotificationContent from "./groupNotification.js";
import MessageContentType from "../messageContentType.js";
import PersistFlag from '../persistFlag.js';

export default class GroupRejectJoinNotificationContent extends GroupNotificationContent {
    persistFlag = PersistFlag.Persist;
    operator;

    rejectUserMap;

    constructor(operator) {
        super(MessageContentType.RejectJoinGroup);
        this.operator = operator;
        this.rejectUserMap = new Map();
    }

    formatNotification(message) {

        let rejectMembersStr = "";
        if (this.rejectUserMap && this.rejectUserMap.size > 0) {
            this.rejectUserMap.forEach((value, key) => {
                rejectMembersStr += key + " ";
            });
        }

        return rejectMembersStr + " 拒绝加入群组";
    }

    encode() {
        let payload = super.encode();
        let obj = {
            g: this.groupId,
            o: this.operator,
            mi: this.rejectUserMap
        };
        payload.binaryContent = Buffer.from(JSON.stringify(obj)).toString('base64');
        return payload;
    }

    decode(payload) {
        super.decode(payload);
        let obj = JSON.parse(Buffer.from(payload.binaryContent, 'base64').toString());
        this.groupId = obj.g;
        this.operator = obj.o;
        this.rejectUserMap = new Map(JSON.parse(obj.mi));
    }
}