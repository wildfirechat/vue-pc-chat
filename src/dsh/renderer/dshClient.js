import { ipcRenderer, isElectron } from '../../platform';
import Config from '../../config';
import wfc from '../../wfc/client/wfc';
import IpcEventType from '../../ipcEventType';
import { setDshProvision, setDshHostStatus, dshState } from './state';

export function isDshSupported() {
    return isElectron();
}

/** 通过 IM SDK 获取应用 authCode（和 wf-poll-server 等第三方服务一致）。 */
function getImAuthCode(serverUrl) {
    return new Promise((resolve, reject) => {
        let host;
        try { host = new URL(serverUrl).host; } catch (e) { reject(new Error('AI 服务地址无效')); return; }
        wfc.getAuthCode('admin', 2, host, (authCode) => {
            if (!authCode) reject(new Error('IM 返回空 authCode'));
            else resolve(authCode);
        }, (err) => reject(new Error('获取 IM authCode 失败：' + (err || 'unknown'))));
    });
}

/**
 * 登录后由 AI Agent 服务开通/复用机器人；robotSecret / AI Key 留在主进程。
 */
export async function provisionDsh(forceRefresh = false) {
    if (!isElectron()) throw new Error('DSH 仅支持 Electron');
    const userId = wfc.getUserId();
    if (!userId) throw new Error('未登录');
    const cached = await ipcRenderer.invoke(IpcEventType.DSH_GET_CACHED, userId);
    if (!forceRefresh && cached && cached.ok && cached.provision) {
        // A cached client key can expire while the app is closed. Refresh on
        // startup when it is missing or close to expiring; 0 means the server
        // has no TTL, so rely on the periodic config sync instead.
        const ai = cached.provision.ai || {};
        const expiresAt = Number(ai.expiresAt) || 0;
        const fresh = !expiresAt || expiresAt - Date.now() > 24 * 60 * 60 * 1000;
        if (fresh) {
            setDshProvision(cached.provision);
            setDshHostStatus(cached.hostStatus);
            try { window.dispatchEvent(new Event('dsh-provision-updated')); } catch (e) { /* ignore */ }
            return cached;
        }
    }
    const status = await ipcRenderer.invoke(IpcEventType.DSH_AI_AGENT_STATUS, userId);
    const serverUrl = (status && status.view && status.view.serverUrl)
        || (cached && cached.provision && cached.provision.aiAgent && cached.provision.aiAgent.serverUrl)
        || Config.getAiAgentServer()
        || '';
    if (!serverUrl) throw new Error('请先在 config.js 或「AI 服务」中配置服务地址');
    const authCode = await getImAuthCode(serverUrl);
    const result = await ipcRenderer.invoke(IpcEventType.DSH_PROVISION, {
        userId,
        serverUrl,
        authCode,
        clientId: wfc.getClientId(),
        platform: Config.getWFCPlatform(),
        forceRefresh,
    });
    if (result && result.ok && result.provision) {
        setDshProvision(result.provision);
        setDshHostStatus(result.hostStatus);
        try { window.dispatchEvent(new Event('dsh-provision-updated')); } catch (e) { /* ignore */ }
    }
    return result;
}

let lastRecoveryAt = 0;

/**
 * Periodic, authCode-free config refresh. Detects server-side model / quota /
 * whitelist changes and recovers from a rotated client key (401) by doing one
 * forced /provision, with a cooldown to avoid loops.
 */
export async function syncDshConfig() {
    if (!isElectron()) return { ok: false, error: '仅支持 Electron' };
    const userId = wfc.getUserId();
    if (!userId) return { ok: false, error: '未登录' };
    const result = await ipcRenderer.invoke(IpcEventType.DSH_SYNC_CONFIG, userId);
    if (result && result.ok && result.provision) {
        setDshProvision(result.provision);
        setDshHostStatus(result.hostStatus);
        try { window.dispatchEvent(new Event('dsh-provision-updated')); } catch (e) { /* ignore */ }
        return result;
    }
    if (result && result.disabled) {
        // The server rejected the key because the admin stopped this user.
        // Reflect it locally so the UI shows "已停用" instead of "已配置".
        const prev = dshState.provision;
        if (prev) {
            setDshProvision({ ...prev, ai: { ...(prev.ai || {}), enabled: false } });
            try { window.dispatchEvent(new Event('dsh-provision-updated')); } catch (e) { /* ignore */ }
        }
        return result;
    }
    if (result && result.needsReprovision && Date.now() - lastRecoveryAt > 5 * 60 * 1000) {
        lastRecoveryAt = Date.now();
        try { return await provisionDsh(true); }
        catch (e) { return { ok: false, error: e && e.message ? e.message : String(e), needsReprovision: true }; }
    }
    return result || { ok: false, error: '配置同步失败' };
}

