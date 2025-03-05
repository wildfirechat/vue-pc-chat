<!--export default class CallState {-->
<!--static STATUS_IDLE = 0;-->
<!--static STATUS_OUTGOING = 1;-->
<!--static STATUS_INCOMING = 2;-->
<!--static STATUS_CONNECTING = 3;-->
<!--static STATUS_CONNECTED = 4;-->
<!--}-->
<template>
    <div class="flex-column flex-align-center flex-justify-center" style="background: #2d3033">
        <h1 style="display: none">Voip-single，运行在新的window，和主窗口数据是隔离的！！</h1>

        <div v-if="sharedMiscState.isElectron" ref="notClickThroughArea">
            <!--            <ElectronWindowsControlButtonView style="position: absolute; top: 0; left: 0; width: 100%; height: 30px; background: white"-->
            <!--                                              :title="'野火会议'"-->
            <!--                                              :macos="!sharedMiscState.isElectronWindowsOrLinux"/>-->
            <ScreenShareControlView v-if="session && session.screenSharing && session.rcStatus === 5"
                                    type="conference"
                                    stop-screen-share-title="结束远程控制"
                                    :stop-screen-share-func="hangup"/>
        </div>
        <div v-if="session && !(session.screenSharing && session.rcStatus === 5)" class="container" style="background: #292929">
            <section class="full-height full-width">
                <!--video-->
                <div class="content-container">
                    <div class="local-media-container" v-if="session.rcStatus !== 5">
                        <video v-if="status === 4 || localStream"
                               ref="localVideo"
                               class="localVideo me"
                               :srcObject.prop="localStream"
                               muted
                               webkit-playsinline playsinline x5-playsinline preload="auto"
                               autoPlay/>
                        <img v-else class="avatar" :src="session.selfUserInfo.portrait">
                    </div>
                    <div class="remote-media-container">
                        <video v-if="status ===4"
                               ref="remoteVideo"
                               class="video"
                               :srcObject.prop="remoteStream"
                               webkit-playsinline playsinline x5-playsinline preload="auto"
                               autoPlay/>
                        <div v-else class="flex-column flex-justify-center flex-align-center">
                            <img class="avatar" :src="participantUserInfo.portrait">
                            <p>{{ participantUserInfo.displayName }}</p>
                            <p v-if="status === 1">等待对方接受远程控制请求</p>
                            <p v-else-if="status === 2">请求远程控制你的桌面</p>
                            <p v-else-if="status === 3">建立连接中...</p>
                        </div>
                    </div>
                </div>
            </section>

            <!--actions-->
            <footer>
                <!--incoming-->
                <div v-if="status === 2" class="action-container">
                    <div class="action">
                        <img @click="hangup" class="action-img" src='@/assets/images/av_hang_up.png'/>
                    </div>
                    <div class="action">
                        <img @click="answer" class="action-img" src='@/assets/images/av_video_answer.png'/>
                    </div>
                </div>
                <!--outgoing-->
                <div v-if="status === 1" class="action-container">
                    <div class="action">
                        <img @click="hangup" class="action-img" src='@/assets/images/av_hang_up.png'/>
                    </div>
                </div>

                <!--connected-->

                <UseDraggable v-if="status === 4" class="floating-action-container">
                    <p class="desc">控制</p>
                    <div class="floating-actions">
                        <div class="action">
                            <img @click="hangup" class="action-img" src='@/assets/images/av_hang_up.png'/>
                            <p>结束远程控制</p>
                        </div>
                        <div class="action">
                            <img v-if="!session.audioMuted" @click="mute" class="action-img" src='@/assets/images/av_mute.png'/>
                            <img v-else @click="mute" class="action-img" src='@/assets/images/av_mute_hover.png'/>
                            <p>静音</p>
                        </div>
                    </div>
                </UseDraggable>
            </footer>
        </div>
    </div>
</template>

<script>
import avenginekit from "../../wfc/av/internal/engine.min";
import CallSessionCallback from "../../wfc/av/engine/callSessionCallback";
import CallState from "../../wfc/av/engine/callState";
import {ipcRenderer, isElectron} from "../../platform";
import ScreenOrWindowPicker from "./ScreenOrWindowPicker";
import VideoType from "../../wfc/av/engine/videoType";
import Config from "../../config";
import ElectronWindowsControlButtonView from "../common/ElectronWindowsControlButtonView.vue";
import ScreenShareControlView from "./ScreenShareControlView.vue";
import store from "../../store";
import wfrc from "../../wfc/rc/wfrc";
import registerRemoteControlEventListener, {startMonitorUACStatus, stopMonitorUACStatus, unregisterRemoteControlEventListener} from "./rcEventHelper";
import avenginekitproxy from "../../wfc/av/engine/avenginekitproxy";
import IpcEventType from "../../ipcEventType";
import {UseDraggable} from '@vueuse/components'

