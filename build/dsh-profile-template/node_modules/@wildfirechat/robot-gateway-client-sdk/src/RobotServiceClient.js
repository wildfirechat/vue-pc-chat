import { ConnectionManager } from './ConnectionManager.js';
import { IMResult } from '@wildfirechat/server-sdk';

/**
 * RobotService 客户端
 * 提供与 Java 版 RobotServiceClient 完全相同的 API
 * 
 * 注意：使用 @../server-sdk.js 中的模型类（Conversation, MessagePayload 等）
 */
export class RobotServiceClient {
    /**
     * 创建客户端实例
     * @param {string} gatewayUrl - 网关地址，如 'ws://localhost:8884/robot/gateway'
     * @param {MessageHandler} messageHandler - 消息处理器
     * @param {Object} options - 配置选项
     * @param {number} options.timeout - 请求超时时间（秒），默认 30
     * @param {number} options.reconnectInterval - 重连间隔（毫秒），默认 5000
     * @param {number} options.heartbeatInterval - 心跳间隔（毫秒），默认 270000
     */
    constructor(gatewayUrl, messageHandler = null, options = {}) {
        this.gatewayUrl = gatewayUrl;
        this.messageHandler = messageHandler;
        this.options = options;
        
        this.connectionManager = new ConnectionManager(gatewayUrl, messageHandler, options);
    }

    /**
     * 连接并鉴权
     * @param {string} robotId - 机器人ID
     * @param {string} robotSecret - 机器人密钥
     * @param {number} timeoutSeconds - 超时时间（秒）
     * @returns {Promise<boolean>} - 是否成功
     */
    async connect(robotId, robotSecret, timeoutSeconds = 30) {
        return this.connectionManager.connect(robotId, robotSecret, timeoutSeconds);
    }

    /**
     * 断开连接
     */
    close() {
        this.connectionManager.disconnect();
    }

    /**
     * 是否已连接
     */
    isConnected() {
        return this.connectionManager.isConnected();
    }

    /**
     * 是否已鉴权
     */
    isAuthenticated() {
        return this.connectionManager.isAuthenticated();
    }

    /**
     * 获取机器人ID
     * @returns {string} - 机器人ID
     */
    getRobotId() {
        return this.connectionManager.robotId;
    }

    /**
     * 发送请求并包装为 IMResult
     * @param {string} method - 方法名
     * @param {Array} params - 参数数组
     * @returns {Promise<IMResult>} - IMResult 对象
     */
    async invoke(method, params = []) {
        const client = this.connectionManager.getClient();
        if (!client) {
            return new IMResult(-1, 'Not connected', null);
        }

        try {
            const responseMessage = await client.sendRequest(method, params);
            if(responseMessage.isSuccess()){
                const response = responseMessage.result;
                return new IMResult(response.code, response.msg, response.result);
            } else {
                return new IMResult(responseMessage.code, responseMessage.msg, null);
            }
        } catch (error) {
            return new IMResult(-1, error.message, null);
        }
    }

    // ==================== 消息相关 API ====================

    /**
     * 获取单条消息（只能获取机器人参与会话中的消息）。
     * 对应 Java RobotService.getMessage(long messageUid)。
     *
     * 注意：messageUid 是超大的 long（可能超过 2^53），JS number 无法精确保存，
     * 必须传字符串（string），内部以字符串原样透传给网关（网关按 JSON 字符串解析为
     * long）；传 number 会直接返回错误，避免静默丢精度。
     * @param {string} messageUid - 消息 uid（超长 long，必须传字符串）
     * @returns {Promise<IMResult>} - result 为消息数据（含 searchableContent 等）
     */
    async getMessage(messageUid) {
        if (typeof messageUid !== 'string') {
            return new IMResult(-1, 'messageUid 是超长 long，必须传字符串（JS number 会丢失精度）', null);
        }
        return this.invoke('getMessage', [messageUid]);
    }

