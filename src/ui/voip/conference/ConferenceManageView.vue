<template>
    <div class="conference-manage-view-container" ref="rootContainer">
        <div>
            <div v-if="!showApplyList && selfUserId === conferenceManager.conferenceInfo.owner && conferenceManager.applyingUnmuteMembers.length > 0"
                 @click="showParticipantList = false;showApplyList = true"
                 class="action-tip">xxx 正在申请解除静音
            </div>
            <div v-if="showApplyList" class="title-container">
                <i class="icon-ion-android-arrow-back"
                   @click="showApplyList = false; showParticipantList = true"
                ></i>
                <p>申请解除静音列表</p>
            </div>
            <div v-if="selfUserId === conferenceManager.conferenceInfo.owner && conferenceManager.handUpMembers.length > 0"
                 @click="showParticipantList = false; showHandUpList = true"
                 class="action-tip">xxx 正在举手
            </div>
        </div>
        <ConferenceParticipantListView
            v-if="showParticipantList"
            :participants="participants"
            :session="session"
        />
        <ConferenceApplyUnmuteListView
            v-if="showApplyList"
        />
        <ConferenceHandUpListView
            v-if="showHandUpList"
        />
    </div>
</template>

<script>
import wfc from "../../../wfc/client/wfc";
import conferenceManager from "./conferenceManager";
import ConferenceParticipantListView from "./ConferenceParticipantListView";
import ConferenceApplyUnmuteListView from "./ConferenceApplyUnmuteListView";
import ConferenceHandUpListView from "./ConferenceHandUpListView";

export default {
    name: "ConferenceManageView",
    props: {
        participants: {
            type: Array,
            required: true,
        },
        session: {
            type: Object,
            required: true,
        }
    },
    data() {
        return {
            selfUserId: wfc.getUserId(),
            isContextMenuShow: false,
            currentParticipant: {},
            conferenceManager: conferenceManager,
            showParticipantList: true,
            showApplyList: false,
            showHandUpList: false,
        }
    },
    components: {
        ConferenceHandUpListView,
        ConferenceApplyUnmuteListView,
        ConferenceParticipantListView,
    },
    methods: {}
}
</script>

<style scoped>
.conference-manage-view-container {
    display: none;
    height: 100%;
    overflow: auto;
    background-color: #ffffffe5;
    backdrop-filter: blur(6px);
    border-left: 1px solid #e6e6e6;
}

.conference-manage-view-container.active {
    display: flex;
    flex-direction: column;
}

.conference-manage-view-container .action-tip {
    padding: 10px;
    background: #f1f1f1;
    border-bottom: 1px solid #dadada;
}

.conference-manage-view-container .action-tip:active {
    background: #d6d6d6;
}

.title-container {
    display: flex;
    padding: 10px;
    align-items: center;
    background: #f1f1f1;
}

.title-container i {
    padding-right: 10px;
    height: 100%;
}

.title-container i:active {
    background: #d6d6d6;
}

</style>