export default {
    name: 'SingleRemoteControl',
    components: {
        ScreenShareControlView,
        ElectronWindowsControlButtonView,
        UseDraggable
    },
    data() {
        return {
            session: null,
            participantUserInfos: [],
            muted: false,
            status: 4,
            startTimestamp: 0,
            currentTimestamp: 0,
            localStream: null,
            remoteStream: null,
            videoInputDeviceIndex: 0,
            autoPlayInterval: 0,
            sharedMiscState: store.state.misc,

            ringAudio: null,

            deltaXSum: 0,
            deltaYSum: 0,
        }
    },
    methods: {
        autoPlay() {
            if (isElectron()) {
                return;
            }
            console.log('can play');
            if (!this.autoPlayInterval) {
                this.autoPlayInterval = setInterval(() => {
                    try {
                        if (this.$refs.localVideo && this.$refs.localVideo.paused) {
                            let p = this.$refs.localVideo.play();
                            if (p !== undefined) {
                                p.catch(err => {
                                    // do nothing
                                })
                            }
                            console.log('can play local');
                        }
                        if (this.$refs.remoteVideo && this.$refs.remoteVideo.paused) {
                            let p = this.$refs.remoteVideo.play();
                            if (p !== undefined) {
                                p.catch(err => {
                                    // do nothing
                                })
                            }
                            console.log('can play remote');
                        }
                    } catch (e) {
                        // do nothing
                    }

                    if (this.$refs.localVideo && !this.$refs.localVideo.paused && this.$refs.remoteVideo && !this.$refs.remoteVideo.paused) {
                        clearInterval(this.autoPlayInterval);
                        this.autoPlayInterval = 0;
                    }
                }, 100);
            }
        },
        switchVideoType() {
            if (!this.session) {
                return
            }
            let userId = this.session.getParticipantIds()[0];
            let subscriber = this.session.getSubscriber(userId, false);
            if (subscriber) {
                let currentVideoType = subscriber.currentVideoType;
                let videoType = VideoType.NONE;
                if (currentVideoType === VideoType.NONE) {
                    videoType = VideoType.BIG_STREAM;
                } else if (currentVideoType === VideoType.BIG_STREAM) {
                    videoType = VideoType.SMALL_STREAM;
                } else if (currentVideoType === VideoType.SMALL_STREAM) {
                    videoType = VideoType.NONE;
                }
                console.log('setParticipantVideoType', userId, videoType);
                this.session.setParticipantVideoType(userId, false, videoType);
            }
        },
        setupSessionCallback() {
            let sessionCallback = new CallSessionCallback();

            // 可能回调多次
            sessionCallback.didChangeState = (state) => {
                // 响铃示例代码
                if (state === CallState.STATUS_OUTGOING) {
                    console.log('start outgoing ring')
                    this.ringAudio = new Audio(require("@/assets/audios/incoming_call_ring.mp3"))
                    this.ringAudio.loop = true;
                    this.ringAudio.play();
                } else if (state === CallState.STATUS_INCOMING) {
                    // 由于浏览器的限制，web 端，可能不能自动播放！！!
                    // 另外，微信收到音视频通话邀请时，也没有声音
                    // this.ringAudio = new Audio(require("@/assets/audios/incoming_call_ring.mp3"))
                    // this.ringAudio.loop = true;
                    // this.ringAudio.play();
                } else {
                    if (this.ringAudio) {
                        this.ringAudio.pause();
                        this.ringAudio = null;
                    }
                }

                this.status = state;
                console.log('didChangeState', state)
                if (state === CallState.STATUS_CONNECTED) {
                    if (this.startTimestamp === 0) {
                        this.startTimestamp = new Date().getTime();
                        this.timer = setInterval(() => {
                            this.currentTimestamp = new Date().getTime();
                        }, 1000)
                    }

                    if (!this.session.moCall) {
                        // 被控
                        this.chooseScreenToBeRemoteControlled()
                    } else {
                        // 主控
                        this.$nextTick(() => {
                            registerRemoteControlEventListener(this.session, this.$refs.remoteVideo)
                        })
                    }
                } else if (state === CallState.STATUS_IDLE) {
                    if (this.timer) {
                        clearInterval(this.timer);
                    }
                }

                console.log('status change', state)
            };

            sessionCallback.onInitial = (session, selfUserInfo, initiatorUserInfo, participantUserInfos) => {
                console.log('onInitial', participantUserInfos)
                window.__callSession = session;
                this.session = session;
                this.participantUserInfos = [...participantUserInfos];
            };

            sessionCallback.didChangeMode = (audioOnly) => {
            };

            sessionCallback.didCreateLocalVideoTrack = (stream) => {
                this.localStream = stream;
                this.autoPlay();
            };

            sessionCallback.didReceiveRemoteVideoTrack = (userId, stream) => {
                this.remoteStream = stream;
                this.autoPlay();
            };

            sessionCallback.didCallEndWithReason = (reason) => {
                console.log('callEndWithReason', reason)
                this.session.closeVoipWindow();
                this.session = null;
                wfrc.stop()
                unregisterRemoteControlEventListener()
                if (process && process.platform === 'win32') {
                    stopMonitorUACStatus(this.session)
                }
            }
            sessionCallback.didVideoMuted = (userId, muted) => {
                console.log('didVideoMuted', userId, muted);
                this.muted = muted;
            };

            sessionCallback.didMediaLostPacket = (media, lostPacket) => {
                if (lostPacket > 6) {
                    console.log('您的网络不好');
                }
            };

            sessionCallback.didUserMediaLostPacket = (userId, media, lostPacket, uplink) => {
                //如果uplink ture对方网络不好，false您的网络不好
                //接收方丢包超过10为网络不好
                if (lostPacket > 10) {
                    if (uplink) {
                        console.log('对方网络不好');
                    } else {
                        console.log('您的网络不好');
                    }
                }
            };

            sessionCallback.didParticipantConnected = (userId) => {
                console.log('didParticipantConnected', userId)
            }

            sessionCallback.didReportAudioVolume = (userId, volume) => {
                // console.log('didReportAudioVolume', userId, volume)
            }
            sessionCallback.didRemoteUACStatusChange = (isUac) => {
                console.error('didRemoteUACStatusChange', isUac);
                // 进行提示
                if (isUac) {
                    this.$alert({
                        name: 'uac-alert',
                        showIcon: false,
                        content: '请通知对方进行提权操作，否则将不能进一步操作',
                        cancelCallback: () => {
                            // do nothing
                        },
                        confirmCallback: () => {
                        }
                    })
                } else {
                    this.$notify({
                        content: '对方已提权',
                        duration: 2000,
                        type: 'success'
                    })
                    this.$modal.hide('uac-alert')
                }
            }

            avenginekit.sessionCallback = sessionCallback;
        },

        answer() {
            this.session.acceptRemoteControlRequest();
        },

        hangup() {
            this.session.hangup();
            wfrc.stop()
        },

        switchCamera() {
            if (!this.session || this.session.isScreenSharing()) {
                return;
            }
            // The oer is significant - the default capture devices will be listed first.
            // navigator.mediaDevices.enumerateDevices()
            navigator.mediaDevices.enumerateDevices().then(devices => {
                devices = devices.filter(d => d.kind === 'videoinput');
                if (devices.length < 2) {
                    console.log('switchCamera error, no more video input device')
                    return;
                }
                this.videoInputDeviceIndex++;
                if (this.videoInputDeviceIndex >= devices.length) {
                    this.videoInputDeviceIndex = 0;
                }
                this.session.setVideoInputDeviceId(devices[this.videoInputDeviceIndex].deviceId)
                console.log('setVideoInputDeviceId', devices[this.videoInputDeviceIndex]);
            })
        },

        mute() {
            let enable = this.session.audioMuted ? true : false;
            this.session.selfUserInfo._isAudioMuted = !enable;
            this.session.setAudioEnabled(enable)
        },

        async chooseScreenToBeRemoteControlled() {
            if (isElectron()) {

                let startScreenShareAndListenRCEvent = (sourceId) => {
                    let desktopShareOptions = {
                        sourceId: sourceId,
                        // minWidth: 1280,
                        // maxWidth: 1280,
                        // minHeight: 720,
                        // maxHeight: 720
                    }
                    this.session.startScreenShare(desktopShareOptions);
                    avenginekitproxy.emitToMain(IpcEventType.START_SCREEN_SHARE, {rc: true})
                    wfrc.start()
                    if (process && process.platform === 'win32') {
                        startMonitorUACStatus(this.session)
                    }
                }

                let screens = await ipcRenderer.invoke(IpcEventType.GET_SOURCE, {types: ['screen'], fetchWindowIcons: false})
                if (screens.length === 1) {
                    startScreenShareAndListenRCEvent(screens[0].id);
                } else {
                    let beforeClose = (event) => {
                        // What a gamble... 50% chance to cancel closing
                        if (!event.params) {
                            // TODO
                            // FIXME
                            // hangup
                            return;
                        }
                        if (event.params.source) {
                            let source = event.params.source;
                            startScreenShareAndListenRCEvent(source.id);
                        }
                    };
                    this.$modal.show(
                        ScreenOrWindowPicker,
                        {
                            title: '请选择允许被远程控制的桌面',
                            desc: '将允许对方远程操作你选择的桌面',
                            types: ['screen']
                        }, null, {
                            width: 360,
                            height: 620,
                            name: 'screen-window-picker-modal',
                            clickToClose: false,
                        }, {
                            // 'before-open': beforeOpen,
                            'before-close': beforeClose,
                            // 'closed': closed,
                        })
                }
            } else {
                // this.session.startScreenShare();
                // not support
            }
        },

        timestampFormat(timestamp) {
            timestamp = ~~(timestamp / 1000);
            let str = ''
            let hour = ~~(timestamp / 3600);
            str = hour > 0 ? ((hour < 10 ? "0" : "") + hour + ':') : '';
            let min = ~~((timestamp % 3600) / 60);
            str += (min < 10 ? "0" : "") + min + ':'
            let sec = ~~((timestamp % 60));
            str += (sec < 10 ? "0" : "") + sec
            return str;
        },

        isCallConnected() {
            //Todo
            return true;
        },
    },

    mounted() {
        console.log('single-rc mounted')
        // 必须
        if (isElectron()) {
            avenginekit.setup();
        }
        this.setupSessionCallback();
    },

    computed: {
        participantUserInfo() {
            return this.session.participantUserInfos[0];
        },

        duration() {
            if (this.currentTimestamp <= 0) {
                return '00:00'
            }
            let escapeMillis = this.currentTimestamp - this.startTimestamp;
            return this.timestampFormat(escapeMillis)
        }
    },

}
</script>

