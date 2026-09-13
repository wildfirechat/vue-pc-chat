// 自签名证书扫描与信任工具
//
// Electron 里有三条相互独立的网络通道，都需要自签名证书：
//   1. IM 长连接 / 协议栈媒体：mars 原生，需要证书【文件路径】列表（src/main.js 调用 wfc.UseTls）
//   2. 渲染进程（Chromium）：axios 请求、头像/图片/视频等（src/background.js 的 setCertificateVerifyProc）
//   3. 主进程 Node：electron-updater 等（src/background.js 设置 NODE_EXTRA_CA_CERTS）
//
// 证书按【目录】组织，目录下所有 .crt/.pem/.cer/.der 都会被加载，支持多个域名/IP 各自的自签证书，
// 也支持一个 .pem 文件里放多张证书。为了让 mars 原生只拿到标准 PEM，这里会统一转换并落到临时目录。

import fs from 'fs';
import os from 'os';
import path from 'path';
import net from 'net';
import { X509Certificate } from 'crypto';

// 支持的证书扩展名
export const CERT_EXTENSIONS = ['.crt', '.pem', '.cer', '.der'];

// 证书目录：开发模式 build/certs，打包后 resources/extraResources/certs
// （vue.config.js 的 extraResources 已经把整个 build/certs 目录拷贝过去）
export function selfSignedCertDir() {
    return process.env.NODE_ENV === 'production'
        ? path.join(process.resourcesPath, 'extraResources/certs')
        : path.join(process.cwd(), 'build/certs');
}

// 规范化后的 PEM 输出目录（mars 原生要求 PEM 文件路径）。
// 带上进程号：主进程和各个渲染进程都会各自扫描一次，用独立目录避免互相覆盖/删除对方正在使用的文件
function normalizedCertDir() {
    return path.join(os.tmpdir(), `wfc-self-signed-certs-${process.pid}`);
}

// 只在内容变化时写入，且用「临时文件 + rename」保证原子性，
// 避免正在读取该文件的 mars 原生层读到写了一半的证书
function writeFileIfChanged(file, content) {
    try {
        if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === content) {
            return true;
        }
        const tmpFile = `${file}.${process.pid}.tmp`;
        fs.writeFileSync(tmpFile, content);
        fs.renameSync(tmpFile, file);
        return true;
    } catch (e) {
        console.warn(`[cert] 写证书文件失败: ${file}`, e.message);
        return false;
    }
}

// 去掉空白后比较 PEM，避免换行符/行尾差异导致匹配失败
export function normalizePem(pem) {
    return (pem || '').replace(/\s+/g, '');
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
    const buffer = fs.readFileSync(filePath);
    const text = buffer.toString('utf8');
    let pems = [];
    if (text.includes('-----BEGIN ')) {
        pems = splitPemBlocks(text);
    } else {
        // 按 DER 解析，再统一转成 PEM
        try {
            pems = [new X509Certificate(buffer).toString()];
        } catch (e) {
            console.warn(`[cert] 无法识别的证书文件，已跳过: ${filePath}`, e.message);
            return [];
        }
    }

    const certificates = [];
    for (const pem of pems) {
        try {
            const x509 = new X509Certificate(pem);
            certificates.push({
                pem,
                subjectAltName: x509.subjectAltName || '',
                notAfter: x509.validTo,
                expired: new Date(x509.validTo).getTime() < Date.now(),
            });
        } catch (e) {
            console.warn(`[cert] 解析证书失败，已跳过: ${filePath}`, e.message);
        }
    }
    return certificates;
}

// 把证书统一落成 PEM 文件，返回文件路径列表
function materialize(certificates) {
    const dir = normalizedCertDir();
    try {
        fs.mkdirSync(dir, { recursive: true });
    } catch (e) {
        console.warn('[cert] 创建证书临时目录失败:', e.message);
        return [];
    }
    const files = [];
    certificates.forEach((cert, index) => {
        const file = path.join(dir, `cert-${index}.pem`);
        const content = cert.pem.endsWith('\n') ? cert.pem : cert.pem + '\n';
        if (writeFileIfChanged(file, content)) {
            files.push(file);
        }
    });
    return files;
}

