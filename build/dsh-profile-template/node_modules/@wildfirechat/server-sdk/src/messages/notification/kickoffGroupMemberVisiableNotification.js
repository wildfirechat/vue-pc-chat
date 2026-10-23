/*
 * Copyright (c) 2020 WildFireChat. All rights reserved.
 */

import MessageContentType from "../messageContentType.js";

import GroupNotificationContent from "./groupNotification.js";
import PersistFlag from '../persistFlag.js';

export default class KickoffGroupMemberVisiableNotification extends GroupNotificationContent {
    persistFlag = PersistFlag.Persist;
    operator = '';
    kickedMembers = [];

    constructor(operator, kickedMembers) {
        super(MessageContentType.KickOffGroupMember_Visible_Notification);
        this.operator = operator;
        this.kickedMembers = kickedMembers;
    }

    formatNotification() {
        let notifyStr;
        if (this.fromSelf) {
            notifyStr = '您把 ';
        } else {
            notifyStr = this.operator + '把 ';
        }

        let kickedMembersStr = '';
        this.kickedMembers.forEach(uid => {
            kickedMembersStr += ' ' + uid;
        });

        return notifyStr + kickedMembersStr + ' 移除了群组';
    }

    encode() {
        let payload = super.encode();
        let obj = {
            g: this.groupId,
            ms: this.kickedMembers,
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
        this.kickedMembers = obj.ms;
    }
}