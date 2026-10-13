<template>
    <section @click.stop="" class="user-info-container">
        <div class="header">
            <div class="desc">
                <div class="flex-row flex-align-center">
                    <h2>{{ userInfo.displayName }}</h2>
                    <p v-if="isExternalDomainUser" class="single-line" style="color: var(--text-warning); border-radius: 2px;  padding: 1px 2px; font-size: 9px">{{ domainName }}</p>
                </div>
                <label style="max-width: 200px; text-overflow: ellipsis" class="single-line">{{ $t('common.wfc_id') + ': ' + userInfo.name }}</label>
            </div>
            <div>
                <img class="avatar" draggable="false" v-bind:src="userInfo.portrait" @click="onAvatarClick"/>
                <input v-if="enableUpdatePortrait" ref="fileInput" @change="onPickFile($event)" class="icon-ion-android-attach" type="file"
                       accept="image/png, image/jpeg"
                       style="display: none">
            </div>
        </div>
        <div class="content">
            <ul>
                <!-- 文件传输助手不显示备注 -->
                <li v-if="isFriend && !isFileHelper">
                    <label>{{ $t('common.alias') }}</label>
                    <div class="input-wrapper">
                        <input @click.stop="" type="text"
                               v-model.trim="friendAlias"
                               @keyup.enter="updateFriendAlias"
                               placeholder="备注名"/>
                        <span class="edit-icon">&#9998;</span>
                    </div>
                </li>
                <li>
                    <label>{{ $t('common.area') }}</label>
                    <div>{{ $t('misc.beijing') }}</div>
                </li>
                <li v-if="departmentOrg">
                    <label>所属部门</label>
                    <div class="department-link" @click.stop="openDepartment">{{ departmentOrg.name }}</div>
                </li>
                <li>
                    <label>{{ $t('common.label') }}</label>
                    <div>{{ $t('misc.test_user') }}</div>
                </li>
                <li v-if="!isSelf && !isFileHelper" class="more-info-row" @click.stop="showMoreInfo">
                    <label>更多信息</label>
                    <div class="more-info-value">和他(她)的群聊 <i class="icon-ion-ios-arrow-right"></i></div>
                </li>
            </ul>
        </div>
        <div class="action">
            <!--            <a href="#"><i class="icon-ion-ios-shuffle" @click="share"></i></a>-->
            <div class="i-button-wrapper i-button-large" @click.prevent="chat">
                <i class="icon-ion-ios-chatboxes-outline"></i>
                发消息
            </div>
            <div class="i-button-wrapper i-button-large" v-if="!isSelf && !isFileHelper" @click.prevent="startAudioCall">
                <i class="icon-ion-ios-telephone-outline"></i>
                语音通话
            </div>
            <div class="i-button-wrapper i-button-large" v-if="!isSelf && !isFileHelper" @click.prevent="startVideoCall">
                <i class="icon-ion-ios-videocam-outline"></i>
                视频通话
            </div>
            <div class="i-button-wrapper i-button-large" v-if="!isFriend && !isFileHelper && sameOrgChecked && !isSameOrganization" @click.prevent="addFriend">
                <i class="icon-ion-ios-personadd-outline"></i>
                添加好友
            </div>
        </div>
    </section>
</template>

<script>
import store from '../../../store';
import Conversation from '../../../wfc/model/conversation';
import ConversationType from '../../../wfc/model/conversationType';
import FriendRequestView from '../../main/contact/FriendRequestView';
import wfc from '../../../wfc/client/wfc';
import MessageContentMediaType from '../../../wfc/messages/messageContentMediaType';
import ModifyMyInfoEntry from '../../../wfc/model/modifyMyInfoEntry';
import ModifyMyInfoType from '../../../wfc/model/modifyMyInfoType';
import IpcSub from '../../../ipc/ipcSub';
import WfcUtil from '../../../wfc/util/wfcUtil';
import Config from '../../../config';
import organizationServerApi from '../../../api/organizationServerApi';
import {previewPortrait} from '../../util/portraitPreview';
import UserMoreInfoDialog from './UserMoreInfoDialog.vue';

// 组织关系按人缓存：同组织判断会在每个资料卡打开时用到，避免重复请求
const relationshipCache = new Map();

function getRelationshipCached(employeeId) {
    if (!relationshipCache.has(employeeId)) {
        relationshipCache.set(employeeId, organizationServerApi.getRelationShip(employeeId).catch(() => []));
    }
    return relationshipCache.get(employeeId);
}

