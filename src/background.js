import fs from 'fs';
import tmp from 'tmp';
import {
    app,
    BrowserWindow,
    clipboard,
    crashReporter,
    dialog,
    globalShortcut,
    ipcMain,
    Menu,
    nativeImage as NativeImage,
    powerMonitor,
    protocol,
    screen,
    session,
    shell,
    Tray,
    desktopCapturer,
    webContents
} from 'electron';
import Screenshots from "electron-screenshots";
import windowStateKeeper from 'electron-window-state';
import i18n from 'i18n';
import proto from '../marswrapper.node';
// import rcProto from '../rc.node';

import pkg from '../package.json';
import IPCEventType from "./ipcEventType";
import nodePath from 'path'
import {init as initProtoMain} from "./wfc/proto/proto_main";
import createProtocol from "./createProtocol";

console.log('start crash report', app.getPath('crashDumps'))
// crashReporter.start({uploadToServer: false});
crashReporter.start({
    companyName: pkg.company,
    productName: pkg.name,
    submitURL: 'https://imndxx_gmail_com.bugsplat.com/post/electron/crash.php',
    compress: true,
    ignoreSystemCrashHandler: false,
    extra: {
        'key': 'application key',
        'email': 'user email',
        'comments': 'comment'
    }
})

// Scheme must be registered before the app is ready
protocol.registerSchemesAsPrivileged([
    {scheme: 'app', privileges: {secure: true, standard: true, bypassCSP: true}}
])

const isDevelopment = process.env.NODE_ENV !== 'production'

const workingDir = isDevelopment ? `${__dirname}/public` : `${__dirname}`;


let Locales = {};
i18n.configure({
    locales: ['en', 'ch'],
    directory: workingDir + '/locales',
    register: Locales
});
Locales.setLocale('ch');

app.commandLine.appendSwitch('js-flags', '--expose-gc')
// 忽略证书错误
//app.commandLine.appendSwitch('ignore-certificate-errors')

process.on('uncaughtException', (error) => {
    console.log('--------uncaughtException-----------', error)
})

let forceQuit = false;
let downloading = false;
let mainWindow;
let fileWindow;
let multimediaPreviewWindow;
let compositeMessageWindows = new Map();
let openPlatformAppHostWindows = new Map();
let conversationMessageHistoryMessageWindow;
let messageHistoryMessageWindow;
let conversationWindowMap = new Map();
let screenshots;
let tray;
let trayIcon;
let downloadFileMap = new Map()
let settings = {};
let isFullScreen = false;
let isMainWindowFocusedWhenStartScreenshot = false;
let screenShotWindowId = 0;
let isOsx = process.platform === 'darwin';
let isWin = !isOsx;
let userId = ''

