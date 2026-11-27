<template>
    <div class="pick-user-container">
        <section class="user-list-panel">
            <div class="input-container">
                <input type="text" :placeholder="$t('common.search')" v-model="query">
            </div>
            <div class="user-list-container">
                <div class="back" @click="backPickConversation">
                    <p>{{ $t('common.back') }}</p>
                </div>
                <!-- 与「发起群聊」（PickUserView）一致：组织服务可用时，可从组织结构选人 / 选部门 -->
                <div v-if="orgServiceAvailable" class="pick-category-container">
                    <!-- 机器人：组织架构入口下独立的分组，只在最外层显示 -->
                    <RobotPickEntry :visible="!insideOrganization"
                                    :search-query="query"
                                    @open-change="robotViewOpened = $event"/>

                    <!-- 机器人列表打开时把组织树和联系人收起来，返回后原样恢复 -->
                    <div v-show="!robotViewOpened">
                        <CheckableOrganizationTreeView :search-query="query"
                                                       @depth-change="insideOrganization = $event > 1"/>

                        <div class="contact-category-section">
                            <div @click="expandContactSection = !expandContactSection" class="category-item-container">
                                <i class="arrow right" v-bind:class="{down: expandContactSection}"></i>
                                <div class="category-item">
                                    <span class="title">联系人</span>
                                    <span class="desc">{{ filteredUsers.length }}</span>
                                </div>
                            </div>
                            <div v-show="expandContactSection">
                                <CheckableUserListView :enable-pick="true"
                                                       :users="filteredUsers"
                                                       :show-category-label="!query || !query.trim()"
                                                       :padding-left="'20px'"
                                                       :virtual-list-style="{ 'max-height': '600px', 'overflow-y': 'auto' }"
                                                       :enable-category-label-sticky="true"/>
                            </div>
                        </div>
                    </div>
                </div>
                <CheckableUserListView v-else
                                       class="user-list"
                                       :enable-pick="true"
                                       :users="filteredUsers"
                                       :show-category-label="!query || !query.trim()"
                                       :padding-left="'20px'"
                                       :enable-category-label-sticky="true"/>
            </div>
        </section>
        <section class="checked-user-list-container">
            <header>
                <h2>{{ $t('conversation.forward_title') }}</h2>
                <div>
                    <span v-if="sharedPickState.users.length === 0">{{ $t('conversation.picked_contact') }}</span>
                    <span v-else>{{ $t('conversation.picked_contact') + this.sharedPickState.users.length }}</span>
                    <span v-if="sharedPickState.organizations.length">{{ '组织: ' + sharedPickState.organizations.length }}</span>
                </div>
            </header>
            <div class="content">
                <div class="picked-user-container" v-for="(user, index) in sharedPickState.users" :key="index">
                    <div class="picked-user">
                        <img class="avatar" :src="user.portrait" alt="">
                        <button @click="unpick(user)" class="unpick-button">x</button>
                    </div>
                    <span class="name single-line">{{ user._displayName || user.displayName }}</span>
                </div>
                <div class="picked-user-container" v-for="org in sharedPickState.organizations" :key="'org-' + org.id">
                    <div class="picked-user">
                        <img class="avatar" :src="org.portrait ? org.portrait : defaultOrganizationPortraitUrl" alt="">
                        <button @click="unpickOrganization(org)" class="unpick-button">x</button>
                    </div>
                    <span class="name single-line">{{ org.name }}</span>
                </div>
            </div>

            <ForwardMessageView ref="forwardMessageView" v-if="hasPicked"
                                :forward-type="forwardType"
                                :messages="messages"/>
            <footer>
                <button @click="cancel" class="cancel">{{ $t('common.cancel') }}</button>
                <button @click="confirm" class="confirm">{{ $t('common.send') }}</button>
            </footer>
        </section>
    </div>
</template>

<script>
import store from "../../../../../store";
import ForwardMessageView from "./ForwardMessageView.vue";
import CheckableUserListView from "../../../user/CheckableUserListView.vue";
import CheckableOrganizationTreeView from "../../../pick/CheckableOrganizationTreeView.vue";
import RobotPickEntry from "../../../pick/RobotPickEntry.vue";
import Config from "../../../../../config";
import organizationServerApi from "../../../../../api/organizationServerApi";
import wfc from "../../../../../wfc/client/wfc";

