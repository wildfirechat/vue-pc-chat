// 自签名证书支持（只在主进程使用）
//
// 证书按【目录】组织，目录下所有 .crt/.pem/.cer/.der 都会被加载，支持多个域名/IP 各自的证书，
// 也支持一个 .pem 文件里放多张证书。
//
// 信任规则（公签证书不受影响，始终走默认校验），自签名证书要同时满足：
//   1. 服务端发来的证书和目录里某张证书完全一致（SHA-256 指纹）。目录里的证书不会被当作 CA；
//      证书链上的其它证书由服务端随意填写，不能作为信任依据
//   2. 在有效期内
//   3. SAN 包含实际连接的域名/IP（不回退到 CN）
//
// 用到证书的三条网络通道：
//   1. IM 长连接 / 协议栈媒体：mars 原生，需要 PEM 文件路径，主进程写好后，渲染进程通过 IPC 取回再传给 wfc.UseTls
//   2. Chromium：渲染进程的 axios、头像/图片/视频，以及 electron-updater，见 createCertificateVerifyProc
//   3. 主进程 Node 的 https：密聊媒体解密服务，见 createHttpsAgent

import fs from 'fs';
import path from 'path';
import net from 'net';
import https from 'https';
import tls from 'tls';
import { X509Certificate } from 'crypto';

// 支持的证书扩展名
export const CERT_EXTENSIONS = ['.crt', '.pem', '.cer', '.der'];

// 内置证书可以覆盖的 Chromium 错误码，吊销、弱密钥等其它错误不覆盖：
//   -202 net::ERR_CERT_AUTHORITY_INVALID：证书不受信任，自签证书的常规报错
//   -207 net::ERR_CERT_INVALID：macOS 对不满足其 TLS 策略的证书（例如缺少 extendedKeyUsage=serverAuth）报这个
const OVERRIDABLE_CHROMIUM_ERRORS = [-202, -207];

// 证书目录：开发模式 build/certs，打包后 resources/extraResources/certs
// （vue.config.js 的 extraResources 已经把整个 build/certs 目录拷贝过去）
export function selfSignedCertDir() {
    return process.env.NODE_ENV === 'production'
        ? path.join(process.resourcesPath, 'extraResources/certs')
        : path.join(process.cwd(), 'build/certs');
}

// 一个文件里可能有多张 PEM 证书，按 BEGIN/END 切分
function splitPemBlocks(text) {
    const blocks = [];
    const regex = /-----BEGIN [^-]*CERTIFICATE-----[\s\S]*?-----END [^-]*CERTIFICATE-----/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
        blocks.push(match[0]);
    }
    return blocks;
}

// 读取一个证书文件，返回其中的所有证书（兼容 PEM / DER / 一个文件多张）
function readCertificateFile(filePath) {
    let buffer;
    try {
        buffer = fs.readFileSync(filePath);
    } catch (e) {
        console.warn(`[cert] 读取证书文件失败，已跳过: ${filePath}`, e.message);
        return [];
    }
    const text = buffer.toString('utf8');
    // 不是 PEM 就按 DER 解析
    const sources = text.includes('-----BEGIN ') ? splitPemBlocks(text) : [buffer];

    const certificates = [];
    for (const source of sources) {
        try {
            const x509 = new X509Certificate(source);
            certificates.push({
                x509,
                pem: x509.toString(),
                fingerprint256: x509.fingerprint256,
                subjectAltName: x509.subjectAltName || '',
                sourcePath: filePath,
            });
        } catch (e) {
            console.warn(`[cert] 解析证书失败，已跳过: ${filePath}`, e.message);
        }
    }
    return certificates;
}