let isSuspend = false;
let closeWindowToExit = true;
let userData = app.getPath('userData');
let imagesCacheDir = `${userData}/images`;
let voicesCacheDir = `${userData}/voices`;
let mainMenu = [
    {
        label: pkg.name,
        submenu: [
            {
                label: `About ${pkg.name}`,
                selector: 'orderFrontStandardAboutPanel:',
            },
            {
                label: Locales.__('Main').Preferences,
                accelerator: 'Cmd+,',
                click() {
                    mainWindow.show();
                    mainWindow.webContents.send('show-settings');
                }
            },
            {
                type: 'separator'
            },
            {
                role: 'hide'
            },
            {
                role: 'hideothers'
            },
            {
                role: 'unhide'
            },
            {
                label: Locales.__('Main').Check,
                accelerator: 'Cmd+U',
                click() {
                    checkForUpdates();
                }
            },
            {
                type: 'separator'
            },
            {
                label: Locales.__('Main').Quit,
                accelerator: 'Command+Q',
                selector: 'terminate:',
                click() {
                    forceQuit = true;
                    mainWindow = null;
                    disconnectAndQuit();
                }
            }
        ]
    },
    {
        label: Locales.__('Edit').Title,
        submenu: [
            {
                role: 'undo',
                label: Locales.__('Edit').Undo
            },
            {
                role: 'redo',
                label: Locales.__('Edit').Redo
            },
            {
                type: 'separator'
            },
            {
                role: 'cut',
                label: Locales.__('Edit').Cut
            },
            {
                role: 'copy',
                label: Locales.__('Edit').Copy
            },
            {
                role: 'paste',
                label: Locales.__('Edit').Paste
            },
            {
                role: 'pasteandmatchstyle',
                label: Locales.__('Edit').PasteMatch
            },
            {
                role: 'delete',
                label: Locales.__('Edit').Delete
            },
            {
                role: 'selectall',
                label: Locales.__('Edit').SelectAll
            }
        ]
    },
    {
        label: Locales.__('View').Title,
        submenu: [
            {
                label: isFullScreen ? Locales.__('View').ExitFull : Locales.__('View').EnterFull,
                accelerator: 'Shift+Cmd+F',
                click() {
                    isFullScreen = !isFullScreen;

                    mainWindow.show();
                    mainWindow.setFullScreen(isFullScreen);
                }
            },
            {
                label: Locales.__('View').ToggleConversations,
                accelerator: 'Shift+Cmd+M',
                click() {
                    mainWindow.show();
                    mainWindow.webContents.send('show-conversations');
                }
            },
            {
                type: 'separator',
            },
            {
                type: 'separator',
            },
            {
                role: 'toggledevtools',
                label: Locales.__('View').ToggleDevtools
            },
            {
                role: 'togglefullscreen',
                label: Locales.__('View').ToggleFull
            }
        ]
    },
    {
        label: Locales.__('Window').Title,
        role: 'window',
        submenu: [
            {
                label: Locales.__('Window').Min,
                role: 'minimize'
            },
            {
                label: Locales.__('Window').Close,
                role: 'close'
            }
        ]
    },
    {
        label: Locales.__('Help').Title,
        role: 'help',
        submenu: [
            {
                label: Locales.__('Help').FeedBack,
                click() {
                    shell.openExternal('https://github.com/wildfirechat/vue-pc-chat/issues');
                }
            },
            {
                label: Locales.__('Help').Fork,
                click() {
                    shell.openExternal('https://github.com/wildfirechat/vue-pc-chat');
                }
            },
            {
                type: 'separator'
            },
            {
                role: 'reload',
                label: Locales.__('Help').Reload
            },
            {
                role: 'forcereload',
                label: Locales.__('Help').ForceReload
            },
        ]
    }
];
let trayMenu = [
    {
        label: '切换主窗口',
        click() {
            let isVisible = mainWindow.isVisible();
            isVisible ? mainWindow.hide() : mainWindow.show();
        }
    },
    {
        type: 'separator'
    },
    {
        label: Locales.__('Help').Fork,
        click() {
            shell.openExternal('https://github.com/wildfirechat/vue-pc-chat');
        }
    },
    {
        label: Locales.__('View').ToggleDevtools,
        accelerator: 'Alt+Command+I',
        click() {
            mainWindow.show();
            mainWindow.toggleDevTools();
        }
    },
    {
        type: 'separator'
    },
    {
        label: Locales.__('Main').Quit,
        accelerator: 'Command+Q',
        selector: 'terminate:',
        click() {
            forceQuit = true;
            mainWindow = null;
            proto.disconnect(0);
            console.log('--------------- disconnect', proto);
            setTimeout(() => {
                app.exit(0);
            }, 1000);
        }
    }
];
let blink = null

function checkForUpdates() {
    if (downloading) {
        dialog.showMessageBox({
            type: 'info',
            buttons: ['OK'],
            title: pkg.name,
            message: `Downloading...`,
            detail: `Please leave the app open, the new version is downloading. You'll receive a new dialog when downloading is finished.`
        });

        return;
    }

}

function updateTray(unread = 0) {
    settings.showOnTray = true;

    if (settings.showOnTray) {
        if (tray
            && updateTray.lastUnread === unread) {
            return;
        }

        let contextmenu = Menu.buildFromTemplate(trayMenu);
        if (!trayIcon) {
            let iconPath;
            if (!isOsx) {
                iconPath = `${workingDir}/images/icon.png`;
            } else {
                iconPath = `${workingDir}/images/tray.png`;
            }
            trayIcon = NativeImage.createFromPath(iconPath);
        }


        // Make sure the last tray has been destroyed
        setTimeout(() => {
            if (!tray) {
                // Init tray icon
                tray = new Tray(trayIcon);
                if (process.platform === 'linux') {
                    tray.setContextMenu(contextmenu);
                }

                tray.on('right-click', () => {
                    tray.popUpContextMenu(contextmenu);
                });

                tray.on('click', () => {
                    mainWindow.show();
                });
            }

            if (isOsx) {
                tray.setTitle(unread > 0 ? ' ' + unread : '');
            }

            tray.setImage(trayIcon);
            execBlink(unread > 0);
            // Avoid tray icon been recreate
            updateTray.lastUnread = unread;
        });
    } else {
        if (!tray) return;

        // if (!isOsx) {
        tray.destroy();
        // }
        tray = null;
    }


}

function createMenu() {
    var menu = Menu.buildFromTemplate(mainMenu);

    if (isOsx) {
        Menu.setApplicationMenu(menu);
    } else {
        mainWindow.setMenu(null);
    }
}

function regShortcut() {
    // if(isWin) {
    globalShortcut.register('CommandOrControl+G', () => {
        mainWindow.webContents.toggleDevTools();
    })
    // }
    globalShortcut.register('Control+F5', () => {
        mainWindow.webContents.reload();
    })
    globalShortcut.register('CommandOrControl+shift+a', () => {
        isMainWindowFocusedWhenStartScreenshot = mainWindow.isFocused();
        console.log('isMainWindowFocusedWhenStartScreenshot', mainWindow.isFocused());
        screenshots.startCapture()
    });
    // 调试用，主要用于处理 windows 不能打开子窗口的控制台
    // 打开所有窗口控制台
    globalShortcut.register('ctrl+shift+i', () => {
        let windows = BrowserWindow.getAllWindows();
        windows.forEach(win => win.openDevTools())

    });
    globalShortcut.register('ctrl+shift+d', () => {
        let heapdump = require('@nearform/heap-profiler');
        console.log('generateHeapSnapshot dir', __dirname)
        heapdump.generateHeapSnapshot({
            destination: __dirname + "/" + Date.now() + ".heapsnapshot"
        }, (err) => {
            console.log('generateHeapSnapshot cb', err)
        })
    });
}

