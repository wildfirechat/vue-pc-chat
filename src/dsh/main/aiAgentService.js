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
        if (!data.config || !data.config.apiKey) {
            throw new Error('AI 服务开通失败：返回缺少 AI 配置');
        }
        // A missing robot is a partial success: keep the AI config so model /
        // quota changes still reach the client, and let the caller report the
        // robot error without restarting the Host.
        // Only switch the active server after a successful /provision.
        this.rememberServer(userId, base, true);
        this.records[userId] = {
            serverUrl: base,
            configVersion: data.configVersion || '',
            config: this._configFrom(data.config, base),
            updatedAt: Date.now(),
        };
        this._persist();
        return {
            ...data,
            aiAgent: data.aiAgent || { serverUrl: base },
        };
    }

    _configFrom(cfg, serverUrl) {
        const c = cfg || {};
        const base = String(serverUrl || '').replace(/\/+$/, '');
        return {
            baseUrl: base ? base + '/v1' : '',
            apiKey: c.apiKey,
            expiresAt: Number(c.expiresAt) || 0,
            model: c.model || '',
            reasoningEffort: c.reasoningEffort || '',
            maxTokens: c.maxTokens,
            contextWindow: c.contextWindow,
            allowedModels: c.allowedModels || [],
            allowCustomModel: c.allowCustomModel !== false,
            source: c.source || {},
            enabled: c.enabled !== false,
            configured: c.configured === true,
            userName: c.user?.name || '',
            userId: c.user?.id || '',
        };
    }

    /**
     * Cheap config refresh (GET /api/me/config). No IM call and no key rotation:
     * only the server-side config is merged into the cached record.
     *
     * Resolves to { ok, changed, unchanged, needsReprovision, disabled, status }.
     */
    async fetchConfig(userId, { etag } = {}) {
        const record = this.records[userId];
        if (!record || !record.config || !record.config.apiKey || !record.serverUrl) {
            return { ok: false, needsReprovision: true, error: 'AI 服务尚未开通' };
        }
        // Refresh before the key actually expires instead of waiting for a 401.
        const expiresAt = Number(record.config.expiresAt) || 0;
        if (expiresAt && expiresAt - Date.now() < 10 * 60 * 1000) {
            return { ok: false, needsReprovision: true, error: '客户端 Key 即将过期' };
        }
        const url = `${record.serverUrl.replace(/\/+$/, '')}/api/me/config`;
        const headers = { Authorization: `Bearer ${record.config.apiKey}` };
        if (etag) headers['If-None-Match'] = etag;
        try {
            const response = await axios.get(url, {
                timeout: 15000,
                httpsAgent: this.httpsAgent,
                proxy: false,
                headers,
                validateStatus: (s) => (s >= 200 && s < 300) || s === 304,
            });
            if (response.status === 304) {
                return { ok: true, unchanged: true, configVersion: record.configVersion || '' };
            }
            const data = response.data || {};
            if (!data.config || !data.config.apiKey) {
                return { ok: false, error: 'AI 服务返回缺少 AI 配置' };
            }
            const nextVersion = data.configVersion || '';
            const changed = nextVersion !== (record.configVersion || '');
            this.records[userId] = {
                ...record,
                configVersion: nextVersion,
                config: this._configFrom(data.config, record.serverUrl),
                updatedAt: Date.now(),
            };
            this._persist();
            return { ok: true, changed, configVersion: nextVersion };
        } catch (e) {
            const status = e.response?.status;
            const message = e.response?.data?.error?.message || e.message || '配置刷新失败';
            return {
                ok: false,
                status,
                error: message,
                // 401: key rotated/expired; 404/405: server too old for this
                // endpoint, fall back to /provision.
                needsReprovision: status === 401 || status === 404 || status === 405,
                disabled: status === 403,
            };
        }
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

    async renameRobot(userId, displayName) {
        const record = this.records[userId];
        if (!record || !record.config || !record.config.apiKey || !record.serverUrl) {
            throw new Error('AI 服务尚未开通');
        }
        const response = await axios.post(`${record.serverUrl.replace(/\/+$/, '')}/api/me/robot/rename`,
            { displayName },
            {
                timeout: 15000,
                httpsAgent: this.httpsAgent,
                proxy: false,
                headers: { Authorization: `Bearer ${record.config.apiKey}` },
            });
        return response.data;
    }

    /** Ask the effective model for a short session title (same model as chat). */
    async generateTitle(userId, text) {
        const record = this.records[userId];
        if (!record || !record.config || !record.config.apiKey || !record.config.model || !record.serverUrl) {
            throw new Error('AI 服务尚未开通');
        }
        const system = [
            'Create a concise title for an AI coding-assistant session from the supplied human message.',
            'Return only the title on one line, in plain text of natural language, with no quotes, prefix, explanation, Markdown, XML, or terminal control codes. No code is allowed.',
            'Use the language of the message.',
            'Aim for about 5 words in non-CJK languages or 10 CJK characters.',
        ].join('\n');
        const response = await axios.post(`${record.serverUrl.replace(/\/+$/, '')}/v1/chat/completions`, {
            model: record.config.model,
            messages: [
                { role: 'system', content: system },
                { role: 'user', content: `Generate the session title from this JSON array of human messages:\n${JSON.stringify([{ text }])}` },
            ],
            max_tokens: 64,
            temperature: 0.2,
            stream: false,
        }, {
            timeout: 60000,
            httpsAgent: this.httpsAgent,
            proxy: false,
            headers: { Authorization: `Bearer ${record.config.apiKey}` },
        });
        const choice = response.data && response.data.choices && response.data.choices[0];
        const content = choice && choice.message && choice.message.content;
        return typeof content === 'string' ? content : '';
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
            configVersion: record.configVersion || '',
            updatedAt: record.updatedAt || 0,
            user: { name: c.userName || '', id: c.userId || '' },
            enabled: c.enabled !== false,
            configured: !!(c.configured && c.baseUrl && c.apiKey),
            model: c.model || '',
            baseUrl: c.baseUrl || '',
            expiresAt: Number(c.expiresAt) || 0,
            allowedModels: c.allowedModels || [],
            allowCustomModel: c.allowCustomModel !== false,
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