// 把证书写成 PEM 文件（mars 原生层需要文件路径），返回文件路径列表。
// 文件名是证书指纹：内容相同则文件名相同，同时运行多个客户端也不会写出冲突的内容
function writePemFiles(certificates, outputDir) {
    try {
        fs.mkdirSync(outputDir, { recursive: true, mode: 0o700 });
    } catch (e) {
        console.warn(`[cert] 创建证书目录失败: ${outputDir}`, e.message);
        return [];
    }
    const files = [];
    for (const cert of certificates) {
        const file = path.join(outputDir, `${cert.fingerprint256.replace(/:/g, '').toLowerCase()}.pem`);
        try {
            if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== cert.pem) {
                // 先写临时文件再 rename，避免 mars 读到写了一半的文件
                const tmpFile = `${file}.${process.pid}.tmp`;
                fs.writeFileSync(tmpFile, cert.pem);
                fs.renameSync(tmpFile, file);
            }
            files.push(file);
        } catch (e) {
            console.warn(`[cert] 写证书文件失败: ${file}`, e.message);
        }
    }
    return files;
}

/**
 * 扫描证书目录，加载全部自签名证书，并写成 PEM 文件供 mars 原生层使用。
 * @param {string} outputDir PEM 文件的输出目录，应当只有当前用户可写
 * @returns {{dir: string, certificates: Array, files: string[]}}
 *   certificates: [{ x509, pem, fingerprint256, subjectAltName, sourcePath }]
 *   files: PEM 文件路径，可直接传给 wfc.UseTls
 */
export function loadSelfSignedCertificates(outputDir) {
    const dir = selfSignedCertDir();
    const result = { dir, certificates: [], files: [] };

    let names = [];
    try {
        if (!fs.existsSync(dir)) {
            return result;
        }
        names = fs.readdirSync(dir)
            .filter(name => CERT_EXTENSIONS.includes(path.extname(name).toLowerCase()))
            .sort();
    } catch (e) {
        console.warn('[cert] 读取证书目录失败:', e.message);
        return result;
    }

    const seen = new Set();
    for (const name of names) {
        const filePath = path.join(dir, name);
        try {
            if (!fs.statSync(filePath).isFile()) {
                continue;
            }
        } catch (e) {
            continue;
        }
        for (const cert of readCertificateFile(filePath)) {
            if (seen.has(cert.fingerprint256)) {
                continue; // 同一张证书放在多个文件里去重
            }
            seen.add(cert.fingerprint256);
            result.certificates.push(cert);
        }
    }

    if (result.certificates.length) {
        result.files = writePemFiles(result.certificates, outputDir);
    }
    return result;
}

// 日期解析失败（NaN）时按不在有效期处理
function isWithinValidity(x509, now = Date.now()) {
    return Date.parse(x509.validFrom) <= now && now <= Date.parse(x509.validTo);
}

// 和 Chromium 一致：只认 SAN，不回退到 CN。IP 直连匹配 IP SAN，域名匹配 DNS SAN（支持 *.example.com）
function certMatchesHost(x509, hostname) {
    const host = (hostname || '').replace(/^\[(.*)\]$/, '$1'); // IPv6 地址可能带方括号
    if (!host) {
        return false;
    }
    return Boolean(net.isIP(host) ? x509.checkIP(host) : x509.checkHost(host, { subject: 'never' }));
}

export function logSelfSignedCertificates({ dir, certificates }) {
    if (!certificates.length) {
        console.log(`[cert] 未在 ${dir} 找到自签证书，使用系统默认证书校验`);
        return;
    }
    console.log(`[cert] 已加载 ${certificates.length} 张自签证书: ${dir}`);
    for (const cert of certificates) {
        const notes = [];
        if (!isWithinValidity(cert.x509)) {
            notes.push('不在有效期内，不会被信任');
        }
        if (!cert.subjectAltName) {
            notes.push('没有 SAN，不会被信任');
        }
        if (cert.x509.ca) {
            notes.push('CA:TRUE，建议重新签发为 CA:FALSE');
        }
        console.log(`[cert]   ${path.basename(cert.sourcePath)} SAN=[${cert.subjectAltName}] 有效期至 ${cert.x509.validTo}${notes.length ? `（${notes.join('；')}）` : ''}`);
    }
}

/**
 * 生成 session.setCertificateVerifyProc 的回调。
 * 回调值：0 = 信任，-2 = 拒绝，-3 = 使用 Chromium 的校验结果
 */
