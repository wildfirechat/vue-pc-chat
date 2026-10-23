import APIPath from './utils/apiPath.js';
import httpUtils from './utils/httpUtils.js';

/**
 * 聊天室管理类
 * 
 * 提供聊天室管理相关的功能，包括：
 * - 创建和销毁聊天室
 * - 获取聊天室信息
 * - 聊天室成员管理
 * - 聊天室黑名单管理（仅专业版）
 * - 聊天室管理员设置
 * - 聊天室全员禁言
 */
class ChatroomAdmin {
    /**
     * 创建聊天室
     * @param {string} chatroomId - 聊天室ID（为空时自动生成）
     * @param {string} title - 聊天室标题
     * @param {string} [desc] - 聊天室描述
     * @param {string} [portrait] - 聊天室头像
     * @param {string} [extra] - 额外信息
     * @param {number} [state] - 聊天室状态
     * @returns {Promise<IMResult>}
     */
    static async createChatroom(chatroomId, title, desc = null, portrait = null, extra = null, state = null) {
        const input = {
            chatroomId: chatroomId,
            title: title,
            desc: desc,
            portrait: portrait,
            extra: extra,
            state: state
        };
        return httpUtils.httpJsonPost(APIPath.Create_Chatroom, input);
    }

    /**
     * 销毁聊天室
     * @param {string} chatroomId - 聊天室ID
     * @returns {Promise<IMResult>}
     */
    static async destroyChatroom(chatroomId) {
        const input = {
            chatroomId: chatroomId
        };
        return httpUtils.httpJsonPost(APIPath.Chatroom_Destroy, input);
    }

    /**
     * 获取聊天室信息
     * @param {string} chatroomId - 聊天室ID
     * @returns {Promise<IMResult>}
     */
    static async getChatroomInfo(chatroomId) {
        const input = {
            chatroomId: chatroomId
        };
        return httpUtils.httpJsonPost(APIPath.Chatroom_Info, input);
    }

    /**
     * 获取聊天室成员列表
     * @param {string} chatroomId - 聊天室ID
     * @returns {Promise<IMResult>}
     */
    static async getChatroomMembers(chatroomId) {
        const input = {
            chatroomId: chatroomId
        };
        return httpUtils.httpJsonPost(APIPath.Chatroom_GetMembers, input);
    }

    /**
     * 获取用户所在的聊天室
     * @param {string} userId - 用户ID
     * @returns {Promise<IMResult>}
     */
    static async getUserChatroom(userId) {
        const input = {
            userId: userId
        };
        return httpUtils.httpJsonPost(APIPath.Chatroom_GetUserChatroom, input);
    }

    /**
     * 设置聊天室黑名单状态（仅专业版支持）
     * @param {string} chatroomId - 聊天室ID
     * @param {string} userId - 用户ID
     * @param {number} status - 状态值：0-正常；1-禁言；2-禁止加入
     * @returns {Promise<IMResult>}
     */
    static async setChatroomBlacklist(chatroomId, userId, status) {
        const input = {
            chatroomId: chatroomId,
            userId: userId,
            status: status,
            type: 0
        };
        return httpUtils.httpJsonPost(APIPath.Chatroom_SetBlacklist, input);
    }

    /**
     * 获取聊天室黑名单
     * @param {string} chatroomId - 聊天室ID
     * @returns {Promise<IMResult>}
     */
    static async getChatroomBlacklist(chatroomId) {
        const input = {
            chatroomId: chatroomId
        };
        return httpUtils.httpJsonPost(APIPath.Chatroom_GetBlacklist, input);
    }

    /**
     * 设置聊天室管理员
     * @param {string} chatroomId - 聊天室ID
     * @param {string} userId - 用户ID
     * @param {number} status - 状态值：1-设置为管理员；0-取消管理员
     * @returns {Promise<IMResult>}
     */
    static async setChatroomManager(chatroomId, userId, status) {
        const input = {
            chatroomId: chatroomId,
            userId: userId,
            status: status
        };
        return httpUtils.httpJsonPost(APIPath.Chatroom_SetManager, input);
    }

    /**
     * 获取聊天室管理员列表
     * @param {string} chatroomId - 聊天室ID
     * @returns {Promise<IMResult>}
     */
    static async getChatroomManagerList(chatroomId) {
        const input = {
            chatroomId: chatroomId
        };
        return httpUtils.httpJsonPost(APIPath.Chatroom_GetManagerList, input);
    }

    /**
     * 设置聊天室全员禁言
     * @param {string} chatroomId - 聊天室ID
     * @param {boolean} mute - true-全员禁言，false-取消全员禁言
     * @returns {Promise<IMResult>}
     */
    static async setChatroomMute(chatroomId, mute) {
        const input = {
            chatroomId: chatroomId,
            mute: mute ? 1 : 0
        };
        return httpUtils.httpJsonPost(APIPath.Chatroom_MuteAll, input);
    }
}

export default ChatroomAdmin;