const downloadHandler = (event, item, webContents) => {
    // 设置保存路径,使Electron不提示保存对话框。
    // item.setSavePath('/tmp/save.pdf')
    let fileName = downloadFileMap.get(item.getURL()).fileName;
    item.setSaveDialogOptions({defaultPath: fileName})

    item.on('updated', (event, state) => {
        try {
            if (state === 'interrupted') {
                console.log('Download is interrupted but can be resumed')
            } else if (state === 'progressing') {
                if (item.isPaused()) {
                    console.log('Download is paused')
                } else {
                    // console.log(`Received bytes: ${fileName} ${item.getReceivedBytes()}, ${item.getTotalBytes()}`)
                    let downloadFile = downloadFileMap.get(item.getURL());
                    let messageUid = downloadFile.messageUid;
                    webContents.send('file-download-progress', {
                            messageUid: messageUid,
                            receivedBytes: item.getReceivedBytes(),
                            totalBytes: item.getTotalBytes()
                        }
                    );
                }
            }

        } catch (e) {
            console.log('downloadHandler updated error', e)
        }
    })
    item.once('done', (event, state) => {
        try {
            let downloadFile = downloadFileMap.get(item.getURL());
            if (!downloadFile) {
                return;
            }
            let messageUid = downloadFile.messageUid
            if (state === 'completed') {
                console.log('Download successfully')
                webContents.send('file-downloaded', {messageUid: messageUid, filePath: item.getSavePath()});
            } else {
                webContents.send('file-download-failed', {messageUid: messageUid});
                console.log(`Download failed: ${state}`)
            }
            downloadFileMap.delete(item.getURL());

        } catch (e) {
            console.log('downloadHandler done error', e)
        }
    })
}

