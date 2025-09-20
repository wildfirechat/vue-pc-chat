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

// pc - Electron APIs
export const ipcRenderer = require('electron').ipcRenderer
export const shell = require('electron').shell
export const fs = require('file-system').fs

const remoteWindow = (windowId) => {
    return {
        windowId: windowId,
        close: () => ipcRenderer.send('window-control', {windowId: windowId, command: 'close'}),
        minimize: () => ipcRenderer.send('window-control', {windowId, command: 'minimize'}),
        maximize: () => ipcRenderer.send('window-control', {windowId, command: 'maximize'}),
        unmaximize: () => ipcRenderer.send('window-control', {windowId, command: 'unmaximize'}),
        isMaximized: () => ipcRenderer.sendSync('window-state', {windowId, command: 'isMaximized'}),
        isMinimized: () => ipcRenderer.sendSync('window-state', {windowId, command: 'isMinimized'}),
        isVisible: () => ipcRenderer.sendSync('window-state', {windowId, command: 'isVisible'}),
        isDestroyed: () => ipcRenderer.sendSync('window-state', {windowId, command: 'isDestroyed'}),
        isAlwaysOnTop: () => ipcRenderer.sendSync('window-state', {windowId, command: 'isAlwaysOnTop'}),
        getMediaSourceId: () => ipcRenderer.sendSync('window-state', {windowId, command: 'getMediaSourceId'}),
        getSize: () => ipcRenderer.sendSync('window-state', {windowId, command: 'getSize'}),
        focus: () => ipcRenderer.send('window-control', {windowId, command: 'focus'}),
        show: () => ipcRenderer.send('window-control', {windowId, command: 'show'}),
        hide: () => ipcRenderer.send('window-control', {windowId, command: 'hide'}),
        setOpacity: (opacity) => ipcRenderer.send('window-control', {windowId, command: 'setOpacity', args: opacity}),
        setFullScreen: (flag) => ipcRenderer.send('window-control', {windowId, command: 'setFullScreen', args: flag}),
        setAlwaysOnTop: (flag) => ipcRenderer.send('window-control', {windowId, command: 'setAlwaysOnTop', args: flag}),
        setSize: (width, height, animate) => ipcRenderer.send('window-control', {windowId, command: 'setSize', args: [width, height, animate]}),
        setMinimumSize: (width, height) => ipcRenderer.send('window-control', {windowId, command: 'setMinimumSize', args: [width, height]}),
        setIgnoreMouseEvents: (ignore , options) => ipcRenderer.send('window-control', {windowId, command: 'setIgnoreMouseEvents', args: [ignore,options]}),
        setPosition: (x, y, animate) => ipcRenderer.send('window-control', {windowId, command: 'setPosition', args: [x, y, animate]}),
        center: () => ipcRenderer.send('window-control', {windowId, command: 'center'}),
        removeMenu: () => ipcRenderer.send('window-control', {windowId, command: 'removeMenu'}),
        // on: (event, listener) => {
        //     ipcRenderer.on(`window-${windowId}`, (event, args) => {
        //         if (event === event) {
        //             listener(event, args);
        //         }
        //     })
        // },
        webContents: {
            emit: (event, ...args) => ipcRenderer.send('webcontents-emit', {windowId, channel: event, args}),
            // on: (channel, listener) => {
            //     ipcRenderer.on(`window-${windowId}-webcontents-${channel}`, listener)
            // },
            send: (channel, ...args) => ipcRenderer.send('webcontents-send', {windowId, channel: channel, args}),
            openDevTools: () => ipcRenderer.send('webcontents-openDevTools', {windowId}),
            setZoomFactor: (factor) => ipcRenderer.send('webcontents-setZoomFactor', {windowId, args: factor}),
        }
    }
}

export const remote = {
    getCurrentWindow: () => {
        return remoteWindow();
    },
};

export const currentWindow = remote.getCurrentWindow();
export const BrowserWindow = {
    new: async (windowOptions) => {
        // ipcRenderer.sendSync('browser-window', 'new', options),
        console.log('create-voip-window', windowOptions);
        let windowId = await ipcRenderer.invoke('create-voip-window', windowOptions);
        return remoteWindow(windowId);
    },
    getAllWindows: () => ipcRenderer.invoke('browser-window', 'getAllWindows'),
    fromWebContents: () => null, // This can be implemented if needed with IPC
};
export const AppPath = ipcRenderer.sendSync('get-app-path');
export const app = {
    getPath: (name) => ipcRenderer.sendSync('app-get-path', name),
    getAppPath: () => AppPath,
    exit: (code) => ipcRenderer.send('app-exit', code),
    setAppUserModelId: (id) => ipcRenderer.send('app-set-user-model-id', id)
};
export const screen = {
    getPrimaryDisplay: () => ipcRenderer.sendSync('screen-sync', 'getPrimaryDisplay'),
    getAllDisplays: () => ipcRenderer.sendSync('screen-sync', 'getAllDisplays'),
    getDisplayNearestPoint: (point) => ipcRenderer.sendSync('screen-sync', 'getDisplayNearestPoint', point),
    getDisplayMatching: (rect) => ipcRenderer.sendSync('screen-sync', 'getDisplayMatching', rect),
    getCursorScreenPoint: () => ipcRenderer.sendSync('screen-sync', 'getCursorScreenPoint')
};
