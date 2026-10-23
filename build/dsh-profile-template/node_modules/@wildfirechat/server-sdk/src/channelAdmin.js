import APIPath from './utils/apiPath.js';
import httpUtils from './utils/httpUtils.js';

/**
 * 频道管理类
 * 
 * 提供频道管理相关的功能，包括：
 * - 创建和销毁频道
 * - 获取频道信息
 * - 用户订阅/取消订阅频道
 * - 检查用户是否订阅频道
 */
class ChannelAdmin {
    /**
     * 创建频道
     * @param {object} channelInfo - 频道创建信息
     * @param {string} channelInfo.name - 频道名称
     * @param {string} channelInfo.owner - 频道所有者ID
     * @param {string} [channelInfo.portrait] - 频道头像
     * @param {string} [channelInfo.desc] - 频道描述
     * @param {string} [channelInfo.extra] - 额外信息
     * @param {number} [channelInfo.status] - 频道状态
     * @returns {Promise<IMResult>}
     */
    static async createChannel(channelInfo) {
        return httpUtils.httpJsonPost(APIPath.Create_Channel, channelInfo);
    }

    /**
     * 销毁频道
     * @param {string} channelId - 频道ID
     * @returns {Promise<IMResult>}
     */
    static async destroyChannel(channelId) {
        const input = {
            channelId: channelId
        };
        return httpUtils.httpJsonPost(APIPath.Destroy_Channel, input);
    }

    /**
     * 获取频道信息
     * @param {string} channelId - 频道ID
     * @returns {Promise<IMResult>}
     */
    static async getChannelInfo(channelId) {
        const input = {
            channelId: channelId
        };
        return httpUtils.httpJsonPost(APIPath.Get_Channel_Info, input);
    }

    /**
     * 订阅频道
     * @param {string} channelId - 频道ID
     * @param {string} userId - 用户ID
     * @returns {Promise<IMResult>}
     */
    static async subscribeChannel(channelId, userId) {
        const input = {
            channelId: channelId,
            userId: userId,
            subscribe: 1
        };
        return httpUtils.httpJsonPost(APIPath.Subscribe_Channel, input);
    }

    /**
     * 取消订阅频道
     * @param {string} channelId - 频道ID
     * @param {string} userId - 用户ID
     * @returns {Promise<IMResult>}
     */
    static async unsubscribeChannel(channelId, userId) {
        const input = {
            channelId: channelId,
            userId: userId,
            subscribe: 0
        };
        return httpUtils.httpJsonPost(APIPath.Subscribe_Channel, input);
    }

    /**
     * 检查用户是否订阅了频道
     * @param {string} userId - 用户ID
     * @param {string} channelId - 频道ID
     * @returns {Promise<IMResult>}
     */
    static async isUserSubscribedChannel(userId, channelId) {
        const input = {
            channelId: channelId,
            userId: userId,
            subscribe: 0
        };
        return httpUtils.httpJsonPost(APIPath.Check_User_Subscribe_Channel, input);
    }
}

export default ChannelAdmin;
