import fs from 'fs';
import tmp from 'tmp';
import {
    app,
    BrowserWindow,
    clipboard,
    dialog,
    globalShortcut,
    ipcMain,
    Menu,
    nativeImage as NativeImage,
    powerMonitor,
    protocol,
    session,
    shell,
    Tray,
} from 'electron';
import Screenshots from "electron-screenshots";
import windowStateKeeper from 'electron-window-state';
import i18n from 'i18n';
import proto from '../marswrapper.node';

import pkg from '../package.json';
import Badge from 'electron-windows-badge';
import {createProtocol} from "vue-cli-plugin-electron-builder/lib";
import IPCRendererEventType from "./ipcRendererEventType";

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

global.sharedObj = {proto: proto};

let forceQuit = false;
let downloading = false;
let mainWindow;
let fileWindow;
let compositeMessageWindows = new Map();
let workspaceWindow;
let conversationMessageHistoryMessageWindow;
let messageHistoryMessageWindow;
let winBadge;
let screenshots;
let tray;
let downloadFileMap = new Map()
let settings = {};
let isFullScreen = false;
let isMainWindowFocusedWhenStartScreenshot = false;
let isOsx = process.platform === 'darwin';
let isWin = !isOsx;

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
        label: Locales.__('File').Title,
        submenu: [
            {
                label: Locales.__('File').New,
                accelerator: 'Cmd+N',
                click() {
                    mainWindow.show();
                    mainWindow.webContents.send('show-newchat');
                }
            },
            {
                label: Locales.__('File').Search,
                accelerator: 'Cmd+F',
                click() {
                    mainWindow.show();
                    mainWindow.webContents.send('show-search');
                }
            },
            {
                type: 'separator',
            },
            {
                label: Locales.__('File').InsertEmoji,
                accelerator: 'Cmd+I',
                click() {
                    mainWindow.show();
                    mainWindow.webContents.send('show-emoji');
                }
            },
            {
                type: 'separator',
            },
            {
                label: Locales.__('File').Next,
                accelerator: 'Cmd+J',
                click() {
                    mainWindow.show();
                    mainWindow.webContents.send('show-next');
                }
            },
            {
                label: Locales.__('File').Prev,
                accelerator: 'Cmd+K',
                click() {
                    mainWindow.show();
                    mainWindow.webContents.send('show-previous');
                }
            },
        ]
    },
    // {
    //     label: Locales.__('Conversations').Title,
    //     submenu: [
    //         {
    //             label: Locales.__('Conversations').Loading,
    //         }
    //     ],
    // },
    // {
    //     label: Locales.__('Contacts').Title,
    //     submenu: [
    //         {
    //             label: Locales.__('Contacts').Loading,
    //         }
    //     ],
    // },
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
        lable: Locales.__('Window').Title,
        role: 'window',
        submenu: [
            {
                lable: Locales.__('Window').Min,
                role: 'minimize'
            },
            {
                lable: Locales.__('Window').Close,
                role: 'close'
            }
        ]
    },
    {
        lable: Locales.__('Help').Title,
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
            global.sharedObj.proto.disconnect(0);
            console.log('--------------- disconnect', global.sharedObj.proto);
            var now = new Date();
            var exitTime = now.getTime() + 1000;
            while (true) {
                now = new Date();
                if (now.getTime() > exitTime)
                    break;
            }
            app.exit(0);
        }
    }
];
const icon = `${workingDir}/images/dock.png`;
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
        let icon;
        if (!isOsx) {
            icon = `${workingDir}/images/icon.png`;
        } else {
            icon = `${workingDir}/images/tray.png`;
        }


        // Make sure the last tray has been destroyed
        setTimeout(() => {
            if (!tray) {
                // Init tray icon
                tray = new Tray(icon);
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

            tray.setImage(icon);
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
                    console.log(`Received bytes: ${fileName} ${item.getReceivedBytes()}, ${item.getTotalBytes()}`)
                    let downloadFile = downloadFileMap.get(item.getURL());
                    let messageId = downloadFile.messageId
                    webContents.send('file-download-progress', {
                            messageId: messageId,
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
            let messageId = downloadFile.messageId
            if (state === 'completed') {
                console.log('Download successfully')
                webContents.send('file-downloaded', {messageId: messageId, filePath: item.getSavePath()});
            } else {
                webContents.send('file-download-failed', {messageId: messageId});
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
        defaultWidth: 1080,
        defaultHeight: 720,
    });

    mainWindow = new BrowserWindow({
        x: mainWindowState.x,
        y: mainWindowState.y,
        width: 400,
        height: 480,
        minWidth: 400,
        minHeight: 480,
        opacity: 0,
        titleBarStyle: 'hidden',
        maximizable: false,
        resizable: false,
        backgroundColor: 'none',
        // 以下两属性设置时会导致win不能正常unmaximize. electron bug
        // transparent: true,
        // resizable: false,
        webPreferences: {
            scrollBounce: false,
            nodeIntegration: true,
            nativeWindowOpen: true,
            webSecurity: false,
        },
        frame: !isWin,
        icon
    });
    mainWindow.center();
    const badgeOptions = {}
    winBadge = new Badge(mainWindow, badgeOptions);

    if (process.env.WEBPACK_DEV_SERVER_URL) {
        // Load the url of the dev server if in development mode
        await mainWindow.loadURL(process.env.WEBPACK_DEV_SERVER_URL)
        if (!process.env.IS_TEST) mainWindow.webContents.openDevTools()
    } else {
        createProtocol('app')
        // Load the index.html when not in development
        mainWindow.loadURL('app://./index.html')
    }
    mainWindow.webContents.on('did-finish-load', (e) => {
        try {
            mainWindow.show();
            mainWindow.focus();
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

    mainWindow.webContents.on('will-navigate', (event, url) => {
        // do default action
        // event.preventDefault();
        // console.log('navigate', url)
        // shell.openExternal(url);
    });

    mainWindow.on('close', e => {
        if (forceQuit || !tray || closeWindowToExit) {
            mainWindow = null;
            disconnectAndQuit();
        } else {
            e.preventDefault();
            mainWindow.hide();
        }
    });

    mainWindow.webContents.session.on('will-download', downloadHandler);

    ipcMain.on('screenshots-start', (event, args) => {
        // console.log('main voip-message event', args);
        isMainWindowFocusedWhenStartScreenshot = true;
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

    ipcMain.on('click-notification', (event, args) => {
        if (!mainWindow.isVisible() || mainWindow.isMinimized()) {
            mainWindow.show();
            mainWindow.focus();
        }
    });

    ipcMain.on('exec-blink', (event, args) => {
        var isBlink = args.isBlink;
        execBlink(isBlink, args.interval);
    });

    ipcMain.on('update-badge', (event, args) => {
        let count = args;
        //if (settings.showOnTray) {
        updateTray(count);
        app.badgeCount = count;
        //}
    });

    ipcMain.on('file-paste', (event) => {
        var image = clipboard.readImage();
        var args = {hasImage: false};

        if (!image.isEmpty()) {
            let filename = tmp.tmpNameSync() + '.png';

            args = {
                hasImage: true,
                filename: filename,
                raw: image.toPNG(),
            };

            fs.writeFileSync(filename, image.toPNG());
        }

        event.returnValue = args;
    });

    ipcMain.on('file-download', async (event, args) => {
        let remotePath = args.remotePath;
        let messageId = args.messageId;
        let source = args.source;
        remotePath = remotePath.replace(':80', '');
        downloadFileMap.set(encodeURI(remotePath), {messageId: messageId, fileName: args.fileName, source: source});

        if (source === 'file') {
            console.log('file-download file')
            fileWindow.webContents.downloadURL(remotePath)
        } else {
            console.log('file-download main')
            mainWindow.webContents.downloadURL(remotePath)
        }
    });

    ipcMain.on('show-file-window', async (event, args) => {
        console.log('on show-file-window', fileWindow, args)
        if (!fileWindow) {
            let win = createWindow(args.url, 800, 730, 640, 400, true, true);

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
    ipcMain.on('show-composite-message-window', async (event, args) => {
        console.log('on show-composite-message-window', args)
        let messageUid = args.messageUid;
        let compositeMessageWin = compositeMessageWindows.get(messageUid);
        if (!compositeMessageWin) {
            let url = args.url + ('?messageUid=' + messageUid)
            let win = createWindow(url, 700, 850, 700, 850, false, false);
            compositeMessageWindows.set(messageUid, win)

            // win.webContents.openDevTools();
            win.on('close', () => {
                compositeMessageWindows.delete(messageUid);
            });
            win.show();
        } else {
            compositeMessageWin.show();
            compositeMessageWin.focus();
        }
    });

    ipcMain.on('show-workspace-window', async (event, args) => {
        console.log('on show-workspace-window', workspaceWindow, args)
        if (!workspaceWindow) {
            workspaceWindow = createWindow(args.url, 1080, 720, 800, 600, true, true);
            workspaceWindow.on('close', () => {
                workspaceWindow = null;
            });
            workspaceWindow.show();
        } else {
            workspaceWindow.show();
            workspaceWindow.focus();
        }
    });

    ipcMain.on(IPCRendererEventType.showConversationMessageHistoryPage, async (event, args) => {
        console.log(`on ${IPCRendererEventType.showConversationMessageHistoryPage}`, conversationMessageHistoryMessageWindow, args)
        if (!conversationMessageHistoryMessageWindow) {
            let url = args.url + (`?type=${args.type}&target=${args.target}&line=${args.line}`)
            conversationMessageHistoryMessageWindow = createWindow(url, 700, 850, 700, 850, true, true, false);
            conversationMessageHistoryMessageWindow.on('close', () => {
                conversationMessageHistoryMessageWindow = null;
            });
            conversationMessageHistoryMessageWindow.show();
        } else {
            conversationMessageHistoryMessageWindow.show();
            conversationMessageHistoryMessageWindow.focus();
        }
    });

    ipcMain.on(IPCRendererEventType.showMessageHistoryPage, async (event, args) => {
        console.log(`on ${IPCRendererEventType.showMessageHistoryPage}`, messageHistoryMessageWindow, args)
        if (!messageHistoryMessageWindow) {
            messageHistoryMessageWindow = createWindow(args.url, 700, 850, 700, 850, true, true, true);
            messageHistoryMessageWindow.on('close', () => {
                messageHistoryMessageWindow = null;
            });
            messageHistoryMessageWindow.show();
        } else {
            messageHistoryMessageWindow.show();
            messageHistoryMessageWindow.focus();
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

    ipcMain.on('is-suspend', (event, args) => {
        event.returnValue = isSuspend;
    });

    ipcMain.on('logined', (event, args) => {
        closeWindowToExit = args.closeWindowToExit;
        mainWindow.resizable = true;
        mainWindow.maximizable = true;
        mainWindow.setMinimumSize(800, 600);
        mainWindow.setSize(mainWindowState.width, mainWindowState.height);
        mainWindow.center();
        mainWindowState.manage(mainWindow);
    });

    ipcMain.on('logouted', (event, args) => {
        mainWindowState.unmanage();
        mainWindow.resizable = false;
        mainWindow.maximizable = false;
        mainWindow.setMinimumSize(400, 480);
        mainWindow.setSize(400, 480);
        mainWindow.center();
    });

    ipcMain.on('enable-close-window-to-exit', (event, enable) => {
        closeWindowToExit = enable;
    });

    powerMonitor.on('resume', () => {
        isSuspend = false;
        mainWindow.webContents.send('os-resume');
        global.sharedObj.proto.onAppResume();
    });

    powerMonitor.on('suspend', () => {
        isSuspend = true;
        global.sharedObj.proto.onAppSuspend();
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
    createMenu();
    regShortcut();
};

// TODO titleBarStyle
function createWindow(url, w, h, mw, mh, resizable = true, maximizable = true, showTitle = true) {
    let win = new BrowserWindow(
        {
            width: w,
            height: h,
            minWidth: mw,
            minHeight: mh,
            resizable: resizable,
            maximizable: maximizable,
            titleBarStyle: showTitle ? 'default' : 'hiddenInset',
            // titleBarStyle: 'customButtonsOnHover',
            webPreferences: {
                scrollBounce: false,
                nativeWindowOpen: true,
                nodeIntegration: true,
                webviewTag: true
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

// deep link
const PROTOCOL = 'wfc';

function onDeepLink(url) {
    console.log('onOpenDeepLink', url)
    mainWindow.webContents.send('deep-link', url);
}

app.setAsDefaultProtocolClient(PROTOCOL);
app.on('open-url', (event, url) => {
    onDeepLink(url);
})

app.setName(pkg.name);
app.dock && app.dock.setIcon(icon);

if (!app.requestSingleInstanceLock()) {
    console.log('only allow start one instance!')
    app.quit()
}

app.on('second-instance', (event, argv) => {
    if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore()
        mainWindow.focus()
        mainWindow.show()
    }
    let url = argv.find((arg) => arg.startsWith(PROTOCOL));
    if (url) {
        onDeepLink(url)
    }
})

// windows上，需要正确设置appUserModelId，才能正常显示通知，不然通知的应用标识会显示为：electron.app.xxx
app.on('will-finish-launching', () => {
    app.setAppUserModelId("cn.wildfire.chat")
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
}

app.on('ready', () => {
        createMainWindow();

        registerLocalResourceProtocol();

        screenshots = new Screenshots()
        globalShortcut.register('ctrl+shift+a', () => {
            isMainWindowFocusedWhenStartScreenshot = mainWindow.isFocused();
            screenshots.startCapture()
        });
        // 点击确定按钮回调事件
        screenshots.on('ok', (e, data) => {
            if (isMainWindowFocusedWhenStartScreenshot) {
                let filename = tmp.tmpNameSync() + '.png';
                let image = NativeImage.createFromDataURL(data.dataURL);
                fs.writeFileSync(filename, image.toPNG());

                mainWindow.webContents.send('screenshots-ok', {filePath: filename});
            }
            console.log('capture')
        })
        // 点击取消按钮回调事件
        screenshots.on('cancel', () => {
            // console.log('capture', 'cancel1')
        })
        screenshots.on('cancel', e => {
            // 执行了preventDefault
            // 点击取消不会关闭截图窗口
            // e.preventDefault()
            // console.log('capture', 'cancel2')
        })
        // 点击保存按钮回调事件
        screenshots.on('save', (e, {viewer}) => {
            console.log('capture', viewer)
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
    // }
});
app.on('activate', e => {
    if (!mainWindow.isVisible()) {
        mainWindow.show();
    }
});

function disconnectAndQuit() {
    global.sharedObj.proto.disconnect(0);
    var now = new Date();
    var exitTime = now.getTime() + 500;
    while (true) {
        now = new Date();
        if (now.getTime() > exitTime)
            break;
    }
    app.quit();
}

function clearBlink() {
    if (blink) {
        clearInterval(blink)
    }
    blink = null
}

function execBlink(flag, _interval) {
    let interval = _interval ? _interval : 500;
    let icons;
    icons = [`${workingDir}/images/tray.png`,
        `${workingDir}/images/Remind_icon.png`];

    let count = 0;
    if (flag) {
        if (blink) {
            return;
        }
        blink = setInterval(function () {
            toggleTrayIcon(icons[count++]);
            count = count > 1 ? 0 : 1;
        }, interval);
    } else {
        clearBlink();
        toggleTrayIcon(icons[0]);
    }

}

function toggleTrayIcon(icon) {
    tray.setImage(icon);
}

