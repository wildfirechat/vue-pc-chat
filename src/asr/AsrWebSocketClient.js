import {ipcRenderer} from "../platform";
import IpcEventType from "../ipcEventType";

const MESSAGE_EOS = 'eos';
const MESSAGE_PARTIAL = 'partial';
const MESSAGE_EOS_ACK = '[EOS]';
const MESSAGE_PARTIAL_PREFIX = '[PARTIAL]';
const MESSAGE_PONG = 'pong';
const MESSAGE_TRIAL_PREFIX = '[TRIAL]';

// 发送 eos 前补发约 500ms 静音，让不支持 eos 的旧版本 wf-voice 也能通过 VAD 断句，识别出最后一句。
// 静音和录音一样按 30ms（960 字节）一条消息发送，单条消息过大时 asr-api 或 wf-voice 会断开连接
const SILENCE_FRAME_BYTES = 960;
const SILENCE_PADDING_FRAMES = 17;

// 主进程按 webContents 和连接 ID 区分连接
let nextConnectionId = 1;

/**
 * 实时语音识别 WebSocket 客户端
 *
 * 连接 asr-api 的 /api/stream，由 asr-api 鉴权后转发给 wf-voice；内网测试时也可以直连 wf-voice。
 * 浏览器的 WebSocket 不能设置 HTTP header，也不会使用内置的自签名证书，所以 WebSocket 连接在主进程建立（见 background.js），这里通过 IPC 收发消息。
 *
 * 协议详见 wf-voice 项目的 docs/server-api.md：
 * 1. 连接后发送的第一条文本消息是 clientId；需要边说边出字时，接着发送 partial
 * 2. 二进制消息发送 16kHz、16-bit、单声道 PCM
 * 3. 服务端每识别完一句，推送一条文本消息：[段开始毫秒时间戳+时长秒] 识别文本
 * 4. 发送过 partial 时，说话过程中还会推送正在说的这句的中间结果：[PARTIAL] 识别文本
 * 5. 说话结束时发送 eos，服务端推送完剩余识别结果后回复 [EOS]
 *
 * 每次识别使用一个新实例。连接成功之前就可以发送音频，音频先缓存，连接成功后跟在 clientId 后面发送。
 * 调用 disconnect() 之后不再回调。
 */
export default class AsrWebSocketClient {
    /**
     * @param {Object} callback
     * @param {function()} callback.onConnected 连接成功，连接成功之前缓存的音频已经发送
     * @param {function(string)} callback.onPartialResult 正在说的这句的中间结果，之后会被新的中间结果或这句的最终结果替换
     * @param {function(string)} callback.onResult 识别出一句的最终结果
     * @param {function()} callback.onEos eos 之前的识别结果已全部返回
     * @param {function(string)} callback.onError 连接失败或连接被断开
     */
    constructor(callback) {
        this.callback = callback;
        this.id = nextConnectionId++;
        this.clientId = null;
        this.partialResult = false;
        // 连接成功之前发送的音频，连接成功后发送
        this.pendingAudio = [];
        this.connectRequested = false;
        this.opened = false;
        this.disconnected = false;
        this.onStreamEvent = (event, args) => {
            if (args.id === this.id) {
                this._handleStreamEvent(args);
            }
        };
    }

    /**
     * 连接语音识别服务
     * @param {string} url WebSocket 地址，asr-api 或 wf-voice
     * @param {string} clientId 客户端 ID，wf-voice 要求每个连接唯一
     * @param {boolean} partialResult 是否边说边出字
     * @param {string|null} authCode 连接 asr-api 时需要的认证码，直连 wf-voice 时传 null
     */
    connect(url, clientId, partialResult, authCode) {
        console.log('正在连接语音识别服务:', url);
        this.clientId = clientId;
        this.partialResult = partialResult;
        this.connectRequested = true;
        ipcRenderer.on(IpcEventType.ASR_STREAM_EVENT, this.onStreamEvent);
        ipcRenderer.send(IpcEventType.ASR_STREAM_CONNECT, {id: this.id, url, authCode});
    }

