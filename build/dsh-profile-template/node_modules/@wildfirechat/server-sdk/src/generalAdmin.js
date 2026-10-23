import APIPath from './utils/apiPath.js';
import httpUtils from './utils/httpUtils.js';
import {
    getContentTypeByFileName,
    parseUploadParams,
    executeUpload
} from './utils/uploadHelper.js';

/**
 * 通用管理类
 * 
 * 提供通用的系统管理功能，包括：
 * - 系统设置管理
 * - 文件管理（会话文件、用户文件）
 * - 用户设置管理（会话置顶等）
 * - 健康检查
 */
class GeneralAdmin {
    /**
     * 获取系统设置
     * @param {number} id - 设置项ID
     * @returns {Promise<IMResult>}
     */
    static async getSystemSetting(id) {
        const input = {
            id: id
        };
        return httpUtils.httpJsonPost(APIPath.Get_System_Setting, input);
    }

    /**
     * 设置系统设置
     * @param {number} id - 设置项ID
     * @param {string} value - 设置值
     * @param {string} [desc] - 设置描述
     * @returns {Promise<IMResult>}
     */
    static async setSystemSetting(id, value, desc = null) {
        const input = {
            id: id,
            value: value,
            desc: desc
        };
        return httpUtils.httpJsonPost(APIPath.Put_System_Setting, input);
    }

    /**
     * 获取会话文件列表（仅专业版支持）
     * @param {number} conversationType - 会话类型
     * @param {string} target - 会话目标ID
     * @param {number} line - 线路
     * @param {string} userId - 用户ID
     * @param {number} offset - 偏移量
     * @param {boolean} desc - 是否降序
     * @param {number} count - 每页数量
     * @returns {Promise<IMResult>}
     */
    static async getConversationFiles(conversationType, target, line, userId, offset, desc, count) {
        const input = {
            conversationType: conversationType,
            target: target,
            line: line,
            userId: userId,
            offset: offset,
            desc: desc,
            count: count
        };
        return httpUtils.httpJsonPost(APIPath.Get_Conversation_Files, input);
    }

    /**
     * 获取用户文件列表
     * @param {string} userId - 用户ID
     * @param {number} offset - 偏移量
     * @param {boolean} desc - 是否降序
     * @param {number} count - 每页数量
     * @returns {Promise<IMResult>}
     */
    static async getUserFiles(userId, offset, desc, count) {
        const input = {
            userId: userId,
            offset: offset,
            desc: desc,
            count: count
        };
        return httpUtils.httpJsonPost(APIPath.Get_User_Files, input);
    }

    /**
     * 根据消息ID获取文件信息
     * @param {number} messageId - 消息ID
     * @returns {Promise<IMResult>}
     */
    static async getFile(messageId) {
        const input = {
            value: messageId
        };
        return httpUtils.httpJsonPost(APIPath.Get_Message_File, input);
    }

    /**
     * 设置会话置顶
     * @param {string} userId - 用户ID
     * @param {number} conversationType - 会话类型
     * @param {string} target - 会话目标ID
     * @param {number} line - 线路
     * @param {boolean} isTop - true-置顶，false-取消置顶
     * @returns {Promise<IMResult>}
     */
    static async setConversationTop(userId, conversationType, target, line, isTop) {
        const key = `${conversationType}-${line}-${target}`;
        const value = isTop ? '1' : '0';
        return this.setUserSetting(userId, 3, key, value);
    }

    /**
     * 获取会话置顶状态
     * @param {string} userId - 用户ID
     * @param {number} conversationType - 会话类型
     * @param {string} target - 会话目标ID
     * @param {number} line - 线路
     * @returns {Promise<IMResult>}
     */
    static async getConversationTop(userId, conversationType, target, line) {
        const key = `${conversationType}-${line}-${target}`;
        const result = await this.getUserSetting(userId, 3, key);
        
        // 转换为布尔值结果
        if (result.isSuccess()) {
            const isTop = result.result && result.result.value === '1';
            result.result = isTop;
        }
        return result;
    }

    /**
     * 获取用户设置
     * @param {string} userId - 用户ID
     * @param {number} scope - 设置范围
     * @param {string} key - 设置键
     * @returns {Promise<IMResult>}
     */
    static async getUserSetting(userId, scope, key) {
        const pojo = {
            userId: userId,
            scope: scope,
            key: key
        };
        return httpUtils.httpJsonPost(APIPath.User_Get_Setting, pojo);
    }

    /**
     * 设置用户设置
     * @param {string} userId - 用户ID
     * @param {number} scope - 设置范围
     * @param {string} key - 设置键
     * @param {string} value - 设置值
     * @returns {Promise<IMResult>}
     */
    static async setUserSetting(userId, scope, key, value) {
        const pojo = {
            userId: userId,
            scope: scope,
            key: key,
            value: value
        };
        return httpUtils.httpJsonPost(APIPath.User_Put_Setting, pojo);
    }

    /**
     * 健康检查
     * @returns {Promise<IMResult>}
     */
    static async healthCheck() {
        return httpUtils.httpGet(APIPath.Health);
    }

    /**
     * 获取客户信息
     * @returns {Promise<IMResult>}
     */
    static async getCustomer() {
        return httpUtils.httpJsonPost(APIPath.GET_CUSTOMER, null);
    }

    /**
     * 获取预签名上传地址
     * @param {string} fileName - 文件名
     * @param {number} mediaType - 媒体类型，参考 MessageContentMediaType
     * @param {string} contentType - 文件Content-Type，例如 "image/jpeg", "application/octet-stream" 等
     * @returns {Promise<IMResult>} 包含预签名上传地址的结果
     */
    static async getPresignedUploadUrl(fileName, mediaType, contentType) {
        const requestPojo = {
            fileName: fileName,
            mediaType: mediaType,
            contentType: contentType
        };
        return httpUtils.httpJsonPost(APIPath.Get_Presigned_Upload_Url, requestPojo);
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
     * const result = await GeneralAdmin.uploadFile('/path/to/image.png');
     * 
     * // 方式2: 传入文件路径并指定媒体类型
     * const result = await GeneralAdmin.uploadFile('/path/to/image.png', MessageContentMediaType.Image);
     * 
     * // 方式3: 传入文件路径、媒体类型和Content-Type
     * const result = await GeneralAdmin.uploadFile('/path/to/file.pdf', MessageContentMediaType.File, 'application/pdf');
     * 
     * // 方式4: 传入Buffer（适用于内存中生成的内容）
     * const buffer = Buffer.from('Hello World');
     * const result = await GeneralAdmin.uploadFile(buffer, MessageContentMediaType.File, 'text/plain');
     * 
     * // 方式5: 传入Buffer并指定文件名（通过options）
     * const buffer = fs.readFileSync('/path/to/file.png');
     * const result = await GeneralAdmin.uploadFile(buffer, MessageContentMediaType.Image);
     */
    static async uploadFile(filePathOrFileBuffer, mediaType = 4, contentType) {
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

export default GeneralAdmin;
