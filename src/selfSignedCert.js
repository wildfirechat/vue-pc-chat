// 自签名证书支持（只在主进程使用）
//
// 证书按【目录】组织，目录下所有 .crt/.pem/.cer/.der 都会被加载，支持多个域名/IP 各自的证书，
// 也支持一个 .pem 文件里放多张证书。
//
// 信任规则（公签证书不受影响，始终走默认校验）。自签名证书按两种方式之一命中即可：
//   A. 目录里的证书就是服务端证书本身：SHA-256 指纹一致（适用于固定不变、不续期的证书）
//   B. 目录里的证书是签发机构（CA:TRUE）：服务端证书由它签发也信任——签发者名称与签名都要校验，
//      并且要求服务端证书本身在有效期内。服务端证书会定期自动续期（叶子指纹会变）时必须用这种方式，
//      否则续期后客户端就认不出来了，需要重新打包
//   两种方式都还要求：服务端证书在有效期内 + SAN 包含实际连接的域名/IP（不回退到 CN）
//   服务端随证书链发来的其它证书一律不作为信任依据（链是服务端给的，可以随意伪造）
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

// 证书目录候选（按优先级探测，取第一个"存在且有证书"的目录）：
//   1. 打包后：<resources>/extraResources/certs（vue.config.js 的 extraResources 目标）
//   2. 开发时：<项目根>/build/certs
//   3. 开发兜底：从编译产物位置回推项目根（dist_electron/bundled → 项目根），覆盖 cwd 不是项目根的情况
//
// ⚠️ 不要用 process.env.NODE_ENV 判断运行模式：它由打包工具在**编译期**固化，dev 与打包两种运行下都不可靠。
//    本项目实测踩到：dev 运行时被固化成 production 分支，于是去 <electron 自身 Resources>/extraResources/certs
//    找证书 → 那里根本没有 → 加载到 0 张证书 → 协议栈判定"未传入私有证书" → IP 直连自签证书必然握手校验失败。
export function selfSignedCertDirs() {
    const dirs = [];
    const add = d => {
        if (d && dirs.indexOf(d) < 0) {
            dirs.push(d);
        }
    };
    if (process.resourcesPath) {
        add(path.join(process.resourcesPath, 'extraResources/certs'));
    }
    add(path.join(process.cwd(), 'build/certs'));
    if (typeof __dirname === 'string') {
        add(path.resolve(__dirname, '..', '..', 'build/certs'));
    }
    return dirs;
}

