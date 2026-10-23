/**
 * 文件上传辅助工具
 * 
 * 提供文件上传相关的通用功能，包括：
 * - 根据文件名获取Content-Type
 * - 读取文件内容为Buffer
 * - 上传到七牛云（type = 1）
 * - 上传到其它对象存储（type != 1）
 * - 文件上传主方法
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { URL } from 'url';
import IMResult from './imResult.js';

/**
 * 根据文件名获取Content-Type
 * @param {string} fileName - 文件名
 * @returns {string} Content-Type，如果无法识别则返回 "application/octet-stream"
 */
export function getContentTypeByFileName(fileName) {
    if (!fileName || fileName.length === 0) {
        return 'application/octet-stream';
    }

    const lowerName = fileName.toLowerCase();
    const ext = lowerName.substring(lowerName.lastIndexOf('.') + 1);

    const contentTypeMap = {
        // 图片
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'bmp': 'image/bmp',
        'webp': 'image/webp',
        // 视频
        'mp4': 'video/mp4',
        'mov': 'video/quicktime',
        'avi': 'video/x-msvideo',
        'mkv': 'video/x-matroska',
        'flv': 'video/x-flv',
        'wmv': 'video/x-ms-wmv',
        // 音频
        'mp3': 'audio/mpeg',
        'wav': 'audio/wav',
        'ogg': 'audio/ogg',
        'm4a': 'audio/mp4',
        'aac': 'audio/aac',
        // 文档
        'pdf': 'application/pdf',
        'doc': 'application/msword',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'xls': 'application/vnd.ms-excel',
        'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'ppt': 'application/vnd.ms-powerpoint',
        'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        // 文本
        'txt': 'text/plain',
        'html': 'text/html',
        'htm': 'text/html',
        'json': 'application/json',
        'xml': 'application/xml',
        'js': 'application/javascript',
        'css': 'text/css',
        // 压缩包
        'zip': 'application/zip',
        'rar': 'application/x-rar-compressed',
        '7z': 'application/x-7z-compressed',
        'tar': 'application/x-tar',
        'gz': 'application/gzip'
    };

    return contentTypeMap[ext] || 'application/octet-stream';
}

/**
 * 读取文件内容为Buffer
 * @param {string} filePath - 文件路径
 * @returns {Buffer} 文件内容
 * @throws {Error} 文件不存在或读取失败时抛出异常
 */
export function readFileToBuffer(filePath) {
    try {
        if (!fs.existsSync(filePath)) {
            throw new Error(`文件不存在: ${filePath}`);
        }
        return fs.readFileSync(filePath);
    } catch (error) {
        throw new Error(`读取文件失败: ${error.message}`);
    }
}

/**
 * 上传文件到七牛云（type = 1）
 * 使用 POST + multipart/form-data 表单格式
 * @param {object} presignedUrl - 预签名上传地址信息
 * @param {Buffer} fileBuffer - 文件内容
 * @param {string} fileName - 文件名
 * @param {string} contentType - Content-Type
 * @returns {Promise<IMResult>} 上传结果
 */
