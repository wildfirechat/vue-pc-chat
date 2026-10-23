/*
 * Copyright (c) 2020 WildFireChat. All rights reserved.
 */

import GroupNotificationContent from './groupNotification.js'
import MessageContentType from '../messageContentType.js'
import PersistFlag from '../persistFlag.js';

export default class MuteGroupMemberNotification extends GroupNotificationContent {
    persistFlag = PersistFlag.Persist;
    groupId
    operator
    // 操作类型，1禁言，0取消禁言
    muteType
    memberIds

    constructor(operator, muteType, memberIds) {
        super(MessageContentType.MuteGroupMember_Notification)
        this.operator = operator
        this.muteType = muteType
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
        if (this.muteType === 1) {
            notifyStr += '设置了禁言'
        } else {
            notifyStr += '取消了禁言'
        }
        return notifyStr
    }

    encode() {
        let payload = super.encode()
        let obj = {
            g: this.groupId,
            o: this.operator,
            n: this.muteType + '',
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
        this.muteType = parseInt(obj.n)
        this.memberIds = obj.ms
    }
}