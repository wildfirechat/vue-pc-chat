<template>
    <div class="pick-contact-container">
        <section class="contact-list-container">
            <div class="input-container">
                <input type="text" :placeholder="$t('common.search')" v-model="filterQuery">
                <i class="icon-ion-ios-search"></i>
                <span v-if="filterQuery" class="clear-btn" @click="filterQuery = ''">×</span>
            </div>
            <template v-if="showOrganization && orgServiceAvailable">
                <div class="pick-category-container">
                    <!-- 组织架构保持原有布局，不做折叠改动；选人界面只额外增加机器人分组 -->
                    <CheckableOrganizationTreeView :search-query="filterQuery"
                                                   @depth-change="insideOrganization = $event > 1"/>

                    <!-- 机器人：位于组织架构下面、联系人上面；和联系人一样点击展开，默认收起 -->
                    <RobotPickEntry :visible="!insideOrganization"
                                    :search-query="filterQuery"
                                    :initial-checked-users="initialCheckedUsers"
                                    :uncheckable-users="uncheckableUsers"/>

                    <div class="contact-category-section">
                        <div @click="toggleContactSection" class="category-item-container">
                            <i class="arrow right" v-bind:class="{down: expandContactSection}"></i>
                            <div class="category-item">
                                <span class="title">联系人</span>
                                <span class="desc">{{ filterUsers.length }}</span>
                            </div>
                        </div>
                        <div v-show="expandContactSection" class="friend-list-container">
                            <CheckableUserListView :enable-pick="true"
                                                   :users="filterUsers"
                                                   :initial-checked-users="initialCheckedUsers"
                                                   :uncheckable-users="uncheckableUsers"
                                                   :show-category-label="showCategoryLabel && !filterQuery"
                                                   :padding-left="'20px'"
                                                   :virtual-list-style="{ 'max-height': '600px', 'overflow-y': 'auto' }"
                                                   enable-category-label-sticky/>
                        </div>
                    </div>
                </div>
            </template>
            <div v-else class="friend-list-container">
                <CheckableUserListView :enable-pick="true"
                                       :users="filterUsers"
                                       :initial-checked-users="initialCheckedUsers"
                                       :uncheckable-users="uncheckableUsers"
                                       :show-category-label="showCategoryLabel && !filterQuery"
                                       :padding-left="'20px'"
                                       enable-category-label-sticky/>
            </div>
        </section>
        <section class="checked-contact-list-container">
            <header>
                <h2>{{ this.title ? this.title : $t('pick.pick_contact') }}</h2>
                <div class="flex-row flex-justify-end">
                    <span v-if="checkedUsers.length === 0">{{ $t('pick.picked_contact') }}</span>
                    <span v-else>{{ $t('pick.picked_contact') + ':' + this.checkedUsers.length }}</span>
                    <span v-if="sharedPickState.organizations.length">{{ '组织: ' + sharedPickState.organizations.length }}</span>
                </div>
            </header>
            <div class="content">
                <div class="picked-user-container" v-for="(user, index) in checkedUsers" :key="user.uid">
                    <div class="picked-user">
                        <img class="avatar" :src="user.portrait" alt="">
                        <button @click="onPickUser(user)" class="unpick-button">X</button>
                    </div>
                    <div class="flex-row flex-align-center">
                        <p class="name single-line">{{ user._displayName || user.displayName }}</p>
                        <p v-if="isExternalDomainUser(user)" class="single-line" style="color: var(--text-warning); border-radius: 2px;  padding: 1px 2px; font-size: 9px">{{ domainName(user) }}</p>
                    </div>
                </div>
                <div class="picked-user-container" v-for="(org, index) in sharedPickState.organizations" :key="org.id">
                    <div class="picked-user">
                        <img class="avatar" :src="org.portrait ? org.portrait : defaultOrganizationPortraitUrl" alt="">
                        <button @click="onPickOrganization(org)" class="unpick-button">X</button>
                    </div>
                    <span class="name single-line">{{ org.name }}</span>
                </div>
            </div>
            <footer>
                <button @click="cancel" class="cancel">{{ $t('common.cancel') }}</button>
                <button @click="confirm" class="confirm" v-bind:class="{disable:checkedUsers.length === 0  && sharedPickState.organizations.length === 0}">
                    {{ confirmTitle }}
                </button>
            </footer>
        </section>
    </div>
</template>

