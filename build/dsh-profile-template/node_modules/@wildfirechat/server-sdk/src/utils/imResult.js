import ErrorCode from './errorCode.js';

/**
 * IM结果类
 * 
 * 泛型类，用于封装所有API调用的返回结果。
 * 包含错误码、错误消息和返回数据。
 */
class IMResult {
    /**
     * 创建IMResult实例
     * @param {number} code - 错误码
     * @param {string} msg - 错误消息
     * @param {any} result - 返回数据
     */
    constructor(code = ErrorCode.ERROR_CODE_SUCCESS, msg = '', result = null) {
        this.code = code;
        this.msg = msg;
        this.result = result;
    }

    /**
     * 获取错误码
     * @returns {number}
     */
    getCode() {
        return this.code;
    }

    /**
     * 设置错误码
     * @param {number} code
     */
    setCode(code) {
        this.code = code;
    }

    /**
     * 获取错误码枚举
     * @returns {string}
     */
    getErrorCode() {
        return ErrorCode.fromCode(this.code);
    }

    /**
     * 获取错误消息
     * @returns {string}
     */
    getMsg() {
        return this.msg;
    }

    /**
     * 设置错误消息
     * @param {string} msg
     */
    setMsg(msg) {
        this.msg = msg;
    }

    /**
     * 获取返回数据
     * @returns {any}
     */
    getResult() {
        return this.result;
    }

    /**
     * 设置返回数据
     * @param {any} result
     */
    setResult(result) {
        this.result = result;
    }

    /**
     * 判断是否成功
     * @returns {boolean}
     */
    isSuccess() {
        return this.code === ErrorCode.ERROR_CODE_SUCCESS;
    }

    /**
     * 判断是否失败
     * @returns {boolean}
     */
    isFailure() {
        return !this.isSuccess();
    }
}

export default IMResult;
