import https from 'https';
import http from 'http';
import { URL } from 'url';
import crypto from 'crypto';
import IMResult from './imResult.js';
import ErrorCode from './errorCode.js';

/**
 * HTTP工具类
 * 
 * 提供HTTP请求相关的工具方法，包括：
 * - HTTP POST/GET请求
 * - 请求签名
 * - 响应处理
 */
class HttpUtils {
    constructor() {
        this.adminUrl = null;
        this.adminSecret = null;
        this.timeout = 15000;
    }

    /**
     * 初始化HTTP工具
     * @param {string} url - IM服务管理地址
     * @param {string} secret - 管理密钥
     * @param {number} [timeout=15000] - 超时时间（毫秒）
     */
    init(url, secret, timeout = 15000) {
        if (!url || !secret) {
            throw new Error('IM服务地址或密钥不能为空');
        }
        this.adminUrl = url.trim();
        this.adminSecret = secret.trim();
        this.timeout = timeout;
    }

    /**
     * 验证初始化状态
     * @private
     */
    _validateInitStatus() {
        if (!this.adminUrl || !this.adminSecret) {
            throw new Error('野火IM Server SDK未初始化，请调用init(url, secret)完成初始化');
        }
    }

    /**
     * 生成签名
     * @private
     * @returns {{nonce: string, timestamp: string, sign: string}}
     */
    _generateSignature() {
        const nonce = Math.floor(Math.random() * 1000000) + 1;
        const timestamp = Date.now();
        const signStr = `${nonce}|${this.adminSecret}|${timestamp}`;
        const sign = crypto.createHash('sha1').update(signStr).digest('hex');
        
        return {
            nonce: nonce.toString(),
            timestamp: timestamp.toString(),
            sign: sign
        };
    }

    /**
     * 截断超长日志内容
     * @private
     * @param {string} content
     * @param {number} maxLength
     * @returns {string}
     */
    _truncateLogContent(content, maxLength = 1024) {
        if (!content) {
            return '';
        }
        if (content.length > maxLength) {
            return content.substring(0, maxLength) + '...';
        }
        return content;
    }

    /**
     * 掩码处理密钥
     * @private
     * @param {string} secret
     * @returns {string}
     */
    _maskSecret(secret) {
        if (!secret || secret.length <= 4) {
            return '******';
        }
        return secret.substring(0, 2) + '******' + secret.substring(secret.length - 2);
    }

    /**
     * HTTP GET请求
     * @param {string} path - 请求路径
     * @returns {Promise<IMResult>}
     */
    async httpGet(path) {
        this._validateInitStatus();
        
        const url = new URL(path, this.adminUrl);
        const options = {
            method: 'GET',
            timeout: this.timeout,
            headers: {
                'Content-Type': 'application/json; charset=utf-8'
            }
        };

        return new Promise((resolve, reject) => {
            const client = url.protocol === 'https:' ? https : http;
            
            const req = client.request(url, options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const result = this._handleResponse(res.statusCode, data);
                        resolve(result);
                    } catch (error) {
                        reject(error);
                    }
                });
            });

            req.on('error', (error) => {
                reject(new Error(`HTTP GET请求异常：${error.message}`));
            });

            req.on('timeout', () => {
                req.destroy();
                reject(new Error('HTTP GET请求超时'));
            });

            req.end();
        });
    }

    /**
     * HTTP JSON POST请求
     * @param {string} path - 请求路径
     * @param {object} data - 请求数据
     * @returns {Promise<IMResult>}
     */
    async httpJsonPost(path, data) {
        this._validateInitStatus();

        const url = new URL(path, this.adminUrl);
        const signature = this._generateSignature();
        const postData = data ? JSON.stringify(data) : '';

        const options = {
            method: 'POST',
            timeout: this.timeout,
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'Connection': 'Keep-Alive',
                'nonce': signature.nonce,
                'timestamp': signature.timestamp,
                'sign': signature.sign,
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        return new Promise((resolve, reject) => {
            const client = url.protocol === 'https:' ? https : http;
            
            const req = client.request(url, options, (res) => {
                let responseData = '';
                res.on('data', chunk => responseData += chunk);
                res.on('end', () => {
                    try {
                        const result = this._handleResponse(res.statusCode, responseData);
                        resolve(result);
                    } catch (error) {
                        reject(error);
                    }
                });
            });

            req.on('error', (error) => {
                reject(new Error(`HTTP POST请求异常：${error.message}`));
            });

            req.on('timeout', () => {
                req.destroy();
                reject(new Error('HTTP POST请求超时'));
            });

            if (postData) {
                req.write(postData);
            }
            req.end();
        });
    }

    /**
     * 处理HTTP响应
     * @private
     * @param {number} statusCode
     * @param {string} content
     * @returns {IMResult}
     */
    _handleResponse(statusCode, content) {
        // 非200状态码处理
        if (statusCode !== 200) {
            const errorMsg = `HTTP请求失败，状态码：${statusCode}，响应内容：${this._truncateLogContent(content)}`;
            throw new Error(errorMsg);
        }

        // 处理空响应
        if (!content || content.trim() === '') {
            return new IMResult(0, 'success', null);
        }

        // 解析响应体
        let result;
        try {
            result = JSON.parse(content);
        } catch (error) {
            throw new Error(`JSON解析失败：${error.message}，响应内容：${this._truncateLogContent(content)}`);
        }

        const imResult = new IMResult(result.code, result.msg, result.result);

        // 特殊错误码处理
        if (imResult.getErrorCode() === 'ERROR_CODE_AUTH_FAILURE') {
            console.error(`鉴权失败，请检查IM服务地址(${this.adminUrl})或密钥(${this._maskSecret(this.adminSecret)})配置`);
        } else if (imResult.getErrorCode() === 'ERROR_CODE_SIGN_EXPIRED') {
            console.error(`签名过期，请确保当前服务与IM服务(${this.adminUrl})时间同步`);
        }

        return imResult;
    }
}

// 创建单例实例
const httpUtils = new HttpUtils();

export default httpUtils;
