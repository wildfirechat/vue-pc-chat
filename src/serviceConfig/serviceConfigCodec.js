// 服务配置串（登录页「服务配置」）的编解码，只在主进程使用（依赖 Node 的 crypto）。
//
// 与 wf-enterprise-chat 的 chat/lib/service_config/service_config_codec.dart 是同一套格式，
// 同一个配置串在两个客户端里解出来的结果一致；方案见该仓库 design/service-config-codec.md。
//
// 信封文本：WFC1.<base64url(nonce(12B) || 密文 || tag(16B))>
//   * AES-256-GCM：机密性 + 完整性，改一个字节即解不开；
//   * 密钥 = HKDF-SHA256(seed, salt/info 固定)；
//   * AAD 固定串把密文与格式版本绑死；
//   * 明文：紧凑 JSON —— 服务地址 / 备用地址 / TURN / 客户端信息（仅展示）。
import crypto from 'crypto';

export const SERVICE_CONFIG_FORMAT_VERSION = 1;
export const SERVICE_CONFIG_MAGIC = 'WFC1';

// AAD：不加密但参与认证。定稿后不要改，改了所有已发出的串都会失效
const AAD = 'WFC1|wfc-service-config';
const KDF_SALT = 'wfc-svc-cfg-v1';
const KDF_INFO = 'wfc-service-config';

// 应用内置的 seed（32 字节 base64），必须与 wf-enterprise-chat 的 kServiceConfigSeedBase64 一致。
// 写死在应用里：拿到应用就能提取出来自行签发，定位是「防手改 + 防明文外泄」，不是防逆向。
// 轮换：改掉它 → 老配置串全部失效，需要用新 seed 重新签发（签发工具同步改）。
const SEED_BASE64 = 'Wg7r26V/nFvWynTgovOfKtxiadya17X10KPm/Spadvo=';

// 校验失败原因，界面按类型给文案（见 ServiceConfigDialog.vue）
export const ServiceConfigError = {
    malformed: 'malformed',                   // 不是本格式 / 前缀不对 / base64 坏了
    incomplete: 'incomplete',                 // 被截断
    decryptFailed: 'decryptFailed',           // 密文被改过，或不是本产品签发
    versionUnsupported: 'versionUnsupported', // 明文版本高于当前客户端支持
    expired: 'expired',                       // 已过期
    invalidField: 'invalidField',             // 字段非法（host/port/TURN 用户名密码）
};

export class ServiceConfigException extends Error {
    constructor(error, detail) {
        super(`${error}: ${detail}`);
        this.error = error;
        this.detail = detail;
    }
}

function workKey() {
    return Buffer.from(crypto.hkdfSync('sha256', Buffer.from(SEED_BASE64, 'base64'),
        Buffer.from(KDF_SALT, 'utf8'), Buffer.from(KDF_INFO, 'utf8'), 32));
}

function toInt(v) {
    return typeof v === 'number' ? Math.trunc(v) : (v == null ? null : Number(v));
}

// host 允许域名 / IPv4 / 方括号包裹的 IPv6
const HOST_RE = /^\[[0-9A-Fa-f:.]+\]$|^[A-Za-z0-9]([A-Za-z0-9.-]{0,252})$/;

function checkHost(h) {
    if (typeof h !== 'string' || !HOST_RE.test(h) || h.includes('..')) {
        throw new ServiceConfigException(ServiceConfigError.invalidField, `bad host: ${h}`);
    }
}

function checkPort(p) {
    if (!Number.isInteger(p) || p <= 0 || p > 65535) {
        throw new ServiceConfigException(ServiceConfigError.invalidField, `bad port: ${p}`);
    }
}

/**
 * 把明文 JSON 规整成客户端使用的结构（缺省值与 Dart 实现一致）
 */