    /**
     * 发送音频数据。还没连接成功时先缓存，连接成功后发送
     * @param {Uint8Array} pcmData 16kHz、16-bit、单声道 PCM，调用之后不能再修改
     */
    sendAudioData(pcmData) {
        if (this.disconnected) {
            return;
        }
        if (!this.opened) {
            this.pendingAudio.push(pcmData);
        } else {
            this._send(pcmData);
        }
    }

    /**
     * 通知服务端说话结束，服务端返回剩余识别结果后回调 onEos。需要在连接成功后调用
     */
    sendEos() {
        if (!this.opened || this.disconnected) {
            return;
        }
        let silence = new Uint8Array(SILENCE_FRAME_BYTES);
        for (let i = 0; i < SILENCE_PADDING_FRAMES; i++) {
            this._send(silence);
        }
        this._send(MESSAGE_EOS);
    }

    /**
     * 断开连接，之后不再回调
     */
    disconnect() {
        this.callback = null;
        this.disconnected = true;
        this.pendingAudio = [];
        if (this.connectRequested) {
            this.connectRequested = false;
            ipcRenderer.removeListener(IpcEventType.ASR_STREAM_EVENT, this.onStreamEvent);
            ipcRenderer.send(IpcEventType.ASR_STREAM_CLOSE, {id: this.id});
        }
    }

    _send(data) {
        ipcRenderer.send(IpcEventType.ASR_STREAM_SEND, {id: this.id, data});
    }

    _handleStreamEvent({type, text, message, code, reason}) {
        if (this.disconnected) {
            return;
        }
        switch (type) {
            case 'open':
                this._onOpened();
                this.callback.onConnected();
                break;
            case 'message':
                console.log('收到消息:', text);
                this._handleMessage(text);
                break;
            case 'error':
                console.error('WebSocket 连接失败:', message);
                // 握手时服务端返回 401，ws 报错 Unexpected server response: 401
                this.callback.onError(/Unexpected server response: 401/.test(message) ? '语音识别服务鉴权失败' : '连接失败: ' + message);
                break;
            case 'close':
                console.log(`WebSocket 已关闭: code=${code}, reason=${reason}`);
                this.callback.onError('连接已断开');
                break;
        }
    }

    /**
     * 连接成功，先发送 clientId 等指令，再发送连接成功之前缓存的音频
     */
    _onOpened() {
        this._send(this.clientId);
        if (this.partialResult) {
            this._send(MESSAGE_PARTIAL);
        }
        let pendingBytes = 0;
        for (let data of this.pendingAudio) {
            this._send(data);
            pendingBytes += data.length;
        }
        this.pendingAudio = [];
        this.opened = true;
        // 16kHz、16-bit 的音频每毫秒 32 字节
        console.log(`WebSocket 连接成功，发送连接前缓存的音频 ${pendingBytes / 32}ms`);
    }

    _handleMessage(message) {
        if (message === MESSAGE_EOS_ACK) {
            this.callback.onEos();
        } else if (message.startsWith(MESSAGE_PARTIAL_PREFIX)) {
            let text = message.substring(MESSAGE_PARTIAL_PREFIX.length).trim();
            if (text) {
                this.callback.onPartialResult(text);
            }
        } else if (message.startsWith(MESSAGE_TRIAL_PREFIX)) {
            // 体验版每个连接只识别前 30 秒音频
            console.warn(message);
        } else if (message !== MESSAGE_PONG) {
            let text = parseResultText(message);
            if (text) {
                this.callback.onResult(text);
            }
        }
    }
}

/**
 * 去掉识别结果的时间前缀，例如 "[1740992313000+2.35] 你好，世界，" 返回 "你好，世界，"
 */
function parseResultText(message) {
    if (message.startsWith('[')) {
        let end = message.indexOf(']');
        if (end > 0) {
            message = message.substring(end + 1);
        }
    }
    return message.trim();
}