export async function getDshStatus() {
    if (!isElectron()) return null;
    return ipcRenderer.invoke(IpcEventType.DSH_GET_STATUS);
}

export async function getDshLog(maxLines = 300) {
    if (!isElectron()) return '';
    return ipcRenderer.invoke(IpcEventType.DSH_GET_LOG, maxLines);
}

export async function getDshRouting(limit = 100) {
    if (!isElectron()) return [];
    return ipcRenderer.invoke(IpcEventType.DSH_GET_ROUTING, limit);
}

export async function getDshAudit(limit = 100) {
    if (!isElectron()) return [];
    return ipcRenderer.invoke(IpcEventType.DSH_GET_AUDIT, limit);
}

export async function getDshAiAgent(userId) {
    if (!isElectron()) return { ok: false };
    return ipcRenderer.invoke(IpcEventType.DSH_AI_AGENT_STATUS, userId);
}

export async function loginDshAiAgent(userId, serverUrl) {
    if (!isElectron()) return { ok: false, error: '仅支持 Electron' };
    serverUrl = serverUrl || Config.getAiAgentServer();
    if (!serverUrl) return { ok: false, error: '请填写 AI 服务地址' };
    const authCode = await getImAuthCode(serverUrl);
    const result = await ipcRenderer.invoke(IpcEventType.DSH_AI_AGENT_LOGIN, { userId, serverUrl, authCode });
    if (result && result.ok && result.provision) {
        setDshProvision(result.provision);
        setDshHostStatus(result.hostStatus);
        try { window.dispatchEvent(new Event('dsh-provision-updated')); } catch (e) { /* ignore */ }
        try { window.dispatchEvent(new Event('dsh-ai-agent-server-changed')); } catch (e) { /* ignore */ }
    }
    return result;
}

export async function getDshAiAgentStats(userId) {
    if (!isElectron()) return { ok: false, error: '仅支持 Electron' };
    return ipcRenderer.invoke(IpcEventType.DSH_AI_AGENT_STATS, userId);
}

export async function generateDshTitle(userId, text) {
    if (!isElectron()) return { ok: false, error: '仅支持 Electron' };
    return ipcRenderer.invoke(IpcEventType.DSH_GENERATE_TITLE, { userId, text });
}

export async function renameDshRobot(userId, displayName) {
    if (!isElectron()) return { ok: false, error: '仅支持 Electron' };
    const result = await ipcRenderer.invoke(IpcEventType.DSH_RENAME_ROBOT, { userId, displayName });
    if (result && result.ok && result.provision) {
        setDshProvision(result.provision);
        try { window.dispatchEvent(new Event('dsh-provision-updated')); } catch (e) { /* ignore */ }
    }
    return result;
}

export async function setDshAiAgentServer(userId, serverUrl) {
    if (!isElectron()) return { ok: false, error: '仅支持 Electron' };
    const result = await ipcRenderer.invoke(IpcEventType.DSH_AI_AGENT_SET_SERVER, { userId, serverUrl });
    if (result && result.ok) {
        try { window.dispatchEvent(new Event('dsh-ai-agent-server-changed')); } catch (e) { /* ignore */ }
    }
    return result;
}

export async function clearDshAiAgent(userId) {
    if (!isElectron()) return { ok: false };
    const result = await ipcRenderer.invoke(IpcEventType.DSH_AI_AGENT_CLEAR, userId);
    if (result && result.ok) {
        setDshProvision(null);
        setDshHostStatus(result.hostStatus);
        try { window.dispatchEvent(new Event('dsh-provision-updated')); } catch (e) { /* ignore */ }
        try { window.dispatchEvent(new Event('dsh-ai-agent-server-changed')); } catch (e) { /* ignore */ }
    }
    return result;
}

