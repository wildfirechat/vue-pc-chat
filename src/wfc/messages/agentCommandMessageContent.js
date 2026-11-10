/*
 * AGENT_Command (207)：AI 面板静默指令消息（用户→机器人）。
 * 透明消息（Transparent）：不存储、不计未读、不在消息流显示（digest 为空）。
 * content = JSON.stringify({op: "query"|"set"|"sessions"|"switch"|"create", cmd?, seq?, robotId?, sessionId?})
 *   op=sessions：请求最近会话列表（209 应答）；op=switch：切换到 sessionId 指定的历史会话
 *   op=create：新建 DSH 工作区群；可带 model/effort/sandbox/preset 作为新会话的
 *   初始配置（插件在首条消息前写入会话级覆盖）
 */

import MessageContent from './messageContent'
import MessageContentType from './messageContentType';

export default class AgentCommandMessageContent extends MessageContent {
    op;
    cmd;
    seq;
    robotId; // 目标机器人（多机器人会话寻址；空=当前会话默认机器人）
    sessionId; // op=switch 时的目标历史会话 id
    path; // op=create 时的工作区目录（auto 或绝对路径）
    name; // op=create 时的会话/群名称
    model; // op=create 时的初始模型（provider/model，空=部署默认）
    effort; // op=create 时的初始推理等级
    sandbox; // op=create 时的初始沙箱权限模式
    preset; // op=create 时的初始 agent preset
    silent; // 本地客户端操作：插件不要往单聊发成功类通知（远端用户操作仍发）

    constructor(op, cmd, seq, robotId, sessionId, path = '', name = '', options = null, silent = false) {
        super(MessageContentType.AGENT_COMMAND);
        this.op = op;
        this.cmd = cmd;
        this.seq = seq;
        this.robotId = robotId;
        this.sessionId = sessionId;
        this.path = path;
        this.name = name;
        const opts = options || {};
        this.model = opts.model || '';
        this.effort = opts.effort || '';
        this.sandbox = opts.sandbox || '';
        this.preset = opts.preset || '';
        this.silent = silent === true;
    }

    digest() {
        return '';
    }

    encode() {
        let payload = super.encode();
        const data = {op: this.op, cmd: this.cmd, seq: this.seq};
        if (this.robotId) data.robotId = this.robotId;
        if (this.sessionId) data.sessionId = this.sessionId;
        if (this.path) data.path = this.path;
        if (this.name) data.name = this.name;
        if (this.model) data.model = this.model;
        if (this.effort) data.effort = this.effort;
        if (this.sandbox) data.sandbox = this.sandbox;
        if (this.preset) data.preset = this.preset;
        if (this.silent) data.silent = true;
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
            this.path = d.path;
            this.name = d.name;
            this.model = d.model;
            this.effort = d.effort;
            this.sandbox = d.sandbox;
            this.preset = d.preset;
            this.silent = d.silent === true;
        } catch (e) {
            // 非 JSON 内容忽略
        }
    }
}
