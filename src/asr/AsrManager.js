import Config from "../config";
import wfc from "../wfc/client/wfc";
import asrServerApi from "../api/asrServerApi";
import AsrWebSocketClient from "./AsrWebSocketClient";
import PcmAudioRecorder from "./PcmAudioRecorder";

// 最长录音时长：60秒
const MAX_RECORDING_DURATION_MS = 60 * 1000;
// 停止录音后等待剩余识别结果的最长时间：10秒。服务端不支持 eos 指令时不会回复 [EOS]，靠它结束识别
const WAIT_EOS_TIMEOUT_MS = 10 * 1000;

const State = {
    IDLE: 0,        // 空闲
    CONNECTING: 1,  // 连接中，已经开始录音，音频先缓存
    RECORDING: 2,   // 已连接，录音中
    FINISHING: 3,   // 已停止录音，等待剩余识别结果
};

/**
 * 实时语音输入管理器
 *
 * 录音并实时推送到 wf-voice 识别（经过 asr-api 转发，内网测试时也可以直连）。wf-voice 每识别完一句返回这句的最终结果；
 * 开启 Config.ENABLE_ASR_PARTIAL_RESULT 后，说话过程中还会返回正在说的这句的中间结果。
 * 服务地址见 Config.ASR_STREAM_SERVER。
 */
export default class AsrManager {
    state = State.IDLE;
    callback = null;
    audioRecorder = null;
    wsClient = null;
    // 本次识别已确定的文本，即各句的最终结果
    recognizedText = '';
    // 正在说的这句的中间结果，收到这句的最终结果后清空
    partialText = '';
    // 连接成功前已经停止录音，连接成功后发送完缓存的音频再结束识别
    pendingStop = false;
    maxDurationTimer = 0;
    waitEosTimer = 0;

    /**
     * 开始语音识别。会立即开始录音，连接识别服务期间录到的音频先缓存，连接成功后再发送
     * @param {Object} callback 识别完成或出错之后不再回调
     * @param {function(string)} callback.onPartialResult 识别文本有更新：识别出新的一句，或者正在说的这句有了新的中间结果。参数是本次识别到目前为止的全部文本
     * @param {function(string)} callback.onFinalResult 识别完成，参数是本次识别的全部文本，可能为空
     * @param {function(string)} callback.onError 出错，参数是错误信息
     */
    startRecognition(callback) {
        if (this.state !== State.IDLE) {
            console.warn('正在识别中，无需重复开始');
            return;
        }
        let url = Config.getAsrStreamServer();
        if (!url) {
            callback.onError('未配置语音识别服务地址');
            return;
        }

        this.callback = callback;
        this.state = State.CONNECTING;
        this.recognizedText = '';
        this.partialText = '';

        let client = new AsrWebSocketClient({
            onConnected: () => {
                this.state = State.RECORDING;
                if (this.pendingStop) {
                    this.pendingStop = false;
                    this.stopRecognition();
                }
            },
            onPartialResult: text => {
                this.partialText = text;
                this.callback.onPartialResult(this._getText());
            },
            onResult: text => {
                this.partialText = '';
                this.recognizedText = join(this.recognizedText, text);
                this.callback.onPartialResult(this._getText());
            },
            onEos: () => {
                this._finishRecognition();
            },
            onError: error => {
                console.error('语音识别服务错误:', error);
                if (this.state === State.FINISHING) {
                    // 已经停止录音，保留已识别出的文本
                    this._finishRecognition();
                } else {
                    this._failRecognition(error);
                }
            },
        });
        this.wsClient = client;
        // 获取认证码、连接识别服务可能要一两秒，用户点完就开始说话。先开始录音，音频由 wsClient 缓存到连接成功后发送
        this._startAudioRecording();

        // wf-voice 要求每个连接的 clientId 唯一，并会用作服务端录音文件名。连接 asr-api 时由 asr-api 重新生成
        let clientId = wfc.getUserId() + '-' + randomId();
        if (!asrServerApi.isAsrApiUrl(url)) {
            // 直连 wf-voice，不需要鉴权
            client.connect(url, clientId, Config.ENABLE_ASR_PARTIAL_RESULT, null);
            return;
        }
        asrServerApi.getAuthCode()
            .then(authCode => {
                // 获取认证码期间，识别可能已经停止或取消
                if (this.wsClient === client) {
                    client.connect(url, clientId, Config.ENABLE_ASR_PARTIAL_RESULT, authCode);
                }
            })
            .catch(error => {
                if (this.wsClient === client) {
                    this._failRecognition(error.message);
                }
            });
    }