function normalize(json) {
    const im = json.im;
    const bk = json.bk;
    const turn = json.turn;
    const cli = json.cli || {};
    if (!im || typeof im !== 'object') {
        throw new Error('missing im');
    }
    const port = toInt(im.p);
    const cfg = {
        im: {
            host: im.h,
            port,
            // 应用服务端口：没下发 = 与 IM 端口相同（同入口部署）
            appPort: im.ap == null ? port : toInt(im.ap),
            tls: toInt(im.tls == null ? 1 : im.tls) === 1,
            websocket: toInt(im.ws == null ? 1 : im.ws) === 1,
        },
        backup: null,
        turn: null,
        tenant: typeof cli.tenant === 'string' ? cli.tenant : '',
        note: typeof cli.note === 'string' ? cli.note : '',
        issuedAt: toInt(json.iat) || 0,
        expiresAt: toInt(json.exp) || 0,
    };
    if (bk && typeof bk === 'object' && bk.h) {
        const bkPort = bk.p == null ? 443 : toInt(bk.p);
        cfg.backup = {
            host: bk.h,
            port: bkPort,
            appPort: bk.ap == null ? bkPort : toInt(bk.ap),
            strategy: toInt(bk.strategy) || 0,
        };
    }
    if (turn && typeof turn === 'object') {
        cfg.turn = {
            host: turn.h,
            port: toInt(turn.port),
            user: turn.u,
            password: turn.pwd,
        };
    }
    return cfg;
}

function checkFields(cfg) {
    checkHost(cfg.im.host);
    checkPort(cfg.im.port);
    checkPort(cfg.im.appPort);
    if (cfg.backup) {
        checkHost(cfg.backup.host);
        checkPort(cfg.backup.port);
        checkPort(cfg.backup.appPort);
    }
    const t = cfg.turn;
    if (t) {
        checkHost(t.host);
        checkPort(t.port);
        if (!t.user || !t.password || typeof t.user !== 'string' || typeof t.password !== 'string') {
            throw new ServiceConfigException(ServiceConfigError.invalidField, 'turn user/password empty');
        }
        if (/\s/.test(t.password)) {
            throw new ServiceConfigException(ServiceConfigError.invalidField, 'turn password has whitespace');
        }
    }
}

/**
 * 解析并校验配置串，任一步不通过抛 ServiceConfigException。
 * @param {string} text 配置串（允许夹带空白、换行、零宽字符）
 * @param {number} nowSeconds 当前时间（UTC 秒），判断过期用
 */
export function decodeServiceConfig(text, nowSeconds = Math.floor(Date.now() / 1000)) {
    const cleaned = String(text || '').replace(/[\s​﻿]/g, '');
    const parts = cleaned.split('.');
    if (parts.length !== 2 || parts[0] !== SERVICE_CONFIG_MAGIC) {
        throw new ServiceConfigException(ServiceConfigError.malformed, 'bad prefix or segment count');
    }
    if (!/^[A-Za-z0-9_-]+={0,2}$/.test(parts[1])) {
        throw new ServiceConfigException(ServiceConfigError.malformed, 'base64 decode failed');
    }
    const body = Buffer.from(parts[1], 'base64url');
    if (body.length < 12 + 16 + 1) {
        throw new ServiceConfigException(ServiceConfigError.incomplete, `too short: ${body.length}B`);
    }

    let json;
    try {
        const nonce = body.subarray(0, 12);
        const tag = body.subarray(body.length - 16);
        const cipherText = body.subarray(12, body.length - 16);
        const decipher = crypto.createDecipheriv('aes-256-gcm', workKey(), nonce);
        decipher.setAAD(Buffer.from(AAD, 'utf8'));
        decipher.setAuthTag(tag);
        const plain = Buffer.concat([decipher.update(cipherText), decipher.final()]);
        json = JSON.parse(plain.toString('utf8'));
    } catch (e) {
        throw new ServiceConfigException(ServiceConfigError.decryptFailed, 'gcm/json failed: ' + e.message);
    }

    const v = toInt(json.v) || 0;
    if (v !== SERVICE_CONFIG_FORMAT_VERSION) {
        throw new ServiceConfigException(ServiceConfigError.versionUnsupported,
            `payload v${v} > supported ${SERVICE_CONFIG_FORMAT_VERSION}`);
    }

    let cfg;
    try {
        cfg = normalize(json);
    } catch (e) {
        throw new ServiceConfigException(ServiceConfigError.invalidField, 'payload shape error: ' + e.message);
    }
    if (cfg.expiresAt > 0 && nowSeconds > cfg.expiresAt) {
        throw new ServiceConfigException(ServiceConfigError.expired, 'expired');
    }
    checkFields(cfg);
    return cfg;
}
