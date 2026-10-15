import { ipcRenderer, isElectron } from './platform';
import { remote } from './platform';
import IPCEventType from './ipcEventType';
import IpcEventType from './ipcEventType';
import store from './store';
import Config from './config';

/**
 * 获取基础 URL（开发环境或生产环境）
 * @returns {string}
 */
export function getAppBaseUrl() {
    let hash = window.location.hash;
    let url = window.location.origin;
    if (hash) {
        url = window.location.href.replace(hash, '');
    } else {
        // url += '';
    }
    return url;
}

export function downloadFile(message) {
    let file = message.messageContent;
    downloadFile2(file.remotePath, file.name, message.messageUid);
}

export function downloadFile2(url, name, messageUid) {
    // 检查禁止接收的文件类型
    let fileName = name || '';
    let ext = fileName.split('.').pop().toLowerCase();
    if (Config.DISABLED_RECEIVE_FILE_TYPES.includes(ext)) {
        console.log('file type not allowed to receive', ext);
        window.dispatchEvent(new CustomEvent('app-toast', {
            detail: { title: '提示', text: '不能接收该类型文件', type: 'warn' }
        }));
        return;
    }

    // 消息里的地址是消息加载时按当时的网络转换的，双网切换后可能已经不可达，下载时按当前网络重新转换
    url = Config.urlRedirect(url);

    if (isElectron()) {
        ipcRenderer.send(IPCEventType.DOWNLOAD_FILE, {
            messageUid: stringValue(messageUid),
            remotePath: url,
            fileName: name,
            windowId: remote.getCurrentWindow().getMediaSourceId()
        });
    } else {
        let fileHref = url;
        let filename = name;
        if (window.navigator.msSaveBlob) {// ie
            let xhr = new XMLHttpRequest();
            xhr.onloadstart = function () {
                xhr.responseType = 'blob';
            };
            xhr.onload = function () {
                navigator.msSaveOrOpenBlob(xhr.response, filename);
            };
            xhr.open('GET', fileHref, true);
            xhr.send();
        } else {
            let anchor = document.createElement('a');
            anchor.download = filename;
            anchor.href = fileHref;
            anchor.target = 'about:blank';
            anchor.click();
        }
    }
}

export function previewMM(message, mixMultiMediaItemIndex = 0, continuous = true) {
    if (isElectron()) {
        let hash = window.location.hash;
        let url = window.location.origin;
        if (hash) {
            url = window.location.href.replace(hash, '#/mmpreview');
        } else {
            url += '/mmpreview';
        }

        url += `?messageUid=${stringValue(message.messageUid)}&mmmIndex=${mixMultiMediaItemIndex}&continuous=${continuous}`;
        ipcRenderer.send(IpcEventType.SHOW_MULTIMEDIA_PREVIEW_WINDOW, {
            url: url,
            messageUid: stringValue(message.messageUid),
        });
        console.log('show-multimedia-preview-window', url);
    } else {
        store.previewMessage(message, continuous);
    }

}
