import MessageContentType from "./messageContentType";
import MessageContent from './messageContent'
import wfc from "../client/wfc";

/**
 * 群待办卡片（类型 1101）。与 wf-enterprise-chat 的 TodoMessageContent 一致。
 *
 * 由应用服务发进群：建好时以创建人身份发一张（action = create，@ 负责人），之后每次
 * 完成、结束、修改、增减负责人、删除，都以操作人身份再发一张。每张都是发出那一刻的快照，
 * 发出后不再改；最新状态要点开详情去服务端取。
 */
export default class TodoMessageContent extends MessageContent {
    static ACTION_CREATE = 'create';
    static ACTION_DONE = 'done';
    static ACTION_UNDONE = 'undone';
    static ACTION_CLOSE = 'close';
    static ACTION_REOPEN = 'reopen';
    static ACTION_EDIT = 'edit';
    static ACTION_ASSIGNEES = 'assignees';
    static ACTION_DELETE = 'delete';

    todoId = '';
    // 这张卡片记录的动作，见 ACTION_* 常量
    action = TodoMessageContent.ACTION_CREATE;
    // 做这个动作的人（同消息发送人）
    operatorId = '';
    creatorId = '';
    content = '';
    // 截止时间（毫秒），0 = 没有
    dueAt = 0;
    // 0 = 进行中，1 = 已结束
    status = 0;
    // 创建人手动结束
    closed = false;
    deleted = false;
    // 负责人（最多前 20 个，画头像用），总数见 assigneeCount
    assignees = [];
    assigneeCount = 0;
    doneCount = 0;
    // assignees 动作：这次加上的 / 移除的负责人
    added = [];
    removed = [];
    // 从某条消息建的：原消息发送人与摘要（只有新建的卡片带）
    srcSenderId = '';
    srcDigest = '';

    constructor(type = MessageContentType.Todo) {
        super(type);
    }

    isCreate() {
        return this.action === TodoMessageContent.ACTION_CREATE;
    }

    isFinished() {
        return this.status === 1;
    }

    // 全员都完成了（不是创建人手动结束的）
    isAllDone() {
        return this.assigneeCount > 0 && this.doneCount >= this.assigneeCount;
    }

    // 会话列表里群聊会在前面加上发送人（即操作人），所以这里只写动作
    digest() {
        let verb = {
            [TodoMessageContent.ACTION_DONE]: this.isAllDone() ? '完成了，已全部完成：' : '完成了：',
            [TodoMessageContent.ACTION_UNDONE]: '取消完成：',
            [TodoMessageContent.ACTION_CLOSE]: '结束了：',
            [TodoMessageContent.ACTION_REOPEN]: '重新打开：',
            [TodoMessageContent.ACTION_EDIT]: '修改了：',
            [TodoMessageContent.ACTION_ASSIGNEES]: '调整了负责人：',
            [TodoMessageContent.ACTION_DELETE]: '删除了：',
        }[this.action] || '';
        return '[待办] ' + verb + this.content;
    }

    encode() {
        let payload = super.encode();
        payload.searchableContent = this.content;
        let obj = {
            todoId: this.todoId,
            action: this.action,
            creatorId: this.creatorId,
            content: this.content,
            dueAt: this.dueAt,
            status: this.status,
            closed: this.closed,
            deleted: this.deleted,
            assignees: this.assignees,
            assigneeCount: this.assigneeCount,
            doneCount: this.doneCount,
        };
        if (this.operatorId) {
            obj.operatorId = this.operatorId;
        }
        if (this.added.length) {
            obj.added = this.added;
        }
        if (this.removed.length) {
            obj.removed = this.removed;
        }
        if (this.srcDigest) {
            obj.src = {senderId: this.srcSenderId, digest: this.srcDigest};
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
            this.action = obj.action || TodoMessageContent.ACTION_CREATE;
            this.operatorId = obj.operatorId || '';
            this.creatorId = obj.creatorId || '';
            this.content = obj.content != null ? obj.content : this.content;
            this.dueAt = obj.dueAt || 0;
            this.status = obj.status || 0;
            this.closed = !!obj.closed;
            this.deleted = !!obj.deleted;
            this.assignees = Array.isArray(obj.assignees) ? obj.assignees : [];
            this.assigneeCount = obj.assigneeCount != null ? obj.assigneeCount : this.assignees.length;
            this.doneCount = obj.doneCount || 0;
            this.added = Array.isArray(obj.added) ? obj.added : [];
            this.removed = Array.isArray(obj.removed) ? obj.removed : [];
            if (obj.src) {
                this.srcSenderId = obj.src.senderId || '';
                this.srcDigest = obj.src.digest || '';
            }
        } catch (e) {
            // 内容坏了就当成一张空卡片，不能让整条消息解不出来
            console.error('decode todo message error', e);
        }
    }
}
