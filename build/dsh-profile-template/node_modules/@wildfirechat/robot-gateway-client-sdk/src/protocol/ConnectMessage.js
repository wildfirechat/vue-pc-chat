/**
 * 鉴权消息类
 * 对应 Java 版本的 ConnectMessage
 *
 * `platform`：机器人 SDK 所在平台（野火 Platform 号，见 ProtoConstants.Platform：
 * 1=iOS, 2=Android, 3=Windows, 4=OSX, 5=WEB, 6=WX, 7=Linux, 10=Harmony ...）。
 * 网关用它调用 im-server 的 `/robot/set_online` 设置机器人在正确平台在线。
 */
export class ConnectMessage {
    constructor(type, robotId = null, secret = null, code = null, msg = null, platform = null) {
        this.type = type;
        this.robotId = robotId;
        this.secret = secret;
        this.code = code;
        this.msg = msg;
        this.platform = platform;
    }

    /**
     * 创建鉴权请求消息
     */
    static authRequest(robotId, secret, platform = null) {
        return new ConnectMessage('connect', robotId, secret, null, null, platform);
    }

    /**
     * 创建鉴权成功响应
     */
    static authSuccess() {
        return new ConnectMessage('connect', null, null, 0, 'success');
    }

    /**
     * 创建鉴权失败响应
     */
    static authFailed(code, msg) {
        return new ConnectMessage('connect', null, null, code, msg);
    }

    /**
     * 创建错误响应
     */
    static error(code, msg) {
        return new ConnectMessage('error', null, null, code, msg);
    }

    toJSON() {
        const obj = { type: this.type };
        if (this.robotId !== null) obj.robotId = this.robotId;
        if (this.secret !== null) obj.secret = this.secret;
        if (this.code !== null) obj.code = this.code;
        if (this.msg !== null) obj.msg = this.msg;
        if (this.platform !== null && this.platform !== undefined) obj.platform = this.platform;
        return obj;
    }

    static fromJSON(json) {
        return new ConnectMessage(
            json.type,
            json.robotId,
            json.secret,
            json.code,
            json.msg,
            json.platform
        );
    }
}
