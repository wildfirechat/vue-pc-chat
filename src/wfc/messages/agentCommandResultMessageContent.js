/*
 * AGENT_Command_Result (209)：AI 面板指令应答消息（机器人→用户）。
 * 透明消息（Transparent）：不存储、不计未读、不在消息流显示（digest 为空）。
 * content = JSON.stringify({ver:1, op:"dirs", seq, robotId?, cwd?, root?, dirs:[], total?, truncated?})
 * 当前仅 op="dirs"（目录列表按需获取）：客户端按 seq 关联 207 op=dirs 的 pending 请求，
 * 应答为目录名数组（非全路径）。decode 容错：非 JSON/字段缺失时保持空值。
 */

import MessageContent from './messageContent'
import MessageContentType from './messageContentType';

export default class AgentCommandResultMessageContent extends MessageContent {
    ver;
    op;
    seq;
    robotId; // 目标机器人（原样回显请求的 robotId；多机器人会话寻址）
    cwd; // 应答时机器人侧的工作目录
    root; // dirs 的来源目录（项目根，绝对路径）
    dirs; // 目录名数组（非全路径，按名称升序）
    total; // 截断前的目录总数
    truncated; // 是否被插件截断（上限 3000）

    constructor(op, seq, robotId, data) {
        super(MessageContentType.AGENT_COMMAND_RESULT);
        this.ver = 1;
        this.op = op;
        this.seq = seq;
        this.robotId = robotId;
        const d = data || {};
        this.cwd = d.cwd;
        this.root = d.root;
        this.dirs = Array.isArray(d.dirs) ? d.dirs : [];
        this.total = d.total;
        this.truncated = d.truncated;
    }

    digest() {
        return '';
    }

    encode() {
        let payload = super.encode();
        const data = {ver: this.ver || 1, op: this.op, seq: this.seq};
        if (this.robotId) data.robotId = this.robotId;
        if (this.cwd) data.cwd = this.cwd;
        if (this.root) data.root = this.root;
        if (Array.isArray(this.dirs)) data.dirs = this.dirs;
        if (this.total !== undefined) data.total = this.total;
        if (this.truncated !== undefined) data.truncated = this.truncated;
        payload.content = JSON.stringify(data);
        payload.searchableContent = '';
        return payload;
    }

    decode(payload) {
        super.decode(payload);
        // 默认空值：content 非法时不抛异常，消费方按「无有效应答」处理
        this.dirs = [];
        try {
            const d = JSON.parse(payload.content);
            if (!d || typeof d !== 'object') return;
            this.ver = d.ver;
            this.op = d.op;
            this.seq = d.seq;
            this.robotId = d.robotId;
            this.cwd = d.cwd;
            this.root = d.root;
            this.dirs = Array.isArray(d.dirs) ? d.dirs : [];
            this.total = d.total;
            this.truncated = d.truncated;
        } catch (e) {
            // 非 JSON 内容忽略
        }
    }
}
