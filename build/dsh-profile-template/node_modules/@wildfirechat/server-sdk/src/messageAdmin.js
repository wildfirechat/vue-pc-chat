import APIPath from './utils/apiPath.js';
import httpUtils from './utils/httpUtils.js';

/**
 * 消息管理类
 * 
 * 提供消息管理相关的功能，包括：
 * - 发送消息（单聊、群聊、聊天室等）
 * - 撤回消息
 * - 删除消息
 * - 更新消息内容
 * - 广播和群发消息
 * - 会话管理
 * - 消息已读和投递状态查询
 */
class MessageAdmin {
    /**
     * 发送消息
     * @param {string} sender - 发送者用户ID
     * @param {object} conversation - 会话信息 {type, target, line}
     * @param {object} payload - 消息内容
     * @returns {Promise<IMResult>}
     */
    static async sendMessage(sender, conversation, payload) {
        return this.sendMessageWithOptions(sender, conversation, payload, null, false);
    }

    /**
     * 发送消息（可指定部分接收用户）
     * @param {string} sender - 发送者用户ID
     * @param {object} conversation - 会话信息 {type, target, line}
     * @param {object} payload - 消息内容
     * @param {string[]} [toUsers] - 接收用户ID列表，null表示发送给会话中所有用户
     * @returns {Promise<IMResult>}
     */
    static async sendMessageToUsers(sender, conversation, payload, toUsers) {
        return this.sendMessageWithOptions(sender, conversation, payload, toUsers, false);
    }

    /**
     * 发送消息（完整参数版本）
     * @param {string} sender - 发送者用户ID
     * @param {object} conversation - 会话信息 {type, target, line}
     * @param {object} payload - 消息内容
     * @param {string[]} [toUsers] - 接收用户ID列表，null表示发送给会话中所有用户
     * @param {boolean} [isUserMessage=false] - 是否为用户消息
     * @returns {Promise<IMResult>}
     */
    static async sendMessageWithOptions(sender, conversation, payload, toUsers, isUserMessage = false) {
        const messageData = {
            sender: sender,
            conv: conversation,
            payload: payload,
            toUsers: toUsers,
            userMessage: isUserMessage
        };

        // 检查文本消息格式
        if (payload && payload.type === 1 && (!payload.searchableContent || payload.searchableContent.length === 0)) {
            console.warn('Payload错误，Payload格式应该跟客户端消息encode出来的Payload对齐，这样客户端才能正确识别。比如文本消息，文本需要放到searchableContent属性。');
        }

        return httpUtils.httpJsonPost(APIPath.Msg_Send, messageData);
    }

    /**
     * 撤回消息
     * @param {string} operator - 操作者用户ID
     * @param {number} messageUid - 消息UID
     * @returns {Promise<IMResult>}
     */
    static async recallMessage(operator, messageUid) {
        const messageData = {
            operator: operator,
            messageUid: messageUid
        };
        return httpUtils.httpJsonPost(APIPath.Msg_Recall, messageData);
    }

    /**
     * 删除消息（仅专业版支持）
     * @param {number} messageUid - 消息UID
     * @returns {Promise<IMResult>}
     */
    static async deleteMessage(messageUid) {
        const deleteMessageData = {
            messageUid: messageUid
        };
        return httpUtils.httpJsonPost(APIPath.Msg_Delete, deleteMessageData);
    }

    /**
     * 清除用户消息（仅专业版支持）
     * @param {string} userId - 用户ID
     * @param {object} conversation - 会话信息 {type, target, line}
     * @param {number} fromTime - 起始时间
     * @param {number} toTime - 结束时间
     * @returns {Promise<IMResult>}
     */
    static async clearUserMessages(userId, conversation, fromTime, toTime) {
        const clearUserMessages = {
            userId: userId,
            conversation: conversation,
            fromTime: fromTime,
            toTime: toTime
        };
        return httpUtils.httpJsonPost(APIPath.Msg_Clear_By_User, clearUserMessages);
    }

    /**
     * 更新消息内容（仅专业版支持）
     * @param {string} operator - 操作者用户ID
     * @param {number} messageUid - 消息UID
     * @param {object} payload - 新的消息内容
     * @param {boolean} distribute - 是否分发更新
     * @returns {Promise<IMResult>}
     */
    static async updateMessageContent(operator, messageUid, payload, distribute) {
        const updateMessageContentData = {
            operator: operator,
            messageUid: messageUid,
            payload: payload,
            distribute: distribute ? 1 : 0,
            updateTimestamp: 0
        };
        return httpUtils.httpJsonPost(APIPath.Msg_Update, updateMessageContentData);
    }

