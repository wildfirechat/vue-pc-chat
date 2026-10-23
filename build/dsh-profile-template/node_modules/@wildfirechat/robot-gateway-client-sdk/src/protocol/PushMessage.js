/**
 * 推送消息类
 * 对应 Java 版本的 PushMessage
 */
export class PushMessage {
    constructor(type, data = null) {
        this.type = type;
        this.data = data;
    }

    /**
     * 创建消息推送
     */
    static message(data) {
        return new PushMessage('message', data);
    }

    /**
     * 创建心跳响应
     */
    static heartbeat(timestamp) {
        return new PushMessage('heartbeat', { timestamp });
    }

    toJSON() {
        return {
            type: this.type,
            data: this.data
        };
    }

    static fromJSON(json) {
        return new PushMessage(json.type, json.data);
    }
}