export function uploadToQiniu(presignedUrl, fileBuffer, fileName, contentType) {
    return new Promise((resolve, reject) => {
        // 解析七牛云上传地址：格式为 "https://host?token?key"
        const uploadUrl = presignedUrl.uploadUrl;
        let token, key, baseUrl;

        const tokenStart = uploadUrl.indexOf('?');
        const keyStart = uploadUrl.indexOf('?', tokenStart + 1);

        if (tokenStart === -1 || keyStart === -1) {
            reject(new Error('七牛云上传地址格式错误'));
            return;
        }

        baseUrl = uploadUrl.substring(0, tokenStart);
        token = uploadUrl.substring(tokenStart + 1, keyStart);
        key = uploadUrl.substring(keyStart + 1);

        // 构建 multipart/form-data 请求体
        const boundary = '----WebKitFormBoundary' + Date.now().toString(36);
        const CRLF = '\r\n';

        let postData = '';
        // token 字段
        postData += `--${boundary}${CRLF}`;
        postData += `Content-Disposition: form-data; name="token"${CRLF}${CRLF}`;
        postData += `${token}${CRLF}`;
        // key 字段
        postData += `--${boundary}${CRLF}`;
        postData += `Content-Disposition: form-data; name="key"${CRLF}${CRLF}`;
        postData += `${key}${CRLF}`;
        // file 字段
        postData += `--${boundary}${CRLF}`;
        postData += `Content-Disposition: form-data; name="file"; filename="${fileName}"${CRLF}`;
        postData += `Content-Type: ${contentType}${CRLF}${CRLF}`;

        const preBuffer = Buffer.from(postData, 'utf8');
        const postBuffer = Buffer.from(`${CRLF}--${boundary}--${CRLF}`, 'utf8');
        const body = Buffer.concat([preBuffer, fileBuffer, postBuffer]);

        const url = new URL(baseUrl);
        const options = {
            hostname: url.hostname,
            port: url.port || (url.protocol === 'https:' ? 443 : 80),
            path: url.pathname + url.search,
            method: 'POST',
            headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
                'Content-Length': body.length
            }
        };

        const client = url.protocol === 'https:' ? https : http;
        const req = client.request(options, (res) => {
            let responseData = '';
            res.on('data', chunk => responseData += chunk);
            res.on('end', () => {
                // 七牛云返回 200 表示成功
                if (res.statusCode === 200 || res.statusCode === 201) {
                    resolve(new IMResult(0, 'success', presignedUrl.downloadUrl));
                } else {
                    reject(new Error(`文件上传到七牛云失败，HTTP状态码：${res.statusCode}`));
                }
            });
        });

        req.on('error', (error) => {
            reject(new Error(`上传请求异常: ${error.message}`));
        });

        req.write(body);
        req.end();
    });
}

/**
 * 上传到其他对象存储（type != 1）
 * 使用 PUT + 二进制流
 * @param {object} presignedUrl - 预签名上传地址信息
 * @param {Buffer} fileBuffer - 文件内容
 * @param {string} contentType - Content-Type
 * @returns {Promise<IMResult>} 上传结果
 */
export function uploadToOther(presignedUrl, fileBuffer, contentType) {
    return new Promise((resolve, reject) => {
        const url = new URL(presignedUrl.uploadUrl);
        const options = {
            hostname: url.hostname,
            port: url.port || (url.protocol === 'https:' ? 443 : 80),
            path: url.pathname + url.search,
            method: 'PUT',
            headers: {
                'Content-Type': contentType,
                'Content-Length': fileBuffer.length
            }
        };

        const client = url.protocol === 'https:' ? https : http;
        const req = client.request(options, (res) => {
            let responseData = '';
            res.on('data', chunk => responseData += chunk);
            res.on('end', () => {
                if (res.statusCode === 200 || res.statusCode === 201) {
                    resolve(new IMResult(0, 'success', presignedUrl.downloadUrl));
                } else {
                    reject(new Error(`文件上传失败，HTTP状态码：${res.statusCode}`));
                }
            });
        });

        req.on('error', (error) => {
            reject(new Error(`上传请求异常: ${error.message}`));
        });

        req.write(fileBuffer);
        req.end();
    });
}

/**
 * 执行文件上传
 * @param {object} presignedUrl - 预签名上传地址信息
 * @param {Buffer} fileBuffer - 文件内容
 * @param {string} fileName - 文件名
 * @param {string} contentType - Content-Type
 * @returns {Promise<IMResult>} 上传结果
 */
export async function executeUpload(presignedUrl, fileBuffer, fileName, contentType) {
    // 根据服务器类型选择上传方式
    if (presignedUrl.type === 1) {
        // 七牛云：使用 POST + multipart/form-data 表单上传
        return uploadToQiniu(presignedUrl, fileBuffer, fileName, contentType);
    } else {
        // 其他（阿里云、Minio、腾讯云、华为云、AWS S3等）：使用 PUT 上传
        return uploadToOther(presignedUrl, fileBuffer, contentType);
    }
}

/**
 * 解析上传参数
 * @param {string|Buffer} filePathOrFileBuffer - 文件路径或Buffer
 * @returns {object} 包含 fileName 和 fileBuffer 的对象
 */
export function parseUploadParams(filePathOrFileBuffer) {
    let fileName;
    let fileBuffer;

    if (Buffer.isBuffer(filePathOrFileBuffer)) {
        // 传入的是 Buffer，生成默认文件名
        fileBuffer = filePathOrFileBuffer;
        fileName = `upload_${Date.now()}`;
    } else {
        // 传入的是文件路径
        const filePath = filePathOrFileBuffer;
        fileName = path.basename(filePath);
        fileBuffer = readFileToBuffer(filePath);
    }

    return { fileName, fileBuffer };
}
