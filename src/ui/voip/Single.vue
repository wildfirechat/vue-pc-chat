<!--export default class CallState {-->
<!--static STATUS_IDLE = 0;-->
<!--static STATUS_OUTGOING = 1;-->
<!--static STATUS_INCOMING = 2;-->
<!--static STATUS_CONNECTING = 3;-->
<!--static STATUS_CONNECTED = 4;-->
<!--}-->
<template>
    <div class="flex-column flex-align-center flex-justify-center">
        <h1 style="display: none">Voip-single，运行在新的window，和主窗口数据是隔离的！！</h1>

        <div class="webrtc-tip" v-if="showVoipTip">
            <p>{{ supportConference ? '当前使用：高级版版音视频' : '当前使用：多人版音视频' }}</p>
            <p>多人版音视频 和 高级版音视频不互通，切换方法请参考: wfc/av/internal/README.MD</p>
            <p>{{ voipTip }}</p>
        </div>
        <div v-if="sharedMiscState.isElectron" ref="notClickThroughArea">
            <!--            <ElectronWindowsControlButtonView style="position: absolute; top: 0; left: 0; width: 100%; height: 30px; background: white"-->
            <!--                                              :title="'野火会议'"-->
            <!--                                              :macos="!sharedMiscState.isElectronWindowsOrLinux"/>-->
            <ScreenShareControlView v-if="session && session.screenSharing && session.rcStatus === 5" type="conference"/>
            <h1 style="display: none">Voip-Conference 运行在新的window，和主窗口数据是隔离的！！</h1>
        </div>
        <div v-if="session && !(session.screenSharing && session.rcStatus === 5)" class="container" style="background: #292929">
            <section class="full-height full-width">
                <!--audio-->
                <div class="content-container" v-if="audioOnly">
                    <div class="local-media-container">
                        <img class="avatar" :src="session.selfUserInfo.portrait">
                        <video v-if="status === 4"
                               ref="localVideo"
                               style="height: 0"
                               :srcObject.prop="localStream"
                               muted
                               webkit-playsinline playsinline x5-playsinline preload="auto"
                               autoPlay/>
                    </div>
                    <div class="remote-media-container">
                        <img class="avatar" :src="participantUserInfo.portrait">
                        <video v-if="status ===4"
                               ref="remoteVideo"
                               class="video"
                               style="height: 0"
                               :srcObject.prop="remoteStream"
                               webkit-playsinline playsinline x5-playsinline preload="auto"
                               autoPlay/>
                        <p>{{ participantUserInfo.displayName }}</p>
                        <p v-if="status === 1">等待对方接听</p>
                        <p v-else-if="status === 2">邀请你语音聊天</p>
                        <p v-else-if="status === 3">接听中...</p>

                        <p v-if="status === 4">{{ duration }}</p>
                    </div>
                </div>

                <!--video-->
                <div v-else class="content-container">
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
                               @click="switchVideoType()"
                               ref="remoteVideo"
                               class="video"
                               :srcObject.prop="remoteStream"
                               webkit-playsinline playsinline x5-playsinline preload="auto"
                               autoPlay/>
                        <div v-else class="flex-column flex-justify-center flex-align-center">
                            <img class="avatar" :src="participantUserInfo.portrait">
                            <p>{{ participantUserInfo.displayName }}</p>
                            <p v-if="status === 1">等待对方接听</p>
                            <p v-else-if="status === 2">邀请你视频聊天</p>
                            <p v-else-if="status === 3">接听中...</p>
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
                    <!--          <div v-if="!audioOnly" class="action">-->
                    <!--            <img @click="down2voice" class="action-img" src='@/assets/images/av_float_audio.png'/>-->
                    <!--            <p>切换到语音聊天</p>-->
                    <!--          </div>-->
                </div>
                <!--outgoing-->
                <div v-if="status === 1 || status === 3" class="action-container">
                    <div class="action">
                        <img @click="hangup" class="action-img" src='@/assets/images/av_hang_up.png'/>
                    </div>
                </div>

                <!--connected-->
                <UseDraggable v-if="status === 4 && session.rcStatus === 5" class="floating-action-container">
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
                <div v-if="status === 4 && session.rcStatus === 0" class="action-container">
                    <div class="action">
                        <img @click="hangup" class="action-img" src='@/assets/images/av_hang_up.png'/>
                    </div>
                    <div class="action">
                        <tippy
                            v-if="audioInputDevices.length > 1"
                            :to="'#trigger-audioInputDevices'"
                            placement="top"
                            distant="7"
                            interactive
                            theme="light"
                            arrow>
                            <template #content>
                                <div v-for="(device, index) in audioInputDevices" :key="index" class="audio-input-device-item" @click="switchAudioInput(device)">
                                    {{ device.label  + (device.deviceId === currentAudioInputDeviceId ? ' (当前)' : '')}}
                                </div>
                            </template>
                        </tippy>

                        <div :id="'trigger-audioInputDevices'"
                             ref="audioInputDeviceTippy"
                             class="flex-column flex-align-center flex-justify-center">
                            <img v-if="!session.audioMuted" @click="mute" class="action-img" src='@/assets/images/av_mute.png'/>
                            <img v-else @click="mute" class="action-img" src='@/assets/images/av_mute_hover.png'/>
                            <p>静音</p>
                        </div>
                    </div>
                    <div v-if="!audioOnly && session.rcStatus === 0" class="action">
                        <img @click="inviteRemoteControl" class="action-img" src='@/assets/images/av_share.png'/>
                        <p>远程协助</p>
                    </div>
                    <div v-if="!audioOnly && session.rcStatus === 0" class="action">
                        <img @click="down2voice" class="action-img" src='@/assets/images/av_float_audio.png'/>
                        <p>切换到语音聊天</p>
                    </div>

                </div>
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
import avenginekitproxy from "../../wfc/av/engine/avenginekitproxy";
import IpcEventType from "../../ipcEventType";
import wfrc from "../../wfc/rc/wfrc";
import RcEndReason from "../../wfc/av/engine/rcEndReason";
import RCState from "../../wfc/av/engine/rcState";
import registerRemoteControlEventListener, {startMonitorUACStatus, stopMonitorUACStatus, unregisterRemoteControlEventListener} from "./rcEventHelper";
import {UseDraggable} from "@vueuse/components";
import wfc from "../../wfc/client/wfc";
import EventType from "../../wfc/client/wfcEvent";

