// 平台相关代码，目前主要用来处理electron 和 浏览器之间不同

export function isElectron() {
    // Renderer process
    if (typeof window !== 'undefined' && typeof window.process === 'object' && window.process.type === 'renderer') {
        return true;
    }

    // Main process
    if (typeof process !== 'undefined' && typeof process.versions === 'object' && !!process.versions.electron) {
        return true;
    }

    // Detect the user agent when the `nodeIntegration` option is set to true
    if (typeof navigator === 'object' && typeof navigator.userAgent === 'string' && navigator.userAgent.indexOf('Electron') >= 0) {
        return true;
    }

    return false;
}

// pc
export const remote = require('@electron/remote');
export const ipcRenderer = require('electron').ipcRenderer;
export const ipcMain = require('electron').ipcMain;
export const shell = require('electron').shell;
export const fs = require('file-system').fs;
export const currentWindow = require('@electron/remote').getCurrentWindow();
export const BrowserWindow = require('@electron/remote').BrowserWindow;
export const AppPath = require('@electron/remote').app.getAppPath();
export const desktopCapturer = require('electron').desktopCapturer;
export const app = require('@electron/remote').app;

// for web

export const PostMessageEventEmitter = null;
