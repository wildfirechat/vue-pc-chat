// 服务配置的落盘与 IPC，只在主进程使用。
//
// 配置串原文存在 userData/service-config.txt（不放 localStorage：退出登录时会清掉渲染进程的存储）。
// 每个窗口的渲染进程启动时，用 GET_SERVICE_CONFIG 同步取回解析好的配置，再应用到 Config（见 src/main.js），
// 所以应用新配置后必须重启客户端，所有窗口才会一致。
import fs from 'fs';
import net from 'net';
import nodePath from 'path';
import {app, ipcMain} from 'electron';
import IPCEventType from '../ipcEventType';
import {decodeServiceConfig, ServiceConfigException} from './serviceConfigCodec';

const FILE_NAME = 'service-config.txt';

// 启动时解析一次：配置串过期或 seed 换了，就当没配置，用内置默认地址
let current = null;

function configFile() {
    return nodePath.join(app.getPath('userData'), FILE_NAME);
}

function loadSaved() {
    let raw;
    try {
        raw = fs.readFileSync(configFile(), 'utf8');
    } catch (e) {
        return null;
    }
    if (!raw || !raw.trim()) {
        return null;
    }
    try {
        const config = decodeServiceConfig(raw);
        console.log('[service_config] 启动期应用已保存配置：'
            + `${config.im.host}:${config.im.port}（应用服务端口 ${config.im.appPort}）`
            + (config.backup ? ` / 备用 ${config.backup.host}:${config.backup.port}` : ' / 无备网')
            + (config.turn ? ` / TURN ${config.turn.host}:${config.turn.port}` : ''));
        return config;
    } catch (e) {
        console.warn('[service_config] 已保存的配置串无效，使用内置默认地址：', e.message);
        return null;
    }
}

// 端口可达性探测：只做 TCP 连接。失败只告警（内网 / 防火墙常不允许从登录页探测）
function probe(host, port) {
    return new Promise(resolve => {
        const socket = net.connect({host: host.replace(/^\[|\]$/g, ''), port, timeout: 3000});
        const done = (ok) => {
            socket.destroy();
            resolve(ok);
        };
        socket.once('connect', () => done(true));
        socket.once('timeout', () => done(false));
        socket.once('error', () => done(false));
    });
}

function errorResult(e) {
    if (e instanceof ServiceConfigException) {
        return {ok: false, error: e.error, detail: e.detail};
    }
    return {ok: false, error: 'malformed', detail: String(e && e.message)};
}

export function installServiceConfigSupport() {
    current = loadSaved();

    // 渲染进程启动时同步取回（任何 Config 读取之前），null = 用内置默认配置
    ipcMain.on(IPCEventType.GET_SERVICE_CONFIG, (event) => {
        event.returnValue = current;
    });

    // 验证：解析 + 连通性探测。界面不展示服务地址，地址只写日志
    ipcMain.handle(IPCEventType.SERVICE_CONFIG_VERIFY, async (event, raw) => {
        let config;
        try {
            config = decodeServiceConfig(raw);
        } catch (e) {
            return errorResult(e);
        }
        const targets = [[config.im.host, config.im.port]];
        // 应用服务端口与 IM 不同时（分开部署）也探一次，免得"IM 端口恰好开着"的错配置溜过去
        if (config.im.appPort !== config.im.port) {
            targets.push([config.im.host, config.im.appPort]);
        }
        let reachable = true;
        for (const [host, port] of targets) {
            if (!await probe(host, port)) {
                console.warn(`[service_config] 连通性探测失败 ${host}:${port}`);
                reachable = false;
            }
        }
        return {ok: true, tenant: config.tenant, reachable};
    });

    // 应用：再解析一遍再落盘（不信任渲染进程传回的解析结果），调用方随后重启客户端
    ipcMain.handle(IPCEventType.SERVICE_CONFIG_APPLY, async (event, raw) => {
        try {
            const config = decodeServiceConfig(raw);
            fs.writeFileSync(configFile(), String(raw).trim(), 'utf8');
            console.log('[service_config] 已保存：'
                + `${config.im.host}:${config.im.port}（应用服务端口 ${config.im.appPort}）`
                + (config.backup ? ` / 备用 ${config.backup.host}:${config.backup.port}（应用服务端口 ${config.backup.appPort}）` : ' / 无备网')
                + (config.turn ? ` / TURN ${config.turn.host}:${config.turn.port}` : ''));
            return {ok: true};
        } catch (e) {
            return errorResult(e);
        }
    });

    // 恢复默认配置：删掉落盘的配置串，调用方随后重启客户端
    ipcMain.handle(IPCEventType.SERVICE_CONFIG_RESTORE, async () => {
        try {
            fs.rmSync(configFile(), {force: true});
            return {ok: true};
        } catch (e) {
            return {ok: false, error: 'io', detail: e.message};
        }
    });
}
