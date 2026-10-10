import MessageContentType from "./messageContentType";
import MessageContent from './messageContent'
import wfc from "../client/wfc";

/**
 * 待办通知（类型 1102）：待办助手单聊发给负责人。与 wf-enterprise-chat 的 TodoNotifyMessageContent 一致。
 */
export default class TodoNotifyMessageContent extends MessageContent {
    static KIND_REMIND = 'remind';
    static KIND_URGE = 'urge';

    todoId = '';
    // KIND_REMIND 到点提醒 / KIND_URGE 催办
    kind = TodoNotifyMessageContent.KIND_REMIND;
    // 催办人（到点提醒没有）
    operatorId = '';
    content = '';
    dueAt = 0;
    // 群待办所在的群
    groupId = '';

    constructor() {
        super(MessageContentType.Todo_Notify);
    }

    digest() {
        return (this.kind === TodoNotifyMessageContent.KIND_URGE ? '[催办] ' : '[待办提醒] ') + this.content;
    }

    encode() {
        let payload = super.encode();
        payload.searchableContent = this.content;
        let obj = {
            todoId: this.todoId,
            kind: this.kind,
            content: this.content,
            dueAt: this.dueAt,
        };
        if (this.operatorId) {
            obj.operatorId = this.operatorId;
        }
        if (this.groupId) {
            obj.groupId = this.groupId;
        }
        payload.binaryContent = wfc.utf8_to_b64(JSON.stringify(obj));
        return payload;
    }

    decode(payload) {
        super.decode(payload);
        this.content = payload.searchableContent || '';
        if (!payload.binaryContent) {
            return;
        }
        try {
            let obj = JSON.parse(wfc.b64_to_utf8(payload.binaryContent));
            this.todoId = obj.todoId != null ? String(obj.todoId) : '';
            this.kind = obj.kind || TodoNotifyMessageContent.KIND_REMIND;
            this.operatorId = obj.operatorId || '';
            this.content = obj.content != null ? obj.content : this.content;
            this.dueAt = obj.dueAt || 0;
            this.groupId = obj.groupId || '';
        } catch (e) {
            console.error('decode todo notify message error', e);
        }
    }
}
