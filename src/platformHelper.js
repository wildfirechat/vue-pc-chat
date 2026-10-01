import { ipcRenderer, isElectron } from './platform';
import { remote, screen } from './platform';
import IPCEventType from './ipcEventType';
import IpcEventType from './ipcEventType';
import store from './store';
import Config from './config';
import ImageMessageContent from './wfc/messages/imageMessageContent';
import { scaleDown } from './ui/util/imageUtil';

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

/**
 * 构建投票页面 URL
 * @param {Object} params
 * @param {string} params.mode - 'home' | 'create' | 'list' | 'detail'
 * @param {string} [params.pollId] - 投票 ID（detail 模式需要）
 * @param {string} [params.groupId] - 群 ID
 * @param {boolean} [params.fromMessage] - 是否从消息点击进入
 * @returns {string}
 */
export function buildPollUrl({ mode = 'home', pollId, groupId, fromMessage } = {}) {
    const baseUrl = getAppBaseUrl();

    // 根据模式决定路由
    let route = '/poll';
    if (mode === 'create') {
        route = '/poll/create';
    } else if (mode === 'list') {
        route = '/poll/list';
    } else if (mode === 'detail' && pollId) {
        route = '/poll/detail';
    }

    let url = baseUrl + '#' + route;

    const queryParams = [];
    if (pollId) {
        queryParams.push(`pollId=${pollId}`);
    }
    if (groupId) {
        queryParams.push(`groupId=${groupId}`);
    }
    if (fromMessage) {
        queryParams.push(`fromMessage=1`);
    }
    if (queryParams.length > 0) {
        url += `?${queryParams.join('&')}`;
    }

    return url;
}

/**
 * 构建接龙页面 URL
 * @param {Object} params
 * @param {string} params.mode - 'create' | 'detail'
 * @param {string} [params.collectionId] - 接龙 ID（detail 模式需要）
 * @param {string} [params.groupId] - 群 ID
 * @returns {string}
 */
export function buildCollectionUrl({ mode = 'create', collectionId, groupId } = {}) {
    const baseUrl = getAppBaseUrl();

    // 根据模式决定路由
    let route = collectionId ? '/collection/detail' : '/collection/create';

    let url = baseUrl + '#' + route;

    const queryParams = [];
    if (collectionId) {
        queryParams.push(`collectionId=${collectionId}`);
    }
    if (groupId) {
        queryParams.push(`groupId=${groupId}`);
    }
    if (queryParams.length > 0) {
        url += `?${queryParams.join('&')}`;
    }

    return url;
}

/**
 * 构建在线文档独立窗口的 URL（#/pan-doc?fileId= 或 ?url=）
 * @param {Object} params
 * @param {string} [params.url] - 按链接只读打开的文档地址
 * @param {string|number} [params.fileId] - 网盘文件 id
 * @param {string} [params.name] - 文件名（按链接打开时给服务端用）
 * @param {string} [params.title] - 窗口标题
 * @param {string} [params.href] - 直接放进页面的地址（静态页）
 * @returns {string}
 */
export function buildPanDocUrl({url, fileId, name, title, href} = {}) {
    const baseUrl = getAppBaseUrl();
    let appUrl = baseUrl + '#/pan-doc';
    const queryParams = [];
    if (fileId) {
        queryParams.push(`fileId=${encodeURIComponent(fileId)}`);
    }
    if (url) {
        queryParams.push(`url=${encodeURIComponent(url)}`);
    }
    if (href) {
        queryParams.push(`href=${encodeURIComponent(href)}`);
    }
    if (name) {
        queryParams.push(`name=${encodeURIComponent(name)}`);
    }
    if (title) {
        queryParams.push(`title=${encodeURIComponent(title)}`);
    }
    if (queryParams.length > 0) {
        appUrl += `?${queryParams.join('&')}`;
    }
    return appUrl;
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
        let size;
        if (message.messageContent instanceof ImageMessageContent) {
            let display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
            let imgMsg = message.messageContent;
            if (imgMsg.imageWidth && imgMsg.imageHeight) {
                let workAreaWith = display.workAreaSize.width;
                let workAreaHeight = display.workAreaSize.height;
                size = scaleDown(imgMsg.imageWidth, imgMsg.imageHeight, workAreaWith, workAreaHeight);
            }
        }
        ipcRenderer.send(IpcEventType.SHOW_MULTIMEDIA_PREVIEW_WINDOW, {
            url: url,
            messageUid: stringValue(message.messageUid),
            size
        });
        console.log('show-multimedia-preview-window', url);
    } else {
        store.previewMessage(message, continuous);
    }

}
