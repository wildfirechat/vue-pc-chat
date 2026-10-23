// ==================== 核心客户端类 ====================
export { RobotServiceClient, OutputPresignedUploadUrl, MediaEntry } from './RobotServiceClient.js';
export { ConnectionManager } from './ConnectionManager.js';
export { RobotGatewayClient } from './RobotGatewayClient.js';

// ==================== 协议消息类 ====================
export { RequestMessage } from './protocol/RequestMessage.js';
export { ResponseMessage } from './protocol/ResponseMessage.js';
export { ConnectMessage } from './protocol/ConnectMessage.js';
export { PushMessage } from './protocol/PushMessage.js';

// ==================== 处理器类 ====================
export { MessageHandler } from './handler/MessageHandler.js';
export { ResponseHandler } from './handler/ResponseHandler.js';

// ==================== 从 server-sdk.js 重新导出模型类 ====================
// 这些类用于创建消息、会话等
export {
    // 基础模型
    Conversation,
    ConversationType,
    
    // 用户和群组
    UserInfo,
    GroupInfo,
    GroupMember,
    GroupType,
    GroupMemberType,
    
    // 聊天室和频道
    ChatRoomInfo,
    ChannelInfo,
    
    // 消息内容
    MessagePayload,
    MessageContent,
    MessageContentType,
    TextMessageContent,
    ImageMessageContent,
    FileMessageContent,
    LocationMessageContent,
    
    // 结果封装
    IMResult,
    
    // 初始化函数
    init
} from '@wildfirechat/server-sdk';
