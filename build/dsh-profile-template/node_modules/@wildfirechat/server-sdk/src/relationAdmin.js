import APIPath from './utils/apiPath.js';
import httpUtils from './utils/httpUtils.js';

/**
 * 好友关系管理类
 * 
 * 提供好友关系管理相关的功能，包括：
 * - 设置和获取好友关系
 * - 黑名单管理
 * - 好友别名和额外信息管理
 * - 好友请求发送
 * - 关系查询
 */
class RelationAdmin {
    /**
     * 设置用户好友关系
     * @param {string} userId - 用户ID
     * @param {string} targetId - 目标用户ID
     * @param {boolean} isFriend - true-设置为好友，false-删除好友
     * @param {string} [extra] - 额外信息
     * @returns {Promise<IMResult>}
     */
    static async setUserFriend(userId, targetId, isFriend, extra = null) {
        const input = {
            userId: userId,
            friendUid: targetId,
            status: isFriend ? 0 : 1, // 历史遗留问题，在IM数据库中0是好友，1是好友被删除。
            extra: extra
        };
        return httpUtils.httpJsonPost(APIPath.Friend_Update_Status, input);
    }

    /**
     * 获取好友列表
     * @param {string} userId - 用户ID
     * @returns {Promise<IMResult>}
     */
    static async getFriendList(userId) {
        const input = {
            userId: userId
        };
        return httpUtils.httpJsonPost(APIPath.Friend_Get_List, input);
    }

    /**
     * 设置黑名单
     * @param {string} userId - 用户ID
     * @param {string} targetId - 目标用户ID
     * @param {boolean} isBlacklist - true-加入黑名单，false-移出黑名单
     * @returns {Promise<IMResult>}
     */
    static async setUserBlacklist(userId, targetId, isBlacklist) {
        const input = {
            userId: userId,
            targetUid: targetId,
            status: isBlacklist ? 2 : 1
        };
        return httpUtils.httpJsonPost(APIPath.Blacklist_Update_Status, input);
    }

    /**
     * 获取用户黑名单
     * @param {string} userId - 用户ID
     * @returns {Promise<IMResult>}
     */
    static async getUserBlacklist(userId) {
        const input = {
            userId: userId
        };
        return httpUtils.httpJsonPost(APIPath.Blacklist_Get_List, input);
    }

    /**
     * 更新好友别名
     * @param {string} operator - 操作者用户ID
     * @param {string} targetId - 目标用户ID
     * @param {string} alias - 别名
     * @returns {Promise<IMResult>}
     */
    static async updateFriendAlias(operator, targetId, alias) {
        const input = {
            operator: operator,
            targetId: targetId,
            alias: alias
        };
        return httpUtils.httpJsonPost(APIPath.Friend_Set_Alias, input);
    }

    /**
     * 获取好友别名
     * @param {string} operator - 操作者用户ID
     * @param {string} targetId - 目标用户ID
     * @returns {Promise<IMResult>}
     */
    static async getFriendAlias(operator, targetId) {
        const input = {
            operator: operator,
            targetId: targetId
        };
        return httpUtils.httpJsonPost(APIPath.Friend_Get_Alias, input);
    }

    /**
     * 更新好友额外信息
     * @param {string} operator - 操作者用户ID
     * @param {string} targetId - 目标用户ID
     * @param {string} extra - 额外信息
     * @returns {Promise<IMResult>}
     */
    static async updateFriendExtra(operator, targetId, extra) {
        const input = {
            operator: operator,
            targetId: targetId,
            extra: extra
        };
        return httpUtils.httpJsonPost(APIPath.Friend_Set_Extra, input);
    }

    /**
     * 发送好友请求
     * @param {string} userId - 用户ID
     * @param {string} targetId - 目标用户ID
     * @param {string} [reason] - 申请理由
     * @param {boolean} [force=false] - 是否强制添加（直接成为好友无需对方同意）
     * @returns {Promise<IMResult>}
     */
    static async sendFriendRequest(userId, targetId, reason = '', force = false) {
        const input = {
            userId: userId,
            friendUid: targetId,
            reason: reason,
            force: force
        };
        return httpUtils.httpJsonPost(APIPath.Friend_Send_Request, input);
    }

    /**
     * 获取两个用户之间的关系
     * @param {string} userId - 用户1的ID
     * @param {string} targetId - 用户2的ID
     * @returns {Promise<IMResult>}
     */
    static async getRelation(userId, targetId) {
        const input = {
            first: userId,
            second: targetId
        };
        return httpUtils.httpJsonPost(APIPath.Relation_Get, input);
    }
}

export default RelationAdmin;
