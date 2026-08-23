/*
 * DSH_Command (207)：AI 面板静默指令消息（用户→机器人）。
 * 透明消息（Transparent）：不存储、不计未读、不在消息流显示（digest 为空）。
 * content = JSON.stringify({op: "query"|"set", cmd?, seq?})
 */

import MessageContent from './messageContent'
import MessageContentType from './messageContentType';

export default class DshCommandMessageContent extends MessageContent {
    op;
    cmd;
    seq;

    constructor(op, cmd, seq) {
        super(MessageContentType.DSH_COMMAND);
        this.op = op;
        this.cmd = cmd;
        this.seq = seq;
    }

    digest() {
        return '';
    }

    encode() {
        let payload = super.encode();
        payload.content = JSON.stringify({op: this.op, cmd: this.cmd, seq: this.seq});
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
        } catch (e) {
            // 非 JSON 内容忽略
        }
    }
}
