import MessageContentType from "./messageContentType";
import TodoMessageContent from "./todoMessageContent";

/**
 * 群待办卡片的安静版（类型 1103）：完成、修改这类不 @ 人的动作。内容同 TodoMessageContent，
 * 只是按「只存储、不算未读」注册 —— 野火客户端按消息类型注册的存储方式决定算不算未读。
 */
export default class TodoActivityMessageContent extends TodoMessageContent {
    constructor() {
        super(MessageContentType.Todo_Activity);
    }
}
