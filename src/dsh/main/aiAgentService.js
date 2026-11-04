import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { safeStorage } from 'electron';

/**
 * 客户端 AI 服务（主进程）。
 *
 * 一个 /provision 请求同时完成：
 *   IM authCode -> 机器人 + AI 代理地址/客户端 Key/模型
 * authCode 不落盘；只缓存 AI 配置和客户端 Key，Renderer 只拿脱敏视图。
 */
export default class DshAiAgentService {
    constructor({ userDataPath, httpsAgent }) {
        this.file = path.join(userDataPath, 'dsh-ai-agent.enc');
        this.httpsAgent = httpsAgent;
        this.records = this._load();
    }

    _load() {
        if (!fs.existsSync(this.file)) return {};
        let raw;
        try { raw = fs.readFileSync(this.file); } catch (e) { return {}; }
        const texts = [];
        if (safeStorage.isEncryptionAvailable()) {
            try { texts.push(safeStorage.decryptString(raw)); } catch (e) { /* try plain */ }
        }
        texts.push(raw.toString('utf8'));
        for (const text of texts) {
            try {
                const parsed = JSON.parse(text);
                if (parsed && typeof parsed === 'object') return parsed;
            } catch (e) { /* next */ }
        }
        try {
            const backup = `${this.file}.corrupt-${Date.now()}`;
            fs.renameSync(this.file, backup);
            console.warn(`[ai-agent] cache is invalid; moved to ${backup}`);
        } catch (e) {
            try { fs.unlinkSync(this.file); } catch (e2) { /* ignore */ }
        }
        return {};
    }

    _persist() {
        try {
            if (!safeStorage.isEncryptionAvailable()) {
                // Never persist a long-lived client key as plaintext. The user
                // can re-provision after restart; an attacker with the file
                // cannot get a durable credential.
                console.warn('[ai-agent] safeStorage unavailable; refusing to persist AI credentials');
                try { if (fs.existsSync(this.file)) fs.unlinkSync(this.file); } catch (e) { /* ignore */ }
                return;
            }
            fs.mkdirSync(path.dirname(this.file), { recursive: true });
            const text = JSON.stringify(this.records);
            const data = safeStorage.encryptString(text);
            fs.writeFileSync(this.file, data, { mode: 0o600 });
            try { fs.chmodSync(this.file, 0o600); } catch (e) { /* ignore */ }
        } catch (e) {
            console.warn('[ai-agent] persist failed', e.message);
        }
    }

