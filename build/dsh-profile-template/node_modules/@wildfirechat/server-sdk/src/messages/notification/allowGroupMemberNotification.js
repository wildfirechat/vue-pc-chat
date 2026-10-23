/*
 * Copyright (c) 2020 WildFireChat. All rights reserved.
 */

import GroupNotificationContent from './groupNotification.js'
import MessageContentType from '../messageContentType.js'
import PersistFlag from '../persistFlag.js';

export default class AllowGroupMemberNotification extends GroupNotificationContent {
    persistFlag = PersistFlag.Persist;
    groupId
    operator
    // 操作类型，1允许发言，0禁止发言
    type
    memberIds

    constructor(operator, type, memberIds) {
        super(MessageContentType.MuteGroupMember_Notification)
        this.operator = operator
        this.type = type
        this.memberIds = memberIds
    }

    formatNotification(message) {
        let notifyStr = ''
        if (this.fromSelf) {
            notifyStr += '您'
        } else {
            notifyStr += this.operator
        }
        notifyStr += '把'
        if (this.memberIds) {
            this.memberIds.forEach((memberId) => {
                notifyStr += ' '
                notifyStr += memberId
            })
        }
        if (this.type === 0) {
            notifyStr += '取消群禁言时发言权限'
        } else {
            notifyStr += '允许群禁言时发言'
        }
        return notifyStr
    }

    encode() {
        let payload = super.encode()
        let obj = {
            g: this.groupId,
            o: this.operator,
            n: this.type + '',
            ms: this.memberIds,
        }
        payload.binaryContent = Buffer.from(JSON.stringify(obj)).toString('base64')
        return payload
    }

    decode(payload) {
        super.decode(payload)

        let json = Buffer.from(payload.binaryContent, 'base64').toString()
        let obj = JSON.parse(json)
        this.groupId = obj.g
        this.operator = obj.o
        this.type = parseInt(obj.n)
        this.memberIds = obj.ms
    }
}