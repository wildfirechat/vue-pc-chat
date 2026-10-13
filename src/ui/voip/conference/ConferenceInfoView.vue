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
                <p class="desc" @click="copyConferenceId">{{ conferenceInfo.conferenceId }}</p>
            </div>
            <div class="item" @click="showQrCode">
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
                    <input :disabled="audience" v-model="enableVideo" type="checkbox">
                </label>
            </div>
            <div class="item">
                <label>
                    开启音频
                    <input :disabled="audience" v-model="enableAudio" type="checkbox">
                </label>
            </div>
        </div>

        <div class="action-container">
            <button class="destroy" v-if="enableDestroy" @click="destroyConference">
                销毁会议
            </button>
            <button class="share" v-if="!ended" @click="shareConference">
                分享
            </button>
            <button ref="favButton" v-if="conferenceInfo.startTime * 1000 > new Date().getTime() && conferenceInfo.owner !== selfUserId" @click="favConference">
                尚未开始，收藏会议
            </button>
            <button ref="favButton" v-else-if="conferenceInfo.startTime * 1000 > new Date().getTime()" :disabled="true">
                尚未开始
            </button>
            <button v-else-if="ended" class="delete-record" @click="deleteRecord">
                删除记录
            </button>
            <button v-else @click="joinConference">
                加入会议
            </button>
        </div>
    </div>
</template>

<script>
import wfc from "../../../wfc/client/wfc";
import avenginekitproxy from "../../../wfc/av/engine/avenginekitproxy";
import conferenceApi from "../../../api/conferenceApi";
import {copyText} from "../../util/clipboard";
import conferenceManager from "./conferenceManager";
import WfcScheme from "../../../wfcScheme";
import QRCodeDialogView from "../../common/QRCodeDialogView.vue";
import ConferenceInviteMessageContent from "../../../wfc/av/messages/conferenceInviteMessageContent";
import Message from "../../../wfc/messages/message";
import ForwardType from "../../main/conversation/message/forward/ForwardType";

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
            ownerName: '',
            selfUserId: wfc.getUserId(),
        }
    },
    mounted() {
        console.log('conferenceInfo', this.conferenceInfo);
        this.ownerName = wfc.getUserDisplayName(this.conferenceInfo.owner);
        conferenceApi.queryConferenceInfo(this.conferenceInfo.conferenceId, this.conferenceInfo.password)
            .then(info => {
                this.conferenceInfo.endTime = info.endTime;
            })
            .catch(err => {
                console.log('queryConferenceInfo error', err);
            })
    },
    methods: {
        favConference() {
            conferenceApi.favConference(this.conferenceInfo.conferenceId)
                .then(r => {
                    this.$refs.favButton.title = '已收藏';
                    this.$refs.favButton.disabled = true;
                })
                .catch(err => {
                    console.error('favConference error', err);
                })
        },
        joinConference() {
            let info = this.conferenceInfo;
            console.log('joinConference', info);
            let audience = !this.enableVideo && !this.enableAudio
            avenginekitproxy.joinConference(info.conferenceId, false, info.pin, info.owner, info.conferenceTitle, '', audience, info.advance, !this.enableAudio, !this.enableVideo);
            this.$modal.hide('conference-info-modal');
        },

        /** 分享会议邀请卡片到会话（对齐 wf-enterprise-chat aa971d1c） */
        shareConference() {
            let info = this.conferenceInfo;
            let content = new ConferenceInviteMessageContent(
                info.conferenceId,
                info.owner,
                info.conferenceTitle,
                '',
                info.startTime,
                false,
                info.audience,
                info.advance,
                info.pin,
                info.password
            );
            let message = new Message(null, content);
            this.$forwardMessage({
                forwardType: ForwardType.NORMAL,
                messages: [message]
            });
            this.$modal.hide('conference-info-modal');
        },

        /** 已结束的会议：删除本地历史记录，已收藏的一并取消收藏（对齐 wf-enterprise-chat de980c9b） */
        deleteRecord() {
            this.$alert({
                showIcon: false,
                content: '将从历史记录中删除该会议；如果已收藏也会一并取消收藏。是否删除？',
                confirmText: '删除',
                cancelText: '取消',
                confirmCallback: () => {
                    conferenceApi.unfavConference(this.conferenceInfo.conferenceId)
                        .catch(err => {
                            console.log('unfav conference error', err);
                        })
                        .finally(() => {
                            conferenceManager.removeHistory(this.conferenceInfo);
                            this.$notify({text: '已删除', type: 'success'});
                            this.$modal.hide('conference-info-modal');
                        });
                },
                cancelCallback: () => {
                    // do nothing
                }
            });
        },

        copyConferenceId(){
            copyText(this.conferenceInfo.conferenceId)
            this.$notify({
                text: '会议号已复制',
                type: 'info'
            });
        },

        showQrCode() {
            this.$modal.hide('conference-info-modal');
            this.$modal.show(
                QRCodeDialogView,
                {
                    title: '会议二维码',
                    content: WfcScheme.buildConferenceLink(this.conferenceInfo.conferenceId, this.conferenceInfo.pin),
                }, null, {
                    name: 'qr-code-dialog-modal',
                    width: 320,
                    height: 380,
                    clickToClose: true,
                }, {})
        },
        async destroyConference(){
            await conferenceApi.destroyConference(this.conferenceInfo.conferenceId)
            conferenceManager.removeHistory(this.conferenceInfo)
            this.$eventBus.$emit('conferenceListUpdated');
            this.$modal.hide('conference-info-modal', {destroy: true});
        }
    },
    computed: {
        startTime() {
            let date = new Date(this.conferenceInfo.startTime * 1000);
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
            return !(this.conferenceInfo.owner === this.selfUserId || !this.conferenceInfo.audience || this.conferenceInfo.allowSwitchMode)
        },
        enableDestroy() {
            return this.conferenceInfo.owner === this.selfUserId && this.conferenceInfo.endTime * 1000 > new Date().getTime();
        },
        ended() {
            return this.conferenceInfo.endTime * 1000 < new Date().getTime();
        },
        enableFav() {
            return this.conferenceInfo.owner !== this.selfUserId && new Date().getTime() > this.conferenceInfo.startTime * 1000;
        },
        notStarted() {
            return new Date().getTime() > this.conferenceInfo.startTime * 1000;
        },
        enableJoin() {
            let now = new Date().getTime();
            return now > this.conferenceInfo.startTime * 1000 && now < this.conferenceInfo.endTime * 1000;
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
    background: var(--background-item-normal);
}

.conference-info-container h2 {
    justify-content: center;
    font-weight: normal;
    font-style: normal;
    font-size: var(--font-size-2xl);
    background: var(--background-primary);
    text-align: center;
    padding: 20px 0;
}

.item-container {
    background: var(--background-primary);
    margin-bottom: 20px;
    font-size: var(--font-size-base);
}

.item {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    padding: 12px 20px;
    border-spacing: 20px;
}


/*.item:active {*/
/*    background: var(--background-item-placeholder);*/
/*}*/

.item:not(:last-of-type) {
    border-bottom: 1px solid var(--border-tertiary);
}

.item .desc {
    color: var(--text-secondary);
}

.item label {
    width: 100%;
    display: flex;
    justify-content: space-between;
}

.action-container {
    display: flex;
    margin: 0 8px;
}

button {
    background: var(--background-primary);
    width: 100%;
    text-align: center;
    vertical-align: middle;
    height: 40px;
    line-height: 40px;
    border: none;
}

button:active {
    background: lightgrey;
}

button.destroy {
    margin-right: 8px;
    color: var(--text-danger);
}

</style>