    /**
     * 停止录音，剩余识别结果返回后回调 onFinalResult
     */
    stopRecognition() {
        if (this.state === State.CONNECTING) {
            if (this.pendingStop) {
                return;
            }
            // 连接成功后发送完缓存的音频再结束，一直连不上时超时
            console.log('停止录音，连接成功后再结束识别');
            this.pendingStop = true;
            this._stopAudioRecording();
            clearTimeout(this.maxDurationTimer);
            this.waitEosTimer = setTimeout(() => {
                console.warn('连接语音识别服务超时');
                this._failRecognition('连接语音识别服务超时');
            }, WAIT_EOS_TIMEOUT_MS);
        } else if (this.state === State.RECORDING) {
            console.log('停止录音，等待剩余识别结果');
            this.state = State.FINISHING;
            this._stopAudioRecording();
            clearTimeout(this.maxDurationTimer);
            this.wsClient.sendEos();
            clearTimeout(this.waitEosTimer);
            this.waitEosTimer = setTimeout(() => {
                console.warn('等待剩余识别结果超时，结束识别');
                this._finishRecognition();
            }, WAIT_EOS_TIMEOUT_MS);
        }
    }

    /**
     * 取消语音识别，丢弃还没返回的识别结果，之后不再回调
     */
    cancelRecognition() {
        if (this.state !== State.IDLE) {
            console.log('取消识别');
            this._cleanup();
        }
    }

    /**
     * 是否正在识别，包括停止录音后等待剩余识别结果的阶段
     */
    isRecognizing() {
        return this.state !== State.IDLE;
    }

    _startAudioRecording() {
        let client = this.wsClient;
        let recorder = new PcmAudioRecorder();
        this.audioRecorder = recorder;
        recorder.startRecording(pcmData => {
            // 实时发送到服务端，还没连接成功时 client 会先缓存
            client.sendAudioData(pcmData);
        }, message => {
            // 忽略已经停止的录音报的错误
            if (this.audioRecorder === recorder) {
                this._failRecognition('录音失败: ' + message);
            }
        });
        this.maxDurationTimer = setTimeout(() => {
            console.log('达到最大录音时长，自动停止');
            this.stopRecognition();
        }, MAX_RECORDING_DURATION_MS);
    }

    _stopAudioRecording() {
        if (this.audioRecorder) {
            this.audioRecorder.stopRecording();
            this.audioRecorder = null;
        }
    }

    /**
     * 已确定的文本，加上正在说的这句的中间结果
     */
    _getText() {
        return join(this.recognizedText, this.partialText);
    }

    _finishRecognition() {
        if (this.state === State.IDLE) {
            return;
        }
        let callback = this.callback;
        // wf-voice 会把句号替换成逗号，去掉结尾多余的逗号
        let text = this._getText().replace(/[，,]+$/, '');
        this._cleanup();
        callback.onFinalResult(text);
    }

    _failRecognition(message) {
        if (this.state === State.IDLE) {
            return;
        }
        let callback = this.callback;
        this._cleanup();
        callback.onError(message);
    }

    _cleanup() {
        this.state = State.IDLE;
        this.callback = null;
        clearTimeout(this.maxDurationTimer);
        clearTimeout(this.waitEosTimer);
        this._stopAudioRecording();
        if (this.wsClient) {
            this.wsClient.disconnect();
            this.wsClient = null;
        }
        this.recognizedText = '';
        this.partialText = '';
        this.pendingStop = false;
    }
}

/**
 * 拼接两段识别文本，两段英文之间补一个空格
 */
function join(text, sentence) {
    if (text && sentence) {
        let last = text.charAt(text.length - 1);
        let first = sentence.charAt(0);
        if (last.charCodeAt(0) < 128 && !/\s/.test(last) && /[A-Za-z0-9]/.test(first)) {
            return text + ' ' + sentence;
        }
    }
    return text + sentence;
}

// 32 位十六进制随机字符串
function randomId() {
    return Array.from(window.crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
}
