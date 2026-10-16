<template>
    <section ref="root" @click.stop="closePopupMenus" class="user-info-container" :class="{'page-mode': pageMode}">
        <!-- 布局参照微信 PC 的资料卡：头像在左、名字账号在右，下面分段列信息，底部一排图标操作。
             注意模板根上只能有这一个 section（开发模式下注释也算节点，放在外面就成了多根，$el 不再是元素） -->
        <div class="header">
            <div class="avatar-wrapper">
                <img class="avatar" draggable="false" v-bind:src="userInfo.portrait" @click.stop="onAvatarClick"/>
                <!-- 自己的头像：先出「查看 / 修改」（对齐 wf-enterprise-chat 7cfc2b58） -->
                <ul v-if="showAvatarMenu" class="popup-menu avatar-menu" @click.stop>
                    <li @click="viewOwnAvatar">查看</li>
                    <li @click="modifyOwnAvatar">修改</li>
                </ul>
                <input v-if="enableUpdatePortrait" ref="fileInput" @change="onPickFile($event)" class="icon-ion-android-attach" type="file"
                       accept="image/png, image/jpeg"
                       style="display: none">
            </div>
            <div class="desc">
                <div class="name-line">
                    <h2 class="name single-line">{{ userInfo.friendAlias || userInfo.displayName }}</h2>
                    <span v-if="isExternalDomainUser" class="domain-tag single-line">{{ domainName }}</span>
                </div>
                <!-- 设了备注时大字显示备注，昵称挪到下面一行（同微信） -->
                <p v-if="userInfo.friendAlias" class="info-line single-line">昵称：{{ userInfo.displayName }}</p>
                <p class="info-line single-line">{{ $t('common.wfc_id') + '：' + userInfo.name }}</p>
            </div>
            <div v-if="!isFileHelper" class="more-wrapper">
                <i class="more-button icon-ion-android-more-horizontal" @click.stop="toggleMoreMenu"></i>
                <ul v-if="showMoreMenu" class="popup-menu more-menu" @click.stop>
                    <li @click="shareUserCard">{{ $t('misc.share_to_friend') }}</li>
                    <li v-if="isFriend && !isSelf" class="danger" @click="deleteFriend">{{ $t('contact.delete_friend') }}</li>
                </ul>
            </div>
        </div>
        <div v-if="showAliasRow || departmentOrgs.length || showCommonGroupsRow" class="info-section">
            <!-- 好友设置备注，自己这一行改的是自己的昵称；文件传输助手不显示 -->
            <div v-if="showAliasRow" class="info-row">
                <label class="row-label">{{ isSelf ? '昵称' : $t('common.alias') }}</label>
                <div class="row-value input-wrapper">
                    <input @click.stop="" type="text"
                           v-model.trim="friendAlias"
                           @keyup.enter="$event.target.blur()"
                           @blur="updateFriendAlias"
                           :placeholder="isSelf ? '设置昵称' : '添加备注名'"/>
                    <span class="edit-icon">&#9998;</span>
                </div>
            </div>
            <!-- 一个人可能挂在多个部门下，逐个列出，点一个去联系人页打开它（对齐 wf-enterprise-chat b764b881） -->
            <div v-if="departmentOrgs.length" class="info-row department-row">
                <label class="row-label">所属部门</label>
                <div class="row-value department-list">
                    <div v-for="org in departmentOrgs" :key="org.id" class="department-link single-line"
                         @click.stop="openDepartment(org)">{{ org.name }}
                    </div>
                </div>
            </div>
            <!-- 共同群聊（对齐 wf-enterprise-chat d2a8e82e、990ac36d）：点开在卡片旁边弹出群列表，同微信 -->
            <div v-if="showCommonGroupsRow" class="info-row">
                <label class="row-label">共同群聊</label>
                <tippy v-if="commonGroups && commonGroups.length"
                       ref="commonGroupsTippy"
                       class="row-value"
                       interactive
                       trigger="click"
                       placement="right"
                       theme="light"
                       animation="fade"
                       @state="onCommonGroupsTippyState">
                    <div class="common-groups-trigger" :class="{active: commonGroupsShown}">
                        <span>{{ commonGroups.length }}个</span>
                        <i class="row-chevron icon-ion-ios-arrow-right"></i>
                    </div>
                    <template #content>
                        <div class="common-groups-popover">
                            <div class="popover-title">{{ commonGroups.length }}个共同群聊</div>
                            <ul class="common-group-list">
                                <li v-for="group in commonGroups" :key="group.target" @click.stop="openGroup(group)">
                                    <img class="group-avatar" :src="group.portrait" alt="" draggable="false" @error="onGroupAvatarError"/>
                                    <span class="single-line">{{ group._displayName || group.name }}</span>
                                </li>
                            </ul>
                        </div>
                    </template>
                </tippy>
                <div v-else class="row-value common-groups-trigger disabled">{{ commonGroups ? '0个' : '' }}</div>
            </div>
        </div>
        <div class="action">
            <div class="action-item" @click="chat">
                <i class="icon-ion-ios-chatbubble-outline"></i>
                <span>发消息</span>
            </div>
            <div class="action-item" v-if="!isSelf && !isFileHelper" @click="startAudioCall">
                <i class="icon-ion-ios-telephone-outline"></i>
                <span>语音通话</span>
            </div>
            <div class="action-item" v-if="!isSelf && !isFileHelper" @click="startVideoCall">
                <i class="icon-ion-ios-videocam-outline"></i>
                <span>视频通话</span>
            </div>
            <div class="action-item" v-if="canAddFriend" @click="addFriend">
                <i class="icon-ion-ios-personadd-outline"></i>
                <span>添加好友</span>
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
import AvatarCropper from './AvatarCropper.vue';
import CardMessageContent from '../../../wfc/messages/cardMessageContent';
import Message from '../../../wfc/messages/message';
import ForwardType from '../conversation/message/forward/ForwardType';

