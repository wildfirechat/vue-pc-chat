/*
 * Copyright (c) 2020 WildFireChat. All rights reserved.
 */

import GroupNotificationContent from "./groupNotification.js";
import MessageContentType from "../messageContentType.js";
import PersistFlag from '../persistFlag.js';

export default class GroupPrivateChatNotificationContent extends GroupNotificationContent {
    persistFlag = PersistFlag.Persist;
    operator;

    //是否运行群中普通成员私聊。0 允许，1不允许
    privateChatType;

    constructor(operator, privateChatType) {
        super(MessageContentType.ChangePrivateChat_Notification);
        this.operator = operator;
        this.privateChatType = privateChatType;
    }

    formatNotification(message) {
        // return sb.toString();
        let notifyStr = this.fromSelf ? '您' : this.operator;
        notifyStr += this.privateChatType === 0 ? ' 开启了成员私聊' : ' 关闭了成员私聊';

        return notifyStr;
    }

    encode() {
        let payload = super.encode();
        let obj = {
            g: this.groupId,
            o: this.operator,
            n: this.privateChatType + ''
        };
        payload.binaryContent = Buffer.from(JSON.stringify(obj)).toString('base64');
        return payload;
    }

    decode(payload) {
        super.decode(payload);
        let obj = JSON.parse(Buffer.from(payload.binaryContent, 'base64').toString());
        this.groupId = obj.g;
        this.operator = obj.o;
        this.privateChatType = parseInt(obj.n);
    }
}