export default {
    name: "ForwardMessageByCreateConversationView",
    inject: {
        conversationActiveStore: {
            default: null,
        },
    },
    props: {
        users: {
            type: Array,
            required: true,
        },
        forwardType: {
            // 可参考ForwardType
            type: Number,
            required: false,
        },
        messages: {
            type: Array,
            required: true,
        }
    },
    data() {
        const activeStore = this.conversationActiveStore || store;
        return {
            activeStore: activeStore,
            sharedPickState: activeStore.state.pick,
            query: '',
            expandContactSection: true,
            // 机器人列表是否展开：展开时收起组织树和联系人
            robotViewOpened: false,
            // 是否已经进到某个组织内部：组织内部不显示机器人入口
            insideOrganization: false,
            defaultOrganizationPortraitUrl: Config.DEFAULT_DEPARTMENT_PORTRAIT_URL,
            orgServiceAvailable: organizationServerApi.isServiceAvailable,
            confirming: false,
        }
    },
    methods: {
        unpick(user) {
            this.activeStore.pickOrUnpickUser(user, false);
        },

        unpickOrganization(org) {
            this.activeStore.pickOrUnpickOrganization(org);
        },

        clearPicked() {
            this.sharedPickState.users.length = 0
            this.sharedPickState.organizations.length = 0
        },

        backPickConversation() {
            this.clearPicked();
            this.$modal.hide('forward-by-create-conversation-modal',
                {
                    backPickConversation: true,
                    forwardType: this.forwardType,
                    messages: this.messages,
                })
        },

        cancel() {
            this.clearPicked();
            this.$modal.hide('forward-by-create-conversation-modal', {confirm: false})
        },

        async confirm() {
            if (!this.hasPicked || this.confirming) {
                return;
            }
            let extraMessageText = this.$refs['forwardMessageView'].extraMessageText;
            let pickedUsers = [...this.sharedPickState.users];
            if (this.sharedPickState.organizations.length) {
                // 选了部门的话，展开成部门下的全部人员
                this.confirming = true;
                try {
                    let orgIds = this.sharedPickState.organizations.map(o => o.id);
                    let employeeList = await organizationServerApi.getOrganizationEmployees(orgIds);
                    employeeList.forEach(e => pickedUsers.push(organizationServerApi.employeeToUserInfo(e)));
                } catch (e) {
                    this.$notify({text: '获取组织成员失败', type: 'error'});
                    return;
                } finally {
                    this.confirming = false;
                }
            }
            // 去重，并去掉自己（部门里可能有自己，也可能和单独勾选的人重复）
            let selfUid = wfc.getUserId();
            let uidSet = new Set();
            pickedUsers = pickedUsers.filter(u => {
                if (u.uid === selfUid || uidSet.has(u.uid)) {
                    return false;
                }
                uidSet.add(u.uid);
                return true;
            });
            if (pickedUsers.length === 0) {
                this.$notify({text: '没有可选的成员', type: 'warn'});
                return;
            }
            this.clearPicked();
            this.$modal.hide('forward-by-create-conversation-modal',
                {
                    confirm: true,
                    users: pickedUsers,
                    forwardType: this.forwardType,
                    messages: this.messages,
                    extraMessageText: extraMessageText,
                })
        },
    },

    computed: {
        hasPicked() {
            return this.sharedPickState.users.length > 0 || this.sharedPickState.organizations.length > 0;
        },
        filteredUsers() {
            let result;
            if (this.query && this.query.trim()) {
                result = this.activeStore.filterUsers(this.users, this.query);
            } else {
                result = this.users;
            }
            return result.filter(u => u.uid !== Config.FILE_HELPER_ID)
        }
    },

    components: {
        RobotPickEntry,
        CheckableUserListView,
        CheckableOrganizationTreeView,
        ForwardMessageView
    },
}
</script>

<style lang="css" scoped>
.pick-user-container {
    display: flex;
    height: 100%;
    width: 100%;
}

.user-list-panel {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    background-color: var(--background-item-normal);
    border-right: 1px solid var(--border-primary);
    overflow: hidden;
}

.user-list-panel .input-container {
    display: flex;
    width: 100%;
    flex-shrink: 0;
}

.user-list-panel input {
    height: 32px;
    margin: 14px 16px 8px 16px;
    flex: 1;
    border-radius: var(--radius-md);
    border: 1px solid var(--border-tertiary);
    background-color: var(--background-primary);
    padding: 0 12px;
    text-align: left;
    outline: none;
    color: var(--text-primary);
    font-size: var(--font-size-sm);
    transition: border-color var(--duration-fast);
}

.user-list-panel input::placeholder {
    color: var(--text-hint);
}

.user-list-panel input:focus {
    border-color: var(--accent-color);
}

