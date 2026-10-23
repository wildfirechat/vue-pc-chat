/**
 * 响应消息类
 * 对应 Java 版本的 ResponseMessage
 */
export class ResponseMessage {
    constructor(requestId, code, msg, result = null) {
        this.requestId = requestId;
        this.code = code;
        this.msg = msg;
        this.result = result;
    }

    /**
     * 是否成功
     */
    isSuccess() {
        return this.code === 0;
    }

    /**
     * 创建成功响应
     */
    static success(requestId, result) {
        return new ResponseMessage(requestId, 0, 'success', result);
    }

    /**
     * 创建错误响应
     */
    static error(requestId, code, msg) {
        return new ResponseMessage(requestId, code, msg, null);
    }

    toJSON() {
        return {
            requestId: this.requestId,
            code: this.code,
            msg: this.msg,
            result: this.result
        };
    }

    static fromJSON(json) {
        return new ResponseMessage(json.requestId, json.code, json.msg, json.result);
    }
}
