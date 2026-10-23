import { ipcRenderer, isElectron } from '../../platform';
import Config from '../../config';
import wfc from '../../wfc/client/wfc';
import { getItem } from '../../ui/util/storageHelper';
import IpcEventType from '../../ipcEventType';
import { setDshProvision, setDshHostStatus } from './state';

function appServerUrl() {
    return Config.getAppServer();
}

function authTokenFor(url) {
    try {
        return getItem('authToken-' + new URL(url).host);
    } catch (e) {
        return null;
    }
}

export function isDshSupported() {
    return isElectron();
}

/**
 * 登录后开通/复用机器人。Renderer 只提交 authToken + appServerUrl，
 * robotSecret / AI Key 留在主进程。
 */
export async function provisionDsh(forceRefresh = false) {
    if (!isElectron()) throw new Error('DSH 仅支持 Electron');
    const userId = wfc.getUserId();
    if (!userId) throw new Error('未登录');
    const url = appServerUrl();
    const authToken = authTokenFor(url);
    if (!authToken && !forceRefresh) {
        const cached = await ipcRenderer.invoke(IpcEventType.DSH_GET_CACHED, userId);
        if (cached && cached.ok && cached.provision) {
            setDshProvision(cached.provision);
            setDshHostStatus(cached.hostStatus);
            try { window.dispatchEvent(new Event('dsh-provision-updated')); } catch (e) { /* ignore */ }
        }
        return cached;
    }
    if (!authToken) throw new Error('缺少应用服务登录态');
    const result = await ipcRenderer.invoke(IpcEventType.DSH_PROVISION, {
        userId,
        appServerUrl: url,
        authToken,
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
    return ipcRenderer.invoke(IpcEventType.DSH_CLEAR_PROVISION, wfc.getUserId());
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
