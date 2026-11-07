import fs from 'fs';
import path from 'path';

/**
 * 客户端本地设置（不属于服务端开通信息，也不进模型配置）。
 *
 * 目前只有一项：`asrServer` —— 语音消息转文字的服务地址。宿主插件的
 * `asrServer` 配置会把群里的语音先转成文本再交给 Agent；为空 = 关闭。
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
        return {
            asrServer: String(data.asrServer || '').trim(),
        };
    }

    set(patch) {
        const data = { ...this.load(), ...(patch || {}) };
        try {
            fs.writeFileSync(this.file, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 });
        } catch (e) {
            // 写失败时仍返回内存值，调用方会看到未保存的差异
        }
        return this.get();
    }
}