const createMainWindow = async () => {
    let mainWindowState = windowStateKeeper({
        defaultWidth: 960,
        defaultHeight: 600,
    });

    mainWindow = new BrowserWindow({
        x: mainWindowState.x,
        y: mainWindowState.y,
        width: 960,
        height: 600,
        minWidth: 960,
        minHeight: 600,
        opacity: 0,
        titleBarStyle: 'hidden',
        trafficLightPosition: {x: 4, y: 8},
        maximizable: false,
        resizable: false,
        backgroundColor: 'none',
        // 以下两属性设置时会导致win不能正常unmaximize. electron bug
        // transparent: true,
        // resizable: false,
        webPreferences: {
            scrollBounce: false,
            nodeIntegration: true,
            contextIsolation: false,
            nativeWindowOpen: true,
            webSecurity: false,
            webviewTag: true,
            zoomFactor: 1.0

            // 如果想打包之后的版本，不能打开调试控制台，请取消下面的注释
            // devTools: !app.isPackaged,
        },
        frame: !isWin,
    });
    mainWindow.center();
    const badgeOptions = {}

    if (process.env.WEBPACK_DEV_SERVER_URL) {
        // Load the url of the dev server if in development mode
        await mainWindow.loadURL(process.env.WEBPACK_DEV_SERVER_URL)
        //if (!process.env.IS_TEST) mainWindow.webContents.openDevTools()
    } else {
        createProtocol('app')
        // Load the index.html when not in development
        mainWindow.loadURL('app://./index.html')
    }
    mainWindow.webContents.on('did-finish-load', (e) => {
        try {
            mainWindow.show();
            mainWindow.focus();
            if (deepLinkUrl) {
                onDeepLink(deepLinkUrl)
            }
            setTimeout(() => mainWindow.setOpacity(1), 1000 / 60);
        } catch (ex) {
            // do nothing
        }
    });

    mainWindow.webContents.on('new-window', (event, url) => {
        event.preventDefault();
        console.log('new-windows', url)
        shell.openExternal(url);
    });

    // open url in default browser, electron 22-
    mainWindow.webContents.on('will-navigate', (event, url) => {
        console.log('will-navigate', url)
        // do default action
        event.preventDefault();
        // console.log('navigate', url)
        shell.openExternal(url);
    });

    // open url in default browser, electron 22+
    mainWindow.webContents.setWindowOpenHandler(details => {
        console.log('main windowOpenHandler', details)
        shell.openExternal(details.url);
        return {action: 'deny'}
    });

    mainWindow.on('close', e => {
        if (forceQuit || !tray || closeWindowToExit) {
            mainWindow = null;
            disconnectAndQuit();
        } else {
            e.preventDefault();
            if (mainWindow.isFullScreen()) {
                mainWindow.setFullScreen(false);
                mainWindow.once('leave-full-screen', () => mainWindow.hide())
            } else {
                mainWindow.hide();
            }
        }
    });

    mainWindow.webContents.session.on('will-download', downloadHandler);

    ipcMain.on(IPCEventType.START_SCREEN_SHOT, (event, args) => {
        // console.log('main voip-message event', args);
        screenShotWindowId = event.sender.id;
        screenshots.startCapture();
    });

    ipcMain.on('voip-message', (event, args) => {
        // console.log('main voip-message event', args);
        mainWindow.webContents.send('voip-message', args);
    });

    ipcMain.on('update-call-start-message', (event, args) => {
        // console.log('main update-call-start-message event', args);
        mainWindow.webContents.send('update-call-start-message', args);
    });

    ipcMain.on('conference-request', (event, args) => {
        // console.log('main voip-message event', args);
        mainWindow.webContents.send('conference-request', args);
    });

    ipcMain.on(IPCEventType.START_SCREEN_SHARE, (event, args) => {
        let pointer = screen.getCursorScreenPoint();
        let display = screen.getDisplayNearestPoint(pointer)
        mainWindow.webContents.send(IPCEventType.START_SCREEN_SHARE, {width: display.size.width, ...args});
    });

    ipcMain.on(IPCEventType.STOP_SCREEN_SHARE, (event, args) => {
        mainWindow.webContents.send(IPCEventType.STOP_SCREEN_SHARE, args);
    });

    ipcMain.on(IPCEventType.CLICK_NOTIFICATION, (event, args) => {
        let targetMediaSourceId = args;
        let targetWin = null;
        if (mainWindow.getMediaSourceId() === targetMediaSourceId) {
            targetWin = mainWindow;
        } else {
            for (let win of conversationWindowMap.values()) {
                if (win.getMediaSourceId() === targetMediaSourceId) {
                    targetWin = win;
                    break;
                }
            }
        }
        if (targetWin && !targetWin.isVisible() || targetWin.isMinimized()) {
            targetWin.show();
            targetWin.focus();
        }
    });

    ipcMain.on('exec-blink', (event, args) => {
        var isBlink = args.isBlink;
        execBlink(isBlink, args.interval);
    });

    ipcMain.on(IPCEventType.UPDATE_BADGE, (event, args) => {
        let count = args;
        //if (settings.showOnTray) {
        updateTray(count);
        app.badgeCount = count;
        //}
    });

    ipcMain.on(IPCEventType.FILE_PASTE, (event) => {
        let args = {hasImage: false};

        if (process.platform !== 'linux') {
            const clipboardEx = require('electron-clipboard-ex')
            // only support windows and mac
            if (clipboardEx) {
                const filePaths = clipboardEx.readFilePaths();
                if (filePaths && filePaths.length > 0) {
                    args = {
                        files: [],
                    };
                    filePaths.forEach(path => {
                        let stat = fs.statSync(path);
                        if (stat.isFile()) {
                            args.files.push({
                                path: path,
                                name: nodePath.basename(path),
                                size: stat.size,
                            })
                        }
                    })
                }
            }

            args.hasFile = args.files && args.files.length > 0;
        }

        if (!args.hasFile) {
            let image = clipboard.readImage();
            console.log('file-paste', image.isEmpty(), image.isTemplateImage(), image.isMacTemplateImage);
            if (!image.isEmpty()) {
                let filename = tmp.tmpNameSync() + '.png';

                args = {
                    hasImage: true,
                    filename: filename,
                    raw: image.toPNG(),
                };

                fs.writeFileSync(filename, image.toPNG());
            }
        }

        event.returnValue = args;
    });
    ipcMain.on(IPCEventType.FILE_COPY, (event, args) => {
        if (process.platform !== 'linux') {
            const clipboardEx = require('electron-clipboard-ex')
            console.log('copy path', args.path);
            clipboardEx.writeFilePaths([args.path]);
        }
    });

    ipcMain.on(IPCEventType.DOWNLOAD_FILE, async (event, args) => {
        let remotePath = args.remotePath;
        let messageUid = args.messageUid;
        let windowId = args.windowId;
        remotePath = remotePath.replace(':80', '');
        downloadFileMap.set(encodeURI(remotePath), {messageUid: messageUid, fileName: args.fileName, windowId: windowId});

        let windows = BrowserWindow.getAllWindows();
        windows.forEach(w => {
            if (w.getMediaSourceId() === windowId) {
                w.webContents.downloadURL(remotePath)
            }
        })
    });

    ipcMain.on(IPCEventType.SHOW_FILE_WINDOW, async (event, args) => {
        console.log('on show-file-window', fileWindow, args)
        if (!fileWindow) {
            let win = createWindow(args.url, 960, 600, 640, 400, true, true);

            // win.webContents.openDevTools();
            win.on('close', () => {
                fileWindow = null;
            });
            win.webContents.session.on('will-download', downloadHandler);
            win.show();
            fileWindow = win;
        } else {
            fileWindow.show();
            fileWindow.focus();
        }
    });

    ipcMain.on(IPCEventType.SHOW_MULTIMEDIA_PREVIEW_WINDOW, async (event, args) => {
        console.log('on show-multimedia-preview-window', multimediaPreviewWindow, args)
        if (!multimediaPreviewWindow) {
            let win = createWindow(args.url, args.size ? args.size.width : 960, args.size ? args.size.height : 600, 640, 520, true, false, true, false, false);

            // win.webContents.openDevTools();
            win.on('close', () => {
                multimediaPreviewWindow = null;
            });
            win.webContents.on('unload', () => {
                win.loadURL('about:blank')
            });
            win.center();
            win.show();
            multimediaPreviewWindow = win;
        } else {
            multimediaPreviewWindow.webContents.loadURL(args.url);
            multimediaPreviewWindow.show();
            multimediaPreviewWindow.focus();
        }
    });
    ipcMain.on(IPCEventType.SHOW_COMPOSITE_MESSAGE_WINDOW, async (event, args) => {
        console.log('on show-composite-message-window', args)
        let messageUid = args.messageUid;
        let compositeMessageWin = compositeMessageWindows.get(messageUid);
        if (!compositeMessageWin) {
            let url;
            if (messageUid) {
                url = args.url + ('?messageUid=' + messageUid)
            } else {
                url = args.url;
            }
            let win = createWindow(url, 960, 600, 640, 400, false, false);
            if (messageUid) {
                compositeMessageWindows.set(messageUid, win)
            }

            // win.webContents.openDevTools();
            win.on('close', () => {
                if (messageUid) {
                    compositeMessageWindows.delete(messageUid);
                }
            });
            win.show();
        } else {
            compositeMessageWin.show();
            compositeMessageWin.focus();
        }
    });

    ipcMain.on(IPCEventType.OPEN_H5_APP_WINDOW, async (event, args) => {
        console.log('on open-h5-app-window', args)
        let win = openPlatformAppHostWindows.get(args.hostUrl);
        if (!win) {
            win = createWindow(args.url, 960, 600, 640, 400, true, true);
            openPlatformAppHostWindows.set(args.hostUrl, win);
            win.on('close', () => {
                openPlatformAppHostWindows.delete(args.hostUrl);
            });
            win.show();
        } else {
            win.webContents.send('new-open-platform-app-tab', args);
            win.show();
            win.focus();
        }
    });

    ipcMain.on(IPCEventType.WORKSPACE_NEW_TAB_WEB_CONTENT, async (event, args) => {
        console.log('on workspace-new-tab-web-content', args)
        let id = args.id;
        let _webContents = webContents.fromId(id)
        _webContents.setWindowOpenHandler(details => {
            console.log('workspace windowOpenHandler', details)
            mainWindow.webContents.send(IPCEventType.WORKSPACE_ADD_NEW_TAB, {url: encodeURI(details.url), frameName: details.frameName})
            return {action: 'deny'}
        });
    });

    ipcMain.on(IPCEventType.showConversationMessageHistoryPage, async (event, args) => {
        console.log(`on ${IPCEventType.showConversationMessageHistoryPage}`, conversationMessageHistoryMessageWindow, args)
        if (!conversationMessageHistoryMessageWindow) {
            let url = args.url + (`?type=${args.type}&target=${args.target}&line=${args.line}`)
            conversationMessageHistoryMessageWindow = createWindow(url, 960, 600, 640, 400, false, false, false, false);
            conversationMessageHistoryMessageWindow.on('close', () => {
                conversationMessageHistoryMessageWindow = null;
            });
            conversationMessageHistoryMessageWindow.show();
        } else {
            let url = args.url + (`?type=${args.type}&target=${args.target}&line=${args.line}`)
            try {
                await conversationMessageHistoryMessageWindow.loadURL(url)
            } catch (e) {
                // 不知道为啥，loadURL 会失败，reload 就好了
                conversationMessageHistoryMessageWindow.reload();
            }
            conversationMessageHistoryMessageWindow.show();
            conversationMessageHistoryMessageWindow.focus();
        }
    });

    ipcMain.on(IPCEventType.showMessageHistoryPage, async (event, args) => {
        console.log(`on ${IPCEventType.showMessageHistoryPage}`, messageHistoryMessageWindow, args)
        if (!messageHistoryMessageWindow) {
            messageHistoryMessageWindow = createWindow(args.url, 960, 600, 640, 400, false, false, true);
            messageHistoryMessageWindow.on('close', () => {
                messageHistoryMessageWindow = null;
            });
            messageHistoryMessageWindow.show();
        } else {
            messageHistoryMessageWindow.show();
            messageHistoryMessageWindow.focus();
        }
    });

    ipcMain.on(IPCEventType.showConversationFloatPage, async (event, args) => {
        console.log(`on ${IPCEventType.showConversationFloatPage}`, messageHistoryMessageWindow, args)
        let url = args.url + (`?type=${args.type}&target=${args.target}&line=${args.line}`)
        let key = args.type + '-' + args.target + '-' + args.line;
        let win = conversationWindowMap.get(key);
        if (!win) {
            win = createWindow(url, 960, 600, 480, 320, true, true, true);
            win.on('close', () => {
                conversationWindowMap.delete(key);
                mainWindow.send('floating-conversation-window-closed', {
                        type: args.type,
                        target: args.target,
                        line: args.line
                    }
                );
            });
            win.show();
            conversationWindowMap.set(key, win);
        } else {
            win.show();
            win.focus();
        }
    });

    // 直接在ui层处理了
    // ipcMain.on('open-file', async (event, filename) => {
    //     shell.openItem(filename);
    // });
    //
    // ipcMain.on('open-folder', async (event, dir) => {
    //     shell.openItem(dir);
    // });

    ipcMain.on('open-map', (event, args) => {
        event.preventDefault();
        shell.openExternal(args.map);
    });

    ipcMain.on(IPCEventType.IS_SUSPEND, (event, args) => {
        event.returnValue = isSuspend;
    });

    ipcMain.on(IPCEventType.LOGIN, (event, args) => {
        closeWindowToExit = args.closeWindowToExit;
        mainWindow.resizable = true;
        mainWindow.maximizable = true;
        mainWindow.minimizable = true;
        mainWindow.setMinimumSize(960, 600);
        mainWindow.setSize(mainWindowState.width, mainWindowState.height);
        mainWindow.center();
        mainWindowState.manage(mainWindow);

        userId = args.userId
        // for multi-instance
        // app.requestSingleInstanceLock({userId: args.userId})
    });

    ipcMain.on(IPCEventType.LOGOUT, (event, args) => {
        mainWindowState.unmanage();
        mainWindow.resizable = false;
        mainWindow.maximizable = false;
        mainWindow.setMinimumSize(400, 500);
        mainWindow.setSize(400, 500);
        mainWindow.center();

        // 清未读数
        updateTray(0);
        app.badgeCount = 0;

        // 请缓存
        session.defaultSession.clearCache();
        session.defaultSession.clearAuthCache();
        session.defaultSession.clearStorageData();
    });

    ipcMain.on(IPCEventType.RESIZE_LOGIN_WINDOW, (event, args) => {
        mainWindowState.unmanage();
        mainWindow.resizable = false;
        mainWindow.maximizable = false;
        mainWindow.setMinimumSize(400, 500);
        mainWindow.setSize(400, 500);
        mainWindow.center();
    });

    ipcMain.on(IPCEventType.ENABLE_CLOSE_WINDOW_TO_EXIT, (event, enable) => {
        closeWindowToExit = enable;
    });

    ipcMain.on('start-secret-server', (event, args) => {
        startSecretDecodeServer(args.port);
    })
    ipcMain.on('start-op-server', (event, args) => {
        startOpenPlatformServer(args.port);
    })

    ipcMain.handle('getMediaSourceId', (event, args) => {
        const senderWindow = BrowserWindow.fromWebContents(event.sender); // BrowserWindow or null
        return senderWindow.getMediaSourceId();
    });

    ipcMain.handle(IPCEventType.GET_SOURCE, (event, args) => {
        return desktopCapturer.getSources(args)
    });

    powerMonitor.on('resume', () => {
        isSuspend = false;
        mainWindow.webContents.send('os-resume');
        proto.onAppResume();
    });

    powerMonitor.on('suspend', () => {
        isSuspend = true;
        proto.onAppSuspend();
    });

    if (isOsx) {
        app.setAboutPanelOptions({
            applicationName: pkg.name,
            applicationVersion: pkg.version,
            copyright: 'Made with 💖 by wildfiechat. \n https://github.com/wildfirechat/vue-pc-chat',
            version: pkg.version
        });
    }

    [imagesCacheDir, voicesCacheDir].map(e => {
        if (!fs.existsSync(e)) {
            fs.mkdirSync(e);
        }
    });

    mainWindow.webContents.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/603.3.8 (KHTML, like Gecko) Version/10.1.2 Safari/603.3.8');
    // Protocol handler for win32
    if (process.platform === 'win32') {
        // Keep only command line / deep linked arguments
        let args = process.argv.slice(1)
        if (args.length > 0 && args[0].startsWith(DEEP_LINK_PROTOCOL + "://")) {
            deepLinkUrl = args[0];
        }
    }
    createMenu();
};

