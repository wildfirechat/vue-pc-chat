/*
 * AGENT_Command (207)：AI 面板静默指令消息（用户→机器人）。
 * 透明消息（Transparent）：不存储、不计未读、不在消息流显示（digest 为空）。
 * content = JSON.stringify({op: "query"|"set"|"sessions"|"switch", cmd?, seq?, robotId?, sessionId?})
 *   op=sessions：请求最近会话列表（209 应答）；op=switch：切换到 sessionId 指定的历史会话
 */

import MessageContent from './messageContent'
import MessageContentType from './messageContentType';

export default class AgentCommandMessageContent extends MessageContent {
    op;
    cmd;
    seq;
    robotId; // 目标机器人（多机器人会话寻址；空=当前会话默认机器人）
    sessionId; // op=switch 时的目标历史会话 id

    constructor(op, cmd, seq, robotId, sessionId) {
        super(MessageContentType.AGENT_COMMAND);
        this.op = op;
        this.cmd = cmd;
        this.seq = seq;
        this.robotId = robotId;
        this.sessionId = sessionId;
    }

    digest() {
        return '';
    }

    encode() {
        let payload = super.encode();
        const data = {op: this.op, cmd: this.cmd, seq: this.seq};
        if (this.robotId) data.robotId = this.robotId;
        if (this.sessionId) data.sessionId = this.sessionId;
        payload.content = JSON.stringify(data);
        payload.searchableContent = '';
        return payload;
    }

    decode(payload) {
        super.decode(payload);
        try {
            const d = JSON.parse(payload.content);
            this.op = d.op;
            this.cmd = d.cmd;
            this.seq = d.seq;
            this.robotId = d.robotId;
            this.sessionId = d.sessionId;
        } catch (e) {
            // 非 JSON 内容忽略
        }
    }
}