export function createCertificateVerifyProc(certificates) {
    const pinned = new Map(certificates.map(cert => [cert.fingerprint256, cert]));
    const loggedHosts = new Set();

    // 交回 Chromium 的校验结果；每个 host 打印一次原因，便于排查自签证书没有生效的情况
    const useChromiumResult = (request, callback, reason) => {
        if (!loggedHosts.has(request.hostname)) {
            loggedHosts.add(request.hostname);
            console.log(`[cert] ${request.hostname}: ${reason}，使用 Chromium 校验结果 ${request.verificationResult}`);
        }
        callback(-3);
    };

    return (request, callback) => {
        if (request.errorCode === 0) {
            return callback(-3); // Chromium 已经信任，例如公签证书
        }
        if (!OVERRIDABLE_CHROMIUM_ERRORS.includes(request.errorCode)) {
            return useChromiumResult(request, callback, '该证书错误不能由内置证书覆盖');
        }
        let leaf;
        try {
            leaf = new X509Certificate(request.certificate.data);
        } catch (e) {
            return useChromiumResult(request, callback, '无法解析服务端证书');
        }
        // 只比对服务端证书本身，不看 issuerCert：证书链是服务端发来的，可以随意伪造
        const cert = pinned.get(leaf.fingerprint256);
        if (!cert) {
            return useChromiumResult(request, callback, `服务端证书 SAN=[${leaf.subjectAltName || ''}] 不在内置证书中`);
        }
        if (!isWithinValidity(leaf)) {
            return useChromiumResult(request, callback, `内置证书 ${path.basename(cert.sourcePath)} 不在有效期内`);
        }
        if (!certMatchesHost(leaf, request.hostname)) {
            return useChromiumResult(request, callback, `内置证书 ${path.basename(cert.sourcePath)} 的 SAN=[${cert.subjectAltName}] 不包含该地址`);
        }
        callback(0);
    };
}

// 主进程 Node https 请求使用的 agent。
// 内置证书不放进 ca：同名（CN 相同）的证书在信任库里会互相干扰，而且放进 ca 等于把它当成 CA。
// 做法是先按 Node 默认的根证书完成握手校验，再决定是否把 socket 交给 http 层：
//   - 默认校验通过（公签证书，证书链和主机名都已校验）：放行
//   - 默认校验失败：服务端证书按上面的规则命中内置证书才放行，否则报错
// socket 在校验完成之后才交给 http 层，所以请求不会发给没有通过校验的服务端
class SelfSignedHttpsAgent extends https.Agent {
    constructor(certificates) {
        super();
        this.pinned = new Set(certificates.map(cert => cert.fingerprint256));
    }

    // http.Agent 支持通过 callback 异步交付 socket（此时返回 undefined）
    createConnection(options, callback) {
        const host = options.servername || options.host;
        // rejectUnauthorized: false 只是让握手后不立即断开，默认校验的结果仍然在 socket.authorized 里
        const socket = tls.connect({ ...options, rejectUnauthorized: false });
        const onError = err => callback(err);
        socket.once('error', onError);
        socket.once('secureConnect', () => {
            socket.removeListener('error', onError);
            const error = this.verify(socket, host);
            if (error) {
                socket.destroy();
                return callback(error);
            }
            callback(null, socket);
        });
    }

    // 返回 null 表示校验通过
    verify(socket, host) {
        if (socket.authorized) {
            return null;
        }
        const leaf = socket.getPeerX509Certificate();
        if (!leaf || !this.pinned.has(leaf.fingerprint256)) {
            const error = new Error(`[cert] ${host} 证书校验失败: ${socket.authorizationError}`);
            error.code = socket.authorizationError;
            return error;
        }
        if (!isWithinValidity(leaf) || !certMatchesHost(leaf, host)) {
            return new Error(`[cert] ${host} 命中内置证书，但证书不在有效期内或 SAN 不包含该地址`);
        }
        return null;
    }
}

/**
 * 主进程 Node https 请求使用的 agent：公签证书照常校验，另外按上面的规则信任内置证书。
 * 没有内置证书时返回 undefined，即使用 Node 默认的 agent。
 */
export function createHttpsAgent(certificates) {
    return certificates.length ? new SelfSignedHttpsAgent(certificates) : undefined;
}