// TODO titleBarStyle
function createWindow(url, w, h, mw, mh, resizable = true, maximizable = true, showTitle = true, webSecurity = false, minimizable = true) {
    let win = new BrowserWindow(
        {
            width: w,
            height: h,
            minWidth: mw,
            minHeight: mh,
            resizable: resizable,
            maximizable: maximizable,
            minimizable: minimizable,
            titleBarStyle: showTitle ? 'default' : 'hiddenInset',
            // titleBarStyle: 'customButtonsOnHover',
            webPreferences: {
                scrollBounce: false,
                nativeWindowOpen: true,
                nodeIntegration: true,
                contextIsolation: false,
                webviewTag: true,
                webSecurity: webSecurity,
            },
            // frame:false
        }
    );
    win.removeMenu();

    win.loadURL(url);
    console.log('create windows url', url)
    win.webContents.on('new-window', (event, url) => {
        event.preventDefault();
        console.log('new-windows', url)
        shell.openExternal(url);
    });
    return win;
}

// deep link，需要和 vue.config.js 里面的 wf-deep-linking 对应上
const DEEP_LINK_PROTOCOL = 'wfc';
let deepLinkUrl;

function onDeepLink(url) {
    console.log('onOpenDeepLink', url)
    deepLinkUrl = url;
    if (mainWindow) {
        mainWindow.webContents.send('deep-link', url);
    }
}