<script>
import store from "../../../store";
import CheckableUserListView from "../user/CheckableUserListView.vue";
import CheckableOrganizationTreeView from "./CheckableOrganizationTreeView.vue";
import RobotPickEntry from "./RobotPickEntry.vue";
import Config from "../../../config";
import organizationServerApi from "../../../api/organizationServerApi";
import UserInfo from "../../../wfc/model/userInfo";
import WfcUtil from "../../../wfc/util/wfcUtil";
import wfc from "../../../wfc/client/wfc";

export default {
    name: "PickUserView",
    props: {
        users: {
            type: Array,
            required: true,
        },
        initialCheckedUsers: {
            type: Array,
            required: false,
            default: null,
        },
        uncheckableUsers: {
            type: Array,
            required: false,
            default: null,
        },
        title: {
            type: String,
            required: false,
            default: '',
        },
        confirmTitle: {
            type: String,
            required: false,
            default: 'confirm',
        },
        showCategoryLabel: {
            type: Boolean,
            required: false,
            default: true,
        },
        showOrganization: {
            type: Boolean,
            required: false,
            default: false,
        }

    },
    data() {
        return {
            sharedPickState: store.state.pick,
            filterQuery: '',
            expandContactSection: true,
            // 是否已经进到某个组织内部：组织内部不显示机器人入口
            insideOrganization: false,
            defaultOrganizationPortraitUrl: Config.DEFAULT_DEPARTMENT_PORTRAIT_URL,
            orgServiceAvailable: organizationServerApi.isServiceAvailable,
        }
    },

    methods: {
        toggleContactSection() {
            this.expandContactSection = !this.expandContactSection;
        },

        onPickUser(user) {
            if (this.isUserUncheckable(user)) {
                return;
            }
            store.pickOrUnpickUser(user);
        },

        onPickOrganization(organization) {
            store.pickOrUnpickOrganization(organization);
        },

        isUserUncheckable(user) {
            return this.uncheckableUsers && this.uncheckableUsers.findIndex(u => u.uid === user.uid) >= 0;
        },

        cancel() {
            this.sharedPickState.users.length = 0
            this.sharedPickState.organizations.length = 0;
            this.$modal.hide('pick-user-modal', {confirm: false})
        },

        /**
         * 不包含默认选中的用户
         */
        confirm() {
            let pickedUsers = this.sharedPickState.users;
            if (this.initialCheckedUsers) {
                pickedUsers = this.sharedPickState.users.filter(u => this.initialCheckedUsers.findIndex(iu => iu.uid === u.uid) === -1);
            } else {
                pickedUsers = this.sharedPickState.users;
            }
            let users = [...pickedUsers];
            this.sharedPickState.users.length = 0

            if (this.sharedPickState.organizations.length) {
                let orgIds = this.sharedPickState.organizations.map(o => o.id);
                organizationServerApi.getOrganizationEmployees(orgIds)
                    .then(employeeList => {
                        this.sharedPickState.organizations.length = 0;
                        for (const employee of employeeList) {
                            let userInfo = new UserInfo();
                            userInfo.uid = employee.employeeId;
                            userInfo.displayName = employee.name;
                            userInfo.updateDt = employee.updateDt;
                            users.push(userInfo);
                        }
                        this.$modal.hide('pick-user-modal', {confirm: true, users: users})
                    })
            } else {
                this.$modal.hide('pick-user-modal', {confirm: true, users: users})
            }
        },

        isExternalDomainUser(user) {
            return WfcUtil.isExternal(user.uid);

        },
        domainName(user) {
            if (WfcUtil.isExternal(user.uid)) {
                let domainId = WfcUtil.getExternalDomainId(user.uid);
                let domainInfo = wfc.getDomainInfo(domainId);
                return '@' + domainInfo.name;
            }
            return '';
        },
    },

    computed: {
        checkedUsers() {
            let users = this.sharedPickState.users;
            if (!this.initialCheckedUsers || this.initialCheckedUsers.length === 0) {
                return users;
            }
            return users.filter(u => {
                return this.initialCheckedUsers.findIndex(iu => iu.uid === u.uid) === -1
            })
        },
        filterUsers() {
            if (this.filterQuery) {
                return store.filterUsers(this.users, this.filterQuery);
            } else {
                return this.users;
            }
        }
    },

    components: {RobotPickEntry, CheckableOrganizationTreeView, CheckableUserListView},
}
</script>

<style lang="css" scoped>
.pick-contact-container {
    display: flex;
    height: 100%;
    width: 100%;
}