    /**
     * 发送消息
     * @param {Conversation} conversation - 会话对象
     * @param {MessagePayload} payload - 消息内容
     * @returns {Promise<IMResult>}
     */
    async sendMessage(conversation, payload) {
        return this.invoke('sendMessage', [this.getRobotId(), conversation, payload]);
    }

    /**
     * 发送消息（指定接收者）
     * @param {Conversation} conversation - 会话对象
     * @param {MessagePayload} payload - 消息内容
     * @param {Array<string>} toUsers - 指定接收者用户ID列表
     * @returns {Promise<IMResult>}
     */
    async sendMessageToUsers(conversation, payload, toUsers) {
        return this.invoke('sendMessage', [this.getRobotId(), conversation, payload, toUsers]);
    }

    /**
     * 回复消息
     * @param {number} messageId - 原消息ID
     * @param {MessagePayload} payload - 回复内容
     * @param {boolean} mentionSender - 是否@原消息发送者
     * @returns {Promise<IMResult>}
     */
    async replyMessage(messageId, payload, mentionSender) {
        return this.invoke('replyMessage', [messageId, payload, mentionSender]);
    }

    /**
     * 撤回消息
     * @param {number} messageId - 消息ID
     * @returns {Promise<IMResult>}
     */
    async recallMessage(messageId) {
        return this.invoke('recallMessage', [messageId]);
    }

    /**
     * 更新消息
     * @param {number} messageId - 消息ID
     * @param {MessagePayload} payload - 新消息内容
     * @returns {Promise<IMResult>}
     */
    async updateMessage(messageId, payload) {
        return this.invoke('updateMessage', [messageId, payload]);
    }

    /**
     * 设置会话级用户设置（scope=31），会话内所有用户（机器人除外）都会收到
     * key 为 convType-line-target_type 的用户设置变更（服务端 im 新接口）。
     * @param {object} conversation 会话 {type, target, line}；私聊 target 为对方用户 uid，群聊 target 为 groupId
     * @param {number} type 设置类型（业务约定：1=状态, 2=权限, 3=模型, 4=推理等级等）
     * @param {string} value 设置值（JSON 字符串）
     * @returns {Promise<IMResult>}
     */
    async updateConversationUserSetting(conversation, type, value) {
        return this.invoke('updateConversationUserSetting', [conversation, type, value]);
    }

    // ==================== 用户相关 API ====================

    /**
     * 获取用户信息
     * @param {string} userId - 用户ID
     * @returns {Promise<IMResult>}
     */
    async getUserInfo(userId) {
        return this.invoke('getUserInfo', [userId]);
    }

    /**
     * 通过手机号获取用户
     * @param {string} mobile - 手机号
     * @returns {Promise<IMResult>}
     */
    async getUserInfoByMobile(mobile) {
        return this.invoke('getUserInfoByMobile', [mobile]);
    }

    /**
     * 通过用户名获取用户
     * @param {string} name - 用户名
     * @returns {Promise<IMResult>}
     */
    async getUserInfoByName(name) {
        return this.invoke('getUserInfoByName', [name]);
    }

    /**
     * 通过邮箱获取用户信息
     * @param {string} email - 邮箱地址
     * @returns {Promise<IMResult>}
     */
    async getUserInfoByEmail(email) {
        return this.invoke('getUserInfoByEmail', [email]);
    }

    /**
     * 批量获取用户信息
     * @param {Array} userIds - 用户ID列表
     * @returns {Promise<IMResult>}
     */
    async getBatchUsers(userIds) {
        return this.invoke('getBatchUsers', [userIds]);
    }

    /**
     * 应用获取用户信息
     * @param {string} userId - 用户ID
     * @returns {Promise<IMResult>}
     */
    async applicationGetUserInfo(userId) {
        return this.invoke('applicationGetUserInfo', [userId]);
    }

    // ==================== 好友/搜索/机器人列表 API ====================

    /**
     * 获取机器人 owner 的好友列表
     * @returns {Promise<IMResult>}
     */
    async getOwnerFriendList() {
        return this.invoke('getOwnerFriendList', []);
    }

