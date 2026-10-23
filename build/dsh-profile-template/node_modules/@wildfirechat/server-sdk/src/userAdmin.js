import APIPath from './utils/apiPath.js';
import httpUtils from './utils/httpUtils.js';

/**
 * 用户管理类
 * 
 * 提供用户管理相关的功能，包括：
 * - 用户信息的获取、创建、更新、销毁
 * - 机器人管理
 * - 用户封禁状态管理
 * - 用户在线状态查询
 * - 用户设备管理
 * - 用户Token管理
 */
class UserAdmin {
    /**
     * 根据用户名获取用户信息（不包含已删除用户）
     * @param {string} name - 用户名
     * @returns {Promise<IMResult>}
     */
    static async getUserByName(name) {
        return this.getUserByNameWithDeleted(name, false);
    }

    /**
     * 根据用户名获取用户信息
     * @param {string} name - 用户名
     * @param {boolean} includeDeleted - 是否包含已删除的用户
     * @returns {Promise<IMResult>}
     */
    static async getUserByNameWithDeleted(name, includeDeleted) {
        const getUserInfo = {
            name: name,
            includeDeleted: includeDeleted
        };
        return httpUtils.httpJsonPost(APIPath.User_Get_Info, getUserInfo);
    }

    /**
     * 根据用户ID获取用户信息（不包含已删除用户）
     * @param {string} userId - 用户ID
     * @returns {Promise<IMResult>}
     */
    static async getUserByUserId(userId) {
        return this.getUserByUserIdWithDeleted(userId, false);
    }

    /**
     * 根据用户ID获取用户信息
     * @param {string} userId - 用户ID
     * @param {boolean} includeDeleted - 是否包含已删除的用户
     * @returns {Promise<IMResult>}
     */
    static async getUserByUserIdWithDeleted(userId, includeDeleted) {
        const getUserInfo = {
            userId: userId,
            includeDeleted: includeDeleted
        };
        return httpUtils.httpJsonPost(APIPath.User_Get_Info, getUserInfo);
    }

    /**
     * 根据手机号获取用户信息（不包含已删除用户）
     * @param {string} mobile - 手机号
     * @returns {Promise<IMResult>}
     */
    static async getUserByMobile(mobile) {
        return this.getUserByMobileWithDeleted(mobile, false);
    }

    /**
     * 根据手机号获取用户信息
     * @param {string} mobile - 手机号
     * @param {boolean} includeDeleted - 是否包含已删除的用户
     * @returns {Promise<IMResult>}
     */
    static async getUserByMobileWithDeleted(mobile, includeDeleted) {
        const getUserInfo = {
            mobile: mobile,
            includeDeleted: includeDeleted
        };
        return httpUtils.httpJsonPost(APIPath.User_Get_Info, getUserInfo);
    }

    /**
     * 根据邮箱获取用户信息列表
     * @param {string} email - 邮箱地址
     * @returns {Promise<IMResult>}
     */
    static async getUserByEmail(email) {
        return httpUtils.httpJsonPost(APIPath.User_Get_Email_Info, email);
    }

    /**
     * 获取所有用户列表（分页）
     * @param {number} count - 每页数量
     * @param {number} offset - 偏移量
     * @returns {Promise<IMResult>}
     */
    static async getAllUsers(count, offset) {
        const input = {
            count: count,
            offset: offset
        };
        return httpUtils.httpJsonPost(APIPath.User_Get_All, input);
    }

    /**
     * 批量获取用户信息
     * @param {string[]} userIds - 用户ID列表
     * @returns {Promise<IMResult>}
     */
    static async getBatchUsers(userIds) {
        const input = {
            list: userIds
        };
        return httpUtils.httpJsonPost(APIPath.User_Batch_Get_Infos, input);
    }

    /**
     * 创建用户
     * @param {object} user - 用户信息
     * @param {string} user.userId - 用户ID
     * @param {string} user.name - 用户名
     * @param {string} user.displayName - 显示名称
     * @param {string} [user.password] - 密码
     * @param {string} [user.portrait] - 头像
     * @param {number} [user.gender] - 性别
     * @param {string} [user.mobile] - 手机号
     * @param {string} [user.email] - 邮箱
     * @param {string} [user.address] - 地址
     * @param {string} [user.company] - 公司
     * @param {string} [user.social] - 社交信息
     * @param {string} [user.extra] - 额外信息
     * @returns {Promise<IMResult>}
     */
    static async createUser(user) {
        return httpUtils.httpJsonPost(APIPath.Create_User, user);
    }

    /**
     * 更新用户信息
     * @param {object} user - 用户信息
     * @param {number} flag - 更新标志位
     * @returns {Promise<IMResult>}
     */
    static async updateUserInfo(user, flag) {
        const updateUserInfo = {
            flag: flag,
            userInfo: user
        };
        return httpUtils.httpJsonPost(APIPath.Update_User, updateUserInfo);
    }

    /**
     * 创建机器人
     * @param {object} robot - 机器人信息
     * @param {string} robot.userId - 机器人用户ID
     * @param {string} robot.name - 机器人名称
     * @param {string} robot.displayName - 显示名称
     * @param {string} [robot.portrait] - 头像
     * @param {string} [robot.callback] - 回调地址
     * @param {string} [robot.extra] - 额外信息
     * @returns {Promise<IMResult>}
     */
    static async createRobot(robot) {
        return httpUtils.httpJsonPost(APIPath.Create_Robot, robot);
    }