    /**
     * 清除会话（仅专业版支持）
     * @param {string} userId - 用户ID
     * @param {object} conversation - 会话信息 {type, target, line}
     * @returns {Promise<IMResult>}
     */
    static async clearConversation(userId, conversation) {
        const input = {
            userId: userId,
            conversation: conversation
        };
        return httpUtils.httpJsonPost(APIPath.Conversation_Delete, input);
    }

    /**
     * 获取单条消息
     * @param {number} messageUid - 消息UID
     * @returns {Promise<IMResult>}
     */
    static async getMessage(messageUid) {
        const input = {
            messageUid: messageUid
        };
        return httpUtils.httpJsonPost(APIPath.Msg_GetOne, input);
    }

    /**
     * 撤回广播消息（仅专业版支持）
     * @param {string} operator - 操作者用户ID
     * @param {number} messageUid - 消息UID
     * @returns {Promise<IMResult>}
     */
    static async recallBroadCastMessage(operator, messageUid) {
        const messageData = {
            operator: operator,
            messageUid: messageUid
        };
        return httpUtils.httpJsonPost(APIPath.Msg_RecallBroadCast, messageData);
    }

    /**
     * 撤回群发消息
     * @param {string} operator - 操作者用户ID
     * @param {number} messageUid - 消息UID
     * @param {string[]} receivers - 接收者ID列表
     * @returns {Promise<IMResult>}
     */
    static async recallMultiCastMessage(operator, messageUid, receivers) {
        const messageData = {
            operator: operator,
            messageUid: messageUid,
            receivers: receivers
        };
        return httpUtils.httpJsonPost(APIPath.Msg_RecallMultiCast, messageData);
    }

    /**
     * 删除广播消息（仅专业版支持）
     * @param {string} operator - 操作者用户ID
     * @param {number} messageUid - 消息UID
     * @returns {Promise<IMResult>}
     */
    static async deleteBroadCastMessage(operator, messageUid) {
        const messageData = {
            operator: operator,
            messageUid: messageUid
        };
        return httpUtils.httpJsonPost(APIPath.Msg_DeleteBroadCast, messageData);
    }

    /**
     * 删除群发消息
     * @param {string} operator - 操作者用户ID
     * @param {number} messageUid - 消息UID
     * @param {string[]} receivers - 接收者ID列表
     * @returns {Promise<IMResult>}
     */
    static async deleteMultiCastMessage(operator, messageUid, receivers) {
        const messageData = {
            operator: operator,
            messageUid: messageUid,
            receivers: receivers
        };
        return httpUtils.httpJsonPost(APIPath.Msg_DeleteMultiCast, messageData);
    }

    /**
     * 广播消息（仅专业版支持）
     * @param {string} sender - 发送者用户ID
     * @param {number} line - 线路
     * @param {object} payload - 消息内容
     * @returns {Promise<IMResult>}
     */
    static async broadcastMessage(sender, line, payload) {
        const messageData = {
            sender: sender,
            line: line,
            payload: payload
        };
        return httpUtils.httpJsonPost(APIPath.Msg_Broadcast, messageData);
    }

    /**
     * 群发消息
     * @param {string} sender - 发送者用户ID
     * @param {string[]} receivers - 接收者ID列表
     * @param {number} line - 线路
     * @param {object} payload - 消息内容
     * @returns {Promise<IMResult>}
     */
    static async multicastMessage(sender, receivers, line, payload) {
        const messageData = {
            sender: sender,
            targets: receivers,
            line: line,
            payload: payload
        };
        return httpUtils.httpJsonPost(APIPath.Msg_Multicast, messageData);
    }

    /**
     * 获取会话已读时间戳
     * @param {string} userId - 用户ID
     * @param {object} conversation - 会话信息 {type, target, line}
     * @returns {Promise<IMResult>}
     */
    static async getConversationReadTimestamp(userId, conversation) {
        const input = {
            userId: userId,
            conversationType: conversation.type,
            target: conversation.target,
            line: conversation.line
        };
        return httpUtils.httpJsonPost(APIPath.Msg_ConvRead, input);
    }

    /**
     * 获取消息投递时间戳
     * @param {string} userId - 用户ID
     * @returns {Promise<IMResult>}
     */
    static async getMessageDelivery(userId) {
        const input = {
            userId: userId
        };
        return httpUtils.httpJsonPost(APIPath.Msg_Delivery, input);
    }
}

export default MessageAdmin;
