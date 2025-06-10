import {app, BrowserWindow, ipcMain, screen} from "electron";

// Window control handlers
ipcMain.on('window-control', (event, args) => {
    let windowId = args.windowId;
    let command = args.command;
    args = args.args;
    let win;
    if (windowId) {
        win = BrowserWindow.fromId(windowId);
    } else {
        win = BrowserWindow.fromWebContents(event.sender);
    }
    if (!win) return;

    switch (command) {
        case 'close':
            win.close();
            break;
        case 'minimize':
            win.minimize();
            break;
        case 'maximize':
            win.maximize();
            break;
        case 'unmaximize':
            win.unmaximize();
            break;
        case 'focus':
            win.focus();
            break;
        case 'show':
            win.show();
            break;
        case 'hide':
            win.hide();
            break;
        case 'setOpacity':
            win.setOpacity(args[0]);
            break;
        case 'setFullScreen':
            win.setFullScreen(args[0]);
            break;
        case 'setAlwaysOnTop':
            win.setAlwaysOnTop(args[0]);
            break;
        case 'setSize':
            win.setSize(args[0], args[1], args[2]);
            break;
        case 'setMinimumSize':
            win.setMinimumSize(args[0], args[1]);
            break;
        case 'setIgnoreMouseEvents':
            win.setIgnoreMouseEvents(args[0], args[1]);
            break;
        case 'setPosition':
            win.setPosition(args[0], args[1], args[2]);
            break;
        case 'center':
            win.center();
            break;
        case 'removeMenu':
            win.removeMenu();
            break;
        default:
            break
    }
});

// Window state handlers
ipcMain.on('window-state', (event, args) => {
    let windowId = args.windowId;
    let command = args.command;
    args = args.args;
    let win;
    if (windowId) {
        win = BrowserWindow.fromId(windowId);
    } else {
        win = BrowserWindow.fromWebContents(event.sender);
    }
    if (!win) {
        event.returnValue = undefined;
        return;
    }

    switch (command) {
        case 'isMaximized':
            event.returnValue = win.isMaximized();
            break;
        case 'isMinimized':
            event.returnValue = win.isMinimized();
            break;
        case 'isVisible':
            event.returnValue = win.isVisible();
            break;
        case 'isDestroyed':
            event.returnValue = win.isDestroyed();
            break;
        case 'isAlwaysOnTop':
            event.returnValue = win.isAlwaysOnTop();
            break;
        case 'getMediaSourceId':
            event.returnValue = win.getMediaSourceId();
            break;
        case 'getSize':
            event.returnValue = win.getSize();
            break
        default:
            event.returnValue = false;
    }
});

// WebContents handlers
ipcMain.on('webcontents-emit', (event, args) => {
    let windowId = args.windowId;
    let channel = args.channel;
    args = args.args;
    let win;
    if (windowId) {
        win = BrowserWindow.fromId(windowId);
    } else {
        win = BrowserWindow.fromWebContents(event.sender);
    }
    if (win && win.webContents) {
        win.webContents.emit(channel, ...args);
    }
});

ipcMain.on('webcontents-send', (event, args) => {
    let windowId = args.windowId;
    let channel = args.channel;
    args = args.args;
    let win;
    if (windowId) {
        win = BrowserWindow.fromId(windowId);
    } else {
        win = BrowserWindow.fromWebContents(event.sender);
    }
    if (win && win.webContents) {
        win.webContents.send(channel, ...args);
    }
});

ipcMain.on('webcontents-openDevTools', (event, args) => {
    let windowId = args.windowId;
    let win;
    if (windowId) {
        win = BrowserWindow.fromId(windowId);
    } else {
        win = BrowserWindow.fromWebContents(event.sender);
    }
    if (win && win.webContents) {
        win.webContents.openDevTools();
    }
});

ipcMain.on('webcontents-setZoomFactor', (event, args) => {
    let windowId = args.windowId;
    args = args.args;
    let win;
    if (windowId) {
        win = BrowserWindow.fromId(windowId);
    } else {
        win = BrowserWindow.fromWebContents(event.sender);
    }
    if (win && win.webContents) {
        win.webContents.setZoomFactor(args);
    }
});

// App path handler
ipcMain.on('get-app-path', (event) => {
    event.returnValue = app.getAppPath();
});

// App handlers
ipcMain.on('app-get-path', (event, name) => {
    event.returnValue = app.getPath(name);
});

ipcMain.on('app-exit', (event, code) => {
    app.exit(code);
});

ipcMain.on('app-set-user-model-id', (event, id) => {
    app.setAppUserModelId(id);
});

// BrowserWindow handlers
ipcMain.handle('browser-window', async (event, command, ...args) => {
    switch (command) {
        case 'getAllWindows':
            return BrowserWindow.getAllWindows().map(win => ({
                id: win.id,
                title: win.getTitle(),
                // Add other needed window properties
            }));
        default:
            return null;
    }
});

// Replace the asynchronous screen handlers with synchronous ones
ipcMain.on('screen-sync', (event, command, ...args) => {
    switch (command) {
        case 'getPrimaryDisplay':
            event.returnValue = screen.getPrimaryDisplay();
            break;
        case 'getAllDisplays':
            event.returnValue = screen.getAllDisplays();
            break;
        case 'getDisplayNearestPoint':
            event.returnValue = screen.getDisplayNearestPoint(args[0]);
            break;
        case 'getDisplayMatching':
            event.returnValue = screen.getDisplayMatching(args[0]);
            break;
        case 'getCursorScreenPoint':
            event.returnValue = screen.getCursorScreenPoint();
            break;
        default:
            event.returnValue = null;
    }
});