export async function getDshModels(userId) {
    if (!isElectron()) return [];
    return ipcRenderer.invoke(IpcEventType.DSH_GET_MODELS, userId);
}

export async function addDshModel(userId, model) {
    return ipcRenderer.invoke(IpcEventType.DSH_ADD_MODEL, { userId, model });
}

export async function updateDshModel(userId, id, model) {
    return ipcRenderer.invoke(IpcEventType.DSH_UPDATE_MODEL, { userId, id, model });
}

export async function deleteDshModel(userId, id) {
    return ipcRenderer.invoke(IpcEventType.DSH_DELETE_MODEL, { userId, id });
}

export async function getDshFiles(dir) {
    if (!isElectron() || !dir) return [];
    return ipcRenderer.invoke(IpcEventType.DSH_LIST_FILES, dir);
}

/** List one directory for the workspace file browser (no 30-entry cap). */
export async function getDshDirectory(dir) {
    if (!isElectron() || !dir) return [];
    try {
        return await ipcRenderer.invoke(IpcEventType.DSH_LIST_DIRECTORY, dir);
    } catch (e) {
        return [];
    }
}

/** Read a workspace file for the file previewer. */
export async function readDshFile(filePath) {
    if (!isElectron() || !filePath) return { ok: false, error: 'missing path' };
    try {
        return await ipcRenderer.invoke(IpcEventType.DSH_READ_FILE, filePath);
    } catch (e) {
        return { ok: false, error: e && e.message ? e.message : String(e) };
    }
}

/**
 * 「新会话」可选项：运行时模型目录（provider/model + 推理等级）与 profile 声明
 * 的 agent preset。与 dsh-runtime-patch.yml / profile patch 同源；宿主未启动或
 * profile 未启用 preset 模式时对应列表为空。
 */
export async function getDshModelCatalog() {
    const empty = { models: [], presets: [], defaultPreset: '' };
    if (!isElectron()) return empty;
    try {
        const data = await ipcRenderer.invoke(IpcEventType.DSH_MODEL_CATALOG);
        if (Array.isArray(data)) return { ...empty, models: data };
        return {
            models: Array.isArray(data && data.models) ? data.models : [],
            presets: Array.isArray(data && data.presets) ? data.presets : [],
            defaultPreset: (data && data.defaultPreset) || '',
        };
    } catch (e) {
        return empty;
    }
}

export async function getDshPlugins() {
    if (!isElectron()) return { plugins: [], profileDir: '' };
    return ipcRenderer.invoke(IpcEventType.DSH_GET_PLUGINS);
}

export async function getDshWorkspaces() {
    if (!isElectron()) return {};
    return ipcRenderer.invoke(IpcEventType.DSH_GET_WORKSPACES);
}

export async function pickDshDirectory() {
    if (!isElectron()) return { ok: false };
    return ipcRenderer.invoke(IpcEventType.DSH_PICK_DIRECTORY);
}

export async function openDshPath(targetPath) {
    if (!isElectron()) return { ok: false };
    return ipcRenderer.invoke(IpcEventType.DSH_OPEN_PATH, targetPath);
}

export async function restartDsh() {
    if (!isElectron()) return null;
    return ipcRenderer.invoke(IpcEventType.DSH_RESTART);
}

export async function stopDsh() {
    if (!isElectron()) return null;
    return ipcRenderer.invoke(IpcEventType.DSH_STOP);
}

export async function openDshLog() {
    if (!isElectron()) return false;
    return ipcRenderer.invoke(IpcEventType.DSH_OPEN_LOG);
}

export async function clearDshProvision() {
    if (!isElectron()) return { ok: false };
    const result = await ipcRenderer.invoke(IpcEventType.DSH_CLEAR_PROVISION, wfc.getUserId());
    if (result && result.ok) {
        setDshProvision(null);
        setDshHostStatus(null);
        try { window.dispatchEvent(new Event('dsh-provision-updated')); } catch (e) { /* ignore */ }
    }
    return result;
}