export default {
    name: 'UserCardView',
    props: {
        userInfo: {
            type: Object,
            required: true,
        },
        enableUpdatePortrait: {
            type: Boolean,
            required: false,
        }
    },
    data() {
        return {
            friendAlias: this.userInfo.uid === wfc.getUserId() ? this.userInfo.displayName : this.userInfo.friendAlias,
            sharedMiscState: store.state.misc,
            // 是否已判断出与对方同组织；判断出结果前先不放「加好友」，避免闪一下
            sameOrgChecked: false,
            isSameOrganization: false,
            departmentOrg: null,
        }
    },
    mounted() {
        this.checkSameOrganization();
        this.loadDepartment();
    },
    methods: {
        /** 取对方所属部门，卡片上展示并可跳到联系人页（对齐 wf-enterprise-chat b764b881） */
        async loadDepartment() {
            if (this.isFileHelper || !organizationServerApi.isServiceAvailable) {
                return;
            }
            try {
                const employee = await organizationServerApi.getEmployee(this.userInfo.uid);
                if (employee && employee.organizationId) {
                    const path = await organizationServerApi.getOrganizationPath(employee.organizationId);
                    if (path && path.length) {
                        // path[0] 是直属部门，最后一个是根组织
                        this.departmentOrg = path[0];
                    }
                }
            } catch (e) {
                console.warn('load user department failed', e);
            }
        },
        openDepartment() {
            if (!this.departmentOrg) {
                return;
            }
            store.setCurrentOrganization(this.departmentOrg);
            if (this.$router.currentRoute.path !== '/home/contact') {
                this.$router.replace('/home/contact');
            }
            this.close();
        },
        /** 「更多信息」：和他(她)的群聊（对齐 wf-enterprise-chat d2a8e82e、990ac36d） */
        showMoreInfo() {
            this.$modal.show(UserMoreInfoDialog, {userId: this.userInfo.uid}, null, {
                name: 'user-more-info-modal',
                width: 380,
                height: 'auto',
                clickToClose: true,
            });
        },
        /** 取双方组织关系，有共同节点即同组织同事（对齐 wf-enterprise-chat 624d0210） */
        async checkSameOrganization() {            const myId = wfc.getUserId();
            if (!myId || this.userInfo.uid === myId || this.isFileHelper || !organizationServerApi.isServiceAvailable) {
                this.sameOrgChecked = true;
                return;
            }
            try {
                const [mine, theirs] = await Promise.all([
                    getRelationshipCached(myId),
                    getRelationshipCached(this.userInfo.uid),
                ]);
                const mineOrgs = new Set((mine || []).map(r => r.organizationId));
                this.isSameOrganization = (theirs || []).some(r => mineOrgs.has(r.organizationId));
            } catch (e) {
                // 失败按非同组织处理，退回加好友
                this.isSameOrganization = false;
            } finally {
                this.sameOrgChecked = true;
            }
        },
        share() {
            // TODO share
            this.close();
        },
        chat() {
            let conversation = new Conversation(ConversationType.Single, this.userInfo.uid, 0);
            if (store.isConversationInCurrentWindow(conversation)) {
                store.setCurrentConversation(conversation)

                // 跳转到会话列表页
                if (this.$router.currentRoute.path !== '/home') {
                    this.$router.replace('/home');
                }
            } else {
                IpcSub.startConversation(conversation);
            }
            this.close();
        },
        startAudioCall() {
            this.close();
            let conversation = new Conversation(ConversationType.Single, this.userInfo.uid, 0);
            this.$startVoipCall({ audioOnly: true, conversation: conversation });
        },

        startVideoCall() {
            this.close();
            let conversation = new Conversation(ConversationType.Single, this.userInfo.uid, 0);
            this.$startVoipCall({ audioOnly: false, conversation: conversation });
        },
        addFriend() {
            this.close();
            this.$modal.show(
                FriendRequestView,
                {
                    userInfo: this.userInfo,
                }, null,
                {
                    name: 'friend-request-modal',
                    width: 600,
                    height: 250,
                    clickToClose: false,
                }, {})
        },
        updateFriendAlias() {
            if (this.userInfo.uid === wfc.getUserId()) {
                if (this.friendAlias !== this.userInfo.displayName) {
                    let entry = new ModifyMyInfoEntry();
                    entry.type = ModifyMyInfoType.Modify_DisplayName;
                    entry.value = this.friendAlias;
                    wfc.modifyMyInfo([entry]);
                }
            } else {
                if (this.friendAlias !== this.userInfo.friendAlias) {
                    wfc.setFriendAlias(this.userInfo.uid, this.friendAlias,
                        () => {
                            // do nothing
                        },
                        (error) => {
                            // do nothing
                        })
                }
            }
            this.close();
        },
        close() {
            this.$emit('close');
        },

        pickFile() {
            if (!this.enableUpdatePortrait) {
                return;
            }
            this.$refs['fileInput'].click();
        },
        /** 点头像：自己的换头像，别人的看大图（对齐 wf-enterprise-chat 7cfc2b58、96182762） */
        onAvatarClick() {
            if (this.enableUpdatePortrait) {
                this.pickFile();
                return;
            }
            previewPortrait(this.userInfo.portrait, this.userInfo.displayName);
        },
        onPickFile(event) {
            // this.batchProcess(e.target.files[0]);
            let file = event.target.files[0];

            wfc.uploadMedia(file.name, file, MessageContentMediaType.Portrait, (url) => {
                let entry = new ModifyMyInfoEntry();
                entry.type = ModifyMyInfoType.Modify_Portrait;
                entry.value = url;

                wfc.modifyMyInfo([entry], () => {
                    //this.userInfo.portrait = url;
                    // 会触发userInfosUpdate 通知
                }, (err) => {
                    console.log('modify my info error', err)
                })
            }, (err) => {
                console.log('err', err)
            }, (p, t) => {
                console.log('progress', p, t)
            })
        },

    },

    computed: {
        isFriend() {
            return wfc.getUserId() === this.userInfo.uid || wfc.isMyFriend(this.userInfo.uid)
        },
        isSelf() {
            return this.userInfo.uid === wfc.getUserId();
        },
        // 文件传输助手是服务端内置机器人：不查好友/组织，动作区只留发消息（对齐 wf-enterprise-chat 9a5a67b0）
        isFileHelper() {
            return this.userInfo.uid === Config.FILE_HELPER_ID;
        },
        isExternalDomainUser() {
            let user = this.userInfo;
            return WfcUtil.isExternal(user.uid);

        },
        domainName() {
            let user = this.userInfo;
            if (WfcUtil.isExternal(user.uid)) {
                let domainId = WfcUtil.getExternalDomainId(user.uid);
                let domainInfo = wfc.getDomainInfo(domainId);
                return '@' + domainInfo.name;
            }
            return '';
        },
    }
};
</script>

