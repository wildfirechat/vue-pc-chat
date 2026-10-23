/**
 * 消息处理器接口
 * 对应 Java 版本的 MessageHandler
 */
export class MessageHandler {
    /**
     * 收到消息时调用
     * @param {PushMessage} message - 推送消息
     */
    onMessage(message) {
        // 子类实现
    }

    /**
     * 连接状态变化时调用
     * @param {boolean} connected - 是否已连接
     */
    onConnectionChanged(connected) {
        // 子类实现
    }

    /**
     * 发生错误时调用
     * @param {string} error - 错误信息
     */
    onError(error) {
        // 子类实现
    }
}