export function onDshStatus(callback) {
    if (!isElectron()) return () => {};
    const listener = (event, status) => {
        setDshHostStatus(status);
        callback(status);
    };
    ipcRenderer.on(IpcEventType.DSH_STATUS_EVENT, listener);
    return () => ipcRenderer.off(IpcEventType.DSH_STATUS_EVENT, listener);
}

// ── 用户自定义 Agent 预设 ────────────────────────────────────────────────────

/** 列出预设（内置 + 自建）与可选工具。 */
export async function listDshPresets() {
    if (!isElectron()) return { ok: false, error: '仅支持 Electron', items: [] };
    try {
        return await ipcRenderer.invoke(IpcEventType.DSH_PRESET_LIST);
    } catch (e) {
        return { ok: false, error: e && e.message ? e.message : String(e), items: [] };
    }
}

/** 新建或保存一个预设定义（id 已存在则覆盖）。 */
export async function saveDshPreset(spec) {
    return ipcRenderer.invoke(IpcEventType.DSH_PRESET_SAVE, spec);
}

/** 删除自建预设。 */
export async function deleteDshPreset(id) {
    return ipcRenderer.invoke(IpcEventType.DSH_PRESET_DELETE, id);
}

/** 设置默认预设（空字符串 = 不覆盖部署默认）。 */
export async function setDshDefaultPreset(id) {
    return ipcRenderer.invoke(IpcEventType.DSH_PRESET_SET_DEFAULT, id);
}

/** 导出为 .dshpreset.zip（主进程弹保存框）。 */
export async function exportDshPreset(id) {
    return ipcRenderer.invoke(IpcEventType.DSH_PRESET_EXPORT, id);
}

/** 选择并解析一个预设包，返回预览（不落盘）。 */
export async function inspectDshPresetImport() {
    return ipcRenderer.invoke(IpcEventType.DSH_PRESET_IMPORT);
}

/** 应用导入：{ file, id, overwrite, overwriteSkills }。 */
export async function applyDshPresetImport(payload) {
    return ipcRenderer.invoke(IpcEventType.DSH_PRESET_IMPORT_APPLY, payload);
}

/** 选择一个技能目录并安装到 $DSH_HOME/skills。 */
export async function addDshPresetSkills() {
    return ipcRenderer.invoke(IpcEventType.DSH_PRESET_ADD_SKILLS);
}

/** 列出 $DSH_HOME/skills 下全部技能（含展示名/描述）。 */
export async function listDshPresetSkills() {
    try {
        return await ipcRenderer.invoke(IpcEventType.DSH_PRESET_LIST_SKILLS);
    } catch (e) {
        return { ok: false, error: e && e.message ? e.message : String(e), skills: [] };
    }
}

/** 读取一个技能的 SKILL.md 内容。 */
export async function readDshPresetSkill(name) {
    try {
        return await ipcRenderer.invoke(IpcEventType.DSH_PRESET_READ_SKILL, name);
    } catch (e) {
        return { ok: false, error: e && e.message ? e.message : String(e) };
    }
}

// ── 本地设置 ────────────────────────────────────────────────────────────────

/** 读取本地设置（目前只有 asrServer）。 */
export async function getDshLocalSettings() {
    if (!isElectron()) return { ok: false, settings: { asrServer: '' } };
    try {
        return await ipcRenderer.invoke(IpcEventType.DSH_GET_LOCAL_SETTINGS);
    } catch (e) {
        return { ok: false, error: e && e.message ? e.message : String(e), settings: { asrServer: '' } };
    }
}

/** 保存语音转文字服务地址；Host 运行中会自动重启使其生效。 */
export async function setDshAsrServer(url) {
    return ipcRenderer.invoke(IpcEventType.DSH_SET_ASR_SERVER, url || '');
}

/** 读取主会话设置。 */
export async function getDshMainSession() {
    if (!isElectron()) return { ok: false, settings: {} };
    try {
        return await ipcRenderer.invoke(IpcEventType.DSH_GET_MAIN_SESSION);
    } catch (e) {
        return { ok: false, error: e && e.message ? e.message : String(e), settings: {} };
    }
}

/** 保存主会话设置；Host 运行中会自动重启使其生效。 */
export async function setDshMainSession(mainSession) {
    return ipcRenderer.invoke(IpcEventType.DSH_SET_MAIN_SESSION, mainSession || {});
}