// 所有资料卡共用一个 IntersectionObserver，卡片显示出来时回调
let visibilityObserver = null;
const visibilityCallbacks = new WeakMap();

function observeVisible(el, callback) {
    if (!(el instanceof Element)) {
        return;
    }
    if (!visibilityObserver) {
        visibilityObserver = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                const cb = entry.isIntersecting && visibilityCallbacks.get(entry.target);
                if (cb) {
                    cb();
                }
            });
        });
    }
    visibilityCallbacks.set(el, callback);
    visibilityObserver.observe(el);
}

function unobserveVisible(el) {
    if (visibilityObserver && visibilityCallbacks.has(el)) {
        visibilityCallbacks.delete(el);
        visibilityObserver.unobserve(el);
    }
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
        },
        // 联系人页右栏直接铺开显示（不是浮层卡片），样式沿用原来的联系人详情页
        pageMode: {
            type: Boolean,
            default: false,
        },
    },
    data() {
        return {
            friendAlias: this.userInfo.uid === wfc.getUserId() ? this.userInfo.displayName : this.userInfo.friendAlias,
            sharedMiscState: store.state.misc,
            sharedContactState: store.state.contact,
            // 是否已判断出与对方同组织；判断出结果前先不放「加好友」，避免闪一下
            sameOrgChecked: false,
            isSameOrganization: false,
            departmentOrgs: [],
            showAvatarMenu: false,
            showMoreMenu: false,
            // null 表示还没取到
            commonGroups: null,
            commonGroupsShown: false,
        }
    },
    mounted() {
        // tippy 的内容是常驻的：消息列表里每条消息、组织结构里每个成员都挂着一张资料卡。所属部门、是否同组织、
        // 共同群聊都要发请求，所以等卡片真正显示出来才取。部门和组织关系取一次就够，共同群聊每次弹出都刷新一次
        observeVisible(this.$refs.root, () => {
            if (!this._orgInfoRequested) {
                this._orgInfoRequested = true;
                this.checkSameOrganization();
                this.loadDepartment();
            }
            if (this.showCommonGroupsRow) {
                this.loadCommonGroups();
            }
        });
    },
    beforeUnmount() {
        unobserveVisible(this.$refs.root);
    },
    methods: {
        /**
         * 取对方所属部门：组织关系里的直属部门（bottom）可能不止一个，逐个列出（对齐 wf-enterprise-chat b764b881）。
         * 老服务端的组织关系没有 bottom 标记时，退回员工资料里的主部门。
         */
        async loadDepartment() {
            if (this.isFileHelper || !organizationServerApi.isServiceAvailable) {
                return;
            }
            try {
                const relationships = await organizationServerApi.getRelationshipCached(this.userInfo.uid);
                let orgIds = relationships.filter(r => r.bottom).map(r => r.organizationId);
                if (!orgIds.length) {
                    const employee = await organizationServerApi.getEmployee(this.userInfo.uid);
                    if (employee && employee.organizationId) {
                        orgIds = [employee.organizationId];
                    }
                }
                orgIds = [...new Set(orgIds)];
                if (orgIds.length) {
                    const orgs = await organizationServerApi.getOrganizations(orgIds);
                    this.departmentOrgs = (orgs || []).filter(o => o && o.id);
                }
            } catch (e) {
                console.warn('load user department failed', e);
            }
        },
        openDepartment(org) {
            if (!org) {
                return;
            }
            store.setCurrentOrganization(org);
            if (this.$router.currentRoute.value.path !== '/home/contact') {
                this.$router.replace('/home/contact');
            }
            this.close();
        },
        loadCommonGroups() {
            const uid = this.userInfo.uid;
            wfc.getCommonGroups(uid, (groupIds) => {
                if (uid !== this.userInfo.uid) {
                    return;
                }
                this.commonGroups = (groupIds || []).map(id => {
                    let info = wfc.getGroupInfo(id, false);
                    return info ? info : {target: id, name: id, portrait: Config.DEFAULT_GROUP_PORTRAIT_URL};
                });
            }, (err) => {
                console.warn('load common groups failed', err);
            });
        },
        openGroup(group) {
            this.openConversation(new Conversation(ConversationType.Group, group.target, 0));
        },
        onCommonGroupsTippyState(state) {
            this.commonGroupsShown = state.isVisible;
        },
        onGroupAvatarError(e) {
            e.target.src = Config.DEFAULT_GROUP_PORTRAIT_URL;
        },
        async checkSameOrganization() {
            if (this.isNormalUser) {
                this.isSameOrganization = await organizationServerApi.isSameOrganization(this.userInfo.uid);
            }
            this.sameOrgChecked = true;
        },
        closePopupMenus() {
            this.showAvatarMenu = false;
            this.showMoreMenu = false;
        },
        toggleMoreMenu() {
            this.showAvatarMenu = false;
            this.showMoreMenu = !this.showMoreMenu;
        },
        shareUserCard() {
            this.showMoreMenu = false;
            this.close();
            let user = this.userInfo;
            let content = new CardMessageContent(0, user.uid, user.displayName, user.portrait, wfc.getUserId());
            content.name = user.name;
            this.$forwardMessage({
                forwardType: ForwardType.NORMAL,
                messages: [new Message(null, content)],
            });
        },
        deleteFriend() {
            this.showMoreMenu = false;
            this.close();
            let user = this.userInfo;
            let displayName = user.friendAlias || user.displayName;
            this.$alert({
                title: '删除好友?',
                content: '删除好友「' + displayName + '」后，与他的聊天记录也将被清空',
                confirmText: '确定',
                confirmButtonType: 'danger',
                cancelText: '取消',
                cancelCallback: () => {
                    // do nothing
                },
                confirmCallback: () => {
                    store.deleteFriend(user.uid);
                    let currentFriend = this.sharedContactState.currentFriend;
                    if (currentFriend && currentFriend.uid === user.uid) {
                        store.setCurrentFriend(null);
                    }
                }
            });
        },
        chat() {
            this.openConversation(new Conversation(ConversationType.Single, this.userInfo.uid, 0));
        },
        openConversation(conversation) {
            if (store.isConversationInCurrentWindow(conversation)) {
                store.setCurrentConversation(conversation)

                // 跳转到会话列表页
                if (this.$router.currentRoute.value.path !== '/home') {
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
            if (!this.canAddFriend) {
                return;
            }
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
        /** 备注回车或失焦即保存，卡片不关（同微信） */
        updateFriendAlias() {
            if (!this.showAliasRow) {
                return;
            }
            if (this.isSelf) {
                if (this.friendAlias && this.friendAlias !== this.userInfo.displayName) {
                    let entry = new ModifyMyInfoEntry();
                    entry.type = ModifyMyInfoType.Modify_DisplayName;
                    entry.value = this.friendAlias;
                    wfc.modifyMyInfo([entry]);
                }
                return;
            }
            if ((this.friendAlias || '') !== (this.userInfo.friendAlias || '')) {
                wfc.setFriendAlias(this.userInfo.uid, this.friendAlias,
                    () => {
                        // do nothing
                    },
                    (error) => {
                        // do nothing
                    })
            }
        },
        close() {
            if (this.$refs.commonGroupsTippy) {
                this.$refs.commonGroupsTippy.hide();
            }
            this.$emit('close');
        },

        pickFile() {
            if (!this.enableUpdatePortrait) {
                return;
            }
            this.$refs['fileInput'].click();
        },
        /** 点头像：自己的出「查看 / 修改」，别人的看大图（对齐 wf-enterprise-chat 7cfc2b58、96182762） */
        onAvatarClick() {
            if (this.enableUpdatePortrait) {
                this.showMoreMenu = false;
                this.showAvatarMenu = !this.showAvatarMenu;
                return;
            }
            previewPortrait(this.userInfo.portrait, this.userInfo.displayName);
        },
        viewOwnAvatar() {
            this.showAvatarMenu = false;
            previewPortrait(this.userInfo.portrait, this.userInfo.displayName);
        },
        modifyOwnAvatar() {
            this.showAvatarMenu = false;
            this.pickFile();
        },
        onPickFile(event) {
            let file = event.target.files[0];
            if (!file) {
                return;
            }
            // 选完图先进裁剪页（480×480、JPEG 70），对齐 wf-enterprise-chat ac77e5b6、a64c8faf
            event.target.value = '';
            let src = URL.createObjectURL(file);
            this.$modal.show(AvatarCropper, {
                src,
                onConfirm: (blob) => {
                    this.$modal.hide('avatar-cropper-modal');
                    URL.revokeObjectURL(src);
                    this.uploadPortrait(new File([blob], 'avatar.jpg', {type: 'image/jpeg'}));
                },
                onCancel: () => {
                    this.$modal.hide('avatar-cropper-modal');
                    URL.revokeObjectURL(src);
                },
            }, null, {
                name: 'avatar-cropper-modal',
                width: 380,
                height: 'auto',
                clickToClose: false,
            });
        },

        uploadPortrait(file) {
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
        isNormalUser() {
            return this.userInfo.type === 0 && !this.isFileHelper;
        },
        isFriend() {
            return this.isNormalUser
                && (wfc.getUserId() === this.userInfo.uid || wfc.isMyFriend(this.userInfo.uid));
        },
        canAddFriend() {
            return this.isNormalUser && !this.isFriend && this.sameOrgChecked && !this.isSameOrganization;
        },
        isSelf() {
            return this.userInfo.uid === wfc.getUserId();
        },
        // 文件传输助手是服务端内置机器人：不查好友/组织，动作区只留发消息（对齐 wf-enterprise-chat 9a5a67b0）
        isFileHelper() {
            return this.userInfo.uid === Config.FILE_HELPER_ID;
        },
        showAliasRow() {
            return this.isFriend && !this.isFileHelper;
        },
        showCommonGroupsRow() {
            return !this.isSelf && !this.isFileHelper;
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
    width: 320px;
    padding: 16px 12px 4px;
    display: flex;
    flex-direction: column;
    text-align: left;
    color: var(--text-primary);
    background-color: var(--background-tooltip);
}

.header {
    position: relative;
    display: flex;
    align-items: flex-start;
    margin: 0 12px;
    padding-bottom: 20px;
}

.avatar-wrapper {
    position: relative;
    flex-shrink: 0;
}

.user-info-container .avatar {
    display: block;
    width: 64px;
    height: 64px;
    object-fit: cover;
    border-radius: var(--default-portrait-border-radius);
    cursor: pointer;
}

.desc {
    flex: 1;
    min-width: 0;
    margin-left: 14px;
    /* 右上角留给「···」 */
    padding-right: 28px;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
}

.name-line {
    max-width: 100%;
    display: flex;
    align-items: center;
    min-width: 0;
}

.name {
    min-width: 0;
    margin: 0 0 6px;
    font-size: calc(18px * var(--font-scale));
    font-weight: 500;
    line-height: 1.4;
}

.domain-tag {
    flex-shrink: 0;
    max-width: 100px;
    margin: 0 0 6px 6px;
    padding: 1px 2px;
    border-radius: 2px;
    font-size: 9px;
    color: var(--text-warning);
}

.info-line {
    max-width: 100%;
    font-size: var(--font-size-sm);
    line-height: 1.7;
    color: var(--text-secondary);
}

.more-wrapper {
    position: absolute;
    top: 2px;
    right: -4px;
}

.more-button {
    display: block;
    padding: 0 6px;
    font-size: 20px;
    line-height: 24px;
    border-radius: var(--radius-sm);
    color: var(--text-secondary);
    cursor: pointer;
}

.more-button:hover {
    background-color: var(--background-item-hover);
}

.popup-menu {
    position: absolute;
    top: 100%;
    z-index: 10;
    margin-top: 4px;
    padding: 4px 0;
    min-width: 72px;
    list-style: none;
    white-space: nowrap;
    border-radius: var(--radius-sm);
    background-color: var(--background-primary);
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15);
}

.avatar-menu {
    left: 0;
}

.more-menu {
    right: 0;
}

.popup-menu li {
    padding: 6px 14px;
    font-size: var(--font-size-sm);
    cursor: pointer;
}

.popup-menu li:hover {
    background-color: var(--background-item-hover);
}

.popup-menu li.danger {
    color: var(--text-danger);
}

.info-section {
    margin: 0 12px;
    padding: 10px 0;
    border-top: 1px solid var(--border-primary);
}

.info-row {
    display: flex;
    align-items: center;
    min-height: 36px;
    font-size: var(--font-size-base);
}

.row-label {
    width: 72px;
    flex-shrink: 0;
    color: var(--text-secondary);
}

.row-value {
    flex: 1;
    min-width: 0;
}

.info-row .input-wrapper > input {
    height: 28px;
    padding: 0 4px;
    margin-left: -5px;
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    color: var(--text-primary);
    font-size: var(--font-size-base);
}

.info-row .input-wrapper > input::placeholder {
    color: var(--text-tertiary);
}

.info-row .input-wrapper > input:focus {
    border-color: var(--border-active);
}

.department-row {
    align-items: flex-start;
    padding: 8px 0;
}

.department-row .row-label {
    line-height: 20px;
}

.department-list {
    max-height: 60px;
    overflow-y: auto;
}

.department-link {
    line-height: 20px;
    color: var(--text-link);
    cursor: pointer;
}

.common-groups-trigger {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 32px;
    margin-left: -8px;
    padding: 0 6px 0 8px;
    border-radius: var(--radius-sm);
    cursor: pointer;
}

.common-groups-trigger:hover,
.common-groups-trigger.active {
    background-color: var(--background-item-hover);
}

.common-groups-trigger.disabled {
    cursor: default;
    color: var(--text-secondary);
    background-color: transparent;
}

.common-groups-popover {
    width: 260px;
    padding: 6px 0 2px;
    text-align: left;
}

.popover-title {
    padding: 2px 0 10px;
    text-align: center;
    font-size: var(--font-size-base);
    font-weight: 500;
}

.common-group-list {
    list-style: none;
    margin: 0;
    padding: 0;
    max-height: 300px;
    overflow-y: auto;
}

.common-group-list li {
    display: flex;
    align-items: center;
    padding: 8px;
    border-radius: var(--radius-sm);
    font-size: var(--font-size-base);
    cursor: pointer;
}

.common-group-list li:hover {
    background-color: var(--background-item-hover);
}

.common-group-list .group-avatar {
    width: 36px;
    height: 36px;
    flex-shrink: 0;
    margin-right: 10px;
    border-radius: var(--default-portrait-border-radius);
}

.action {
    margin: 0 12px;
    padding: 14px 0 10px;
    display: flex;
    justify-content: space-around;
    border-top: 1px solid var(--border-primary);
}

.action-item {
    min-width: 64px;
    padding: 6px 4px;
    display: flex;
    flex-direction: column;
    align-items: center;
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    color: var(--text-link);
    cursor: pointer;
}

.action-item:hover {
    background-color: var(--background-item-hover);
}

.action-item i {
    color: var(--text-link);
    font-size: 28px;
    line-height: 32px;
    margin-bottom: 4px;
}

/* --- 联系人详情页：尺寸同原来的详情页（FrienRequestDetailView 仍是这套） --- */
.user-info-container.page-mode {
    width: 400px;
    padding: 0;
    background-color: transparent;
}

.page-mode .header {
    margin: 0;
    min-height: 75px;
    padding-bottom: 16px;
    align-items: center;
}

.page-mode .avatar {
    width: 60px;
    height: 60px;
}

.page-mode .desc {
    margin-left: 20px;
}

.page-mode .name {
    margin-bottom: 4px;
    font-size: var(--font-size-lg);
    font-weight: normal;
}

.page-mode .info-line {
    color: var(--text-secondary-strong);
}

.page-mode .info-section {
    margin: 0;
    padding: 20px 0 8px;
}

.page-mode .info-row {
    min-height: 40px;
    font-size: var(--font-size-xs);
}

.page-mode .row-label {
    width: 48px;
    margin-right: 20px;
    text-align: justify;
    text-align-last: justify;
    color: var(--text-secondary-strong);
}

.page-mode .info-row .input-wrapper > input {
    font-size: var(--font-size-sm);
}

.page-mode .action {
    margin: 0;
    padding: 30px 0 0;
    justify-content: center;
}

.page-mode .action-item {
    width: calc(56px * var(--layout-scale-cap));
    height: calc(56px * var(--layout-scale-cap));
    min-width: 0;
    margin: 0 16px;
    padding: 0;
    justify-content: space-around;
    font-size: var(--font-size-xs);
}

.page-mode .action-item:hover {
    background-color: var(--i-button-hover-bg);
}

.page-mode .action-item i {
    font-size: var(--font-size-2xl);
    line-height: normal;
    margin-bottom: 0;
}

</style>
