import APIPath from './utils/apiPath.js';
import httpUtils from './utils/httpUtils.js';

/**
 * 朋友圈管理类
 * 
 * 提供朋友圈（动态）管理相关的功能。
 */
class MomentsAdmin {
    /**
     * 发布朋友圈动态
     * @param {object} feedPojo - 动态内容
     * @param {number} feedPojo.type - 动态类型
     * @param {string} feedPojo.text - 文本内容
     * @param {object[]} [feedPojo.medias] - 媒体列表
     * @param {string[]} [feedPojo.to] - 可见用户列表
     * @param {string[]} [feedPojo.ex] - 排除用户列表
     * @param {string[]} [feedPojo.mu] - @用户列表
     * @param {string} [feedPojo.extra] - 额外信息
     * @returns {Promise<IMResult>}
     */
    static async postFeeds(feedPojo) {
        return httpUtils.httpJsonPost(APIPath.Admin_Moments_Post_Feed, feedPojo);
    }
}

export default MomentsAdmin;
