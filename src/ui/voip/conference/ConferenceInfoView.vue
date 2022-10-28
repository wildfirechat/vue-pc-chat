<template>
    <div class="conference-info-container">
        <h2>会议详情</h2>
        <div class="item-container">
            <div class="item">
                <p class="title">会议主题</p>
                <p class="desc">{{ conferenceInfo.conferenceTitle }}</p>
            </div>
            <div class="item">
                <p class="title">发起人</p>
                <p class="desc">{{ ownerName }}</p>
            </div>
            <div class="item">
                <p class="title">会议号</p>
                <p class="desc">{{ conferenceInfo.conferenceId }}</p>
            </div>
            <div class="item">
                <p class="title">二维码</p>
                <i>&gt;</i>
            </div>
        </div>
        <div class="item-container">
            <div class="item">
                <p class="title">开始时间</p>
                <p class="desc">{{ startTime }}</p>
            </div>
            <div class="item">
                <p class="title">结束时间</p>
                <p class="desc">{{ endTime }}</p>
            </div>
        </div>
        <div class="item-container">
            <div class="item">
                <label>
                    开启视频
                    <input :disabled="audience" v-model="enableAudio" type="checkbox">
                </label>
            </div>
            <div class="item">
                <label>
                    开启音频
                    <input :disabled="audience" v-model="enableVideo" type="checkbox">
                </label>
            </div>
        </div>

        <div>
            <button :disabled="ended" @click="joinConference">
                加入会议
            </button>
        </div>
    </div>
</template>

<script>
import wfc from "../../../wfc/client/wfc";
import avenginekitproxy from "../../../wfc/av/engine/avenginekitproxy";

export default {
    name: "ConferenceInfoView",
    props: {
        conferenceInfo: {
            type: Object,
            required: true,
        }
    },
    data() {
        return {
            enableVideo: false,
            enableAudio: false,
        }
    },
    methods: {
        joinConference() {
            let info = this.conferenceInfo;
            console.log('joinConference', info)
            avenginekitproxy.joinConference(info.conferenceId, info.audience, info.pin, info.owner, info.conferenceTitle, '', info.audience, info.advance, !this.enableAudio, !this.enableVideo);
            this.$modal.hide('conference-info-modal')
        }
    },
    computed: {
        ownerName() {
            let userInfo = wfc.getUserDisplayName(this.conferenceInfo.ownner)
            return userInfo.displayName;
        },
        startTime() {
            let date = new Date(this.conferenceInfo.startTime * 1000)
            return date.toString();
        },
        endTime() {
            if (!this.conferenceInfo.endTime) {
                return '-'
            }

            let date = new Date(this.conferenceInfo.endTime * 1000)
            return date.toString();
        },
        audience() {
            return this.conferenceInfo.audience && this.conferenceInfo.owner !== wfc.getUserId();
        },
        ended() {
            return !!this.conferenceInfo.endTime && new Date().getTime() > this.conferenceInfo.endTime * 1000;
        }
    }
}
</script>

<style scoped>

.conference-info-container {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    background: #f8f8f8;
}

.conference-info-container h2 {
    justify-content: center;
    font-weight: normal;
    font-style: normal;
    font-size: 18px;
    background: white;
    text-align: center;
    padding: 20px 0;
}

.item-container {
    background: white;
    margin-bottom: 20px;
}

.item {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    padding: 12px 20px;
    border-spacing: 20px;
}


/*.item:active {*/
/*    background: #d6d6d6;*/
/*}*/

.item:not(:last-of-type) {
    border-bottom: 1px solid #f1f1f1;
}

.item .desc {
    color: gray;
}

.item label {
    width: 100%;
    display: flex;
    justify-content: space-between;
}

button {
    background: white;
    width: 100%;
    text-align: center;
    vertical-align: middle;
    height: 50px;
    line-height: 50px;
    border: none;
}

button:active {
    background: lightgrey;
}

</style>
