<template>
    <div class="participant-list-container"
    >
        <div v-if="true" @click="invite"
             class="action-item">
            <div class="icon">+</div>
            <p>邀请新参与者</p>
        </div>
        <div v-if="false" @click="invite"
             class="action-item">
            <div class="icon">-</div>
            <p>移除参与者</p>
        </div>
        <ul>
            <li v-for="user in participants" :key="user.uid">
                <tippy
                    :to="'user-' + user.uid"
                    interactive
                    theme="light"
                    :animate-fill="false"
                    placement="left"
                    distant="7"
                    animation="fade"
                    trigger="click"
                >
                    <UserCardView :user-info="user"/>
                </tippy>
                <div class="participant-user"
                     :ref="'userCardTippy-'+user.uid"
                     :name="'user-'+user.uid">
                    <div class="avatar-container">
                        <img class="avatar" :src="user.portrait" alt="">
                        <div v-if=" selfUserId === session.host && !user._isHost" @click.stop="kickoff(user)"
                             class="icon">
                            -
                        </div>
                    </div>
                    <span class="single-line name"> {{ userName(user) }}</span>
                    <span class="single-line label host"
                          v-if="user._isHost">主持人</span>
                    <span v-else class="single-line label"
                          @click.stop="requestChangeMode(user)"
                          v-bind:class="{audience: user._isAudience}">{{
                            user._isAudience ? '听众' : '互动成员'
                        }}</span>
                </div>
            </li>
        </ul>
    </div>
</template>

<script>
import ConferenceInviteMessageContent from "../../../wfc/av/messages/conferenceInviteMessageContent";
import Message from "../../../wfc/messages/message";
import {isElectron} from "../../../platform";
import ForwardType from "../../main/conversation/message/forward/ForwardType";
import localStorageEmitter from "../../../ipc/localStorageEmitter";
import wfc from "../../../wfc/client/wfc";
import UserCardView from "../../main/user/UserCardView";

export default {
    name: "ConferenceParticipantListView",
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
        }
    },
    components: {
        UserCardView
    },
    methods: {
        invite() {
            let callSession = this.session;
            let inviteMessageContent = new ConferenceInviteMessageContent(callSession.callId, callSession.host, callSession.title, callSession.desc, callSession.startTime, callSession.audioOnly, callSession.defaultAudience, callSession.advance, callSession.pin)
            if (isElectron()) {
                let message = new Message(null, inviteMessageContent);
                this.$forwardMessage({
                    forwardType: ForwardType.NORMAL,
                    messages: [message]
                });
            } else {
                console.log('invite----')
                localStorageEmitter.send('inviteConferenceParticipant', {messagePayload: inviteMessageContent.encode()})
            }
            this.showParticipantList = false;
        },

        requestChangeMode(user) {
            if (user.uid === this.selfUserInfo.uid) {
                // TODO 需要根据实际产品定义处理，这儿直接禁止
                //this.session.switchAudience(!user._isAudience);
                return;
            }
            this.$alert({
                content: user._isAudience ? `邀请${this.userName(user)}参与互动?` : `取消${this.userName(user)}参与互动?`,
                cancelCallback: () => {
                    // do nothing
                },
                confirmCallback: () => {
                    this.session.requestChangeMode(user.uid, !user._isAudience);
                }
            })
        },

        kickoff(user) {
            this.$alert({
                content: `确认将${this.userName(user)}移除会议?`,
                cancelCallback: () => {
                    // do nothing
                },
                confirmCallback: () => {
                    this.session.kickoff(user.uid)
                }
            })
        },

        userName(user) {
            let name = '';
            if (user.groupAlias) {
                name = user.groupAlias;
            } else if (user.friendAlias) {
                name = user.friendAlias;
            } else if (user.displayName) {
                name = user.displayName;
            } else {
                name = user.name;
            }
            return name;
        },

    }
}
</script>

<style scoped>
.participant-list-container {
    display: none;
    width: 250px;
    height: 100%;
    overflow: auto;
    background-color: #ffffffe5;
    backdrop-filter: blur(6px);
    border-left: 1px solid #e6e6e6;
}

.participant-list-container.active {
    display: flex;
    flex-direction: column;
}

.participant-list-container .action-item {
    height: 50px;
    display: flex;
    padding: 5px 0 0 10px;
    align-items: center;
}

.participant-list-container .action-item .icon {
    width: 40px;
    height: 40px;
    display: flex;
    justify-content: center;
    align-items: center;
    border-radius: 3px;
    border: 1px dashed #d6d6d6;
    margin-right: 10px;
}

.participant-user {
    display: flex;
    align-items: center;
    padding: 5px 0 0 10px;
}

.participant-user .name {
    flex: 1;
}

.participant-user .label {
    color: green;
    font-size: 12px;
    border: 1px solid green;
    border-radius: 2px;
    padding: 2px 5px;
    margin-right: 10px;
}

.participant-user .audience {
    color: gray;
    border: 1px solid gray;
}

.participant-user .host {
    color: #4168e0;
    border: 1px solid #4168e0;
}


.participant-user .avatar {
    width: 40px;
    height: 40px;
    border-radius: 3px;
    margin-right: 10px;
}

.avatar-container {
    position: relative;
}

.avatar-container .icon {
    width: 40px;
    height: 40px;
    display: none;
    justify-content: center;
    align-items: center;
    border-radius: 3px;
    border: 1px dashed #d6d6d6;
    margin-right: 10px;
}

.avatar-container:hover .icon {
    display: flex;
    position: absolute;
    left: 0;
    top: 0;
    color: white;
    background: #e0d6d6d6;
}

</style>
