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
                    <div @click="expandOrganizationSection = !expandOrganizationSection" class="category-item-container">
                        <i class="arrow right" v-bind:class="{down: expandOrganizationSection}"></i>
                        <div class="category-item">
                            <span class="title">组织结构</span>
                        </div>
                    </div>
                    <div v-show="expandOrganizationSection" class="organization-section">
                        <div v-if="organizationPathList.length" class="pick-source-nav">
                            <div ref="organizationPathNav" class="pick-source-nav-scroll">
                                <ul>
                                    <li v-for="org in organizationPathList" :key="org.id">
                                        <a href="#" @click.prevent="loadAndShowOrganization(org)">{{ org.name }}</a>
                                    </li>
                                </ul>
                            </div>
                        </div>
                        <CheckableOrganizationTreeView
                            ref="checkableOrganizationTreeView"
                            :search-query="query"
                            @organization-path-update="onOrganizationPathUpdate"/>
                    </div>

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
                                               :padding-left="'20px'"
                                               :virtual-list-style="{ 'max-height': '600px', 'overflow-y': 'auto' }"
                                               :enable-category-label-sticky="true"/>
                    </div>
                </div>
                <CheckableUserListView v-else
                                       class="user-list"
                                       :enable-pick="true"
                                       :users="filteredUsers"
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
                    <span class="name single-line">{{ user.displayName }}</span>
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
            organizationPathList: [],
            expandOrganizationSection: !this.users.some(user => user.uid !== Config.FILE_HELPER_ID),
            expandContactSection: true,
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

        onOrganizationPathUpdate(orgPathList) {
            this.organizationPathList = orgPathList;
            this.$nextTick(() => {
                const nav = this.$refs.organizationPathNav;
                if (nav) {
                    nav.scrollLeft = nav.scrollWidth;
                }
            });
        },

        loadAndShowOrganization(org) {
            this.$refs.checkableOrganizationTreeView.loadAndShowOrganization(org);
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
            let result ;
            if (this.query && this.query.trim()) {
                result = this.activeStore.filterContact(this.query)
            } else {
                result = this.users;
            }
            return result.filter(u => u.uid !== Config.FILE_HELPER_ID)
        }
    },

    components: {
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
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    background-color: var(--background-item-normal);
    overflow: hidden;
}

.user-list-panel .input-container {
    display: flex;
    width: 100%;
}

.user-list-panel input {
    height: 25px;
    margin: 16px 20px 0 16px;
    flex: 1;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-tertiary);
    background-color: var(--background-primary);
    padding-left: 8px;
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
    height: 40px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    margin-left: 16px;
    color: var(--text-primary);
    font-size: var(--font-size-base);
    border-top: 1px solid var(--border-tertiary);
    background-color: var(--background-secondary);
    transition: background var(--duration-fast);
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

.organization-section :deep(.organization-tree-container) {
    height: auto;
    max-height: none;
}

.pick-source-nav {
    box-sizing: border-box;
    padding: 8px 16px 0 20px;
    width: 100%;
}

.pick-source-nav-scroll {
    width: 100%;
    min-width: 0;
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
}

.pick-source-nav ul {
    display: flex;
    flex-wrap: nowrap;
    list-style: none;
    margin: 0;
    padding: 0;
}

.pick-source-nav li {
    flex-shrink: 0;
    white-space: nowrap;
}

.pick-source-nav a {
    text-decoration: none;
    font-size: var(--font-size-base);
    white-space: nowrap;
}

.pick-source-nav li:not(:last-child)::after {
    display: inline-block;
    margin: 0 8px;
    color: var(--text-secondary-strong);
    content: ">";
}

.pick-source-nav li:not(:last-child) a {
    color: var(--accent-color);
}

.pick-source-nav li:last-child a {
    color: var(--text-secondary-strong);
    pointer-events: none;
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
    display: flex;
    flex-direction: column;
}

.checked-user-list-container header {
    height: 55px;
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
    margin-left: 30px;
}

.checked-user-list-container header span {
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
    margin-right: 20px;
}


.checked-user-list-container .content {
    height: 100%;
    flex: 1;
    display: flex;
    padding: 0 30px;
    flex-wrap: wrap;
    justify-content: flex-start;
    align-items: flex-start;
    align-content: flex-start;
    overflow: auto;
}

.checked-user-list-container .content .picked-user-container {
    width: 33%;
    display: flex;
    flex-direction: column;
    column-count: 1;
    justify-content: center;
    align-items: center;
    padding: 4px 8px;
    overflow: hidden;
}

.checked-user-list-container .content .picked-user-container .name {
    text-align: center;
    max-width: 80px;
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
    border-radius: var(--radius-sm);
    top: 0;
    right: 0;
    background: var(--background-secondary);
    color: var(--text-secondary);
    font-size: var(--font-size-xs);
    display: flex;
    align-items: center;
    justify-content: center;
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
    height: 55px;
    display: flex;
    justify-content: flex-end;
    align-items: center;
    margin-bottom: 8px;
    flex-shrink: 0;
    border-top: 1px solid var(--border-primary);
}

.checked-user-list-container footer button {
    padding: 4px 30px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-primary);
    background: transparent;
    color: var(--text-primary);
    font-size: var(--font-size-sm);
    transition: background var(--duration-fast), color var(--duration-fast), border-color var(--duration-fast);
}

.checked-user-list-container footer button.cancel:hover {
    background: var(--background-item-hover);
}

.checked-user-list-container footer button.confirm {
    background-color: var(--accent-color);
    border-color: var(--accent-color);
    color: var(--text-on-accent);
    margin-left: 20px;
    margin-right: 20px;
}

.checked-user-list-container footer button.confirm:hover {
    background-color: var(--accent-color-active);
    border-color: var(--accent-color-active);
}


</style>