app.setAsDefaultProtocolClient(DEEP_LINK_PROTOCOL);
// pls refer to: https://blog.csdn.net/youyudexiaowangzi/article/details/118676790
// windows 7 下面，如果启动黑屏，请将下面注释打开
//app.disableHardwareAcceleration();
app.on('open-url', (event, url) => {
    onDeepLink(url);
})

app.setName(pkg.name);
const icon = `${workingDir}/images/dock.png`;
isDevelopment && app.dock && app.dock.setIcon(icon);

// comment the following for multi-instance, start
if (!app.requestSingleInstanceLock()) {
    console.log('only allow start one instance!')
    app.quit()
}
// end

app.on('second-instance', (event, argv, workingDir, additionalData) => {
    // for multi-instance
    // if (additionalData && additionalData.userId && additionalData.userId === userId){
    //     app.quit()
    // }
    if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore()
        mainWindow.focus()
        mainWindow.show()
    }
    let url = argv.find((arg) => arg.startsWith(DEEP_LINK_PROTOCOL));
    if (url) {
        onDeepLink(url)
    }
})

// windows上，需要正确设置appUserModelId，才能正常显示通知，不然通知的应用标识会显示为：electron.app.xxx
app.on('will-finish-launching', () => {
    app.setAppUserModelId(pkg.appId)
})

