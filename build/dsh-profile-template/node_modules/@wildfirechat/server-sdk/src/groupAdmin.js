import APIPath from './utils/apiPath.js';
import httpUtils from './utils/httpUtils.js';

/**
 * 群组管理类
 * 
 * 提供群组管理相关的功能，包括：
 * - 群组的创建、解散、转移
 * - 群组信息修改
 * - 群组成员管理（添加、移除、踢出）
 * - 群组管理员设置
 * - 群组成员禁言
 * - 用户群组查询
 */
class GroupAdmin {
    /**
     * 创建群组
     * @param {string} operator - 操作者用户ID
     * @param {object} groupInfo - 群组信息 {target_id, name, portrait, owner, type, extra, ...}
     * @param {object[]} [members] - 群组成员列表 [{member_id, alias, type, extra}, ...]
     * @param {string} [memberExtra] - 成员额外信息
     * @param {number[]} [toLines] - 消息同步到的线路列表
     * @param {object} [notifyMessage] - 通知消息
     * @returns {Promise<IMResult>}
     */
    static async createGroup(operator, groupInfo, members = [], memberExtra = null, toLines = null, notifyMessage = null) {
        const pojoGroup = {
            group_info: groupInfo,
            members: members
        };
        const createGroup = {
            group: pojoGroup,
            operator: operator,
            member_extra: memberExtra,
            to_lines: toLines,
            notify_message: notifyMessage
        };

        return httpUtils.httpJsonPost(APIPath.Create_Group, createGroup);
    }

    /**
     * 获取群组信息
     * @param {string} groupId - 群组ID
     * @returns {Promise<IMResult>}
     */
    static async getGroupInfo(groupId) {
        const input = {
            groupId: groupId
        };
        return httpUtils.httpJsonPost(APIPath.Group_Get_Info, input);
    }

    /**
     * 批量获取群组信息
     * @param {string[]} groupIds - 群组ID列表
     * @returns {Promise<IMResult>}
     */
    static async batchGroupInfos(groupIds) {
        return httpUtils.httpJsonPost(APIPath.Group_Batch_Info, groupIds);
    }

    /**
     * 解散群组
     * @param {string} operator - 操作者用户ID
     * @param {string} groupId - 群组ID
     * @param {number[]} [toLines] - 消息同步到的线路列表
     * @param {object} [notifyMessage] - 通知消息
     * @returns {Promise<IMResult>}
     */
    static async dismissGroup(operator, groupId, toLines = null, notifyMessage = null) {
        const dismissGroup = {
            operator: operator,
            group_id: groupId,
            to_lines: toLines,
            notify_message: notifyMessage
        };
        return httpUtils.httpJsonPost(APIPath.Group_Dismiss, dismissGroup);
    }

    /**
     * 转让群组
     * @param {string} operator - 操作者用户ID
     * @param {string} groupId - 群组ID
     * @param {string} newOwner - 新群主用户ID
     * @param {number[]} [toLines] - 消息同步到的线路列表
     * @param {object} [notifyMessage] - 通知消息
     * @returns {Promise<IMResult>}
     */
    static async transferGroup(operator, groupId, newOwner, toLines = null, notifyMessage = null) {
        const transferGroup = {
            group_id: groupId,
            new_owner: newOwner,
            operator: operator,
            to_lines: toLines,
            notify_message: notifyMessage
        };
        return httpUtils.httpJsonPost(APIPath.Group_Transfer, transferGroup);
    }

    /**
     * 修改群组信息
     * @param {string} operator - 操作者用户ID
     * @param {string} groupId - 群组ID
     * @param {number} type - 修改信息类型（ModifyGroupInfoType）
     * @param {string} value - 新值
     * @param {number[]} [toLines] - 消息同步到的线路列表
     * @param {object} [notifyMessage] - 通知消息
     * @returns {Promise<IMResult>}
     */
    static async modifyGroupInfo(operator, groupId, type, value, toLines = null, notifyMessage = null) {
        const modifyGroupInfo = {
            group_id: groupId,
            operator: operator,
            to_lines: toLines,
            type: type,
            value: value,
            notify_message: notifyMessage
        };
        return httpUtils.httpJsonPost(APIPath.Group_Modify_Info, modifyGroupInfo);
    }

