/*
 * Copyright (c) 2020 WildFireChat. All rights reserved.
 */

import GroupNotificationContent from "./groupNotification.js";
import MessageContentType from "../messageContentType.js";
import PersistFlag from '../persistFlag.js';

export default class GroupMuteNotificationContent extends GroupNotificationContent {
    persistFlag = PersistFlag.Persist;
    operator;

    //0 正常；1 全局禁言
    muteType;

    constructor(operator, muteType) {
        super(MessageContentType.MuteGroup_Notification);
        this.operator = operator;
        this.muteType = muteType;
    }

    formatNotification(message) {
        // return sb.toString();
        let notifyStr = this.fromSelf ? '您' : this.operator;
        notifyStr += this.muteType === 0 ? ' 关闭了全员禁言' : ' 开启了全员禁言';

        return notifyStr;
    }

    encode() {
        let payload = super.encode();
        let obj = {
            g: this.groupId,
            o: this.operator,
            n: this.muteType + ''
        };
        payload.binaryContent = Buffer.from(JSON.stringify(obj)).toString('base64');
        return payload;
    }

    decode(payload) {
        super.decode(payload);
        let obj = JSON.parse(Buffer.from(payload.binaryContent, 'base64').toString());
        this.groupId = obj.g;
        this.operator = obj.o;
        this.muteType = parseInt(obj.n);
    }
}