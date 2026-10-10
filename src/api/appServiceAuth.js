import axios from "axios";
import Config from "../config";
import wfc from "../wfc/client/wfc";
import {getItem, removeItem, setItem} from "../ui/util/storageHelper";
import AppServerError from "./appServerError";

/**
 * 应用服务（合并服务 wf-app-server）的统一鉴权。
 *
 * 应用服务、组织通讯录、接龙、投票、语音转文字、网盘、待办都在同一个服务的 /api/<类别> 下，整站共用一个 authToken：
 * - 账号密码登录、扫码登录成功时，响应头下发 authToken（见 appServerApi）；
 * - 已经连上 IM 时，用 IM 的 authCode 调 POST {服务根地址}/api/auth/login 换一个（响应头下发）；
 * - 之后所有业务请求带 header authToken，服务端不再接受 authCode header；
 * - 会话失效时业务接口返回 {"code":13}（HTTP 200，个别网关是 401/403），清掉 token 重新换一个，再重试一次。
 *   14 是没有权限，重新登录也不会变，不重试。
 *
 * token 按服务的 host[:port] 保存（键 authToken-<host>），双网环境下主备地址是同一个服务，两个都存，切换网络后不用重新登录。
 */

// 服务端约定：没有登录 / 会话失效
export const CODE_NOT_LOGIN = 13;
// 功能被服务端关掉（app.feature.xxx=false）时 HTTP 404 + {"code":404}；服务端太老、没有这个模块时是 Spring 默认的 404
export const CODE_FEATURE_DISABLED = 404;

const LOGIN_PATH = '/api/auth/login';

// 正在进行的登录，按服务根地址去重：并发的多个请求发现 token 失效时只登录一次
const pendingLogins = {};

function tokenKey(host) {
    return 'authToken-' + host;
}

/** 服务根地址（scheme://host[:port]）；ws/wss 地址换成 http/https */
export function serviceRootOf(url) {
    let u = new URL(url);
    let protocol = u.protocol === 'wss:' ? 'https:' : u.protocol === 'ws:' ? 'http:' : u.protocol;
    return `${protocol}//${u.host}`;
}

/** 同一个服务在主备网下的所有 host（第一个是 url 自己的） */
function serviceHostsOf(url) {
    let host = new URL(url).host;
    let hosts = [host];
    let main = Config.APP_SERVICE_ADDRESS;
    let backup = Config.APP_SERVICE_BACKUP_ADDRESS;
    if (main && backup) {
        let mainHost = new URL(main).host;
        let backupHost = new URL(backup).host;
        if (host === mainHost && backupHost !== host) {
            hosts.push(backupHost);
        } else if (host === backupHost && mainHost !== host) {
            hosts.push(mainHost);
        }
    }
    return hosts;
}

/** url 所属服务缓存的 authToken，没有时返回 null */
export function getAuthToken(url) {
    for (const host of serviceHostsOf(url)) {
        let token = getItem(tokenKey(host));
        if (token) {
            return token;
        }
    }
    return null;
}

/** 保存 url 所属服务的 authToken（主备地址都存） */
export function saveAuthToken(url, token) {
    if (!token) {
        return;
    }
    serviceHostsOf(url).forEach(host => setItem(tokenKey(host), token));
}

/** 从响应头取出服务端下发的 authToken 并保存，返回 token；没有下发时返回 null */
export function saveAuthTokenFromResponse(url, response) {
    let token = response && response.headers && (response.headers['authtoken'] || response.headers['authToken']);
    if (token) {
        saveAuthToken(url, token);
        return token;
    }
    return null;
}

function removeAuthToken(url) {
    serviceHostsOf(url).forEach(host => removeItem(tokenKey(host)));
}

function getAuthCode(host) {
    return new Promise((resolve, reject) => {
        // 和组织通讯录、网盘一样，使用管理后台类型（ApplicationType_Admin）的认证码
        wfc.getAuthCode('admin', 2, host, resolve, err => reject(new AppServerError(err || -1, '获取认证码失败')));
    });
}

async function login(root) {
    let authCode = await getAuthCode(new URL(root).host);
    let response = await axios.post(root + LOGIN_PATH, {authCode}, {withCredentials: false});
    let body = response.data;
    if (!body || body.code !== 0) {
        throw new AppServerError(body ? body.code : -1, (body && body.message) || '登录失败');
    }
    let token = saveAuthTokenFromResponse(root, response);
    if (!token) {
        throw new AppServerError(-1, '登录响应里没有 authToken');
    }
    return token;
}

function loginOnce(url) {
    let root = serviceRootOf(url);
    if (!pendingLogins[root]) {
        pendingLogins[root] = login(root).finally(() => {
            delete pendingLogins[root];
        });
    }
    return pendingLogins[root];
}

/** url 所属服务的 authToken：有缓存用缓存，没有就用 authCode 换一个 */
export async function ensureAuthToken(url) {
    return getAuthToken(url) || loginOnce(url);
}

/** 清掉 url 所属服务的 authToken 并重新登录，返回新 token */
export async function refreshAuthToken(url) {
    removeAuthToken(url);
    return loginOnce(url);
}

function needRelogin(response) {
    if (response.status === 401 || response.status === 403) {
        return true;
    }
    return response.status === 200 && response.data && response.data.code === CODE_NOT_LOGIN;
}

/**
 * 带 authToken 的请求，会话失效时重新登录并重试一次。
 *
 * @param {string} method 'post' / 'get'
 * @param {string} url 完整接口地址
 * @param {Object} data 请求体（POST）
 * @return {Promise<*>} 响应体里的 result；code != 0 时抛 AppServerError（功能没开时 errorCode 为 404）
 */
async function requestWithAuthToken(method, url, data) {
    let send = async (token) => {
        let response = await axios.request({
            method,
            url,
            data: method === 'post' ? data : undefined,
            headers: {authToken: token},
            withCredentials: false,
            // 404（功能没开）也要拿到响应体里的业务码，不让 axios 直接抛
            validateStatus: status => status < 500,
        });
        saveAuthTokenFromResponse(url, response);
        return response;
    };

    let response = await send(await ensureAuthToken(url));
    if (needRelogin(response)) {
        response = await send(await refreshAuthToken(url));
    }

    let body = response.data;
    if (response.status === 200 && body && typeof body === 'object') {
        if (body.code === 0) {
            return body.result;
        }
        throw new AppServerError(body.code, body.message || '请求失败');
    }
    if (body && typeof body === 'object' && typeof body.code === 'number') {
        throw new AppServerError(body.code, body.message || '请求失败');
    }
    if (response.status === 404) {
        throw new AppServerError(CODE_FEATURE_DISABLED, '功能未开启');
    }
    throw new AppServerError(-1, '网络错误: ' + response.status);
}

export function postWithAuthToken(url, data = {}) {
    return requestWithAuthToken('post', url, data);
}

export function getWithAuthToken(url) {
    return requestWithAuthToken('get', url);
}
