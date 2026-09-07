/**
 * 会话线路（conversation.line / lines 参数）语义常量：
 * 0=default（默认会话）、1=moment（朋友圈）、2=agent（AI/Agent 会话，多机器人群聊）。
 * 供 getConversationList / getUnreadCount 等 lines 参数使用，避免散落裸数字 0/1/2。
 */
export default class ConversationLine {
    /** 默认线路（普通单聊/群聊/频道等） */
    static Default = 0;
    /** 朋友圈线路 */
    static Moment = 1;
    /** AI/Agent 会话线路（line=2 的多机器人群聊） */
    static Agent = 2;
}
