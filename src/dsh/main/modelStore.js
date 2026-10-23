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
        try {
            if (!fs.existsSync(this.file)) return {};
            const raw = fs.readFileSync(this.file);
            const text = safeStorage.isEncryptionAvailable()
                ? safeStorage.decryptString(raw)
                : raw.toString('utf8');
            const parsed = JSON.parse(text);
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch (e) {
            console.warn('[dsh] load model config failed', e && e.message);
            return {};
        }
    }

    _persist() {
        try {
            fs.mkdirSync(path.dirname(this.file), { recursive: true });
            const text = JSON.stringify(this.records);
            const data = safeStorage.isEncryptionAvailable()
                ? safeStorage.encryptString(text)
                : Buffer.from(text, 'utf8');
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
            maxTokens: m.maxTokens || 8192,
            contextWindow: m.contextWindow || 131072,
            hasApiKey: !!m.apiKey,
            apiKeyPreview: m.apiKey ? `••••${String(m.apiKey).slice(-4)}` : '',
            createdAt: m.createdAt,
        }));
    }
}