    /**
     * 根据昵称搜索用户
     * @param {string} keyword - 搜索关键词
     * @returns {Promise<IMResult>}
     */
    async searchUserByDisplayName(keyword) {
        return this.invoke('searchUserByDisplayName', [keyword]);
    }

    /**
     * 获取指定用户拥有的机器人列表
     * @param {string} userId - 用户ID
     * @returns {Promise<IMResult>}
     */
    async getUserRobots(userId) {
        return this.invoke('getUserRobots', [userId]);
    }

    // ==================== 机器人资料 API ====================

    /**
     * 获取机器人资料
     * @returns {Promise<IMResult>}
     */
    async getProfile() {
        return this.invoke('getProfile', []);
    }

    /**
     * 更新机器人资料
     * @param {number} type - 资料类型
     * @param {string} value - 资料值
     * @returns {Promise<IMResult>}
     */
    async updateProfile(type, value) {
        return this.invoke('updateProfile', [type, value]);
    }

    // ==================== 群组相关 API ====================

    /**
     * 创建群组
     * @param {Object} groupInfo - 群组信息
     * @param {Array} members - 成员列表
     * @param {string} to - 目标用户（创建群时的邀请者）
     * @param {Array<number>} lines - 会话线路
     * @param {MessagePayload} payload - 通知消息
     * @returns {Promise<IMResult>}
     */
    async createGroup(groupInfo, members, to, lines, payload) {
        return this.invoke('createGroup', [groupInfo, members, to, lines, payload]);
    }

    /**
     * 获取群组信息
     * @param {string} groupId - 群组ID
     * @returns {Promise<IMResult>}
     */
    async getGroupInfo(groupId) {
        return this.invoke('getGroupInfo', [groupId]);
    }

    /**
     * 解散群组
     * @param {string} groupId - 群组ID
     * @param {Array<number>} lines - 会话线路
     * @param {MessagePayload} payload - 通知消息
     * @returns {Promise<IMResult>}
     */
    async dismissGroup(groupId, lines, payload) {
        return this.invoke('dismissGroup', [groupId, lines, payload]);
    }

    /**
     * 转让群组
     * @param {string} groupId - 群组ID
     * @param {string} newOwner - 新群主用户ID
     * @param {Array<number>} lines - 会话线路
     * @param {MessagePayload} payload - 通知消息
     * @returns {Promise<IMResult>}
     */
    async transferGroup(groupId, newOwner, lines, payload) {
        return this.invoke('transferGroup', [groupId, newOwner, lines, payload]);
    }

    /**
     * 修改群组信息
     * @param {string} groupId - 群组ID
     * @param {number} type - 修改类型
     * @param {string} value - 新值
     * @param {Array<number>} lines - 会话线路
     * @param {MessagePayload} payload - 通知消息
     * @returns {Promise<IMResult>}
     */
    async modifyGroupInfo(groupId, type, value, lines, payload) {
        return this.invoke('modifyGroupInfo', [groupId, type, value, lines, payload]);
    }

    /**
     * 获取群组成员
     * @param {string} groupId - 群组ID
     * @returns {Promise<IMResult>}
     */
    async getGroupMembers(groupId) {
        return this.invoke('getGroupMembers', [groupId]);
    }

    /**
     * 获取指定群成员信息
     * @param {string} groupId - 群组ID
     * @param {string} memberId - 成员ID
     * @returns {Promise<IMResult>}
     */
    async getGroupMember(groupId, memberId) {
        return this.invoke('getGroupMember', [groupId, memberId]);
    }

    /**
     * 添加群成员
     * @param {string} groupId - 群组ID
     * @param {Array} members - 成员列表
     * @param {string} to - 目标用户
     * @param {Array<number>} lines - 会话线路
     * @param {MessagePayload} payload - 通知消息
     * @returns {Promise<IMResult>}
     */
    async addGroupMembers(groupId, members, to, lines, payload) {
        return this.invoke('addGroupMembers', [groupId, members, to, lines, payload]);
    }