<style lang="css" scoped>
.user-info-container {
    pointer-events: auto !important;
    width: 300px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    color: var(--text-primary);
    background-color: var(--background-tooltip);
}

.user-info-container .avatar {
    width: 60px;
    height: 60px;
    cursor: pointer;
}

.header {
    width: calc(100% - 40px);
    margin: 8px 20px;
    padding-bottom: 20px;
    display: flex;
    justify-content: space-between;
    border-bottom: 1px solid var(--border-primary);
}


.header .desc {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: flex-start;
}

.content {
    width: 100%;
    text-align: left;
}

.content ul {
    list-style: none;
    margin: 8px 20px;
}

.content ul li {
    margin-left: 0;
    height: 40px;
    line-height: 40px;
    display: flex;
}

.content ul li label {
    width: 40px;
    color: var(--text-secondary);
}

.content ul li .input-wrapper > input {
    padding: 2px 4px;
    color: var(--text-primary);
    font-size: var(--font-size-sm);
}

.content ul li .input-wrapper > input:focus,
.content ul li .input-wrapper > input:active {
    border: 1px solid var(--border-active);
}

.content ul li > div:not(.input-wrapper) {
    display: inline-block;
    flex: 1;
    color: var(--text-primary);
}

.action {
    width: 100%;
    display: flex;
    justify-content: center;

    padding-top: 20px;
    padding-bottom: 8px;
}

.action i {
    font-size: 26px;
    color: var(--text-link);
}

.action div {
    margin: 0 8px;
    color: var(--text-link);
}

.department-link {
    color: var(--text-link);
    cursor: pointer;
}

.more-info-row {
    cursor: pointer;
}

.more-info-value {
    color: var(--text-link);
}

</style>
