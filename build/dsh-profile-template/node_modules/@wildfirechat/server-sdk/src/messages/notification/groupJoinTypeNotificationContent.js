/*
 * Copyright (c) 2020 WildFireChat. All rights reserved.
 */

import GroupNotificationContent from "./groupNotification.js";
import MessageContentType from "../messageContentType.js";
import PersistFlag from '../persistFlag.js';

export default class GroupJoinTypeNotificationContent extends GroupNotificationContent {
    persistFlag = PersistFlag.Persist;
    operator;

    //在group type为Restricted时，0 开放加入权限（群成员可以拉人，用户也可以主动加入）；1 只能群成员拉人入群；2 只能群管理拉人入群
    joinType;


    constructor(operator, joinType) {
        super(MessageContentType.ChangeJoinType_Notification);
        this.operator = operator;
        this.type = joinType;
    }

    formatNotification(message) {
        let notifyStr;
        if (this.fromSelf) {
            notifyStr = '您';
        } else {
            notifyStr = this.operator;
        }
        switch (this.joinType) {
            case 0:
                notifyStr += ' 开放了加入群组功能';
                break;
            case 1:
                notifyStr += ' 仅允许群成员邀请加入群组';
                break;
            case 2:
                notifyStr += " 关闭了加入群组功能";
                break;
            default:
                break;
        }
        return notifyStr;
    }

    encode() {
        let payload = super.encode();
        let obj = {
            g: this.groupId,
            o: this.operator,
            n: (this.joinType + '')
        };
        payload.binaryContent = Buffer.from(JSON.stringify(obj)).toString('base64');
        return payload;
    }

    decode(payload) {
        super.decode(payload);
        let obj = JSON.parse(Buffer.from(payload.binaryContent, 'base64').toString());
        this.groupId = obj.g;
        this.operator = obj.o;
        this.joinType = parseInt(obj.n);
    }
}