.user-list-panel .user-list-container {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.user-list-container > .user-list {
    flex: 1;
    min-height: 0;
    overflow: auto;
}

.pick-category-container {
    flex: 1;
    min-height: 0;
    overflow: auto;
    scrollbar-width: none;
    -ms-overflow-style: none;
}

.pick-category-container::-webkit-scrollbar {
    display: none;
}

.category-item-container {
    position: sticky;
    top: 0;
    z-index: 3;
    height: 40px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    padding-left: 16px;
    color: var(--text-primary);
    font-size: var(--font-size-base);
    border-top: 1px solid var(--border-tertiary);
    background-color: var(--background-secondary);
    transition: background var(--duration-fast);
    cursor: pointer;
    user-select: none;
}

.pick-category-container :deep(.contact-item .label.sticky) {
    top: 40px;
    z-index: 2;
}

.category-item {
    display: flex;
    width: 100%;
    justify-content: space-between;
    align-items: center;
}

.category-item .title {
    font-size: var(--font-size-sm);
    font-weight: 500;
    color: var(--text-primary);
}

.category-item .desc {
    margin-right: 16px;
    color: var(--text-secondary);
    font-size: var(--font-size-xs);
}

.arrow {
    border: solid var(--contact-arrow-border);
    border-width: 0 1px 1px 0;
    display: inline-block;
    padding: 3px;
    margin-right: 8px;
    flex-shrink: 0;
    transition: transform var(--duration-fast);
}

.right {
    transform: rotate(-45deg);
}

.down {
    transform: rotate(45deg);
}

.user-list-container .back {
    background-color: var(--background-item-normal);
    height: 40px;
    flex-shrink: 0;
    font-size: var(--font-size-sm);
    padding-left: 16px;
    display: flex;
    align-items: center;
    color: var(--text-secondary);
    transition: background var(--duration-fast);
}

.user-list-container .back:hover {
    background-color: var(--background-item-hover);
}

.user-list-container .back:active {
    background-color: var(--border-primary);
}

.checked-user-list-container {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
}

.checked-user-list-container header {
    height: 60px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-shrink: 0;
    border-bottom: 1px solid var(--border-primary);
}

.checked-user-list-container header h2 {
    font-size: var(--font-size-lg);
    font-weight: 500;
    color: var(--text-primary);
    margin-left: 24px;
}

.checked-user-list-container header span {
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
    margin-right: 24px;
}


.checked-user-list-container .content {
    height: 100%;
    flex: 1;
    display: flex;
    padding: 12px 20px;
    flex-wrap: wrap;
    justify-content: flex-start;
    align-items: flex-start;
    align-content: flex-start;
    overflow: auto;
}

.checked-user-list-container .content .picked-user-container {
    width: 25%;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    column-count: 1;
    justify-content: center;
    align-items: center;
    padding: 8px 4px;
    overflow: hidden;
}

.checked-user-list-container .content .picked-user-container .name {
    text-align: center;
    max-width: 76px;
    font-size: var(--font-size-xs);
}

.checked-user-list-container .content .picked-user-container .picked-user {
    position: relative;
    height: 65px;
    width: 65px;
}

.checked-user-list-container .content .avatar {
    width: 48px;
    height: 48px;
    margin: 8px 8px;
    border-radius: var(--default-portrait-border-radius);
    object-fit: cover;
}

.checked-user-list-container .content .unpick-button {
    position: absolute;
    width: 20px;
    height: 20px;
    border: 1px solid var(--border-primary);
    border-radius: var(--radius-circle);
    top: 0;
    right: 0;
    background: var(--background-secondary);
    color: var(--text-secondary);
    font-size: var(--font-size-xs);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background var(--duration-fast), color var(--duration-fast), border-color var(--duration-fast);
}

.checked-user-list-container .content .unpick-button:hover {
    background: var(--background-error-subtle);
    color: var(--text-danger);
    border-color: var(--text-danger);
}

.checked-user-list-container .content .unpick-button:active {
    background-color: var(--border-primary);
}

.checked-user-list-container footer {
    height: 60px;
    display: flex;
    justify-content: flex-end;
    align-items: center;
    padding: 0 24px;
    gap: 12px;
    flex-shrink: 0;
    border-top: 1px solid var(--border-primary);
}

.checked-user-list-container footer button {
    height: 32px;
    min-width: 88px;
    padding: 0 20px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-primary);
    background: transparent;
    color: var(--text-primary);
    font-size: var(--font-size-sm);
    cursor: pointer;
    transition: background var(--duration-fast), color var(--duration-fast), border-color var(--duration-fast);
}

.checked-user-list-container footer button.cancel:hover {
    background: var(--background-item-hover);
}

.checked-user-list-container footer button.confirm {
    background-color: var(--accent-color);
    border-color: var(--accent-color);
    color: var(--text-on-accent);
}

.checked-user-list-container footer button.confirm:hover {
    background-color: var(--accent-color-active);
    border-color: var(--accent-color-active);
}


</style>