    /**
     * 设置群管理员
     * @param {string} groupId - 群组ID
     * @param {Array<string>} members - 成员ID列表
     * @param {boolean} isManager - 是否为管理员
     * @param {Array<number>} lines - 会话线路
     * @param {MessagePayload} payload - 通知消息
     * @returns {Promise<IMResult>}
     */
    async setGroupManager(groupId, members, isManager, lines, payload) {
        return this.invoke('setGroupManager', [groupId, members, isManager, lines, payload]);
    }

    /**
     * 禁言群成员
     * @param {string} groupId - 群组ID
     * @param {Array<string>} members - 成员ID列表
     * @param {boolean} mute - 是否禁言
     * @param {Array<number>} lines - 会话线路
     * @param {MessagePayload} payload - 通知消息
     * @returns {Promise<IMResult>}
     */
    async muteGroupMember(groupId, members, mute, lines, payload) {
        return this.invoke('muteGroupMember', [groupId, members, mute, lines, payload]);
    }

    /**
     * 允许群成员发言
     * @param {string} groupId - 群组ID
     * @param {Array<string>} members - 成员ID列表
     * @param {boolean} allow - 是否允许
     * @param {Array<number>} lines - 会话线路
     * @param {MessagePayload} payload - 通知消息
     * @returns {Promise<IMResult>}
     */
    async allowGroupMember(groupId, members, allow, lines, payload) {
        return this.invoke('allowGroupMember', [groupId, members, allow, lines, payload]);
    }

    /**
     * 踢出群成员
     * @param {string} groupId - 群组ID
     * @param {Array<string>} members - 成员ID列表
     * @param {Array<number>} lines - 会话线路
     * @param {MessagePayload} payload - 通知消息
     * @returns {Promise<IMResult>}
     */
    async kickoffGroupMembers(groupId, members, lines, payload) {
        return this.invoke('kickoffGroupMembers', [groupId, members, lines, payload]);
    }

    /**
     * 退出群组
     * @param {string} groupId - 群组ID
     * @param {Array<number>} lines - 会话线路
     * @param {MessagePayload} payload - 通知消息
     * @returns {Promise<IMResult>}
     */
    async quitGroup(groupId, lines, payload) {
        return this.invoke('quitGroup', [groupId, lines, payload]);
    }

    /**
     * 设置群成员别名
     * @param {string} groupId - 群组ID
     * @param {string} memberId - 成员ID
     * @param {string} alias - 别名
     * @param {Array<number>} lines - 会话线路
     * @param {MessagePayload} payload - 通知消息
     * @returns {Promise<IMResult>}
     */
    async setGroupMemberAlias(groupId, memberId, alias, lines, payload) {
        return this.invoke('setGroupMemberAlias', [groupId, memberId, alias, lines, payload]);
    }

    /**
     * 设置群成员扩展信息
     * @param {string} groupId - 群组ID
     * @param {string} memberId - 成员ID
     * @param {string} extra - 扩展信息
     * @param {Array<number>} lines - 会话线路
     * @param {MessagePayload} payload - 通知消息
     * @returns {Promise<IMResult>}
     */
    async setGroupMemberExtra(groupId, memberId, extra, lines, payload) {
        return this.invoke('setGroupMemberExtra', [groupId, memberId, extra, lines, payload]);
    }

    // ==================== 朋友圈相关 API ====================

    /**
     * 发布朋友圈动态
     * @param {number} type - 动态类型
     * @param {string} text - 文本内容
     * @param {Array<MediaEntry>} medias - 媒体列表
     * @param {Array<string>} mentionUsers - @用户列表
     * @param {Array<string>} allowUsers - 允许查看的用户列表
     * @param {Array<string>} denyUsers - 禁止查看的用户列表
     * @param {string} extra - 扩展信息
     * @returns {Promise<IMResult>}
     */
    async postMomentsFeed(type, text, medias, mentionUsers, allowUsers, denyUsers, extra) {
        return this.invoke('postMomentsFeed', [type, text, medias, mentionUsers, allowUsers, denyUsers, extra]);
    }