function registerLocalResourceProtocol() {
    protocol.registerFileProtocol('local-resource', (request, callback) => {
        const url = request.url.replace(/^local-resource:\/\//, '')
        // Decode URL to prevent errors when loading filenames with UTF-8 chars or chars like "#"
        const decodedUrl = decodeURI(url) // Needed in case URL contains spaces
        try {
            return callback(decodedUrl)
        } catch (error) {
            console.error('ERROR: registerLocalResourceProtocol: Could not get file path:', error)
        }
    })

    protocol.registerFileProtocol('file', (request, callback) => {
        const pathname = decodeURIComponent(request.url.replace('file:///', ''));
        callback(pathname);
    });
}

app.on('ready', () => {
        initProtoMain(proto);
        // initRCMain(rcProto);

        createMainWindow();

        regShortcut();

        registerLocalResourceProtocol();

        screenshots = new Screenshots({
            // logger: console.log
            singleWindow: true,
        })

        const onScreenShotEnd = (result) => {
            console.log('onScreenShotEnd', isMainWindowFocusedWhenStartScreenshot, screenShotWindowId);
            if (isMainWindowFocusedWhenStartScreenshot) {
                if (result) {
                    mainWindow.webContents.send('screenshots-ok', result);
                }
                mainWindow.show();
                isMainWindowFocusedWhenStartScreenshot = false;
            } else if (screenShotWindowId) {
                let windows = BrowserWindow.getAllWindows();
                let tms = windows.filter(win => win.webContents.id === screenShotWindowId);
                if (tms.length > 0) {
                    if (result) {
                        tms[0].webContents.send('screenshots-ok', result);
                    }
                    tms[0].show();
                }
                screenShotWindowId = 0;
            }
        }

        // 点击确定按钮回调事件
        screenshots.on('ok', (e, buffer, bounds) => {
            let filename = tmp.tmpNameSync() + '.png';
            let image = NativeImage.createFromBuffer(buffer);
            fs.writeFileSync(filename, image.toPNG());

            console.log('screenshots ok', e)
            onScreenShotEnd({filePath: filename});
        })

        // 点击取消按钮回调事件
        screenshots.on('cancel', e => {
            // 执行了preventDefault
            // 点击取消不会关闭截图窗口
            // e.preventDefault()
            // console.log('capture', 'cancel2')
            console.log('screenshots cancel', e)
            onScreenShotEnd()
        })
        // 点击保存按钮回调事件
        screenshots.on('save', (e, {viewer}) => {
            console.log('screenshots save', e)
            onScreenShotEnd()
        })
        session.defaultSession.webRequest.onBeforeSendHeaders(
            (details, callback) => {
                // 可根据实际需求，配置 Origin，默认置为空
                // details.requestHeaders.Origin = '';
                callback({cancel: false, requestHeaders: details.requestHeaders});
            }
        );
        try {
            updateTray()
        } catch (e) {
            // do nothing
        }

    }
);

// app.on('window-all-closed', () => {
//     if (process.platform !== 'darwin') {
//         app.quit()
//     }
// })

app.on('before-quit', () => {
    // Fix issues #14
    forceQuit = true;

    if (!tray) return;
    // if (!isOsx) {
    tray.destroy();
    tray = null;
    // }
});
app.on('activate', e => {
    if (!mainWindow.isVisible()) {
        mainWindow.show();
    }
});

function disconnectAndQuit() {
    proto.setConnectionStatusListener(() => {
        // 仅仅是为了让渲染进程不收到 ConnectionStatusLogout
        // do nothing
    });
    proto.disconnect(0);
    setTimeout(() => {
        app.quit();
    }, 1000)
}

function clearBlink() {
    if (blink) {
        clearInterval(blink)
    }
    blink = null
}

let blinkIcons;

function execBlink(flag, _interval) {
    let interval = _interval ? _interval : 500;
    if (!blinkIcons) {
        blinkIcons = [NativeImage.createFromPath(`${workingDir}/images/tray.png`),
            NativeImage.createFromPath(`${workingDir}/images/Remind_icon.png`)];
    }

    let count = 0;
    if (flag) {
        if (blink) {
            return;
        }
        blink = setInterval(function () {
            toggleTrayIcon(blinkIcons[count++]);
            count = count > 1 ? 0 : 1;
        }, interval);
    } else {
        clearBlink();
        toggleTrayIcon(blinkIcons[0]);
    }

}

function toggleTrayIcon(icon) {
    if (tray) {
        tray.setImage(icon);
    }
}

var secretDecodeServer;

function startSecretDecodeServer(port) {
    if (secretDecodeServer) {
        return;
    }
    console.log('startSecretDecodeServer', port)
    let http = require('http');
    let url = require('url')
    let https = require('https');
    secretDecodeServer = http.createServer((req, orgRes) => {
        console.log('req', req.url);
        let urlWithStringQuery = url.parse(req.url, true);
        let target = urlWithStringQuery.query.target;
        let mediaUrl = urlWithStringQuery.query.url;

        if (!target || !mediaUrl) {
            orgRes.statusCode = 403;
            orgRes.end('invalid request');
            return;
        }

        let protocol = mediaUrl.startsWith("https") ? https : http

        protocol.get(mediaUrl, res => {
            let data = [];
            res.on('data', function (chunk) {
                data.push(chunk);
            }).on('end', function () {
                //at this point data is an array of Buffers
                //so Buffer.concat() can make us a new Buffer
                //of all of them together
                let buffer = Buffer.concat(data);
                let ab = toArrayBuffer(buffer);
                let decodedAb = proto.decodeSecretChatMediaData(target, ab);
                let decodedBuff = toBuffer(decodedAb);

                let rawHeaders = res.rawHeaders;
                for (let i = 0; i < rawHeaders.length;) {
                    if (rawHeaders[i] !== 'Content-Length' && rawHeaders[i] !== 'content-Length') {
                        orgRes.setHeader(rawHeaders[i], rawHeaders[i + 1])
                    }
                    i += 2;
                }
                orgRes.setHeader('Content-Length', decodedBuff.byteLength)
                orgRes.end(decodedBuff)
            });

        });
    });
    secretDecodeServer.listen(port, 'localhost', function () {
        // do nothing
    });
}

var openPlatformServer;

function startOpenPlatformServer(port) {
    if (openPlatformServer) {
        return
    }
    const WebSocket = require('ws');
    const wss = new WebSocket.Server({port: port ? port : 7983});

    console.log('starting websocket server...');
    wss.on('connection', (ws) => {
        ws.on('message', (data) => {
            wss.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(data);
                }
            });
        });
    });

    openPlatformServer = wss;
}

function toArrayBuffer(buf) {
    const ab = new ArrayBuffer(buf.length);
    const view = new Uint8Array(ab);
    for (let i = 0; i < buf.length; ++i) {
        view[i] = buf[i];
    }
    return ab;
}

function toBuffer(ab) {
    const buf = Buffer.alloc(ab.byteLength);
    const view = new Uint8Array(ab);
    for (let i = 0; i < buf.length; ++i) {
        buf[i] = view[i];
    }
    return buf;
}

// Add VOIP window management handlers
ipcMain.handle('create-voip-window', async (event, windowOptions) => {
    try {
        const win = new BrowserWindow(windowOptions);
        const winId = win.id;

        // Set up listeners for window events
        win.on('closed', () => {
            event.sender.send(`voip-window-closed`);
        });

        win.webContents.on('did-finish-load', () => {
            event.sender.send(`voip-window-webContents-did-finish-load`);
        });
        win.loadURL(windowOptions.url)

        return win.id;
    } catch (error) {
        console.error('Error creating VOIP window:', error);
        return null;
    }
});

import './remote.js'
