import crypto from 'crypto';
import https from 'https';
import http from 'http';
import { URL } from 'url';
import APIPath from './utils/apiPath.js';
import IMResult from './utils/imResult.js';
import {
    getContentTypeByFileName,
    parseUploadParams,
    executeUpload
} from './utils/uploadHelper.js';

/**
 * 机器人服务类
 * 
 * 提供机器人相关的功能，包括：
 * - 发送和回复消息
 * - 获取用户信息
 * - 群组管理
 * - 朋友圈管理
 * - 会议控制
 * - 回调管理
 */
class RobotService {
    /**
     * 创建机器人服务实例
     * @param {string} url - IM服务器地址
     * @param {string} robotId - 机器人ID
     * @param {string} robotSecret - 机器人密钥
     * @param {number} [timeout=15000] - 超时时间（毫秒）
     */
    constructor(url, robotId, robotSecret, timeout = 15000) {
        this.baseUrl = url;
        this.robotId = robotId;
        this.robotSecret = robotSecret;
        this.timeout = timeout;
    }

    /**
     * 获取机器人ID
     * @returns {string}
     */
    getRobotId() {
        return this.robotId;
    }

    /**
     * 获取机器人密钥
     * @returns {string}
     */
    getRobotSecret() {
        return this.robotSecret;
    }

