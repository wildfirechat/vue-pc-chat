import conferenceApi from "../../../api/conferenceApi";
import avenginekitproxy from "../../../wfc/av/engine/avenginekitproxy";
import MessageContentType from "../../../wfc/messages/messageContentType";
import ConferenceChangeModeContent from "../../../wfc/av/messages/conferenceChangeModeContent";
import conferenceCommandMessageContent from "../../../wfc/av/messages/conferenceCommandMessageContent";

class ConferenceManager {

    constructor() {
        console.log('xxx listen to message')
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

    setCurrentConferenceInfo(conferenceInfo) {
        this.conferenceInfo = conferenceInfo;
    }

    handup() {
        this.isHandUp = !this.isHandUp;
        // TODO
    }

    onReceiveMessage = (event, msg) => {
        msg = this._fixLongSerializedIssue(msg)
        if (msg.messageContent.type === MessageContentType.CONFERENCE_CONTENT_TYPE_COMMAND) {
            switch (msg.messageContent.commandType) {
                case conferenceCommandMessageContent.ConferenceCommandType.MUTE_ALL:
                    this.vueInstance.$eventBus.$emit('muteVideo');
                    this.vueInstance.$eventBus.$emit('muteAudio');
                    break;
                default:
                    break;
            }
            //this.vueInstance.$eventBus.$emit('muteVideo');
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
}

let self = new ConferenceManager();
export default self;
