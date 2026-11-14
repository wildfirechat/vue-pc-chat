/**
 * Minimal ambient type declarations for the plain-JS wildfire SDK packages.
 * Only the surface used by this plugin is declared.
 */

declare module "@wildfirechat/robot-gateway-client-sdk" {
  export interface MessageHandler {
    onMessage?(message: any): void;
    onConnectionChanged?(connected: boolean): void;
    onError?(error: Error): void;
  }

  export interface ClientOptions {
    timeout?: number;
    reconnectInterval?: number;
    heartbeatInterval?: number;
    /** 机器人平台号（可选覆盖）；缺省时 SDK 按运行环境自动探测（Linux=7 / macOS=4 / Windows=3）。 */
    platform?: number;
  }

  export class RobotServiceClient {
    constructor(gatewayUrl: string, messageHandler?: MessageHandler | null, options?: ClientOptions);
    connect(robotId: string, robotSecret: string, timeoutSeconds?: number, platform?: number): Promise<boolean>;
    close(): void;
    isConnected(): boolean;
    isAuthenticated(): boolean;
    sendMessage(conversation: any, payload: any): Promise<any>;
    uploadFile(fileData: Buffer, fileName: string, messageContentMediaType?: number, mimeType?: string): Promise<any>;
    getGroupInfo(groupId: string): Promise<{ code: number; msg?: string; result?: any }>;
    getProfile(): Promise<{ code: number; msg?: string; result?: { owner?: string } & Record<string, any> }>;
    createGroup(groupInfo: any, members: any[], to: string, lines: number[], payload: any): Promise<{ code: number; msg?: string; result?: { group_id?: string } }>;
    /** Modify group info: type 0 = group name (ModifyGroupInfoType.Modify_Group_Name). */
    modifyGroupInfo(groupId: string, type: number, value: string, lines?: number[], payload?: any): Promise<{ code: number; msg?: string; isSuccess?: () => boolean }>;
    updateConversationUserSetting(conversation: any, type: number, value: string): Promise<{ code: number; msg?: string }>;
    dismissGroup(groupId: string, lines?: number[] | null, payload?: any): Promise<{ code: number; msg?: string }>;
    updateMessage(messageId: string, payload: any): Promise<{ code: number; msg?: string }>;
    /** 群管理：踢人/拉人/禁言/成员列表（机器人以群主身份操作；lines=通知线路，用 AI 线） */
    kickoffGroupMembers(groupId: string, members: string[], lines?: number[] | null, payload?: any): Promise<{ code: number; msg?: string; isSuccess?: () => boolean }>;
    addGroupMembers(groupId: string, members: string[], to?: string | null, lines?: number[] | null, payload?: any): Promise<{ code: number; msg?: string; isSuccess?: () => boolean }>;
    muteGroupMember(groupId: string, members: string[], mute: boolean, lines?: number[] | null, payload?: any): Promise<{ code: number; msg?: string; isSuccess?: () => boolean }>;
    getGroupMembers(groupId: string): Promise<{ code: number; msg?: string; result?: Array<{ member_id?: string; type?: number }> }>;
    /** 获取用户信息（@提及上下文解析被 @ 用户显示名用） */
    getUserInfo(userId: string): Promise<{ code: number; msg?: string; result?: { userId?: string; name?: string; displayName?: string } | any; isSuccess?: () => boolean }>;
    /** 获取单条消息（只能获取机器人参与会话中的消息）。messageUid 是超长 long，
     *  JS 必须传字符串（number 会丢精度），网关响应里同时提供 messageUidString 字符串字段。 */
    getMessage(messageUid: string): Promise<{ code: number; msg?: string; result?: any; isSuccess?: () => boolean }>;
  }
}

declare module "@wildfirechat/server-sdk" {
  export class MessageContent {
    constructor(type?: number);
    encode(): any;
    decode(payload: any): void;
  }

  export class TextMessageContent extends MessageContent {
    constructor();
    content: string;
  }

  export const MessageContentMediaType: {
    General: 0;
    Image: 1;
    Voice: 2;
    Video: 3;
    File: 4;
    Portrait: 5;
    Sticker: 7;
  };

  export class ImageMessageContent extends MessageContent {
    constructor(mediaType: any, remoteUrl: string | null, localPath: string | null);
  }

  export class FileMessageContent extends MessageContent {
    constructor(mediaType: any, remoteUrl: string | null, name: string | null, size: number);
  }

  export class StreamingTextGeneratingMessageContent extends MessageContent {
    constructor();
    text: string;
    streamId: string;
  }

  export class StreamingTextGeneratedMessageContent extends MessageContent {
    constructor();
    text: string;
    streamId: string;
  }

  export class TipNotificationMessageContent extends MessageContent {
    constructor(tip: string);
    tip: string;
  }

  export interface Conversation {
    type: number;
    target: string;
    line: number;
  }
}
