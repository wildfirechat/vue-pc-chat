/*
 * DSH × Wildfire 结构化交互消息内容类（200-206，官方预留 AI 交互段）。
 *
 * Payload convention:
 *   payload.content           = JSON string (structured data)
 *   payload.searchableContent = human summary (search/notification visible)
 *
 * Card `state` field (pending/answered/approved/rejected/expired) drives the
 * button availability; the sender (robot) updates it via updateMessage.
 */

import MessageContent from './messageContent';
import MessageContentType from './messageContentType';

export function summarizeQuestion(content) {
    const first = Array.isArray(content.questions) ? content.questions[0] : null;
    if (!first) return '🤔 需要你确认';
    return `🤔 ${first.header ? `【${first.header}】` : ''}${first.question}`;
}

export function summarizeApproval(content) {
    return `🔐 工具审批：${content.toolName || '工具'}${content.reason ? `（${content.reason}）` : ''}`;
}

export function summarizeGoal(content) {
    return `🎯 ${content.objective || '目标'}（${content.phase || ''}，round ${content.roundsStarted ?? 0}）`;
}

function decodeJson(payload) {
    try {
        return JSON.parse(payload.content || '{}');
    } catch (e) {
        return {};
    }
}

function encodeJson(content, summary) {
    return {
        content: JSON.stringify(content),
        searchableContent: summary,
    };
}

export class AgentQuestionMessageContent extends MessageContent {
    constructor(content) {
        super(MessageContentType.AGENT_QUESTION);
        this.content = content || { questions: [], state: 'pending' };
    }

    digest() {
        return summarizeQuestion(this.content);
    }

    encode() {
        return Object.assign(super.encode(), encodeJson(this.content, this.digest()));
    }

    decode(payload) {
        super.decode(payload);
        this.content = decodeJson(payload);
    }
}

export class AgentAnswerMessageContent extends MessageContent {
    constructor(content) {
        super(MessageContentType.AGENT_ANSWER);
        this.content = content || { qid: '', answers: [] };
    }

    digest() {
        const answers = Array.isArray(this.content.answers) ? this.content.answers : [];
        const parts = answers.map(a => {
            if (a.selected && a.selected.length) return a.selected.join('、');
            if (a.custom) return a.custom;
            return '';
        }).filter(Boolean);
        return parts.length ? `已选择：${parts.join('；')}` : '（已作答）';
    }

    encode() {
        return Object.assign(super.encode(), encodeJson(this.content, this.digest()));
    }

    decode(payload) {
        super.decode(payload);
        this.content = decodeJson(payload);
    }
}

export class AgentApprovalMessageContent extends MessageContent {
    constructor(content) {
        super(MessageContentType.AGENT_APPROVAL);
        this.content = content || { aid: '', toolName: '', state: 'pending' };
    }

    digest() {
        return summarizeApproval(this.content);
    }

    encode() {
        return Object.assign(super.encode(), encodeJson(this.content, this.digest()));
    }

    decode(payload) {
        super.decode(payload);
        this.content = decodeJson(payload);
    }
}

export class AgentApprovalResultMessageContent extends MessageContent {
    constructor(content) {
        super(MessageContentType.AGENT_APPROVAL_RESULT);
        this.content = content || { aid: '', action: 'reject' };
    }

    digest() {
        return this.content.action === 'approve' ? '（已同意）' : '（已拒绝）';
    }

    encode() {
        return Object.assign(super.encode(), encodeJson(this.content, this.digest()));
    }

    decode(payload) {
        super.decode(payload);
        this.content = decodeJson(payload);
    }
}

export class AgentGoalMessageContent extends MessageContent {
    constructor(content) {
        super(MessageContentType.AGENT_GOAL);
        this.content = content || { gid: '', objective: '', phase: 'active', roundsStarted: 0 };
    }

    digest() {
        return summarizeGoal(this.content);
    }

    encode() {
        return Object.assign(super.encode(), encodeJson(this.content, this.digest()));
    }

    decode(payload) {
        super.decode(payload);
        this.content = decodeJson(payload);
    }
}
