/*
 * DSH_TaskProgress (208)：任务进度卡片（机器人→用户）。
 * content = JSON.stringify({tasks: [{kind, id, label, status, reason, result, updatedAt}], updatedAt})
 * 客户端渲染为任务列表卡片（子任务/后台任务进度），插件 updateMessage 原地更新。
 */

import MessageContent from './messageContent'
import MessageContentType from './messageContentType';

export default class AgentTaskProgressMessageContent extends MessageContent {
    content = null;

    constructor(content) {
        super(MessageContentType.AGENT_TASK_PROGRESS);
        this.content = content || {tasks: [], updatedAt: 0};
    }

    digest() {
        const tasks = this.content && this.content.tasks || [];
        const running = tasks.filter(t => t.status === 'running').length;
        if (tasks.length === 0) return '🧩 任务：无';
        return running > 0 ? `🧩 任务 ${tasks.length}（${running} 运行中）` : `🧩 任务 ${tasks.length}（全部完成）`;
    }

    encode() {
        let payload = super.encode();
        payload.content = JSON.stringify(this.content);
        payload.searchableContent = this.digest();
        return payload;
    }

    decode(payload) {
        super.decode(payload);
        try {
            this.content = JSON.parse(payload.content || '{}');
        } catch (e) {
            this.content = {tasks: [], updatedAt: 0};
        }
    }
}
