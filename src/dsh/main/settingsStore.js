import fs from 'fs';
import path from 'path';

/**
 * 客户端本地设置（不属于服务端开通信息，也不进模型配置）。
 *
 * - `asrServer`：语音消息转文字服务地址；
 * - `mainSession`：主会话（owner 私聊 + line0 普通群旁观）的各项开关，
 *   保存后写入 Host overlay 并重启 Host 生效。
 */
export default class SettingsStore {
    constructor(userDataPath) {
        this.file = path.join(userDataPath, 'dsh-local-settings.json');
    }

    load() {
        try {
            const raw = JSON.parse(fs.readFileSync(this.file, 'utf8'));
            return raw && typeof raw === 'object' ? raw : {};
        } catch (e) {
            return {};
        }
    }

    get() {
        const data = this.load();
        const ms = data.mainSession && typeof data.mainSession === 'object' ? data.mainSession : {};
        return {
            asrServer: String(data.asrServer || '').trim(),
            mainSession: {
                enabled: ms.enabled !== false,
                groups: Array.isArray(ms.groups) ? ms.groups.map((g) => String(g)).filter(Boolean) : [],
                workspace: String(ms.workspace || '').trim(),
                bufferLimit: Number(ms.bufferLimit) > 0 ? Number(ms.bufferLimit) : 200,
                injectLimit: Number(ms.injectLimit) > 0 ? Number(ms.injectLimit) : 30,
                notify: ms.notify !== false,
                notifyCooldownMs: Number(ms.notifyCooldownMs) >= 0 ? Number(ms.notifyCooldownMs) : 600000,
                notifyKeywords: Array.isArray(ms.notifyKeywords)
                    ? ms.notifyKeywords.map((k) => String(k)).filter(Boolean)
                    : [],
                groupReply: ms.groupReply === 'owner' ? 'owner' : 'group',
                history: {
                    enabled: !ms.history || ms.history.enabled !== false,
                    dir: String((ms.history && ms.history.dir) || '').trim(),
                    retainDays: Number(ms.history && ms.history.retainDays) >= 0
                        ? Number(ms.history.retainDays)
                        : 0,
                },
            },
        };
    }

    set(patch) {
        const next = { ...(patch || {}) };
        const data = { ...this.load(), ...next };
        if (next.mainSession && typeof next.mainSession === 'object') {
            const current = (data.mainSession && typeof data.mainSession === 'object') ? data.mainSession : {};
            data.mainSession = { ...current, ...next.mainSession };
            if (next.mainSession.history && typeof next.mainSession.history === 'object') {
                data.mainSession.history = {
                    ...((current.history && typeof current.history === 'object') ? current.history : {}),
                    ...next.mainSession.history,
                };
            }
        }
        try {
            fs.writeFileSync(this.file, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 });
        } catch (e) {
            // 写失败时仍返回内存值，调用方会看到未保存的差异
        }
        return this.get();
    }
}