    /**
     * 获取群组成员列表
     * @param {string} groupId - 群组ID
     * @returns {Promise<IMResult>}
     */
    static async getGroupMembers(groupId) {
        const input = {
            groupId: groupId
        };
        return httpUtils.httpJsonPost(APIPath.Group_Member_List, input);
    }

    /**
     * 获取群组成员信息
     * @param {string} groupId - 群组ID
     * @param {string} memberId - 成员用户ID
     * @returns {Promise<IMResult>}
     */
    static async getGroupMember(groupId, memberId) {
        const input = {
            groupId: groupId,
            memberId: memberId
        };
        return httpUtils.httpJsonPost(APIPath.Group_Member_Get, input);
    }

    /**
     * 添加群组成员
     * @param {string} operator - 操作者用户ID
     * @param {string} groupId - 群组ID
     * @param {object[]} groupMembers - 要添加的成员列表 [{member_id, alias, type, extra}, ...]
     * @param {string} [memberExtra] - 成员额外信息
     * @param {number[]} [toLines] - 消息同步到的线路列表
     * @param {object} [notifyMessage] - 通知消息
     * @returns {Promise<IMResult>}
     */
    static async addGroupMembers(operator, groupId, groupMembers, memberExtra = null, toLines = null, notifyMessage = null) {
        const addGroupMember = {
            group_id: groupId,
            members: groupMembers,
            operator: operator,
            memberExtra: memberExtra,
            to_lines: toLines,
            notify_message: notifyMessage
        };
        return httpUtils.httpJsonPost(APIPath.Group_Member_Add, addGroupMember);
    }

    /**
     * 设置或取消群组管理员
     * @param {string} operator - 操作者用户ID
     * @param {string} groupId - 群组ID
     * @param {string[]} groupMemberIds - 成员用户ID列表
     * @param {boolean} isManager - true-设置为管理员，false-取消管理员
     * @param {number[]} [toLines] - 消息同步到的线路列表
     * @param {object} [notifyMessage] - 通知消息
     * @returns {Promise<IMResult>}
     */
    static async setGroupManager(operator, groupId, groupMemberIds, isManager, toLines = null, notifyMessage = null) {
        const addGroupMember = {
            group_id: groupId,
            members: groupMemberIds,
            is_manager: isManager,
            operator: operator,
            to_lines: toLines,
            notify_message: notifyMessage
        };
        return httpUtils.httpJsonPost(APIPath.Group_Set_Manager, addGroupMember);
    }

    /**
     * 禁言或解禁群组成员
     * @param {string} operator - 操作者用户ID
     * @param {string} groupId - 群组ID
     * @param {string[]} groupMemberIds - 成员用户ID列表
     * @param {boolean} isMute - true-禁言，false-解禁
     * @param {number[]} [toLines] - 消息同步到的线路列表
     * @param {object} [notifyMessage] - 通知消息
     * @returns {Promise<IMResult>}
     */
    static async muteGroupMember(operator, groupId, groupMemberIds, isMute, toLines = null, notifyMessage = null) {
        const addGroupMember = {
            group_id: groupId,
            members: groupMemberIds,
            is_manager: isMute,
            operator: operator,
            to_lines: toLines,
            notify_message: notifyMessage
        };
        return httpUtils.httpJsonPost(APIPath.Group_Mute_Member, addGroupMember);
    }

    /**
     * 允许或禁止群组成员发言
     * @param {string} operator - 操作者用户ID
     * @param {string} groupId - 群组ID
     * @param {string[]} groupMemberIds - 成员用户ID列表
     * @param {boolean} isAllow - true-允许，false-禁止
     * @param {number[]} [toLines] - 消息同步到的线路列表
     * @param {object} [notifyMessage] - 通知消息
     * @returns {Promise<IMResult>}
     */
    static async allowGroupMember(operator, groupId, groupMemberIds, isAllow, toLines = null, notifyMessage = null) {
        const addGroupMember = {
            group_id: groupId,
            members: groupMemberIds,
            is_manager: isAllow,
            operator: operator,
            to_lines: toLines,
            notify_message: notifyMessage
        };
        return httpUtils.httpJsonPost(APIPath.Group_Allow_Member, addGroupMember);
    }

