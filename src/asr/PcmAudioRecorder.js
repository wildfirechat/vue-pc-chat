// 音频参数和 wf-voice 要求一致：16kHz、16-bit、单声道
const SAMPLE_RATE = 16000;
// 每帧 480 个采样，即 30ms、960 字节
const FRAME_SAMPLES = 480;
const PROCESSOR_NAME = 'wf-pcm-frame-processor';

// 在音频线程运行：把 Float32 采样转换成 16-bit PCM，攒够一帧发给主线程
const PROCESSOR_SOURCE = `
class PcmFrameProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.frame = new Int16Array(${FRAME_SAMPLES});
        this.offset = 0;
    }

    process(inputs) {
        const samples = inputs[0] && inputs[0][0];
        if (samples) {
            for (let i = 0; i < samples.length; i++) {
                const s = Math.max(-1, Math.min(1, samples[i]));
                this.frame[this.offset++] = s < 0 ? s * 0x8000 : s * 0x7fff;
                if (this.offset === this.frame.length) {
                    this.port.postMessage(this.frame.buffer, [this.frame.buffer]);
                    this.frame = new Int16Array(${FRAME_SAMPLES});
                    this.offset = 0;
                }
            }
        }
        return true;
    }
}
registerProcessor('${PROCESSOR_NAME}', PcmFrameProcessor);
`;

/**
 * PCM 音频录制器，用于实时语音识别
 *
 * 采集 16kHz、16-bit、单声道 PCM 音频数据，每 30ms（960 字节）回调一次
 */
export default class PcmAudioRecorder {
    stopped = false;
    stream = null;
    audioContext = null;

    /**
     * 开始录音。打开麦克风是异步的，失败时回调 onError；调用 stopRecording 之后不再回调
     * @param {function(Uint8Array)} onAudioData 音频数据回调，每次 960 字节
     * @param {function(string)} onError 错误回调
     */
    async startRecording(onAudioData, onError) {
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                }
            });
            if (this.stopped) {
                this._release();
                return;
            }

            // 麦克风的采样率一般是 48kHz，由 Chromium 转换成 16kHz
            let audioContext = new AudioContext({sampleRate: SAMPLE_RATE});
            this.audioContext = audioContext;
            let moduleUrl = URL.createObjectURL(new Blob([PROCESSOR_SOURCE], {type: 'application/javascript'}));
            try {
                await audioContext.audioWorklet.addModule(moduleUrl);
            } finally {
                URL.revokeObjectURL(moduleUrl);
            }
            if (this.stopped) {
                return;
            }

            let source = audioContext.createMediaStreamSource(this.stream);
            let processor = new AudioWorkletNode(audioContext, PROCESSOR_NAME, {
                channelCount: 1,
                channelCountMode: 'explicit',
            });
            processor.port.onmessage = e => {
                if (!this.stopped) {
                    onAudioData(new Uint8Array(e.data));
                }
            };
            source.connect(processor);
            // processor 不写输出，是静音。连接到 destination，音频图才会持续处理
            processor.connect(audioContext.destination);
            console.log('录音已开始:', SAMPLE_RATE + 'Hz, 16-bit, 单声道');
        } catch (e) {
            console.error('启动录音失败', e);
            this._release();
            if (!this.stopped) {
                onError(e.message || e.name);
            }
        }
    }

    /**
     * 停止录音
     */
    stopRecording() {
        this.stopped = true;
        this._release();
    }

    _release() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        if (this.audioContext) {
            this.audioContext.close().catch(() => {
                // do nothing
            });
            this.audioContext = null;
        }
    }
}
