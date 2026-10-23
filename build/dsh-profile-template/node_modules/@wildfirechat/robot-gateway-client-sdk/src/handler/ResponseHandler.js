import { ResponseMessage } from '../protocol/ResponseMessage.js';

/**
 * 响应处理器
 * 管理待处理的请求和响应匹配
 */
export class ResponseHandler {
    constructor(timeout = 30) {
        // 待处理的请求: requestId -> { resolve, reject, timer }
        this.pendingRequests = new Map();
        this.timeout = timeout * 1000; // 转换为毫秒
    }

    /**
     * 注册请求，返回 Promise
     * @param {string} requestId - 请求ID
     * @returns {Promise<ResponseMessage>}
     */
    registerRequest(requestId) {
        return new Promise((resolve, reject) => {
            // 设置超时定时器
            const timer = setTimeout(() => {
                this.pendingRequests.delete(requestId);
                reject(new Error(`Request timeout: ${requestId}`));
            }, this.timeout);

            // 存储请求
            this.pendingRequests.set(requestId, { resolve, reject, timer });
        });
    }

    /**
     * 处理响应消息
     * @param {ResponseMessage} response - 响应消息
     * @returns {boolean} - 是否找到对应的请求
     */
    handleResponse(response) {
        const pending = this.pendingRequests.get(response.requestId);
        if (!pending) {
            return false;
        }

        // 清除超时定时器
        clearTimeout(pending.timer);
        this.pendingRequests.delete(response.requestId);

        // 解析 Promise
        if (response.isSuccess()) {
            pending.resolve(response);
        } else {
            pending.reject(new Error(`Server error [${response.code}]: ${response.msg}`));
        }

        return true;
    }

    /**
     * 清理所有待处理的请求
     * @param {string} reason - 清理原因
     */
    clearAll(reason = 'Connection closed') {
        for (const [requestId, pending] of this.pendingRequests) {
            clearTimeout(pending.timer);
            pending.reject(new Error(`${reason}: ${requestId}`));
        }
        this.pendingRequests.clear();
    }

    /**
     * 获取待处理请求数量
     */
    getPendingCount() {
        return this.pendingRequests.size;
    }
}
