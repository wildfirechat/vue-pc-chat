/*
 * AGENT_Command (207)：AI 面板静默指令消息（用户→机器人）。
 * 透明消息（Transparent）：不存储、不计未读、不在消息流显示（digest 为空）。
 * content = JSON.stringify({op: "query"|"set", cmd?, seq?})
 */

import MessageContent from './messageContent'
import MessageContentType from './messageContentType';

export default class AgentCommandMessageContent extends MessageContent {
    op;
    cmd;
    seq;
    robotId; // 目标机器人（多机器人会话寻址；空=当前会话默认机器人）

    constructor(op, cmd, seq, robotId) {
        super(MessageContentType.AGENT_COMMAND);
        this.op = op;
        this.cmd = cmd;
        this.seq = seq;
        this.robotId = robotId;
    }

    digest() {
        return '';
    }

    encode() {
        let payload = super.encode();
        const data = {op: this.op, cmd: this.cmd, seq: this.seq};
        if (this.robotId) data.robotId = this.robotId;
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
        } catch (e) {
            // 非 JSON 内容忽略
        }
    }
}
