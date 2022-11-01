import conferenceApi from "../../../api/conferenceApi";

class ConferenceManager {
    constructor() {
    }

    conferenceInfo = {};
    applyingUnmuteMembers = [];
    isApplyingUnmute = false;
    handUpMembers = [];
    isHandUp = false;
    isMuteAll = false;

    getConferenceInfo(conferenceId) {
        // TODO password
        conferenceApi.queryConferenceInfo(conferenceId, '')
            .then(info => {
                this.conferenceInfo = info;
            })
            .catch(err => {
                console.log(err)
            })
    }

    setCurrentConferenceInfo(conferenceInfo) {
        this.conferenceInfo = conferenceInfo;
    }

    handup() {
        this.isHandUp = !this.isHandUp;
        console.log('xxxx', this.isHandUp);
        // TODO
    }

}

let self = new ConferenceManager();
export default self;