    /**
     * 发送HTTP POST请求
     * @private
     * @param {string} path - 请求路径
     * @param {object} data - 请求数据
     * @returns {Promise<IMResult>}
     */
    async _httpPost(path, data) {
        // 使用专门的机器人HTTP工具，需要在httpUtils中扩展支持
        // 这里复用admin的http工具，但实际机器人API使用不同的认证方式

        const url = new URL(path, this.baseUrl);
        
        // 生成机器人签名
        const nonce = Math.floor(Math.random() * 100000) + 3;
        const timestamp = Date.now();
        const str = `${nonce}|${this.robotSecret}|${timestamp}`;
        const sign = crypto.createHash('sha1').update(str).digest('hex');

        const postData = data ? JSON.stringify(data) : '';

        const options = {
            method: 'POST',
            timeout: this.timeout,
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'Connection': 'Keep-Alive',
                'nonce': nonce.toString(),
                'timestamp': timestamp.toString(),
                'sign': sign,
                'rid': this.robotId,
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        return new Promise((resolve, reject) => {
            const client = url.protocol === 'https:' ? https : http;
            
            const req = client.request(url, options, (res) => {
                let responseData = '';
                res.on('data', chunk => responseData += chunk);
                res.on('end', () => {
                    try {
                        // 处理空响应
                        if (!responseData || responseData.trim() === '') {
                            if (res.statusCode >= 200 && res.statusCode < 300) {
                                resolve(new IMResult(0, 'success', null));
                            } else {
                                reject(new Error(`HTTP请求失败，状态码: ${res.statusCode}`));
                            }
                            return;
                        }
                        const result = JSON.parse(responseData);
                        resolve(new IMResult(result.code, result.msg, result.result));
                    } catch (error) {
                        reject(new Error(`JSON解析失败: ${error.message}, 响应内容: ${responseData.substring(0, 200)}`));
                    }
                });
            });

            req.on('error', (error) => {
                reject(new Error(`HTTP请求异常: ${error.message}`));
            });

            req.on('timeout', () => {
                req.destroy();
                reject(new Error('HTTP请求超时'));
            });

            if (postData) {
                req.write(postData);
            }
            req.end();
        });
    }

    // ========== 消息相关 ==========

    /**
     * 发送消息
     * @param {string} sender - 发送者用户ID
     * @param {object} conversation - 会话信息
     * @param {object} payload - 消息内容
     * @returns {Promise<IMResult>}
     */
    async sendMessage(sender, conversation, payload) {
        return this.sendMessageWithOptions(sender, conversation, payload, null);
    }

    /**
     * 发送消息（可指定接收用户）
     * @param {string} sender - 发送者用户ID
     * @param {object} conversation - 会话信息
     * @param {object} payload - 消息内容
     * @param {string[]} [toUsers] - 接收用户ID列表
     * @returns {Promise<IMResult>}
     */
    async sendMessageWithOptions(sender, conversation, payload, toUsers) {
        const messageData = {
            sender: sender,
            conv: conversation,
            toUsers: toUsers,
            payload: payload
        };
        return this._httpPost(APIPath.Robot_Message_Send, messageData);
    }

    /**
     * 回复消息
     * @param {number} messageUid - 消息UID
     * @param {object} payload - 消息内容
     * @param {boolean} [only2Sender=false] - 是否只回复给发送者
     * @returns {Promise<IMResult>}
     */
    async replyMessage(messageUid, payload, only2Sender = false) {
        const messageData = {
            messageUid: messageUid,
            only2Sender: only2Sender,
            payload: payload
        };
        return this._httpPost(APIPath.Robot_Message_Reply, messageData);
    }

    /**
     * 撤回消息
     * @param {number} messageUid - 消息UID
     * @returns {Promise<IMResult>}
     */
    async recallMessage(messageUid) {
        const messageData = {
            messageUid: messageUid
        };
        return this._httpPost(APIPath.Robot_Message_Recall, messageData);
    }

    /**
     * 更新消息
     * @param {number} messageUid - 消息UID
     * @param {object} payload - 消息内容
     * @returns {Promise<IMResult>}
     */
    async updateMessage(messageUid, payload) {
        const updateMessageContentData = {
            messageUid: messageUid,
            payload: payload,
            updateTimestamp: 0,
            distribute: 1
        };
        return this._httpPost(APIPath.Robot_Message_Update, updateMessageContentData);
    }

    // ========== 用户相关 ==========

    /**
     * 获取用户信息
     * @param {string} userId - 用户ID
     * @returns {Promise<IMResult>}
     */
    async getUserInfo(userId) {
        const getUserInfo = {
            userId: userId
        };
        return this._httpPost(APIPath.Robot_User_Info, getUserInfo);
    }

    /**
     * 通过手机号获取用户信息
     * @param {string} phone - 手机号
     * @returns {Promise<IMResult>}
     */
    async getUserInfoByMobile(phone) {
        const getUserInfo = {
            mobile: phone
        };
        return this._httpPost(APIPath.Robot_User_Info, getUserInfo);
    }

    /**
     * 通过用户名获取用户信息
     * @param {string} userName - 用户名
     * @returns {Promise<IMResult>}
     */
    async getUserInfoByName(userName) {
        const getUserInfo = {
            name: userName
        };
        return this._httpPost(APIPath.Robot_User_Info, getUserInfo);
    }

    /**
     * 获取机器人 owner 的好友列表
     * @returns {Promise<IMResult>}
     */
    async getOwnerFriendList() {
        return this._httpPost(APIPath.Robot_Friend_Get_List, null);
    }

    /**
     * 根据昵称搜索用户
     * @param {string} keyword - 搜索关键词
     * @returns {Promise<IMResult>}
     */
    async searchUserByDisplayName(keyword) {
        const req = {
            keyword: keyword,
            searchType:100
        };
        return this._httpPost(APIPath.Robot_Search_User, req);
    }

    /**
     * 获取指定用户拥有的机器人列表
     * @param {string} userId - 用户ID
     * @returns {Promise<IMResult>}
     */
    async getUserRobots(userId) {
        const input = {
            userId: userId
        };
        return this._httpPost(APIPath.Robot_Get_User_Robots, input);
    }

    /**
     * 设置回调地址
     * @param {string} url - 回调地址
     * @returns {Promise<IMResult>}
     */
    async setCallback(url) {
        const pojo = {
            url: url
        };
        return this._httpPost(APIPath.Robot_Set_Callback, pojo);
    }

    /**
     * 获取回调地址
     * @returns {Promise<IMResult>}
     */
    async getCallback() {
        return this._httpPost(APIPath.Robot_Get_Callback, null);
    }

    /**
     * 删除回调地址
     * @returns {Promise<IMResult>}
     */
    async deleteCallback() {
        return this._httpPost(APIPath.Robot_Delete_Callback, null);
    }

    /**
     * 获取机器人资料
     * @returns {Promise<IMResult>}
     */
    async getProfile() {
        return this._httpPost(APIPath.Robot_Get_Profile, null);
    }

    /**
     * 更新机器人资料
     * @param {number} type - 资料类型（MyInfoType）
     * @param {string} value - 资料值
     * @returns {Promise<IMResult>}
     */
    async updateProfile(type, value) {
        const pojo = {
            first: type,
            second: value
        };
        return this._httpPost(APIPath.Robot_Update_Profile, pojo);
    }

    /**
     * 通过应用授权码获取用户信息
     * @param {string} authCode - 应用授权码
     * @returns {Promise<IMResult>}
     */
    async applicationGetUserInfo(authCode) {
        const input = {
            authCode: authCode
        };
        return this._httpPost(APIPath.Robot_Application_Get_UserInfo, input);
    }

    /**
     * 获取应用签名
     * @returns {object}
     */
    getApplicationSignature() {
        const nonce = Math.floor(Math.random() * 100000) + 3;
        const timestamp = Math.floor(Date.now() / 1000);
        const str = `${nonce}|${this.robotId}|${timestamp}|${this.robotSecret}`;
        const sign = crypto.createHash('sha1').update(str).digest('hex');

        return {
            appId: this.robotId,
            appType: 2, // ApplicationType_Robot
            timestamp: timestamp,
            nonceStr: nonce.toString(),
            signature: sign
        };
    }

    // ========== 群组相关 ==========

    /**
     * 创建群组
     * @param {object} groupInfo - 群组信息
     * @param {object[]} [members] - 成员列表
     * @param {string} [memberExtra] - 成员额外信息
     * @param {number[]} [toLines] - 线路列表
     * @param {object} [notifyMessage] - 通知消息
     * @returns {Promise<IMResult>}
     */
    async createGroup(groupInfo, members = [], memberExtra = null, toLines = null, notifyMessage = null) {
        const pojoGroup = {
            group_info: groupInfo,
            members: members
        };
        const createGroup = {
            group: pojoGroup,
            member_extra: memberExtra,
            to_lines: toLines,
            notify_message: notifyMessage
        };
        return this._httpPost(APIPath.Robot_Create_Group, createGroup);
    }

    /**
     * 获取群组信息
     * @param {string} groupId - 群组ID
     * @returns {Promise<IMResult>}
     */
    async getGroupInfo(groupId) {
        const input = {
            groupId: groupId
        };
        return this._httpPost(APIPath.Robot_Group_Get_Info, input);
    }

    /**
     * 解散群组
     * @param {string} groupId - 群组ID
     * @param {number[]} [toLines] - 线路列表
     * @param {object} [notifyMessage] - 通知消息
     * @returns {Promise<IMResult>}
     */
    async dismissGroup(groupId, toLines = null, notifyMessage = null) {
        const dismissGroup = {
            group_id: groupId,
            to_lines: toLines,
            notify_message: notifyMessage
        };
        return this._httpPost(APIPath.Robot_Group_Dismiss, dismissGroup);
    }

    /**
     * 转让群组
     * @param {string} groupId - 群组ID
     * @param {string} newOwner - 新群主ID
     * @param {number[]} [toLines] - 线路列表
     * @param {object} [notifyMessage] - 通知消息
     * @returns {Promise<IMResult>}
     */
    async transferGroup(groupId, newOwner, toLines = null, notifyMessage = null) {
        const transferGroup = {
            group_id: groupId,
            new_owner: newOwner,
            to_lines: toLines,
            notify_message: notifyMessage
        };
        return this._httpPost(APIPath.Robot_Group_Transfer, transferGroup);
    }

    /**
     * 修改群组信息
     * @param {string} groupId - 群组ID
     * @param {number} type - 修改类型
     * @param {string} value - 新值
     * @param {number[]} [toLines] - 线路列表
     * @param {object} [notifyMessage] - 通知消息
     * @returns {Promise<IMResult>}
     */
    async modifyGroupInfo(groupId, type, value, toLines = null, notifyMessage = null) {
        const modifyGroupInfo = {
            group_id: groupId,
            to_lines: toLines,
            type: type,
            value: value,
            notify_message: notifyMessage
        };
        return this._httpPost(APIPath.Robot_Group_Modify_Info, modifyGroupInfo);
    }

    /**
     * 获取群组成员列表
     * @param {string} groupId - 群组ID
     * @returns {Promise<IMResult>}
     */
    async getGroupMembers(groupId) {
        const input = {
            groupId: groupId
        };
        return this._httpPost(APIPath.Robot_Group_Member_List, input);
    }

    /**
     * 获取群组成员信息
     * @param {string} groupId - 群组ID
     * @param {string} memberId - 成员ID
     * @returns {Promise<IMResult>}
     */
    async getGroupMember(groupId, memberId) {
        const input = {
            groupId: groupId,
            memberId: memberId
        };
        return this._httpPost(APIPath.Robot_Group_Member_Get, input);
    }

    /**
     * 添加群组成员
     * @param {string} groupId - 群组ID
     * @param {object[]} groupMembers - 成员列表
     * @param {string} [memberExtra] - 成员额外信息
     * @param {number[]} [toLines] - 线路列表
     * @param {object} [notifyMessage] - 通知消息
     * @returns {Promise<IMResult>}
     */
    async addGroupMembers(groupId, groupMembers, memberExtra = null, toLines = null, notifyMessage = null) {
        const addGroupMember = {
            group_id: groupId,
            members: groupMembers,
            memberExtra: memberExtra,
            to_lines: toLines,
            notify_message: notifyMessage
        };
        return this._httpPost(APIPath.Robot_Group_Member_Add, addGroupMember);
    }

    /**
     * 设置群组管理员
     * @param {string} groupId - 群组ID
     * @param {string[]} groupMemberIds - 成员ID列表
     * @param {boolean} isManager - 是否为管理员
     * @param {number[]} [toLines] - 线路列表
     * @param {object} [notifyMessage] - 通知消息
     * @returns {Promise<IMResult>}
     */
    async setGroupManager(groupId, groupMemberIds, isManager, toLines = null, notifyMessage = null) {
        const addGroupMember = {
            group_id: groupId,
            members: groupMemberIds,
            is_manager: isManager,
            to_lines: toLines,
            notify_message: notifyMessage
        };
        return this._httpPost(APIPath.Robot_Group_Set_Manager, addGroupMember);
    }

    /**
     * 禁言群组成员
     * @param {string} groupId - 群组ID
     * @param {string[]} groupMemberIds - 成员ID列表
     * @param {boolean} isMute - 是否禁言
     * @param {number[]} [toLines] - 线路列表
     * @param {object} [notifyMessage] - 通知消息
     * @returns {Promise<IMResult>}
     */
    async muteGroupMember(groupId, groupMemberIds, isMute, toLines = null, notifyMessage = null) {
        const addGroupMember = {
            group_id: groupId,
            members: groupMemberIds,
            is_manager: isMute,
            to_lines: toLines,
            notify_message: notifyMessage
        };
        return this._httpPost(APIPath.Robot_Group_Mute_Member, addGroupMember);
    }

    /**
     * 允许群组成员发言
     * @param {string} groupId - 群组ID
     * @param {string[]} groupMemberIds - 成员ID列表
     * @param {boolean} isAllow - 是否允许
     * @param {number[]} [toLines] - 线路列表
     * @param {object} [notifyMessage] - 通知消息
     * @returns {Promise<IMResult>}
     */
    async allowGroupMember(groupId, groupMemberIds, isAllow, toLines = null, notifyMessage = null) {
        const addGroupMember = {
            group_id: groupId,
            members: groupMemberIds,
            is_manager: isAllow,
            to_lines: toLines,
            notify_message: notifyMessage
        };
        return this._httpPost(APIPath.Robot_Group_Allow_Member, addGroupMember);
    }

    /**
     * 踢出群组成员
     * @param {string} groupId - 群组ID
     * @param {string[]} groupMemberIds - 成员ID列表
     * @param {number[]} [toLines] - 线路列表
     * @param {object} [notifyMessage] - 通知消息
     * @returns {Promise<IMResult>}
     */
    async kickoffGroupMembers(groupId, groupMemberIds, toLines = null, notifyMessage = null) {
        const kickoffGroupMember = {
            group_id: groupId,
            members: groupMemberIds,
            to_lines: toLines,
            notify_message: notifyMessage
        };
        return this._httpPost(APIPath.Robot_Group_Member_Kickoff, kickoffGroupMember);
    }

    /**
     * 退出群组
     * @param {string} groupId - 群组ID
     * @param {number[]} [toLines] - 线路列表
     * @param {object} [notifyMessage] - 通知消息
     * @returns {Promise<IMResult>}
     */
    async quitGroup(groupId, toLines = null, notifyMessage = null) {
        const quitGroup = {
            group_id: groupId,
            to_lines: toLines,
            notify_message: notifyMessage
        };
        return this._httpPost(APIPath.Robot_Group_Member_Quit, quitGroup);
    }

    /**
     * 设置群组成员别名
     * @param {string} groupId - 群组ID
     * @param {string} memberId - 成员ID
     * @param {string} alias - 别名
     * @param {number[]} [toLines] - 线路列表
     * @param {object} [notifyMessage] - 通知消息
     * @returns {Promise<IMResult>}
     */
    async setGroupMemberAlias(groupId, memberId, alias, toLines = null, notifyMessage = null) {
        const input = {
            group_id: groupId,
            memberId: memberId,
            alias: alias,
            to_lines: toLines,
            notify_message: notifyMessage
        };
        return this._httpPost(APIPath.Robot_Group_Set_Member_Alias, input);
    }

    /**
     * 设置群组成员额外信息
     * @param {string} groupId - 群组ID
     * @param {string} memberId - 成员ID
     * @param {string} extra - 额外信息
     * @param {number[]} [toLines] - 线路列表
     * @param {object} [notifyMessage] - 通知消息
     * @returns {Promise<IMResult>}
     */
    async setGroupMemberExtra(groupId, memberId, extra, toLines = null, notifyMessage = null) {
        const input = {
            group_id: groupId,
            memberId: memberId,
            extra: extra,
            to_lines: toLines,
            notify_message: notifyMessage
        };
        return this._httpPost(APIPath.Robot_Group_Set_Member_Extra, input);
    }

    // ========== 会议相关 ==========

    /**
     * 发送会议请求
     * @param {string} robotId - 机器人ID
     * @param {string} clientId - 客户端ID
     * @param {string} request - 请求类型
     * @param {number} sessionId - 会话ID
     * @param {string} roomId - 房间ID
     * @param {string} data - 请求数据
     * @param {boolean} [advance=false] - 是否高级模式
     * @returns {Promise<IMResult>}
     */
    async sendConferenceRequest(robotId, clientId, request, sessionId, roomId, data, advance = false) {
        const input = {
            robotId: robotId,
            clientId: clientId,
            request: request,
            sessionId: sessionId,
            roomId: roomId,
            data: data,
            advance: advance
        };
        return this._httpPost(APIPath.Robot_Conference_Request, input);
    }

    /**
     * 获取预签名上传地址
     * @param {string} fileName - 文件名
     * @param {number} mediaType - 媒体类型，参考 MessageContentMediaType
     * @param {string} contentType - 文件Content-Type，例如 "image/jpeg", "application/octet-stream" 等
     * @returns {Promise<IMResult>} 包含预签名上传地址的结果
     */
    async getPresignedUploadUrl(fileName, mediaType, contentType) {
        const requestPojo = {
            fileName: fileName,
            mediaType: mediaType,
            contentType: contentType
        };
        return this._httpPost(APIPath.Robot_Get_Presigned_Upload_Url, requestPojo);
    }

    /**
     * 上传文件
     * 流程：先调用getPresignedUploadUrl获取预签名上传地址，然后直接上传文件。
     * 上传成功后返回文件的下载地址等信息。
     * 
     * @param {string|Buffer} filePathOrFileBuffer - 文件路径（字符串）或文件内容（Buffer）
     * @param {number} [mediaType=4] - 媒体类型，参考 MessageContentMediaType，默认为 FILE(4)
     * @param {string} [contentType] - 文件Content-Type，例如 "image/jpeg", "application/octet-stream" 等；
     *                                  如果为null或空，则根据文件名自动识别
     * @returns {Promise<IMResult>} 上传结果，包含下载地址
     * 
     * @example
     * // 方式1: 传入文件路径（最简单）
     * const result = await robotService.uploadFile('/path/to/image.png');
     * 
     * // 方式2: 传入文件路径并指定媒体类型
     * const result = await robotService.uploadFile('/path/to/image.png', MessageContentMediaType.Image);
     * 
     * // 方式3: 传入文件路径、媒体类型和Content-Type
     * const result = await robotService.uploadFile('/path/to/file.pdf', MessageContentMediaType.File, 'application/pdf');
     * 
     * // 方式4: 传入Buffer（适用于内存中生成的内容）
     * const buffer = Buffer.from('Hello World');
     * const result = await robotService.uploadFile(buffer, MessageContentMediaType.File, 'text/plain');
     * 
     * // 方式5: 传入Buffer并指定文件名（通过options）
     * const buffer = fs.readFileSync('/path/to/file.png');
     * const result = await robotService.uploadFile(buffer, MessageContentMediaType.Image);
     */
    async uploadFile(filePathOrFileBuffer, mediaType = 4, contentType) {
        // 解析参数获取文件名和文件内容
        const { fileName, fileBuffer } = parseUploadParams(filePathOrFileBuffer);

        if (!fileBuffer || fileBuffer.length === 0) {
            throw new Error('文件内容不能为空');
        }

        // 如果未指定Content-Type，根据文件名自动获取
        if (!contentType) {
            contentType = getContentTypeByFileName(fileName);
        }

        // 1. 获取预签名上传地址
        const presignedResult = await this.getPresignedUploadUrl(fileName, mediaType, contentType);

        if (!presignedResult.isSuccess()) {
            return presignedResult;
        }

        const presignedUrl = presignedResult.getResult();
        if (!presignedUrl || !presignedUrl.uploadUrl) {
            throw new Error('预签名上传地址为空');
        }

        // 2. 执行上传
        return executeUpload(presignedUrl, fileBuffer, fileName, contentType);
    }
}

export default RobotService;