    /**
     * 更新朋友圈动态
     * @param {number} feedId - 动态ID
     * @param {number} type - 动态类型
     * @param {string} text - 文本内容
     * @param {Array<MediaEntry>} medias - 媒体列表
     * @param {Array<string>} mentionUsers - @用户列表
     * @param {Array<string>} allowUsers - 允许查看的用户列表
     * @param {Array<string>} denyUsers - 禁止查看的用户列表
     * @param {string} extra - 扩展信息
     * @returns {Promise<IMResult>}
     */
    async updateMomentsFeed(feedId, type, text, medias, mentionUsers, allowUsers, denyUsers, extra) {
        return this.invoke('updateMomentsFeed', [feedId, type, text, medias, mentionUsers, allowUsers, denyUsers, extra]);
    }

    /**
     * 获取朋友圈动态列表
     * @param {number} lastTimestamp - 最后时间戳
     * @param {number} count - 获取数量
     * @param {string} userId - 用户ID（可选，获取指定用户的朋友圈）
     * @returns {Promise<IMResult>}
     */
    async getMomentsFeeds(lastTimestamp, count, userId) {
        return this.invoke('getMomentsFeeds', [lastTimestamp, count, userId]);
    }

    /**
     * 获取指定朋友圈动态
     * @param {number} feedId - 动态ID
     * @returns {Promise<IMResult>}
     */
    async getMomentsFeed(feedId) {
        return this.invoke('getMomentsFeed', [feedId]);
    }

    /**
     * 删除朋友圈动态
     * @param {number} feedId - 动态ID
     * @returns {Promise<IMResult>}
     */
    async deleteMomentsFeed(feedId) {
        return this.invoke('deleteMomentsFeed', [feedId]);
    }

    /**
     * 发布朋友圈评论
     * @param {number} feedId - 动态ID
     * @param {number} commentId - 评论ID（回复评论时使用）
     * @param {number} type - 评论类型
     * @param {string} text - 评论内容
     * @param {string} replyTo - 回复对象用户ID
     * @param {string} extra - 扩展信息
     * @returns {Promise<IMResult>}
     */
    async postMomentsComment(feedId, commentId, type, text, replyTo, extra) {
        return this.invoke('postMomentsComment', [feedId, commentId, type, text, replyTo, extra]);
    }

    /**
     * 删除朋友圈评论
     * @param {number} feedId - 动态ID
     * @param {number} commentId - 评论ID
     * @returns {Promise<IMResult>}
     */
    async deleteMomentsComment(feedId, commentId) {
        return this.invoke('deleteMomentsComment', [feedId, commentId]);
    }

    /**
     * 获取用户朋友圈资料
     * @param {string} userId - 用户ID
     * @returns {Promise<IMResult>}
     */
    async getUserMomentsProfile(userId) {
        return this.invoke('getUserMomentsProfile', [userId]);
    }

    /**
     * 更新朋友圈背景图片
     * @param {string} backgroundUrl - 背景图片URL
     * @returns {Promise<IMResult>}
     */
    async updateMomentsBackgroundUrl(backgroundUrl) {
        return this.invoke('updateMomentsBackgroundUrl', [backgroundUrl]);
    }

    /**
     * 更新朋友圈陌生人可见数量
     * @param {number} count - 可见数量
     * @returns {Promise<IMResult>}
     */
    async updateMomentsStrangerVisibleCount(count) {
        return this.invoke('updateMomentsStrangerVisibleCount', [count]);
    }

    /**
     * 更新朋友圈可见范围
     * @param {number} scope - 可见范围
     * @returns {Promise<IMResult>}
     */
    async updateMomentsVisibleScope(scope) {
        return this.invoke('updateMomentsVisibleScope', [scope]);
    }

    /**
     * 更新朋友圈黑名单
     * @param {Array<string>} addBlackUsers - 添加的黑名单用户
     * @param {Array<string>} removeBlackUsers - 移除的黑名单用户
     * @returns {Promise<IMResult>}
     */
    async updateMomentsBlackList(addBlackUsers, removeBlackUsers) {
        return this.invoke('updateMomentsBlackList', [addBlackUsers, removeBlackUsers]);
    }

