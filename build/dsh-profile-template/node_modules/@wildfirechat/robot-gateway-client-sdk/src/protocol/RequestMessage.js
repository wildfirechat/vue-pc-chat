/**
 * 请求消息类
 * 对应 Java 版本的 RequestMessage
 */
export class RequestMessage {
    constructor(requestId, method, params = []) {
        this.requestId = requestId;
        this.method = method;
        this.params = params;
    }

    toJSON() {
        return {
            requestId: this.requestId,
            method: this.method,
            params: this.params
        };
    }

    static fromJSON(json) {
        return new RequestMessage(json.requestId, json.method, json.params);
    }
}