// 兼容旧调用：返回首选目录
export function selfSignedCertDir() {
    return selfSignedCertDirs()[0];
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
export function loadSelfSignedCertificates(outputDir, dirCandidates) {
    const candidates = (dirCandidates && dirCandidates.length) ? dirCandidates : selfSignedCertDirs();
    const result = { dir: '', dirs: candidates, certificates: [], files: [] };

    // 按顺序找第一个"存在且含证书文件"的目录；都不含则视作没有内置证书
    let names = [];
    for (const candidate of candidates) {
        try {
            if (!fs.existsSync(candidate) || !fs.statSync(candidate).isDirectory()) {
                continue;
            }
            const found = fs.readdirSync(candidate)
                .filter(name => CERT_EXTENSIONS.includes(path.extname(name).toLowerCase()))
                .sort();
            if (found.length) {
                result.dir = candidate;
                names = found;
                break;
            }
        } catch (e) {
            console.warn(`[cert] 读取证书目录失败(${candidate}):`, e.message);
        }
    }
    if (!result.dir) {
        result.dir = candidates[0] || '';
    }

    const seen = new Set();
    for (const name of names) {
        const filePath = path.join(result.dir, name);
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

// 判断 leaf 是否由 ca 签发：签发者名称一致 + 用 ca 的公钥验 leaf 的签名。
// 只认 CA:TRUE 的证书，避免把普通服务端证书当作签发机构使用
function issuedBy(leaf, ca) {
    if (!ca.ca) {
        return false;
    }
    try {
        if (!leaf.checkIssued(ca)) {
            return false; // 签发者名称对不上
        }
        // 注意方向：verify 的语义是“本证书是否由给定公钥签发”，所以是 leaf.verify(ca.publicKey)
        return leaf.verify(ca.publicKey);
    } catch (e) {
        return false;
    }
}

/**
 * 在目录里的证书中找出一张能信任 leaf 的证书。
 * 先按指纹精确匹配（服务端证书本身就是目录里的证书），再按 CA 签发关系匹配（目录里放的是 CA）。
 * @returns {{cert: Object, via: 'fingerprint'|'issuer'}|null}
 */
export function findTrustedCert(certificates, leaf) {
    for (const cert of certificates) {
        if (cert.fingerprint256 === leaf.fingerprint256) {
            return {cert, via: 'fingerprint'};
        }
    }
    for (const cert of certificates) {
        if (issuedBy(leaf, cert.x509) && isWithinValidity(cert.x509)) {
            return {cert, via: 'issuer'};
        }
    }
    return null;
}

export function logSelfSignedCertificates({ dir, dirs, certificates }) {
    if (!certificates.length) {
        console.log(`[cert] 未找到自签证书，使用系统默认证书校验（协议栈/Chromium 只认系统信任链，IP 直连自签证书会失败）`);
        for (const d of (dirs && dirs.length ? dirs : [dir])) {
            console.log(`[cert]   已探测: ${d} ${d && fs.existsSync(d) ? '（存在，但里面没有 .crt/.pem/.cer/.der）' : '（不存在）'}`);
        }
        return;
    }
    console.log(`[cert] 已加载 ${certificates.length} 张自签证书: ${dir}`);
    for (const cert of certificates) {
        const notes = [];
        if (!isWithinValidity(cert.x509)) {
            notes.push('不在有效期内，不会被信任');
        }
        if (!cert.x509.ca && !cert.subjectAltName) {
            notes.push('没有 SAN，不会被信任');
        }
        if (cert.x509.ca) {
            notes.push('CA:TRUE，将按签发机构信任其签发的服务端证书（服务端证书续期后无需重新打包客户端）');
        }
        console.log(`[cert]   ${path.basename(cert.sourcePath)} SAN=[${cert.subjectAltName}] 有效期至 ${cert.x509.validTo}${notes.length ? `（${notes.join('；')}）` : ''}`);
    }
}

/**
 * 生成 session.setCertificateVerifyProc 的回调。
 * 回调值：0 = 信任，-2 = 拒绝，-3 = 使用 Chromium 的校验结果
 */
export function createCertificateVerifyProc(certificates) {
    const loggedHosts = new Set();
    const loggedTrustedHosts = new Set();

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
        // 只拿服务端证书本身和内置证书比对，不用 Chromium 传进来的 issuerCert：
        // 证书链是服务端发来的，可以随意伪造，不能作为信任依据
        const trusted = findTrustedCert(certificates, leaf);
        if (!trusted) {
            return useChromiumResult(request, callback, `服务端证书 SAN=[${leaf.subjectAltName || ''}] 既不在内置证书中，也不是由内置 CA 签发`);
        }
        const {cert, via} = trusted;
        const source = via === 'issuer'
            ? `由内置 CA ${path.basename(cert.sourcePath)} 签发`
            : `命中内置证书 ${path.basename(cert.sourcePath)}`;
        if (!isWithinValidity(leaf)) {
            return useChromiumResult(request, callback, `服务端证书不在有效期内（${source}）`);
        }
        if (!certMatchesHost(leaf, request.hostname)) {
            return useChromiumResult(request, callback, `服务端证书 SAN=[${leaf.subjectAltName || ''}] 不包含该地址（${source}）`);
        }
        if (!loggedTrustedHosts.has(request.hostname)) {
            loggedTrustedHosts.add(request.hostname);
            console.log(`[cert] ${request.hostname}: 服务端证书${source}，已信任`);
        }
        callback(0);
    };
}

// 主进程 Node https 请求使用的 agent。
// 内置证书不放进 ca：同名（CN 相同）的证书在信任库里会互相干扰，而且放进 ca 等于把它当成 CA。
// 做法是先按 Node 默认的根证书完成握手校验，再决定是否把 socket 交给 http 层：
//   - 默认校验通过（公签证书，证书链和主机名都已校验）：放行
//   - 默认校验失败：服务端证书命中内置证书、或由内置 CA 签发才放行，否则报错
// socket 在校验完成之后才交给 http 层，所以请求不会发给没有通过校验的服务端
class SelfSignedHttpsAgent extends https.Agent {
    constructor(certificates) {
        super();
        this.certificates = certificates;
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
        const trusted = leaf ? findTrustedCert(this.certificates, leaf) : null;
        if (!trusted) {
            const error = new Error(`[cert] ${host} 证书校验失败: ${socket.authorizationError}`);
            error.code = socket.authorizationError;
            return error;
        }
        if (!isWithinValidity(leaf) || !certMatchesHost(leaf, host)) {
            return new Error(`[cert] ${host} 服务端证书由内置证书信任（${path.basename(trusted.cert.sourcePath)}），但证书不在有效期内或 SAN 不包含该地址`);
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