    /**
     * 更新朋友圈屏蔽列表
     * @param {Array<string>} addBlockUsers - 添加的屏蔽用户
     * @param {Array<string>} removeBlockUsers - 移除的屏蔽用户
     * @returns {Promise<IMResult>}
     */
    async updateMomentsBlockList(addBlockUsers, removeBlockUsers) {
        return this.invoke('updateMomentsBlockList', [addBlockUsers, removeBlockUsers]);
    }

    // ==================== 文件上传相关 API ====================

    /**
     * 获取预签名上传URL
     * @param {string} fileName - 文件名
     * @param {number} messageContentMediaType - 消息内容媒体类型
     * @param {string} mimeType - 媒体类型
     * @returns {Promise<IMResult<OutputPresignedUploadUrl>>}
     */
    async getPresignedUploadUrl(fileName, messageContentMediaType, mimeType) {
        return this.invoke('getPresignedUploadUrl', [fileName, messageContentMediaType, mimeType]);
    }

    /**
     * 上传文件
     * @param {Buffer|Blob|File} fileData - 文件数据
     * @param {string} fileName - 文件名
     * @param {number} messageContentMediaType - 消息内容媒体类型，默认4
     * @param {string} mimeType - 媒体类型，自动根据文件名推断
     * @returns {Promise<IMResult<string>>} - 上传后的下载URL
     */
    async uploadFile(fileData, fileName, messageContentMediaType = 4, mimeType = null) {
        // 如果mediaType为空，根据文件名推断
        if (!mimeType) {
            mimeType = this.getContentTypeByFileName(fileName);
        }

        // 1. 获取预签名上传URL
        const presignedResult = await this.getPresignedUploadUrl(fileName, messageContentMediaType, mimeType);
        if (!presignedResult.isSuccess()) {
            return new IMResult(presignedResult.code, presignedResult.msg, null);
        }

        const presignedUrl = presignedResult.result;
        if (!presignedUrl || !presignedUrl.uploadUrl) {
            return new IMResult(-1, '获取上传URL失败', null);
        }

        // 2. 根据存储类型选择上传方式
        if (presignedUrl.type === 1) {
            // 七牛云上传
            return this.uploadToQiniu(presignedUrl, fileData, fileName, mimeType);
        } else {
            // 其他存储（S3/OSS等）
            return this.uploadToOther(presignedUrl, fileData, mimeType);
        }
    }

    /**
     * 上传到七牛云
     * @param {OutputPresignedUploadUrl} presignedUrl - 预签名URL信息
     * @param {Buffer|Blob|File} fileData - 文件数据
     * @param {string} fileName - 文件名
     * @param {string} mimeType - 媒体类型
     * @returns {Promise<IMResult<string>>}
     */
    async uploadToQiniu(presignedUrl, fileData, fileName, mimeType) {
        const uploadUrl = presignedUrl.uploadUrl;

        // 解析URL：格式为 "http://host?token?key"
        const firstQuestion = uploadUrl.indexOf('?');
        const secondQuestion = uploadUrl.indexOf('?', firstQuestion + 1);

        if (firstQuestion === -1 || secondQuestion === -1) {
            return new IMResult(-1, '七牛云上传地址格式错误', null);
        }

        const serverUrl = uploadUrl.substring(0, firstQuestion);
        const token = uploadUrl.substring(firstQuestion + 1, secondQuestion);
        const key = uploadUrl.substring(secondQuestion + 1);

        try {
            const nodeFormData = new FormData();
            nodeFormData.append('token', token);
            nodeFormData.append('key', key);
            nodeFormData.append('file', fileData, { filename: fileName, contentType: mimeType });
            
            const response = await fetch(serverUrl, {
                method: 'POST',
                body: nodeFormData
            });

            if (response.ok || response.status === 200) {
                return new IMResult(0, 'success', presignedUrl.downloadUrl);
            } else {
                return new IMResult(-1, `文件上传到七牛云失败，HTTP状态码: ${response.status}`, null);
            }
        } catch (error) {
            return new IMResult(-1, `上传文件失败: ${error.message}`, null);
        }
    }

