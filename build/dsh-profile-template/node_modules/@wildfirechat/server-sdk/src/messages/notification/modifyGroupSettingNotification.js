/*
 * Copyright (c) 2023 WildFireChat. All rights reserved.
 */

import MessageContentType from '../messageContentType.js';

import GroupNotificationContent from './groupNotification.js';
import PersistFlag from '../persistFlag.js';

export default class ModifyGroupSettingNotification extends GroupNotificationContent {
    persistFlag = PersistFlag.No_Persist;
    operator = '';
    //修改设置类型。7为修改是否查看历史消息；8为修改群最大成员数，9为修改是否为超级群
    settingType = 0;
    //修改后的值
    settingValue = '';

    constructor(settingType, settingValue) {
        super(MessageContentType.ModifyGroupSetting_Notification);
        this.settingType = settingType;
        this.settingValue = settingValue;
    }

    formatNotification() {
        return '';
    }

    encode() {
        let payload = super.encode();
        let obj = {
            g: this.groupId,
            n: this.settingType,
            o: this.operator,
            m: this.settingValue,
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