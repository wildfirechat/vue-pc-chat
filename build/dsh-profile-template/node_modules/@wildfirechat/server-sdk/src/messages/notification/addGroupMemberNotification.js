/*
 * Copyright (c) 2020 WildFireChat. All rights reserved.
 */

import MessageContentType from '../messageContentType.js';

import GroupNotificationContent from './groupNotification.js';
import PersistFlag from '../persistFlag.js';

export default class AddGroupMemberNotification extends GroupNotificationContent {
    persistFlag = PersistFlag.Persist;
    invitor = '';
    invitees = [];

    constructor(invitor, invitees) {
        super(MessageContentType.AddGroupMember_Notification);
        this.invitor = invitor;
        this.invitees = invitees;
    }

    formatNotification() {
        let notifyStr;
        if (this.invitees.length === 1 && this.invitees[0] === this.invitor) {
            if (this.fromSelf) {
                return '您加入了群组';
            } else {
                return this.invitor + ' 加入了群组';
            }
        }

        if (this.fromSelf) {
            notifyStr = '您邀请:';
        } else {
            notifyStr = this.invitor + '邀请:';
        }

        let membersStr = '';
        this.invitees.forEach(m => {
            membersStr += ' ' + m;
        });

        return notifyStr + membersStr + '加入了群组';
    }

    encode() {
        let payload = super.encode();
        let obj = {
            g: this.groupId,
            o: this.invitor,
            ms: this.invitees,
        };
        payload.binaryContent = Buffer.from(JSON.stringify(obj)).toString('base64');
        return payload;
    }

    decode(payload) {
        super.decode(payload);
        let json = Buffer.from(payload.binaryContent, 'base64').toString();
        let obj = JSON.parse(json);
        this.groupId = obj.g;
        this.invitor = obj.o;
        this.invitees = obj.ms;
    }
}