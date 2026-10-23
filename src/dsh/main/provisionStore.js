import fs from 'fs';
import path from 'path';
import { safeStorage } from 'electron';

/**
 * 加密缓存 /robot/provision 返回的机器人凭据与 AI 配置。
 * 缓存按 userId 分区，Renderer 永远拿不到 secret。
 */
export default class DshProvisionStore {
    constructor(userDataPath) {
        this.file = path.join(userDataPath, 'dsh-provision.enc');
        this.records = this._load();
    }

    _load() {
        try {
            if (!fs.existsSync(this.file)) return {};
            const raw = fs.readFileSync(this.file);
            let text;
            if (safeStorage.isEncryptionAvailable()) {
                text = safeStorage.decryptString(raw);
            } else {
                text = raw.toString('utf8');
            }
            const parsed = JSON.parse(text);
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch (e) {
            console.warn('[dsh] load provision cache failed', e.message);
            return {};
        }
    }

    _persist() {
        try {
            fs.mkdirSync(path.dirname(this.file), { recursive: true });
            const text = JSON.stringify(this.records);
            let data;
            if (safeStorage.isEncryptionAvailable()) {
                data = safeStorage.encryptString(text);
            } else {
                console.warn('[dsh] safeStorage unavailable; provisioning cache will be stored with file permissions only');
                data = Buffer.from(text, 'utf8');
            }
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
            configVersion: provision.configVersion,
            features: provision.features,
            robot: {
                robotId: robot.robotId,
                gatewayUrl: robot.gatewayUrl,
                imServerUrl: robot.imServerUrl,
                owner: robot.owner,
                displayName: robot.displayName,
                portrait: robot.portrait,
            },
            ai: {
                provider: ai.provider,
                baseUrl: ai.baseUrl,
                model: ai.model,
                reasoningEffort: ai.reasoningEffort,
                maxTokens: ai.maxTokens,
                models: ai.models || [],
                configured: !!ai.apiKey,
            },
        };
    }
}
