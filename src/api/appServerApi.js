import axios from "axios";
import {setItem} from "../ui/util/storageHelper";
import {CODE_NOT_LOGIN, getAuthToken, refreshAuthToken, saveAuthToken, saveAuthTokenFromResponse} from "./appServiceAuth";
import Config from "../config";
import FavItem from "../wfc/model/favItem";
import {stringValue} from "../wfc/util/longUtil";
import AppServerError from "./appServerError";
import wfc from "../wfc/client/wfc";
import ConnectionStatus from "../wfc/client/connectionStatus";

/**
 * 应用服务连通性探测：GET {APP_SERVER}/ping（匿名），固定返回 {"code":0,"message":"ok"}。
 * 不能只看 200：网关、代理、强制门户也会回 200，所以要求应答内容正好是约定的
 * @param {string} appServer Config.APP_SERVER 或 Config.APP_BACKUP_SERVER
 * @return {Promise<boolean>}
 */
export async function isAppServerReachable(appServer, timeout = 5000) {
    try {
        let response = await axios.get(appServer + '/ping', {timeout});
        return response.status === 200 && response.data && response.data.code === 0 && response.data.message === 'ok';
    } catch (e) {
        return false;
    }
}

export class AppServerApi {
    // 服务端错误码（见 wf-app-server docs/API.md）
    // 账号密码登录：账号或密码错误
    static CODE_CREDENTIAL_INCORRECT = 1001;
    // PC 扫码：会话不存在或已过期
    static CODE_PC_SESSION_EXPIRED = 1101;
    // PC 扫码：还没有扫码
    static CODE_PC_SESSION_NOT_SCANNED = 1102;
    // PC 扫码：已扫码，等待手机确认（result 里带扫码用户的昵称头像）
    static CODE_PC_SESSION_SCANNED = 1103;
    // PC 扫码：已取消
    static CODE_PC_SESSION_CANCELED = 1104;

    constructor() {
    }

    async _getAppServer() {
        if (!Config.APP_BACKUP_SERVER) {
            return Config.APP_SERVER;
        }
        // IM 已连接时，直接用 wfc 的网络状态判断
        let status = wfc.getConnectionStatus();
        if (status === ConnectionStatus.ConnectionStatusConnected || status === ConnectionStatus.ConnectionStatusReceiveing) {
            return Config.getAppServer();
        }

        // IM 未连接时（登录前），探测可用地址。主备网络是隔离的，一般只有一个地址可达
        // 探测结果会缓存，避免每次请求都探测；请求出现网络错误时清除缓存，下次请求重新探测
        if (!this._probeAppServerPromise) {
            const probe = async (url) => {
                if (await isAppServerReachable(url)) {
                    return url;
                }
                throw new Error('app server probe failed: ' + url);
            };

            this._probeAppServerPromise = Promise.any([
                probe(Config.APP_SERVER),
                probe(Config.APP_BACKUP_SERVER)
            ]).catch((e) => {
                console.log('all app server probes failed', e);
                this._probeAppServerPromise = null;
                // 都探测失败时，回退到主地址，让后续请求正常报错
                return Config.APP_SERVER;
            });
        }
        return this._probeAppServerPromise;
    }

    // 主备地址对应的是同一个应用服务，token 通用，主备地址都保存，切换网络后不用重新登录
    _saveAuthToken(authToken) {
        saveAuthToken(Config.APP_SERVER, authToken);
    }

    // 登录成功时应用服务会下发水印开关（服务端 watermark.enable），存下来沿用到下次登录；旧版服务不下发
    _saveWatermark(result) {
        if (result && typeof result.watermark === 'boolean') {
            setItem('watermark', result.watermark ? '1' : '0');
        }
    }

    loinWithPassword(mobile, password, slideVerifyToken = null) {
        return new Promise((resolve, reject) => {
            let params = {
                mobile,
                password,
                platform: Config.getWFCPlatform(),
                clientId: wfc.getClientId()
            };
            if (slideVerifyToken) {
                params.slideVerifyToken = slideVerifyToken;
            }
            let responsePromise = this._post('/login_pwd', params, true)
            this._interceptLoginResponse(responsePromise, resolve, reject)
        })
    }

    createPCSession(userId) {
        return this._post('/pc_session', {
            flag: 1,
            device_name: 'pc',
            userId: userId,
            clientId: wfc.getClientId(),
            platform: Config.getWFCPlatform()
        })
    }

