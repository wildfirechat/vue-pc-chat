import conferenceApi from "../../../api/conferenceApi";
import avenginekitproxy from "../../../wfc/av/engine/avenginekitproxy";
import MessageContentType from "../../../wfc/messages/messageContentType";
import ConferenceCommandMessageContent from "../../../wfc/av/messages/conferenceCommandMessageContent";
import wfc from "../../../wfc/client/wfc";

class ConferenceManager {

    constructor() {
        avenginekitproxy.listenVoipEvent('message', this.onReceiveMessage);
    }

    vueInstance;

    conferenceInfo = {};
    applyingUnmuteMembers = [];
    isApplyingUnmute = false;
    handUpMembers = [];
    isHandUp = false;
    isMuteAll = false;

    setVueInstance(eventBus) {
        this.vueInstance = eventBus;
    }

    getConferenceInfo(conferenceId) {
        // TODO password
        conferenceApi.queryConferenceInfo(conferenceId, '')
            .then(info => {
                this.conferenceInfo = info;
            })
            .catch(err => {
                console.log(err)
            })
        for (let i = 0; i < 50; i++) {
            this.applyingUnmuteMembers.push('GNMtGtZZ');
            this.handUpMembers.push('GNMtGtZZ');
        }
    }


    handup() {
        this.isHandUp = !this.isHandUp;
        // TODO
    }

    onReceiveMessage = (event, msg) => {
        msg = this._fixLongSerializedIssue(msg)
        if (msg.messageContent.type === MessageContentType.CONFERENCE_CONTENT_TYPE_COMMAND) {
            let command = msg.messageContent;
            switch (command.commandType) {
                case ConferenceCommandMessageContent.ConferenceCommandType.MUTE_ALL:
                    this._reloadCurrentConferenceInfo();
                    this.onMuteAll();
                    break;
                case ConferenceCommandMessageContent.ConferenceCommandType.CANCEL_MUTE_ALL:
                    this._reloadCurrentConferenceInfo();
                    this.onCancelMuteAll(command.boolValue);
                    break;
                case ConferenceCommandMessageContent.ConferenceCommandType.REQUEST_MUTE:
                    if (command.targetUserId === wfc.getUserId()) {
                        this.onRequestMute(command.boolValue);
                    }
                    break;
                case ConferenceCommandMessageContent.ConferenceCommandType.REJECT_UNMUTE_REQUEST:
                    this.vueInstance.$notify({
                        text: '主持人拒绝了你的发言请求',
                        type: 'info'
                    });
                    break;
                case ConferenceCommandMessageContent.ConferenceCommandType.APPLY_UNMUTE:
                    // TODO
                    break;
                default:
                    break;
            }
        }
    }

    onMuteAll() {
        this.vueInstance.$eventBus.$emit('muteVideo', true);
        this.vueInstance.$eventBus.$emit('muteAudio', true);
        this.vueInstance.$notify({
            text: '管理员将全体成员静音了',
            type: 'info'
        });
    }

    onCancelMuteAll(requestUnmute) {
        if (requestUnmute) {
            this.vueInstance.$alert({
                showIcon: false,
                content: '主持人关闭了全员静音，是否要打开麦克风',
                confirmText: '开启麦克风',
                cancelCallback: () => {
                    // do nothing
                },
                confirmCallback: () => {
                    this.vueInstance.$eventBus.$emit('muteAudio', false);
                }
            })

        }
        this.vueInstance.$notify({
            text: '管理员将取消了全体成员静音',
            type: 'info'
        });
    }

    onRequestMute(mute) {
        if (!mute) {
            this.vueInstance.$alert({
                showIcon: false,
                content: '主持人邀请你发言',
                confirmText: '接受',
                cancelCallback: () => {
                    // do nothing
                },
                confirmCallback: () => {
                    this.vueInstance.$eventBus.$emit('muteAudio', false);
                }
            })
        } else {
            this.vueInstance.$eventBus.$emit('muteVideo', true);
            this.vueInstance.$eventBus.$emit('muteAudio', true);

            this.vueInstance.$notify({
                text: '管理员关闭了你的发言',
                type: 'info'
            });
        }
    }

    _fixLongSerializedIssue(msg) {
        if (typeof msg !== 'string') {
            return msg;
        }
        msg = JSON.parse(msg);
        if (typeof msg === 'string') {
            msg = JSON.parse(msg);
        }
        return msg;
    }

    _reloadCurrentConferenceInfo() {
        conferenceApi.queryConferenceInfo(this.conferenceInfo.conferenceId, this.conferenceInfo.password)
            .then(info => {
                this.conferenceInfo = info;
            })
            .catch(err => {
                console.log(err)
            })

    }
}

let self = new ConferenceManager();
export default self;