    /**
     * 上传到通用存储（S3/OSS等）
     * @param {OutputPresignedUploadUrl} presignedUrl - 预签名URL信息
     * @param {Buffer|Blob|File} fileData - 文件数据
     * @param {string} mimeType - 媒体类型
     * @returns {Promise<IMResult<string>>}
     */
    async uploadToOther(presignedUrl, fileData, mimeType) {
        try {
            // 准备请求体
            let body;
            if (fileData instanceof Buffer) {
                body = fileData;
            } else if (fileData instanceof Blob || fileData instanceof File) {
                body = fileData;
            } else {
                body = Buffer.from(fileData);
            }

            // 使用主上传URL
            let response = await fetch(presignedUrl.uploadUrl, {
                method: 'PUT',
                headers: {
                    'Content-Type': mimeType
                },
                body: body
            });

            if (response.ok || (response.status >= 200 && response.status < 300)) {
                return new IMResult(0, 'success', presignedUrl.downloadUrl);
            }

            // 主URL失败，尝试备用URL
            if (presignedUrl.backupUploadUrl) {
                response = await fetch(presignedUrl.backupUploadUrl, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': mimeType
                    },
                    body: body
                });

                if (response.ok || (response.status >= 200 && response.status < 300)) {
                    return new IMResult(0, 'success', presignedUrl.downloadUrl);
                }
            }

            return new IMResult(-1, `上传文件失败，HTTP状态码: ${response.status}`, null);
        } catch (error) {
            return new IMResult(-1, `上传文件失败: ${error.message}`, null);
        }
    }

    /**
     * 根据文件名获取Content-Type
     * @param {string} fileName - 文件名
     * @returns {string} - Content-Type
     */
    getContentTypeByFileName(fileName) {
        if (!fileName) {
            return 'application/octet-stream';
        }

        const lowerCaseName = fileName.toLowerCase();
        const mimeTypes = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.bmp': 'image/bmp',
            '.webp': 'image/webp',
            '.mp4': 'video/mp4',
            '.mov': 'video/quicktime',
            '.avi': 'video/x-msvideo',
            '.mp3': 'audio/mpeg',
            '.wav': 'audio/wav',
            '.pdf': 'application/pdf',
            '.doc': 'application/msword',
            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            '.xls': 'application/vnd.ms-excel',
            '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            '.ppt': 'application/vnd.ms-powerpoint',
            '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            '.txt': 'text/plain',
            '.zip': 'application/zip',
            '.tar': 'application/x-tar',
            '.gz': 'application/gzip'
        };

        for (const [ext, mimeType] of Object.entries(mimeTypes)) {
            if (lowerCaseName.endsWith(ext)) {
                return mimeType;
            }
        }

        return 'application/octet-stream';
    }
}

/**
 * OutputPresignedUploadUrl 预签名上传URL结果
 */
export class OutputPresignedUploadUrl {
    constructor(data = {}) {
        /** 存储类型：1=七牛云，其他=通用S3/OSS */
        this.type = data.type || 0;
        /** 上传URL */
        this.uploadUrl = data.uploadUrl || '';
        /** 备用上传URL */
        this.backupUploadUrl = data.backupUploadUrl || '';
        /** 下载URL */
        this.downloadUrl = data.downloadUrl || '';
    }
}

/**
 * MediaEntry 媒体条目（朋友圈用）
 */
export class MediaEntry {
    constructor(data = {}) {
        /** 媒体类型 */
        this.type = data.type || 0;
        /** 媒体URL */
        this.url = data.url || '';
        /** 缩略图URL */
        this.thumbUrl = data.thumbUrl || '';
        /** 宽度 */
        this.width = data.width || 0;
        /** 高度 */
        this.height = data.height || 0;
        /** 时长（视频/音频） */
        this.duration = data.duration || 0;
    }
}