export default {
    name: 'Single',
    components: {UseDraggable, ScreenShareControlView, ElectronWindowsControlButtonView},
    data() {
        return {
            session: null,
            audioOnly: false,
            participantUserInfos: [],
            muted: false,
            status: 4,
            startTimestamp: 0,
            currentTimestamp: 0,
            localStream: null,
            remoteStream: null,
            videoInputDeviceIndex: 0,
            audioInputDeviceIndex: 0,
            currentAudioInputDeviceId: '',
            audioInputDevices: [],
            autoPlayInterval: 0,
            ringAudio: null,
            showVoipTip: Config.SHOW_VOIP_TIP,
            voipTip: '',
            supportConference: avenginekit.startConference !== undefined,
            sharedMiscState: store.state.misc,

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
                } else if (state === CallState.STATUS_IDLE) {
                    if (this.timer) {
                        clearInterval(this.timer);
                    }
                }

                console.log('status change', state)
            };

            sessionCallback.onInitial = (session, selfUserInfo, initiatorUserInfo, participantUserInfos) => {
                console.log('onInitial')
                window.__callSession = session;
                this.session = session;
                this.audioOnly = session.audioOnly;
                this.participantUserInfos = [...participantUserInfos];

                // for test
                // navigator.mediaDevices.getUserMedia({
                //     audio: false,
                //     video: {
                //         mandatory: {
                //             chromeMediaSource: 'desktop',
                //             // chromeMediaSourceId: id,
                //             minWidth: 800,
                //             maxWidth: 1280,
                //             minHeight: 600,
                //             maxHeight: 720
                //         }
                //     }
                // }).then((stream) => {
                //     session.setInputStream(stream)
                // }).catch(err => {
                // })

            };

            sessionCallback.didChangeMode = (audioOnly) => {
                this.audioOnly = audioOnly;
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

            sessionCallback.onReceiveRemoteControlInvite = () => {
                console.log('onReceiveRemoteControlInvite')
                if (isElectron()) {
                    this.$alert({
                        content: '对方邀请你进行远程协助',
                        confirmText: '接受',
                        cancelText: '拒绝',
                        cancelCallback: () => {
                            this.session.rejectRemoteControlInvite();
                            this.$notify({
                                text: '你拒绝了对方的远程协助邀请',
                                type: 'info'
                            })
                        },
                        confirmCallback: () => {
                            this.session.muteVideo(true);
                            this.session.acceptRemoteControlInvite();
                            registerRemoteControlEventListener(this.session, this.$refs.remoteVideo);
                        }
                    })
                }
            }

            sessionCallback.didAcceptRemoteControlInvite = () => {
                avenginekitproxy.emitToMain(IpcEventType.START_SCREEN_SHARE, {rc: true})
                wfrc.start()
                if (process && process.platform === 'win32'){
                    startMonitorUACStatus(this.session)
                }
            }

            sessionCallback.didRemoteControlEnd = (reason) => {
                console.log('didRemoteControlEnd', reason)
                let reasonTip = '远程协助结束了';
                if (reason === RcEndReason.REASON_REJECT) {
                    reasonTip = '对方拒绝了你的远程协助邀请'
                } else if (reason === RcEndReason.REASON_HANGUP) {
                    reasonTip = '对方结束了远程协助'
                }
                this.$notify({
                    text: reasonTip,
                    type: 'info'
                })
                this.session.stopScreenShare()
                // 其实，只有reason 为 hangup 时，才真正开始过远程协助/控制
                wfrc.stop()
                if (process && process.platform === 'win32'){
                    stopMonitorUACStatus()
                }
                unregisterRemoteControlEventListener()
            }

            sessionCallback.didRemoteUACStatusChange = (isUac) => {
                if (isUac) {
                    this.$notify({
                        text: '请通知对方点击确认，完成提权操作，否则将不能进一步操作',
                        type: 'info'
                    })
                }
            }

            avenginekit.sessionCallback = sessionCallback;
        },

        answer() {
            this.session.call();
        },

        hangup() {
            if (this.session.rcStatus === RCState.STATUS_CONNECTED) {
                this.session.muteVideo(false)
                this.session.endRemoteControl(RcEndReason.REASON_HANGUP)
                return
            }
            this.session.hangup();
        },

        switchAudioInput(device) {
            console.log('switchAudioInput', device);
            this.currentAudioInputDeviceId = device.deviceId
            this.session.setAudioInputDeviceId(device.deviceId)
            this.$refs["audioInputDeviceTippy"]._tippy.hide();
        },

        switchCamera() {
            if (!this.session || this.session.isScreenSharing()) {
                return;
            }
            // The order is significant - the default capture devices will be listed first.
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

        down2voice() {
            this.session.downgrade2Voice();
        },
        async inviteRemoteControl() {
            if (isElectron()) {
                let screens = await ipcRenderer.invoke(IpcEventType.GET_SOURCE, {types: ['screen'], fetchWindowIcons: false})
                let inviteRemoteControl = (sourceId) => {
                    let desktopShareOptions = {
                        sourceId: sourceId,
                        // minWidth: 1280,
                        // maxWidth: 1280,
                        // minHeight: 720,
                        // maxHeight: 720
                    }
                    this.session.startScreenShare(desktopShareOptions);
                    this.session.inviteRemoteControl(window.screen.width, window.screen.height);
                    // TODO
                    // FIXME
                    //  没有提示，奇怪
                    this.$notify({
                        text: '等待对方接受远程协助邀请',
                        type: 'info'
                    });
                }
                console.log('screens', screens)
                if (screens.length === 1) {
                    inviteRemoteControl(screens[0].id);
                } else {
                    let beforeClose = (event) => {
                        // What a gamble... 50% chance to cancel closing
                        if (!event.params) {
                            return;
                        }
                        if (event.params.source) {
                            let source = event.params.source;
                            inviteRemoteControl(source.id)
                        }
                    };
                    this.$modal.show(
                        ScreenOrWindowPicker,
                        {
                            title: '请选择需要远程协助的桌面',
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
        screenShare() {
            if (this.session.isScreenSharing()) {
                this.session.stopScreenShare();
            } else {
                if (isElectron()) {
                    let beforeClose = (event) => {
                        // What a gamble... 50% chance to cancel closing
                        if (!event.params) {
                            return;
                        }
                        if (event.params.source) {
                            let source = event.params.source;
                            let desktopShareOptions = {
                                sourceId: source.id,
                                // minWidth: 1280,
                                // maxWidth: 1280,
                                // minHeight: 720,
                                // maxHeight: 720
                            }
                            this.session.startScreenShare(desktopShareOptions);
                        }
                    };
                    this.$modal.show(
                        ScreenOrWindowPicker,
                        {}, null, {
                            width: 360,
                            height: 620,
                            name: 'screen-window-picker-modal',
                            clickToClose: false,
                        }, {
                            // 'before-open': beforeOpen,
                            'before-close': beforeClose,
                            // 'closed': closed,
                        })
                } else {
                    this.session.startScreenShare();
                }
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
        onUserInfosUpdate(userInfos = []) {
            for (let i = 0; i < this.participantUserInfos.length; i++) {
                let userInfo = userInfos.find(u => u.uid === this.participantUserInfos[i].uid);
                if (userInfo) {
                    Object.assign(this.participantUserInfos[i], userInfo);
                }
            }
        }
    },

    async mounted() {
        console.log('single mounted')
        if (!this.supportConference) {
            let host = window.location.host;
            if (host.indexOf('wildfirechat.cn') === -1 && host.indexOf('localhost') === -1 && Config.ICE_SERVERS) {
                for (const ice of Config.ICE_SERVERS) {
                    if (ice[0].indexOf('turn.wildfirechat.net') >= 0) {
                        // 显示自行部署 turn 提示
                        this.voipTip = '当前音视频 SDK 为多人版。多人版\n 上线前，请部署 turn 服务，野火官方 turn 服务只能开发测试使用!!!';
                        break
                    }
                }
            }
        }
        // 必须
        if (isElectron()) {
            avenginekit.setup();
        }
        this.setupSessionCallback();

        let devices = await navigator.mediaDevices.enumerateDevices()
        let audioInputDevices = devices.filter(device => device.kind === 'audioinput');
        if (audioInputDevices.length > 0) {
            let defaultAudioDevice = audioInputDevices.filter(d => d.deviceId === 'default')[0];
            if(!defaultAudioDevice){
                defaultAudioDevice = audioInputDevices[0]
            }
            let defaultAudioDeviceGroupId = defaultAudioDevice.groupId;
            this.audioInputDevices = audioInputDevices;
            this.currentAudioInputDeviceId = this.audioInputDevices.filter(d => d.groupId === defaultAudioDeviceGroupId)[0].deviceId;
        }
        wfc.eventEmitter.on(EventType.UserInfosUpdate, this.onUserInfosUpdate);
    },
    beforeUnmount() {
        wfc.eventEmitter.off(EventType.UserInfosUpdate, this.onUserInfosUpdate);
    },

    computed: {
        participantUserInfo() {
            return this.participantUserInfos[0];
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

.audio-input-device-item {
    flex: 1;
    height: 30px;
    padding: 0 10px;
    display: flex;
    justify-content: center;
    align-items: center;
    color: black;
}

.audio-input-device-item:not(:last-of-type) {
    border-bottom: 1px solid #e0e0e0e5;
}

.audio-input-device-item:hover {
    background: #e0e0e0e5;
}

.webrtc-tip {
    position: absolute;
    color: red;
    left: 0;
    top: 0;
    z-index: 999;
}

</style>
