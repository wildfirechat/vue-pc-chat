import fs from 'fs';
import path from 'path';
import { safeStorage } from 'electron';

/**
 * 用户额外添加的大模型配置（OpenAI-compatible）。
 *
 * 服务端 provision 返回的 ai 是只读默认配置；这里只保存用户新增的模型，
 * API Key 用 safeStorage 加密，Renderer 只能拿到脱敏信息。
 */
export default class DshModelStore {
    constructor(userDataPath) {
        this.file = path.join(userDataPath, 'dsh-models.enc');
        this.records = this._load();
    }

    _load() {
        if (!fs.existsSync(this.file)) return {};
        let raw;
        try { raw = fs.readFileSync(this.file); } catch (e) { return {}; }
        const texts = [];
        if (safeStorage.isEncryptionAvailable()) {
            try { texts.push(safeStorage.decryptString(raw)); } catch (e) { /* 旧平台/明文缓存 */ }
        }
        texts.push(raw.toString('utf8'));
        for (const text of texts) {
            try {
                const parsed = JSON.parse(text);
                if (parsed && typeof parsed === 'object') return parsed;
            } catch (e) { /* try next */ }
        }
        try {
            const backup = `${this.file}.corrupt-${Date.now()}`;
            fs.renameSync(this.file, backup);
            console.warn(`[dsh] model config is not valid JSON or cannot be decrypted; moved to ${backup}`);
        } catch (e) {
            try { fs.unlinkSync(this.file); } catch (e2) { /* ignore */ }
            console.warn('[dsh] model config is invalid; removed');
        }
        return {};
    }

    _persist() {
        try {
            if (!safeStorage.isEncryptionAvailable()) {
                // Never persist a custom-provider API key as plaintext.
                console.warn('[dsh] safeStorage unavailable; refusing to persist custom model credentials');
                try { if (fs.existsSync(this.file)) fs.unlinkSync(this.file); } catch (e) { /* ignore */ }
                return;
            }
            fs.mkdirSync(path.dirname(this.file), { recursive: true });
            const text = JSON.stringify(this.records);
            const data = safeStorage.encryptString(text);
            fs.writeFileSync(this.file, data, { mode: 0o600 });
            try { fs.chmodSync(this.file, 0o600); } catch (e) { /* ignore */ }
        } catch (e) {
            console.warn('[dsh] persist model config failed', e && e.message);
        }
    }

    get(userId) {
        if (!userId) return [];
        return Array.isArray(this.records[userId]) ? this.records[userId] : [];
    }

    save(userId, models) {
        if (!userId) return [];
        this.records[userId] = Array.isArray(models) ? models : [];
        this._persist();
        return this.get(userId);
    }

    static publicView(models) {
        return (models || []).map(m => ({
            id: m.id,
            providerId: m.providerId || 'custom',
            name: m.name,
            baseUrl: m.baseUrl,
            model: m.model,
            reasoningEffort: m.reasoningEffort || '',
            maxTokens: m.maxTokens || 393216,
            contextWindow: m.contextWindow || 1048576,
            hasApiKey: !!m.apiKey,
            apiKeyPreview: m.apiKey ? `••••${String(m.apiKey).slice(-4)}` : '',
            createdAt: m.createdAt,
        }));
    }
}
