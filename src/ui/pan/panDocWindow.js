import {ipcRenderer, isElectron} from '../../platform';
import IpcEventType from '../../ipcEventType';
import {buildPanDocUrl} from '../../platformHelper';
import panApi from '../../api/panApi';

/** 把 authCode 拼到文档地址的 fragment 上（不会发到服务端，也不进服务端日志） */
function withPanAuthCode(url, authCode) {
    if (!authCode) {
        return url;
    }
    const sep = url.indexOf('#') >= 0 ? '&' : '#';
    return url + sep + 'panAuthCode=' + encodeURIComponent(authCode);
}

/**
 * 打开在线文档。
 *
 * - PC（Electron）：像投票/接龙那样开一个独立窗口，一个文档一个窗口；
 *   同一个文档再次打开时聚焦已有窗口（主进程按 key 去重）。
 *   认证码在**主窗口**取好（主窗口一定有 IM 连接），随地址一起带给文档窗口，
 *   这样文档页不依赖新窗口里的桥也能登录。
 * - 网页版：仍然用应用内的文档面板（PanDocPanel 监听的事件总线）。
 *
 * @param {Object} payload
 * @param {string} payload.url 文档页地址（docOpenUrl / docViewUrl / 静态页）
 * @param {string} [payload.title] 窗口标题
 * @param {Object} [eventBus] 网页版使用的事件总线（组件里的 this.$eventBus）
 */
export async function openPanDoc(payload, eventBus) {
    if (!payload || !payload.url) {
        return;
    }
    if (isElectron()) {
        let docUrl = payload.url;
        try {
            docUrl = withPanAuthCode(docUrl, await panApi.getAuthCode());
        } catch (e) {
            console.warn('openPanDoc: 取 authCode 失败，交给文档页自己去认证', e);
        }
        ipcRenderer.send(IpcEventType.SHOW_PAN_DOC_WINDOW, {
            url: buildPanDocUrl({url: docUrl, title: payload.title || ''}),
            // 文档地址作为去重 key：同一文档不重复开窗口
            key: payload.url,
        });
        return;
    }
    if (eventBus) {
        eventBus.$emit('pan-doc-open', payload);
    }
}
