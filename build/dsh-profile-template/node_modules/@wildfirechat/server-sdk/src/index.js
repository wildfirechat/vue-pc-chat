/**
 * Wildfire Chat Server SDK for JavaScript/Node.js
 * 
 * 野火IM服务端JavaScript SDK
 * 
 * 提供与Java版本Server SDK完全对齐的功能，包括：
 * - 用户管理 (UserAdmin)
 * - 消息管理 (MessageAdmin)
 * - 群组管理 (GroupAdmin)
 * - 好友关系管理 (RelationAdmin)
 * - 聊天室管理 (ChatroomAdmin)
 * - 频道管理 (ChannelAdmin)
 * - 通用管理 (GeneralAdmin)
 * - 会议管理 (ConferenceAdmin)
 * - 敏感词管理 (SensitiveAdmin)
 * - 朋友圈管理 (MomentsAdmin)
 * - 机器人服务 (RobotService)
 * 
 * @example
 * import { init, UserAdmin, MessageAdmin } from '@wildfirechat/server-sdk';
 * 
 * // 初始化SDK
 * init('http://localhost:18080', 'your-secret-key');
 * 
 * // 获取用户信息
 * const result = await UserAdmin.getUserByUserId('userId');
 * console.log(result.getResult());
 */

import httpUtils from './utils/httpUtils.js';

// ========== Admin 管理类 ==========
import UserAdmin from './userAdmin.js';
import MessageAdmin from './messageAdmin.js';
import GroupAdmin from './groupAdmin.js';
import RelationAdmin from './relationAdmin.js';
import ChatroomAdmin from './chatroomAdmin.js';
import ChannelAdmin from './channelAdmin.js';
import GeneralAdmin from './generalAdmin.js';
import ConferenceAdmin from './conferenceAdmin.js';
import SensitiveAdmin from './sensitiveAdmin.js';
import MomentsAdmin from './momentsAdmin.js';

// ========== 服务类 ==========
import RobotService from './robotService.js';

// ========== 工具类 ==========
import IMResult from './utils/imResult.js';
import ErrorCode from './utils/errorCode.js';
import APIPath from './utils/apiPath.js';

// ========== Model 类 ==========
import UserInfo from './model/userInfo.js';
import GroupInfo from './model/groupInfo.js';
import GroupMember from './model/groupMember.js';
import GroupType from './model/groupType.js';
import GroupMemberType from './model/groupMemberType.js';
import Conversation from './model/conversation.js';
import ConversationType from './model/conversationType.js';
import ChatRoomInfo from './model/chatRoomInfo.js';
import ChannelInfo from './model/channelInfo.js';
import QuoteInfo from './model/quoteInfo.js';

// ========== Message 类 ==========
import MessagePayload from './messages/messagePayload.js';
import MessageContent from './messages/messageContent.js';
import MessageContentType from './messages/messageContentType.js';
import MessageContentMediaType from './messages/messageContentMediaType.js';
import TextMessageContent from './messages/textMessageContent.js';
import ImageMessageContent from './messages/imageMessageContent.js';
import FileMessageContent from './messages/fileMessageContent.js';
import MediaMessageContent from './messages/mediaMessageContent.js';
import SoundMessageContent from './messages/soundMessageContent.js';
import VideoMessageContent from './messages/videoMessageContent.js';
import LocationMessageContent from './messages/locationMessageContent.js';
import CardMessageContent from './messages/cardMessageContent.js';
import StickerMessageContent from './messages/stickerMessageContent.js';
import LinkMessageContent from './messages/linkMessageContent.js';
import DeleteMessageContent from './messages/deleteMessageContent.js';
import TypingMessageContent from './messages/typingMessageContent.js';
import UnknownMessageContent from './messages/unknownMessageContent.js';
import Message from './messages/message.js';
import MessageStatus from './messages/messageStatus.js';
import PersistFlag from './messages/persistFlag.js';
import ArticlesMessageContent from './messages/articlesMessageContent.js';
import TipNotificationMessageContent from './messages/notification/tipNotification.js';
import RichNotificationMessageContent from './messages/notification/richNotificationMessageContent.js';
import StreamingTextGeneratingMessageContent from './messages/streamingTextGeneratingMessageContent.js';
import StreamingTextGeneratedMessageContent from './messages/streamingTextGeneratedMessageContent.js';

/**
 * 初始化SDK
 * 
 * @param {string} url - IM服务管理地址，例如: http://localhost:18080
 * @param {string} secret - 管理密钥
 * @param {number} [timeout=15000] - 请求超时时间（毫秒）
 * @example
 * init('http://localhost:18080', 'your-secret-key');
 */
function init(url, secret, timeout = 15000) {
    httpUtils.init(url, secret, timeout);
}

/**
 * 获取当前SDK配置信息
 * @returns {object}
 */
function getConfig() {
    return {
        url: httpUtils.adminUrl,
        timeout: httpUtils.timeout,
        initialized: !!(httpUtils.adminUrl && httpUtils.adminSecret)
    };
}

export {
    // 初始化函数
    init,
    getConfig,

    // Admin 管理类
    UserAdmin,
    MessageAdmin,
    GroupAdmin,
    RelationAdmin,
    ChatroomAdmin,
    ChannelAdmin,
    GeneralAdmin,
    ConferenceAdmin,
    SensitiveAdmin,
    MomentsAdmin,

    // 服务类
    RobotService,

    // 工具类
    IMResult,
    ErrorCode,
    APIPath,

    // Model 类
    UserInfo,
    GroupInfo,
    GroupMember,
    GroupType,
    GroupMemberType,
    Conversation,
    ConversationType,
    ChatRoomInfo,
    ChannelInfo,
    QuoteInfo,

    // Message 类
    MessagePayload,
    MessageContent,
    MessageContentType,
    MessageContentMediaType,
    TextMessageContent,
    ImageMessageContent,
    FileMessageContent,
    MediaMessageContent,
    SoundMessageContent,
    VideoMessageContent,
    LocationMessageContent,
    CardMessageContent,
    StickerMessageContent,
    LinkMessageContent,
    DeleteMessageContent,
    TypingMessageContent,
    UnknownMessageContent,
    Message,
    MessageStatus,
    PersistFlag,
    ArticlesMessageContent,
    TipNotificationMessageContent,
    RichNotificationMessageContent,
    StreamingTextGeneratingMessageContent,
    StreamingTextGeneratedMessageContent,
};