    /**
     * 销毁机器人
     * @param {string} userId - 机器人用户ID
     * @returns {Promise<IMResult>}
     */
    static async destroyRobot(userId) {
        const input = {
            userId: userId
        };
        return httpUtils.httpJsonPost(APIPath.Destroy_User, input);
    }

    /**
     * 获取机器人信息
     * @param {string} robotId - 机器人ID
     * @returns {Promise<IMResult>}
     */
    static async getRobotInfo(robotId) {
        const input = {
            robotId: robotId
        };
        return httpUtils.httpJsonPost(APIPath.User_Get_Robot_Info, input);
    }

    /**
     * 获取用户的机器人列表
     * @param {string} userId - 用户ID
     * @returns {Promise<IMResult>}
     */
    static async getUserRobots(userId) {
        const input = {
            userId: userId
        };
        return httpUtils.httpJsonPost(APIPath.User_Get_User_Robots, input);
    }

    /**
     * 获取用户的IM Token
     * @param {string} userId - 用户ID
     * @param {string} clientId - 客户端ID
     * @param {number} platform - 平台类型
     * @returns {Promise<IMResult>}
     */
    static async getUserToken(userId, clientId, platform) {
        const getToken = {
            userId: userId,
            clientId: clientId,
            platform: platform
        };
        return httpUtils.httpJsonPost(APIPath.User_Get_Token, getToken);
    }

    /**
     * 更新用户封禁状态
     * @param {string} userId - 用户ID
     * @param {number} block - 封禁状态：0-正常，1-封禁
     * @returns {Promise<IMResult>}
     */
    static async updateUserBlockStatus(userId, block) {
        const blockStatus = {
            userId: userId,
            block: block
        };
        return httpUtils.httpJsonPost(APIPath.User_Update_Block_Status, blockStatus);
    }

    /**
     * 检查用户封禁状态
     * @param {string} userId - 用户ID
     * @returns {Promise<IMResult>}
     */
    static async checkUserBlockStatus(userId) {
        const getUserInfo = {
            userId: userId
        };
        return httpUtils.httpJsonPost(APIPath.User_Check_Block_Status, getUserInfo);
    }

    /**
     * 获取被封禁用户列表
     * @returns {Promise<IMResult>}
     */
    static async getBlockedList() {
        return httpUtils.httpJsonPost(APIPath.User_Get_Blocked_List, null);
    }

    /**
     * 检查用户在线状态
     * @param {string} userId - 用户ID
     * @returns {Promise<IMResult>}
     */
    static async checkUserOnlineStatus(userId) {
        const getUserInfo = {
            userId: userId
        };
        return httpUtils.httpJsonPost(APIPath.User_Get_Online_Status, getUserInfo);
    }

    /**
     * 强迫用户下线
     * @param {string} userId - 用户ID
     * @param {string} [clientId] - 客户端ID，为空时踢下线所有客户端
     * @returns {Promise<IMResult>}
     */
    static async kickoffUserClient(userId, clientId) {
        const pojo = {
            first: userId,
            second: clientId
        };
        return httpUtils.httpJsonPost(APIPath.User_Kickoff_Client, pojo);
    }

    /**
     * 销毁用户
     * @param {string} userId - 用户ID
     * @returns {Promise<IMResult>}
     */
    static async destroyUser(userId) {
        const input = {
            userId: userId
        };
        return httpUtils.httpJsonPost(APIPath.Destroy_User, input);
    }

    /**
     * 创建或更新设备信息（仅专业版支持）
     * @param {object} device - 设备信息
     * @returns {Promise<IMResult>}
     */
    static async createOrUpdateDevice(device) {
        return httpUtils.httpJsonPost(APIPath.CreateOrUpdate_Device, device);
    }

    /**
     * 获取设备信息（仅专业版支持）
     * @param {string} deviceId - 设备ID
     * @returns {Promise<IMResult>}
     */
    static async getDevice(deviceId) {
        const input = {
            deviceId: deviceId
        };
        return httpUtils.httpJsonPost(APIPath.Get_Device, input);
    }

    /**
     * 获取用户的设备列表
     * @param {string} userId - 用户ID
     * @returns {Promise<IMResult>}
     */
    static async getUserDevices(userId) {
        const input = {
            userId: userId
        };
        return httpUtils.httpJsonPost(APIPath.Get_User_Devices, input);
    }

    /**
     * 获取在线用户数量
     * @returns {Promise<IMResult>}
     */
    static async getOnlineUserCount() {
        return httpUtils.httpJsonPost(APIPath.User_Online_Count, null);
    }

    /**
     * 获取在线用户列表（分页）
     * @param {number} nodeId - 节点ID，用于分布式部署场景
     * @param {number} offset - 偏移量
     * @param {number} count - 每页数量
     * @returns {Promise<IMResult>}
     */
    static async getOnlineUser(nodeId, offset, count) {
        const request = {
            nodeId: nodeId,
            offset: offset,
            count: count
        };
        return httpUtils.httpJsonPost(APIPath.User_Online_List, request);
    }

    /**
     * 通过应用授权码获取用户信息
     * @param {string} authCode - 应用授权码
     * @returns {Promise<IMResult>}
     */
    static async applicationGetUserInfo(authCode) {
        const input = {
            authCode: authCode
        };
        return httpUtils.httpJsonPost(APIPath.User_Application_Get_UserInfo, input);
    }

    /**
     * 获取用户会话信息
     * @param {string} userId - 用户ID
     * @returns {Promise<IMResult>}
     */
    static async getUserSession(userId) {
        const input = {
            userId: userId
        };
        return httpUtils.httpJsonPost(APIPath.User_Session_List, input);
    }
}

export default UserAdmin;