<style lang="css" scoped>

.container {
    width: 100%;
    height: 100%;
    position: relative;
}

.content-container {
    width: 100%;
    height: 100%;
    position: relative;
}

.action-container {
    width: 100%;
    position: absolute;
    bottom: 0;
    left: 0;
    display: flex;
    justify-content: space-around;
    padding-bottom: 20px;
}

.action-container .action {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    font-size: 12px;
    color: white;
}

.floating-action-container {
    height: 100px;
    min-width: 100px;
    border-radius: 50px;
    top: 10%;
    left: 10%;
    padding: 20px 0;
    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: center;
    position: absolute;
    background: #cccccc;
    cursor: move;
}

.floating-actions {
    width: 300px;
    justify-content: space-around;
}

.floating-action-container:not(:hover) .floating-actions {
    display: none;
}

.floating-action-container:hover .floating-actions {
    display: flex;
    flex-direction: row;
}

.floating-action-container:not(:hover) .desc {
    display: flex;
    height: 100%;
    padding: 20px;
    justify-items: center;
    align-items: center;
}

.floating-action-container:hover .desc {
    cursor: move;
    padding: 20px;
}

.floating-actions .action {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    font-size: 12px;
    color: white;
    cursor: auto;
}

.avatar {
    width: 60px;
    height: 60px;
    border-radius: 3px;
}

.action-img {
    width: 60px;
    height: 60px;
}

.remote-media-container {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    width: 100%;
    height: 100%;
    color: white;
    /*background-color: rebeccapurple;*/
}


.local-media-container {
    position: absolute;
    top: 0;
    left: 0;
}

.local-media-container .avatar {
    margin-left: 20px;
    margin-top: 20px;
}

.localVideo {
    width: 200px;
    height: auto;
    position: absolute;
    top: 0;
    background-color: #cccccc;
    left: 0;
}

.localVideo.me {
    -webkit-transform: scaleX(-1);
    transform: scaleX(-1);
}

.video {
    width: 100%;
    height: 100%;
}

.webrtc-tip {
    position: absolute;
    color: red;
    left: 0;
    top: 0;
    z-index: 999;
}

</style>
