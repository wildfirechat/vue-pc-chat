import Config from "../config";
import AppServerError from "./appServerError";
import {CODE_NOT_LOGIN, ensureAuthToken, refreshAuthToken} from "./appServiceAuth";

/**
 * 语音识别服务 API：合并服务 wf-app-server 的 /api/asr（原 asr-api）
 *
 * 鉴权与其它接口一致：请求带 header authToken（整个应用服务共用一个，见 appServiceAuth）
 */
export class AsrServerApi {

    /**
     * 合并服务的 authToken，没有缓存时用 IM 的 authCode 换一个
     * @param {string} url 识别接口地址（http 或 ws）
     * @return {Promise<string>}
     */
    getAuthToken(url) {
        return ensureAuthToken(url);
    }

    /**
     * 是否是合并服务的识别地址。合并服务的接口都在 /api/ 路径下，直连 wf-voice 的地址没有路径，不需要鉴权
     * @param {string} url
     * @return {boolean}
     */
    isAsrApiUrl(url) {
        try {
            return new URL(url).pathname.indexOf('/api/') >= 0;
        } catch (e) {
            return false;
        }
    }

    _request(url, audioUrl, authToken) {
        return fetch(url, {
            method: 'POST',
            body: JSON.stringify({
                url: audioUrl,
                noReuse: false,
                noLlm: false,
            }),
            headers: {
                'Content-Type': 'application/json',
                'Accept': '*/*',
                'authToken': authToken,
            },
        });
    }

    /**
     * 识别结果是 SSE 文本流；鉴权失败等错误是 JSON 的 {code, message}（HTTP 200）
     * @return {Promise<Object|null>} 错误响应体，正常的文本流返回 null
     */
    async _errorBody(response) {
        let contentType = response.headers.get('content-type') || '';
        if (contentType.indexOf('application/json') < 0) {
            return null;
        }
        try {
            return await response.clone().json();
        } catch (e) {
            return null;
        }
    }

    /**
     * 语音消息转文字，识别结果是流式返回的
     * @param {string} audioUrl 语音文件地址
     * @param {function(string)} onProgress 识别文本有更新时回调，参数是到目前为止识别出的全部文本
     * @return {Promise<string>} 识别出的全部文本
     */
    async recognize(audioUrl, onProgress) {
        let url = Config.getAsrServer();
        let response = await this._request(url, audioUrl, await ensureAuthToken(url));
        let error = await this._errorBody(response);
        if (response.status === 401 || response.status === 403 || (error && error.code === CODE_NOT_LOGIN)) {
            // 会话失效：重新换一个 authToken 再试一次
            response = await this._request(url, audioUrl, await refreshAuthToken(url));
            error = await this._errorBody(response);
        }
        if (!response.ok) {
            throw new Error('request error, status code: ' + response.status);
        }
        if (error && error.code !== 0) {
            throw new AppServerError(error.code, error.message || '语音识别失败');
        }

        let reader = response.body.getReader();
        let decoder = new TextDecoder();
        let result = '';
        while (true) {
            let {value, done} = await reader.read();
            if (done) {
                break;
            }
            let text = decoder.decode(value, {stream: true}).replace(/\r\n|\n|\r/g, '');
            if (text) {
                result += text.replaceAll('data:', '');
                onProgress(result);
            }
        }
        return result;
    }
}

const asrServerApi = new AsrServerApi();
export default asrServerApi;