    // 扫码登录
    loginWithPCSession(appToken) {
        const _interceptPCSessionLoginResponse = (responsePromise, resolve, reject) => {
            responsePromise
                .then(response => {
                    if (response.data.code === 0) {
                        let appAuthToken = response.headers['authtoken'];
                        if (!appAuthToken) {
                            appAuthToken = response.headers['authToken'];
                        }

                        if (appAuthToken) {
                            this._saveAuthToken(appAuthToken);
                        }
                        this._saveWatermark(response.data.result);
                        resolve(response.data);
                    } else if ([AppServerApi.CODE_PC_SESSION_SCANNED, AppServerApi.CODE_PC_SESSION_CANCELED].indexOf(response.data.code) > -1) {
                        resolve(response.data);
                    } else {
                        reject(new AppServerError(response.data.code, response.data.message));
                    }
                })
                .catch(err => {
                    reject(err);
                })
        }

        return new Promise((resolve, reject) => {
            let responsePromise = this._post(`/session_login/${appToken}`, null, true);
            _interceptPCSessionLoginResponse(responsePromise, resolve, reject)
        })
    }

    changePassword(oldPassword, newPassword, slideVerifyToken = null) {
        let params = {
            oldPassword,
            newPassword
        };
        if (slideVerifyToken) {
            params.slideVerifyToken = slideVerifyToken;
        }
        return this._post('/change_pwd', params)
    }

    getGroupAnnouncement(groupId) {
        return this._post('/get_group_announcement', {groupId: groupId})
    }

    updateGroupAnnouncement(author, groupId, announcement) {
        return this._post('/put_group_announcement', {
            author,
            groupId,
            text: announcement
        })
    }

    favMessage(message) {
        let favItem = FavItem.fromMessage(message);
        return this._post('/fav/add', {
            messageUid: stringValue(favItem.messageUid),
            type: favItem.favType,
            convType: favItem.conversation.type,
            convTarget: favItem.conversation.target,
            convLine: favItem.conversation.line,
            origin: favItem.origin,
            sender: favItem.sender,
            title: favItem.title,
            url: favItem.url,
            thumbUrl: favItem.thumbUrl,
            data: favItem.data,
        });
    }

    getFavList(startId, count = 20) {
        return this._post('/fav/list', {id: startId, count: count}, false, true)
    }

    delFav(favItemId) {
        return this._post('/fav/del/' + favItemId, '')
    }

    // 滑动验证相关 API
    getSlideVerify() {
        return this._post('/slide_verify/generate', {}, false, false)
    }

    verifySlide(token, x) {
        // 模仿 iOS，检查 code === 0 判断成功，不关心 result
        return this._post('/slide_verify/verify', {
            token: token,
            x: x
        }, false, true)
    }

    _interceptLoginResponse(responsePromise, resolve, reject) {
        responsePromise
            .then(response => {
                if (response.data.code === 0) {
                    let appAuthToken = response.headers['authtoken'];
                    if (!appAuthToken) {
                        appAuthToken = response.headers['authToken'];
                    }

                    if (appAuthToken) {
                        this._saveAuthToken(appAuthToken);
                    }
                    this._saveWatermark(response.data.result);
                    resolve(response.data.result);
                } else if (response.data.code === AppServerApi.CODE_CREDENTIAL_INCORRECT) {
                    // 密码登录链路上没有验证码，服务端文案「账号或密码错误」统一成「密码错误」，免得以为还要填验证码
                    reject(new AppServerError(response.data.code, '密码错误'));
                } else {
                    reject(new AppServerError(response.data.code, response.data.message));
                }
            })
            .catch(err => {
                reject(err);
            })
    }

    /**
     *
     * @param path
     * @param data
     * @param rawResponse
     * @param rawResponseData
     * @return {Promise<string | AxiosResponse<any>|*|T>}
     * @private
     */
    async _post(path, data = {}, rawResponse = false, rawResponseData = false) {
        let url = await this._getAppServer() + path;
        let send = async () => {
            try {
                let response = await axios.post(url, data, {
                    transformResponse: rawResponseData ? [data => data] : axios.defaults.transformResponse,
                    headers: {
                        'authToken': getAuthToken(url),
                    },
                    withCredentials: false,
                });
                saveAuthTokenFromResponse(url, response);
                return response;
            } catch (e) {
                if (!e.response) {
                    // 网络错误，可能是网络环境变了，清除探测结果
                    this._probeAppServerPromise = null;
                }
                throw e;
            }
        };
        let response = await send();
        // 已经连上 IM 时会话失效（13）：用 authCode 重新换一个 authToken 再试一次。登录相关接口本身不需要 token，不会走到这里
        if (!rawResponseData && response.data && response.data.code === CODE_NOT_LOGIN && this._isImConnected()) {
            await refreshAuthToken(url);
            response = await send();
        }
        if (rawResponse) {
            return response;
        }
        if (response.data) {
            if (rawResponseData) {
                return response.data;
            }
            if (response.data.code === 0) {
                return response.data.result
            } else {
                throw new AppServerError(response.data.code, response.data.message)
            }
        } else {
            throw new Error('request error, status code: ' + response.status)
        }
    }

    _isImConnected() {
        let status = wfc.getConnectionStatus();
        return status === ConnectionStatus.ConnectionStatusConnected || status === ConnectionStatus.ConnectionStatusReceiveing;
    }

}

const appServerApi = new AppServerApi();
export default appServerApi;
