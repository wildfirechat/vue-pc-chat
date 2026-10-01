import {ipcRenderer, isElectron} from '../../platform';
import IpcEventType from '../../ipcEventType';
import {buildPanDocUrl} from '../../platformHelper';

/**
 * 打开在线文档。
 *
 * - PC（Electron）：像投票/接龙那样开一个独立窗口，一个文档一个窗口；
 *   同一个文档再次打开时聚焦已有窗口（主进程按 key 去重）。
 * - 网页版：仍然用应用内的文档面板（PanDocPanel 监听的事件总线）。
 *
 * @param {Object} payload
 * @param {string} payload.url 文档页地址（docOpenUrl / docViewUrl / 静态页）
 * @param {string} [payload.title] 窗口标题
 * @param {Object} [eventBus] 网页版使用的事件总线（组件里的 this.$eventBus）
 */
export function openPanDoc(payload, eventBus) {
    if (!payload || !payload.url) {
        return;
    }
    if (isElectron()) {
        const appUrl = buildPanDocUrl({
            url: payload.url,
            title: payload.title || '',
        });
        ipcRenderer.send(IpcEventType.SHOW_PAN_DOC_WINDOW, {
            url: appUrl,
            // 文档地址作为去重 key：同一文档不重复开窗口
            key: payload.url,
        });
        return;
    }
    if (eventBus) {
        eventBus.$emit('pan-doc-open', payload);
    }
}
