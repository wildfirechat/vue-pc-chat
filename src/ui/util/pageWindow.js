import {ipcRenderer} from "../../platform";
import IpcEventType from "../../ipcEventType";

/** 当前页面地址换成 #<path>，独立窗口和主窗口加载同一份页面 */
function pageUrl(path) {
    const hash = window.location.hash;
    if (hash) {
        return window.location.href.replace(hash, '#' + path);
    }
    return window.location.origin + path;
}

/** 打开 PC 设置窗口（单实例，已开着就置顶）。网页版没有独立窗口，设置还是主界面里的页面 */
export function openSettingsWindow() {
    ipcRenderer.send(IpcEventType.SHOW_SETTINGS_WINDOW, {url: pageUrl('/setting')});
}
