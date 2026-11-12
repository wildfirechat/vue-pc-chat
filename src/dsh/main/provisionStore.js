import fs from 'fs';
import path from 'path';
import { safeStorage } from 'electron';

/**
 * 加密缓存 AI Agent 服务 /provision 返回的机器人凭据与 AI 配置。
 * 缓存按 userId 分区，Renderer 永远拿不到 secret。
 */
export default class DshProvisionStore {
    constructor(userDataPath) {
        this.file = path.join(userDataPath, 'dsh-provision.enc');
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
        // 跨平台复制过来的 safeStorage 缓存无法解密。不要反复读取乱码，
        // 保留一份 .corrupt-* 供诊断，然后从空缓存开始。
        try {
            const backup = `${this.file}.corrupt-${Date.now()}`;
            fs.renameSync(this.file, backup);
            console.warn(`[dsh] provision cache is not valid JSON or cannot be decrypted; moved to ${backup}`);
        } catch (e) {
            try { fs.unlinkSync(this.file); } catch (e2) { /* ignore */ }
            console.warn('[dsh] provision cache is invalid; removed');
        }
        return {};
    }

    _persist() {
        try {
            if (!safeStorage.isEncryptionAvailable()) {
                // robotSecret is a long-lived credential; never write it as
                // plaintext. Re-provisioning after restart is the safe fallback.
                console.warn('[dsh] safeStorage unavailable; refusing to persist robot credentials');
                try { if (fs.existsSync(this.file)) fs.unlinkSync(this.file); } catch (e) { /* ignore */ }
                return;
            }
            fs.mkdirSync(path.dirname(this.file), { recursive: true });
            const text = JSON.stringify(this.records);
            const data = safeStorage.encryptString(text);
            fs.writeFileSync(this.file, data, { mode: 0o600 });
            try { fs.chmodSync(this.file, 0o600); } catch (e) { /* ignore */ }
        } catch (e) {
            console.warn('[dsh] persist provision cache failed', e.message);
        }
    }

    get(userId) {
        if (!userId) return null;
        const record = this.records[userId];
        return record && record.provision ? record : null;
    }

    put(userId, provision, appServerUrl) {
        if (!userId || !provision) return;
        this.records[userId] = {
            provision,
            appServerUrl,
            updatedAt: Date.now(),
        };
        this._persist();
    }

    clear(userId) {
        if (!userId) {
            this.records = {};
        } else {
            delete this.records[userId];
        }
        this._persist();
    }

    /**
     * 给 Renderer 的脱敏视图：不包含 robotSecret / ai.apiKey。
     */
    static publicView(provision, cached = false) {
        if (!provision) return null;
        const robot = provision.robot || {};
        const ai = provision.ai || {};
        return {
            cached: !!cached,
            updatedAt: provision.updatedAt || 0,
            configVersion: provision.configVersion,
            features: provision.features,
            robot: {
                robotId: robot.robotId,
                gatewayUrl: robot.gatewayUrl,
                owner: robot.owner,
                displayName: robot.displayName,
                portrait: robot.portrait,
            },
            aiAgent: provision.aiAgent && provision.aiAgent.serverUrl
                ? { serverUrl: provision.aiAgent.serverUrl }
                : undefined,
            ai: {
                provider: ai.provider,
                baseUrl: ai.baseUrl,
                model: ai.model,
                reasoningEffort: ai.reasoningEffort,
                maxTokens: ai.maxTokens,
                contextWindow: ai.contextWindow,
                allowedModels: ai.allowedModels || [],
                allowCustomModel: ai.allowCustomModel !== false,
                expiresAt: ai.expiresAt,
                enabled: ai.enabled !== false,
                configured: ai.configured === true,
            },
        };
    }
}
