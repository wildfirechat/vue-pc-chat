import Config from "../config";
import wfc from "../wfc/client/wfc";

/**
 * 语音识别服务 API，对应 asr-api 项目（https://gitee.com/wfchat/asr-api）
 *
 * 请求 asr-api 时，需要在 HTTP header authCode 中带上从 IM 服务获取的认证码，asr-api 向 IM 服务校验认证码后得到用户 ID。
 * 认证码 1 分钟内有效，每次请求前重新获取。
 */
export class AsrServerApi {

    /**
     * 获取认证码
     * @return {Promise<string>}
     */
    getAuthCode() {
        return new Promise((resolve, reject) => {
            // 和组织通讯录服务一样，使用管理后台类型（ApplicationType_Admin）的认证码
            wfc.getAuthCode('admin', 2, '', resolve, errorCode => {
                console.error('getAuthCode error', errorCode);
                reject(new Error('获取认证码失败: ' + errorCode));
            });
        });
    }

    /**
     * 是否是 asr-api 的地址。asr-api 的接口都在 /api/ 路径下，直连 wf-voice 的地址没有路径
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

    /**
     * 语音消息转文字，识别结果是流式返回的
     * @param {string} audioUrl 语音文件地址
     * @param {function(string)} onProgress 识别文本有更新时回调，参数是到目前为止识别出的全部文本
     * @return {Promise<string>} 识别出的全部文本
     */
    async recognize(audioUrl, onProgress) {
        let authCode = await this.getAuthCode();
        let response = await fetch(Config.getAsrServer(), {
            method: 'POST',
            body: JSON.stringify({
                url: audioUrl,
                noReuse: false,
                noLlm: false,
            }),
            headers: {
                'Content-Type': 'application/json',
                'Accept': '*/*',
                'authCode': authCode,
            },
        });
        if (!response.ok) {
            throw new Error('request error, status code: ' + response.status);
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