    _normalizeUrl(url) {
        const text = String(url || '').trim().replace(/\/+$/, '');
        if (!/^https?:\/\//i.test(text)) throw new Error('AI Agent 服务地址必须以 http:// 或 https:// 开头');
        return text;
    }

    /**
     * 应用服务/客户端保存的默认地址。URL 变化时清掉旧服务的配置。
     */
    rememberServer(userId, serverUrl, force = false) {
        if (!userId) throw new Error('missing userId');
        const base = this._normalizeUrl(serverUrl);
        const current = this.records[userId];
        if (current && current.serverUrl && current.serverUrl !== base && !force) {
            // Keep the working configuration until /provision succeeds on the
            // new server. A typo in the address must not wipe valid credentials.
            const next = { ...current, pendingServerUrl: base, updatedAt: Date.now() };
            this.records[userId] = next;
            this._persist();
            return { ok: true, view: this.publicView(userId), pending: true };
        }
        const next = current ? { ...current } : {};
        if (next.serverUrl && next.serverUrl !== base) {
            delete next.config;
            delete next.authCode;
            delete next.sessionToken;
            delete next.sessionExpiresAt;
        }
        delete next.pendingServerUrl;
        next.serverUrl = base;
        next.updatedAt = Date.now();
        this.records[userId] = next;
        this._persist();
        return { ok: true, view: this.publicView(userId) };
    }

    setPendingServer(userId, serverUrl) {
        return this.rememberServer(userId, serverUrl, false);
    }

    /**
     * 唯一客户端入口：IM authCode -> robot + config。
     */
    async provision({ userId, serverUrl, authCode, forceRefresh }) {
        if (!userId) throw new Error('missing userId');
        const base = this._normalizeUrl(serverUrl);
        const code = String(authCode || '').trim();
        if (!code) throw new Error('缺少 IM authCode');
        let response;
        try {
            response = await axios.post(`${base}/provision`, { authCode: code, forceRefresh: !!forceRefresh }, {
                timeout: 30000,
                httpsAgent: this.httpsAgent,
                proxy: false,
                headers: { 'Content-Type': 'application/json' },
            });
        } catch (e) {
            const message = e.response?.data?.error?.message || e.message || 'provision 失败';
            throw new Error(`AI 服务开通失败：${message}`);
        }
        const data = response.data || {};
        if (!data.robot || !data.robot.robotId || !data.robot.robotSecret) {
            throw new Error('AI 服务开通失败：返回缺少 robotId/robotSecret');
        }
        if (!data.config || !data.config.baseUrl || !data.config.apiKey) {
            throw new Error('AI 服务开通失败：返回缺少 AI 配置');
        }
        // Only switch the active server after a successful /provision.
        this.rememberServer(userId, base, true);
        this.records[userId] = {
            serverUrl: base,
            config: {
                baseUrl: data.config.baseUrl,
                apiKey: data.config.apiKey,
                expiresAt: Number(data.config.expiresAt) || 0,
                model: data.config.model || '',
                reasoningEffort: data.config.reasoningEffort || '',
                maxTokens: data.config.maxTokens,
                contextWindow: data.config.contextWindow,
                allowedModels: data.config.allowedModels || [],
                source: data.config.source || {},
                enabled: data.config.enabled !== false,
                configured: data.config.configured === true,
                userName: data.config.user?.name || '',
                userId: data.config.user?.id || '',
            },
            updatedAt: Date.now(),
        };
        this._persist();
        return {
            ...data,
            aiAgent: data.aiAgent || { serverUrl: base },
        };
    }

    /** 返回可注入 Host 的 AI 配置；provision 时刷新。 */
    resolve(userId) {
        const record = this.records[userId];
        if (!record || !record.config || !record.config.baseUrl || !record.config.apiKey) return null;
        return { ...record.config, serverUrl: record.serverUrl };
    }

    async stats(userId) {
        const record = this.records[userId];
        if (!record || !record.config || !record.config.apiKey || !record.serverUrl) {
            throw new Error('AI 服务尚未开通');
        }
        const response = await axios.get(`${record.serverUrl.replace(/\/+$/, '')}/api/me/stats`, {
            timeout: 15000,
            httpsAgent: this.httpsAgent,
            proxy: false,
            headers: { Authorization: `Bearer ${record.config.apiKey}` },
        });
        return response.data;
    }

    get(userId) {
        return this.records[userId] || null;
    }

    publicView(userId) {
        const record = this.records[userId];
        if (!record) return null;
        const c = record.config || {};
        return {
            serverUrl: record.pendingServerUrl || record.serverUrl,
            activeServerUrl: record.serverUrl,
            pendingServerUrl: record.pendingServerUrl || '',
            updatedAt: record.updatedAt || 0,
            user: { name: c.userName || '', id: c.userId || '' },
            enabled: c.enabled !== false,
            configured: !!(c.configured && c.baseUrl && c.apiKey),
            model: c.model || '',
            baseUrl: c.baseUrl || '',
            expiresAt: Number(c.expiresAt) || 0,
            allowedModels: c.allowedModels || [],
            source: c.source || {},
            apiKeyMasked: c.apiKey ? `${String(c.apiKey).slice(0, 8)}…${String(c.apiKey).slice(-4)}` : '',
        };
    }

    clear(userId) {
        if (userId) delete this.records[userId];
        else this.records = {};
        this._persist();
    }
}