// 把所有证书拼成一个 bundle 文件，供 NODE_EXTRA_CA_CERTS 使用（该环境变量只接受单个文件）。
// NODE_EXTRA_CA_CERTS 是 Node 内置的变量名，无法自定义；为避免覆盖环境里已有的配置，
// 若该变量已存在且指向其它文件，把其内容一并合并进 bundle
function writeBundle(certificates) {
    const dir = normalizedCertDir();
    try {
        fs.mkdirSync(dir, { recursive: true });
    } catch (e) {
        console.warn('[cert] 创建证书临时目录失败:', e.message);
        return null;
    }
    const file = path.join(dir, 'ca-bundle.pem');
    let content = certificates.map(c => c.pem.endsWith('\n') ? c.pem : c.pem + '\n').join('');
    const existingCaFile = process.env.NODE_EXTRA_CA_CERTS;
    if (existingCaFile && existingCaFile !== file) {
        try {
            const extra = fs.readFileSync(existingCaFile, 'utf8');
            if (extra.trim()) {
                content += extra.endsWith('\n') ? extra : extra + '\n';
                console.log(`[cert] 已合并环境变量 NODE_EXTRA_CA_CERTS 已有的 CA 文件: ${existingCaFile}`);
            }
        } catch (e) {
            console.warn(`[cert] 读取已有 NODE_EXTRA_CA_CERTS 文件失败，已忽略: ${existingCaFile}`, e.message);
        }
    }
    return writeFileIfChanged(file, content) ? file : null;
}

/**
 * 扫描证书目录，加载全部自签名证书。
 * @returns {{dir: string, certificates: Array, files: string[], bundleFile: string|null}}
 *   certificates: [{ pem, subjectAltName, notAfter, expired, sourcePath }]
 *   files: 规范化后的 PEM 文件路径，可直接传给 wfc.UseTls
 *   bundleFile: 所有证书拼接成的 bundle 文件，可用于 NODE_EXTRA_CA_CERTS
 */
export function loadSelfSignedCertificates() {
    const dir = selfSignedCertDir();
    const result = { dir, certificates: [], files: [], bundleFile: null };

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
            const key = normalizePem(cert.pem);
            if (seen.has(key)) {
                continue; // 同一张证书放在多个文件里去重
            }
            seen.add(key);
            cert.sourcePath = filePath;
            result.certificates.push(cert);
        }
    }

    if (result.certificates.length) {
        result.files = materialize(result.certificates);
        result.bundleFile = writeBundle(result.certificates);
    }
    return result;
}

// 域名匹配，支持 *.example.com 只匹配一层
export function dnsMatchesHost(pattern, host) {
    if (!pattern || !host) {
        return false;
    }
    if (pattern.startsWith('*.')) {
        const suffix = pattern.slice(1); // ".example.com"
        if (!host.endsWith(suffix) || host.length <= suffix.length) {
            return false;
        }
        const prefix = host.slice(0, host.length - suffix.length);
        return prefix.length > 0 && !prefix.includes('.');
    }
    return pattern === host;
}

// 证书的 SAN 文本，便于日志排查
export function subjectAltNameOf(pem) {
    try {
        return new X509Certificate(pem).subjectAltName || '';
    } catch (e) {
        return '';
    }
}

/**
 * 证书 SAN 是否覆盖 hostname。
 * 返回 true=匹配，false=不匹配，null=无法判断（此时以证书内容匹配为准，不阻断请求）
 */
export function certHostMatch(pem, hostname) {
    try {
        const x509 = new X509Certificate(pem);
        const san = x509.subjectAltName;
        const host = (hostname || '').toLowerCase();
        if (!san || !host) {
            return null;
        }
        const isIp = net.isIP(host) !== 0;
        let parsed = false;
        for (const raw of san.split(',')) {
            const entry = raw.trim();
            if (entry.startsWith('DNS:')) {
                parsed = true;
                if (!isIp && dnsMatchesHost(entry.slice(4).trim().toLowerCase(), host)) {
                    return true;
                }
            } else if (entry.startsWith('IP Address:') || entry.startsWith('IP:')) {
                parsed = true;
                const ip = entry.replace(/^IP( Address)?:/, '').trim().toLowerCase();
                if (isIp && ip === host) {
                    return true;
                }
            }
        }
        return parsed ? false : null;
    } catch (e) {
        return null;
    }
}
