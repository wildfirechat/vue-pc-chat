import APIPath from './utils/apiPath.js';
import httpUtils from './utils/httpUtils.js';

/**
 * 敏感词管理类
 * 
 * 提供敏感词管理相关的功能，包括：
 * - 添加敏感词
 * - 删除敏感词
 * - 查询敏感词列表
 */
class SensitiveAdmin {
    /**
     * 添加敏感词
     * @param {string[]} sensitives - 敏感词列表
     * @returns {Promise<IMResult>}
     */
    static async addSensitives(sensitives) {
        const input = {
            words: sensitives
        };
        return httpUtils.httpJsonPost(APIPath.Sensitive_Add, input);
    }

    /**
     * 删除敏感词
     * @param {string[]} sensitives - 敏感词列表
     * @returns {Promise<IMResult>}
     */
    static async removeSensitives(sensitives) {
        const input = {
            words: sensitives
        };
        return httpUtils.httpJsonPost(APIPath.Sensitive_Del, input);
    }

    /**
     * 获取敏感词列表
     * @returns {Promise<IMResult>}
     */
    static async getSensitives() {
        return httpUtils.httpJsonPost(APIPath.Sensitive_Query, null);
    }
}

export default SensitiveAdmin;