    /**
     * 踢出群组成员
     * @param {string} operator - 操作者用户ID
     * @param {string} groupId - 群组ID
     * @param {string[]} groupMemberIds - 要踢出的成员用户ID列表
     * @param {number[]} [toLines] - 消息同步到的线路列表
     * @param {object} [notifyMessage] - 通知消息
     * @returns {Promise<IMResult>}
     */
    static async kickoffGroupMembers(operator, groupId, groupMemberIds, toLines = null, notifyMessage = null) {
        const kickoffGroupMember = {
            group_id: groupId,
            members: groupMemberIds,
            operator: operator,
            to_lines: toLines,
            notify_message: notifyMessage
        };
        return httpUtils.httpJsonPost(APIPath.Group_Member_Kickoff, kickoffGroupMember);
    }

    /**
     * 退出群组
     * @param {string} operator - 操作者用户ID
     * @param {string} groupId - 群组ID
     * @param {number[]} [toLines] - 消息同步到的线路列表
     * @param {object} [notifyMessage] - 通知消息
     * @returns {Promise<IMResult>}
     */
    static async quitGroup(operator, groupId, toLines = null, notifyMessage = null) {
        const quitGroup = {
            group_id: groupId,
            operator: operator,
            to_lines: toLines,
            notify_message: notifyMessage
        };
        return httpUtils.httpJsonPost(APIPath.Group_Member_Quit, quitGroup);
    }

    /**
     * 设置群组成员别名
     * @param {string} operator - 操作者用户ID
     * @param {string} groupId - 群组ID
     * @param {string} memberId - 成员用户ID
     * @param {string} alias - 别名
     * @param {number[]} [toLines] - 消息同步到的线路列表
     * @param {object} [notifyMessage] - 通知消息
     * @returns {Promise<IMResult>}
     */
    static async setGroupMemberAlias(operator, groupId, memberId, alias, toLines = null, notifyMessage = null) {
        const input = {
            group_id: groupId,
            operator: operator,
            memberId: memberId,
            alias: alias,
            to_lines: toLines,
            notify_message: notifyMessage
        };
        return httpUtils.httpJsonPost(APIPath.Group_Set_Member_Alias, input);
    }

    /**
     * 设置群组成员额外信息
     * @param {string} operator - 操作者用户ID
     * @param {string} groupId - 群组ID
     * @param {string} memberId - 成员用户ID
     * @param {string} extra - 额外信息
     * @param {number[]} [toLines] - 消息同步到的线路列表
     * @param {object} [notifyMessage] - 通知消息
     * @returns {Promise<IMResult>}
     */
    static async setGroupMemberExtra(operator, groupId, memberId, extra, toLines = null, notifyMessage = null) {
        const input = {
            group_id: groupId,
            operator: operator,
            memberId: memberId,
            extra: extra,
            to_lines: toLines,
            notify_message: notifyMessage
        };
        return httpUtils.httpJsonPost(APIPath.Group_Set_Member_Extra, input);
    }

    /**
     * 获取用户的群组列表
     * @param {string} userId - 用户ID
     * @returns {Promise<IMResult>}
     */
    static async getUserGroups(userId) {
        const input = {
            userId: userId
        };
        return httpUtils.httpJsonPost(APIPath.Get_User_Groups, input);
    }

    /**
     * 根据成员类型获取用户的群组列表
     * @param {string} userId - 用户ID
     * @param {number[]} groupMemberType - 群组成员类型列表（GroupMemberType）
     * @returns {Promise<IMResult>}
     */
    static async getUserGroupsByType(userId, groupMemberType) {
        const input = {
            user: userId,
            types: groupMemberType
        };
        return httpUtils.httpJsonPost(APIPath.Get_User_Groups_By_Type, input);
    }

    /**
     * 获取两个用户的共同群组
     * @param {string} user1 - 用户1的ID
     * @param {string} user2 - 用户2的ID
     * @returns {Promise<IMResult>}
     */
    static async getCommonGroups(user1, user2) {
        const input = {
            first: user1,
            second: user2
        };
        return httpUtils.httpJsonPost(APIPath.Get_Common_Groups, input);
    }
}

export default GroupAdmin;
