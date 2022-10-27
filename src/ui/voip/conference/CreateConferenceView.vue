<template>
    <div class="create-conference-container">
        <h2>发起会议</h2>
        <input v-model="title" class="text-input" type="text" placeholder="会议标题">
        <input v-model="desc" class="text-input" type="text" placeholder="会议描述">
        <label>
            参与者开启摄像头、麦克风入会
            <input v-model="audience" type="checkbox">
        </label>
        <label>
            允许参与者自主开启摄像头和麦克风
            <input :disabled="audience" v-model="allowTurnOnMic" type="checkbox">
        </label>
        <div>
            <label>
                启用密码
                <input v-model="enablePassword" type="checkbox">
            </label>
            <input v-if="enablePassword" v-model="password" class="text-input" style="margin-top: 10px" type="tel" maxlength="4" placeholder="123456">
        </div>
        <div>
            <label>
                使用个人会议号
                <input v-model="enableUserCallId" type="checkbox">
            </label>
            <p style="font-size: 12px">{{ callId }}</p>
        </div>
        <div>
            <label>
                大规模会议
                <input v-model="advance" type="checkbox">
            </label>
            <p class="advance_desc">参会人数大于50人</p>
        </div>

        <div class="action-container">
            <button class="create-button" :disabled="title.trim() === '' || desc.trim() === ''" @click="createConference">创建会议</button>
            <button class="join-button" :disabled="title.trim() === '' || desc.trim() === ''" @click="createAndJoinConference">进入会议</button>
        </div>
    </div>
</template>

<script>
import wfc from "../../../wfc/client/wfc";
import avenginekitproxy from "../../../wfc/av/engine/avenginekitproxy";
import conferenceApi from "../../../api/conferenceApi";
import ConferenceInfo from "../../../wfc/av/model/conferenceInfo";

export default {
    name: "CreateConferenceView",
    data() {
        return {
            title: '',
            desc: '',
            audience: false,
            advance: false,
            allowTurnOnMic: false,
            enablePassword: false,
            password: '',
            enableUserCallId: true,
            callId: '',
        }
    },
    async mounted() {
        this.callId = await conferenceApi.getMyPrivateConferenceId();
    },

    methods: {
        async _createConference() {
            let info = new ConferenceInfo();
            if (this.enableUserCallId) {
                info.conferenceId = this.callId;
                info.conferenceTitle = this.title;
            }
            if (this.password) {
                info.password = this.password;
            }
            info.pin = '' + Math.ceil((1 + Math.random() * 100000) / 10);

            info.owner = wfc.getUserId();
            info.startTime = Math.ceil(new Date().getTime() / 1000);
            // TODO
            info.endTime = 0;
            info.audience = this.audience;
            info.allowSwitchMode = this.allowTurnOnMic;
            info.advance = this.advance;

            info.conferenceId = await conferenceApi.createConference(info)
            return info;
        },
        createConference() {
            this._createConference()
                .then(info => {
                    this.$notify({
                        text: '创建会议 成功',
                        type: 'info'
                    });
                })
                .catch(err => {
                    this.$notify({
                        title: '创建会议失败',
                        text: err.message,
                        type: 'error'
                    });
                })
            this.$modal.hide('create-conference-modal')
        },
        createAndJoinConference() {
            this._createConference()
                .then(info => {
                    avenginekitproxy.startConference(info.conferenceId, false, info.pin, info.owner, info.conferenceTitle, this.desc, info.audience, info.advance);
                })
                .catch(err => {
                    this.$notify({
                        title: '创建会议失败',
                        text: err.message,
                        type: 'error'
                    });
                })
            this.$modal.hide('create-conference-modal')
        }
    },
    watch: {
        advance() {
            // 超级会议模式，一般参会人员会很多，但不需要所有人都能发言；互动模式，是允许每个人发言
            // 开启超级会之后，需要再次确认开启互动模式
            if (this.advance) {
                this.audience = false;
            }
        }
    }
}
</script>

<style scoped lang="css">

.create-conference-container {
    display: flex;
    flex-direction: column;
    padding: 0 20px;
}

.create-conference-container h2 {
    justify-content: center;
    font-weight: normal;
    font-style: normal;
    font-size: 18px;
    text-align: center;
}

.create-conference-container label {
    display: flex;
    justify-content: space-between;
    font-size: 13px;
}

.text-input {
    height: 30px;
    border: 1px solid #e5e5e5;
    border-radius: 3px;
    outline: none;
    width: 100%;
    padding: 0 5px;
}

.text-input:active {
    border: 1px solid #4168e0;
}

.text-input:focus {
    border: 1px solid #4168e0;
}

.create-conference-container button {
    height: 30px;
    border: 1px solid #e5e5e5;
    border-radius: 3px;
}

.create-conference-container button:active {
    border: 1px solid #4168e0;
}

.advance_desc {
    font-size: 12px;
    color: #F95569;
}

.create-conference-container > * {
    margin-top: 20px;
}

.action-container {
    display: flex;
    justify-content: space-between;
}

.action-container button {
    width: 50%;
    border: none;
}

.create-button {
    margin-right: 10px;
}

.create-button:enabled {
    color: gray;
}

.join-button {
    margin-left: 10px;
}

.join-button:enabled {
    color: #4168e0;
}

</style>