.contact-list-container {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    background-color: var(--background-item-normal);
    border-right: 1px solid var(--border-primary);
    overflow: hidden;
}

.contact-list-container .input-container {
    position: relative;
    display: flex;
    align-items: center;
    width: 100%;
    flex-shrink: 0;
}

.input-container input {
    height: 32px;
    margin: 14px 16px;
    flex: 1;
    border-radius: var(--radius-md);
    border: 1px solid var(--border-tertiary);
    background-color: var(--background-primary);
    padding: 0 28px 0 30px;
    text-align: left;
    outline: none;
    color: var(--text-primary);
    font-size: var(--font-size-sm);
    transition: border-color var(--duration-fast);
}

.input-container input::placeholder {
    color: var(--text-placeholder);
}

.input-container input:active {
    border: 1px solid var(--border-active);
}

.input-container input:focus {
    border: 1px solid var(--border-active);
}

.input-container i {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    left: 26px;
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
    pointer-events: none;
}

.input-container .clear-btn {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    right: 24px;
    height: 24px;
    line-height: 24px;
    cursor: pointer;
    color: var(--text-secondary-strong);
    font-size: var(--font-size-lg);
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
    -webkit-transform: rotate(-45deg);
}

.down {
    transform: rotate(45deg);
    -webkit-transform: rotate(45deg);
}

.pick-category-container .friend-list-container {
    overflow: visible;
}

.pick-category-container :deep(.contact-item .label.sticky) {
    top: 40px;
    z-index: 2;
}

.contact-list-container > .friend-list-container {
    flex: 1;
    min-height: 0;
    overflow: auto;
}

.checked-contact-list-container {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    background-color: var(--background-primary);
}

.checked-contact-list-container header {
    height: 60px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid var(--border-primary);
    flex-shrink: 0;
}

.checked-contact-list-container header h2 {
    font-size: var(--font-size-lg);
    font-weight: 500;
    color: var(--text-primary);
    margin-left: 24px;
}

.checked-contact-list-container header span {
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
    margin-right: 24px;
}


.checked-contact-list-container .content {
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

.checked-contact-list-container .content .picked-user-container {
    width: 25%;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    column-count: 1;
    justify-content: center;
    align-items: center;
    padding: 8px 4px;
}

.checked-contact-list-container .content .picked-user-container .name {
    text-align: center;
    max-width: 76px;
    font-size: var(--font-size-xs);
}

.checked-contact-list-container .content .picked-user-container .picked-user {
    position: relative;
    height: 64px;
    width: 64px;
}

.checked-contact-list-container .content .avatar {
    width: 48px;
    height: 48px;
    border-radius: var(--default-portrait-border-radius);
    object-fit: cover;
    margin: 8px;
}

.checked-contact-list-container .content .unpick-button {
    position: absolute;
    width: 18px;
    height: 18px;
    border: 1px solid var(--border-primary);
    padding: 0;
    border-radius: var(--radius-circle);
    background-color: var(--background-secondary);
    top: 2px;
    right: 2px;
    font-size: 10px;
    color: var(--text-secondary);
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
    cursor: pointer;
    transition: background var(--duration-fast), color var(--duration-fast);
}

.checked-contact-list-container .content .unpick-button:hover {
    background-color: var(--background-error-subtle);
    color: var(--text-danger);
    border-color: var(--text-danger);
}

.checked-contact-list-container footer {
    height: 60px;
    display: flex;
    justify-content: flex-end;
    align-items: center;
    padding: 0 24px;
    gap: 12px;
    border-top: 1px solid var(--border-primary);
    flex-shrink: 0;
}

footer button {
    height: 32px;
    min-width: 88px;
    padding: 0 20px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-primary);
    font-size: var(--font-size-sm);
    color: var(--text-primary);
    background: transparent;
    cursor: pointer;
    transition: background var(--duration-fast), border-color var(--duration-fast), color var(--duration-fast);
}

footer button.cancel:hover {
    background-color: var(--background-item-hover);
}

footer button.confirm {
    background-color: var(--accent-color);
    border-color: var(--accent-color);
    color: var(--text-on-accent);
}

footer button.confirm:hover {
    background-color: var(--accent-color-active);
    border-color: var(--accent-color-active);
}

footer button.confirm.disable {
    background-color: var(--background-tertiary);
    border-color: transparent;
    color: var(--text-tertiary);
}

</style>
