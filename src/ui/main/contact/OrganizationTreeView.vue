<template>
    <section class="organization-tree-container">
        <div class="title-bar">
            <h2 class="title">组织结构</h2>
        </div>
        <nav class="breadcrumb">
            <ul>
                <li v-for="(org, index) in currentOrganizationPathList" :key="org.id">
                    <a href="#" @click.prevent="backToOrganization(index)">{{ org.name }}</a>
                </li>
            </ul>
            <div class="search-action" :class="{ active: searchActive }">
                <input
                    ref="searchInput"
                    type="text"
                    placeholder="搜索成员"
                    v-model="searchQuery"
                    class="search-expand-input"
                    @blur="onSearchBlur"
                >
                <button class="search-icon-btn" @mousedown.prevent="toggleSearch">
                    <i :class="searchActive ? 'icon-ion-ios-close' : 'icon-ion-ios-search'"></i>
                </button>
            </div>
        </nav>
        <div class="member-list-container">
            <ul>
                <template v-if="!searchMode">
                    <li v-for="(org, index) in subOrganizations" :key="org.id">
                        <!-- 整行可点，进入该部门 -->
                        <div class="organization-item" @click="enterSubOrganization(org)">
                            <img :src="org.portrait ? org.portrait : defaultDepartmentPortraitUrl">
                            <p class="name">{{ org.name }}({{ org.memberCount || 0 }})</p>
                            <i class="row-chevron icon-ion-ios-arrow-right"></i>
                        </div>
                    </li>
                    <li v-for="(employee, index) in employees" :key="employee.employeeId">
                        <div class="organization-item"
                             @click="showUserCardView($event, employee)"
                        >
                            <tippy
                                :to="'#infoTrigger-' + employee.employeeId"
                                interactive
                                :animate-fill="false"
                                placement="right"
                                distant="20"
                                :id="employee.employeeId"
                                theme="light"
                                animation="fade"
                                trigger="manual"
                            >
                                <template #content>
                                    <UserCardView
                                        v-on:close="closeUserCard"
                                        :enable-update-portrait="false"
                                        :user-info="employeeToUserInfo(employee)"/>
                                </template>
                            </tippy>
                            <img :src="portraitUrl(employee)"
                                 :ref="'ref-employee-' + employee.employeeId"
                                 :id="'infoTrigger-' + employee.employeeId">
                            <div class="employee-info">
                                <p class="name single-line">{{ employee.name }}</p>
                                <p v-if="employee.title" class="employee-title single-line">{{ employee.title }}</p>
                            </div>
                        </div>
                    </li>
                </template>
                <template v-else>
                    <li v-if="searchResults.length === 0">
                        <p class="no-result">无搜索结果</p>
                    </li>
                    <li v-for="(employee, index) in searchResults" :key="'search-' + employee.employeeId">
                        <div class="organization-item"
                             @click="showUserCardView($event, employee)"
                        >
                            <tippy
                                :to="'#infoTrigger-' + employee.employeeId"
                                interactive
                                :animate-fill="false"
                                placement="right"
                                distant="20"
                                :id="employee.employeeId"
                                theme="light"
                                animation="fade"
                                trigger="manual"
                            >
                                <template #content>
                                    <UserCardView
                                        v-on:close="closeUserCard"
                                        :enable-update-portrait="false"
                                        :user-info="employeeToUserInfo(employee)"/>
                                </template>
                            </tippy>
                            <img :src="portraitUrl(employee)"
                                 :ref="'ref-employee-' + employee.employeeId"
                                 :id="'infoTrigger-' + employee.employeeId">
                            <div class="employee-info">
                                <p class="name single-line">{{ employee.name }}</p>
                                <p v-if="employee.title" class="employee-title single-line">{{ employee.title }}</p>
                            </div>
                        </div>
                    </li>
                </template>
            </ul>
        </div>
    </section>
</template>

<script>
import store from "../../../store";
import Config from "../../../config";
import organizationServerApi from "../../../api/organizationServerApi";
import UserCardView from "../user/UserCardView.vue";

export default {
    name: "OrganizationTreeView",
    props: {},
    components: {
        UserCardView,
    },
    data() {
        return {
            sharedContactState: store.state.contact,
            subOrganizations: [],
            employees: [],
            currentOrganizationPathList: [],
            defaultDepartmentPortraitUrl: Config.DEFAULT_DEPARTMENT_PORTRAIT_URL,
            activeTippy: null,
            searchQuery: '',
            searchResults: [],
            searchMode: false,
            currentOrgId: null,
            searchActive: false,
        }
    },
    watch: {
        // 已经停在组织结构页时，再点左栏别的组织、或资料卡里的「所属部门」，组件不会重建，要在这里重新加载
        'sharedContactState.currentOrganization'(org) {
            if (org && org.id !== this.currentOrgId) {
                this.loadAndShowOrganization(org);
            }
        },
        searchQuery(newVal) {
            if (this._searchTimer) {
                clearTimeout(this._searchTimer);
            }
            const keyword = newVal.trim();
            if (keyword) {
                this._searchTimer = setTimeout(() => {
                    this.search(keyword);
                }, 300);
            } else {
                this.searchMode = false;
                this.searchResults = [];
            }
        }
    },
    mounted() {
        let org = this.sharedContactState.currentOrganization;
        this.currentOrgId = org.id;
        this.loadAndShowOrganization(org);
    },
    methods: {
        // 进入下级部门：面包屑在本地接上一级，不用再逐级请求路径（对齐 wf-enterprise-chat）
        enterSubOrganization(org) {
            const path = this.currentOrganizationPathList;
            // 入口的路径还没取回来时，本地拼不出完整路径，退回去请求
            const pathReady = path.length && path[path.length - 1].id === this.currentOrgId;
            this.loadAndShowOrganization(org, pathReady ? [...path, org] : null);
        },
        // 点面包屑回到上级：截掉后面的
        backToOrganization(index) {
            const path = this.currentOrganizationPathList;
            this.loadAndShowOrganization(path[index], path.slice(0, index + 1));
        },
        /**
         * @param org 要显示的部门
         * @param pathList 从根到该部门的面包屑；不传时（从左栏、资料卡「所属部门」进来）向服务端请求
         */
        loadAndShowOrganization(org, pathList = null) {
            // 列表要换掉了，原来那张资料卡的 tippy 会跟着销毁
            this.closeUserCard();
            this.activeTippy = null;
            this.searchQuery = '';
            this.searchMode = false;
            this.searchResults = [];
            this.searchActive = false;
            this.currentOrgId = org.id;

            // 进过的部门先显示缓存，同时后台刷新；没进过的先清空，免得上一个部门的内容还留着能点
            const cached = organizationServerApi.getCachedOrganizationEx(org.id);
            this.subOrganizations = cached ? cached.subOrganizations : [];
            this.employees = cached ? cached.employees : [];
            organizationServerApi.getOrganizationEx(org.id)
                .then(res => {
                    // 连续点了几个部门时，只认最后一个
                    if (this.currentOrgId !== org.id) {
                        return;
                    }
                    this.subOrganizations = res.subOrganizations;
                    this.employees = res.employees;
                });

            if (pathList) {
                this.currentOrganizationPathList = pathList;
                return;
            }
            organizationServerApi.getOrganizationPath(org.id)
                .then(orgs => {
                    if (this.currentOrgId !== org.id) {
                        return;
                    }
                    this.currentOrganizationPathList = orgs.reverse();
                })
        },
        toggleSearch() {
            if (this.searchActive) {
                this.searchQuery = '';
                this.searchActive = false;
            } else {
                this.searchActive = true;
                this.$nextTick(() => {
                    this.$refs.searchInput.focus();
                });
            }
        },
        onSearchBlur() {
            if (!this.searchQuery) {
                this.searchActive = false;
            }
        },
        async search(keyword) {
            if (!this.currentOrgId) return;
            try {
                this.searchResults = await organizationServerApi.searchEmployee(this.currentOrgId, keyword);
                this.searchMode = true;
            } catch (e) {
                console.error('search employee error', e);
            }
        },
        employeeToUserInfo(employee) {
            return organizationServerApi.employeeToUserInfo(employee);
        },
        portraitUrl(employee) {
            return organizationServerApi.employeePortraitUrl(employee)
        },
        showUserCardView(evt, employee) {
            if (this.activeTippy) {
                this.activeTippy.hide();
                if (employee.employeeId === this.activeTippy.id) {
                    return;
                }
                this.activeTippy = null;
            }
            let employeeItem = this.$refs['ref-employee-' + employee.employeeId][0];
            this.activeTippy = employeeItem._tippy;
            this.activeTippy.show();
        },
        closeUserCard() {
            if (this.activeTippy) {
                this.activeTippy.hide();
            }
        }
    },

}
</script>

<style lang="css" scoped>

.organization-tree-container {
    display: flex;
    height: 100%;
    flex-direction: column;
    border-top-right-radius: var(--main-border-radius);
    border-bottom-right-radius: var(--main-border-radius);
}

/* 标题栏与收藏等第三栏统一：60px 高、16px 字号 */
.title-bar {
    display: flex;
    align-items: center;
    padding: 0 20px;
    height: 60px;
    flex-shrink: 0;
    border-bottom: 1px solid var(--border-primary);
}

.title {
    flex: 1;
    font-size: var(--font-size-lg);
    font-weight: 500;
    color: var(--text-primary);
    margin: 0;
}

.search-action {
    display: flex;
    align-items: center;
    flex-direction: row;
    padding: 0 8px;
}

.search-expand-input {
    width: 0;
    height: 25px;
    /* 与首页搜索框统一：圆角边框、输入框底色、聚焦主题色边（对齐 wf-enterprise-chat 2003ca61） */
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    background: var(--background-input);
    outline: none;
    font-size: var(--font-size-sm);
    padding: 0;
    color: var(--text-primary);
    transition: width 0.25s ease, border-color 0.25s ease, padding 0.25s ease;
    overflow: hidden;
}

.search-action.active .search-expand-input {
    width: 150px;
    border-color: var(--border-primary);
    padding: 0 8px;
}

.search-action.active .search-expand-input:focus {
    border-color: var(--border-active);
}

.search-icon-btn {
    width: 32px;
    height: 32px;
    flex-shrink: 0;
    border: none;
    background: transparent;
    cursor: pointer;
    border-radius: var(--radius-circle);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-secondary-strong);
    font-size: var(--font-size-2xl);
    transition: background 0.15s ease;
}

.search-icon-btn:hover {
    background: var(--background-item-hover);
}

.no-result {
    padding: 20px;
    color: var(--text-secondary);
    text-align: center;
    font-size: var(--font-size-base);
}

.breadcrumb {
    display: flex;
    align-items: center;
    padding: 20px;
    height: 50px;
    flex-shrink: 0;
    //border-bottom: 1px solid var(--border-tertiary);
}

.breadcrumb ul {
    flex: 1;
    display: flex;
    flex-wrap: wrap;
    list-style: none;
    margin: 0;
    padding: 0;
}

.breadcrumb a {
    text-decoration: none;
}

.breadcrumb li:not(:last-child)::after {
    display: inline-block;
    margin: 0 8px;
    color: var(--text-secondary-strong);
    content: ">";
}

.breadcrumb li:not(:last-child) a {
    color: var(--accent-color);
}

.breadcrumb li:last-child a {
    color: var(--text-secondary-strong);
    pointer-events: none;
}

.member-list-container {
    margin: 4px 4px 20px 4px;
    flex: 1;
    overflow-y: scroll;
}

.organization-item {
    display: flex;
    flex-direction: row;
    align-items: center;
    height: 56px;
    padding: 0 20px;
    border-radius: var(--radius-md);
    font-size: var(--font-size-base);
}

.organization-item:hover {
    background: var(--background-item-hover);
}

.organization-item img {
    width: 40px;
    height: 40px;
    border-radius: var(--default-portrait-border-radius);
    margin-right: 8px;
}

.organization-item .row-chevron {
    flex-shrink: 0;
    margin-left: auto;
    font-size: var(--font-size-lg);
    color: var(--text-tertiary);
}

/* 成员名下面一行显示职务（对齐 wf-enterprise-chat） */
.organization-item .employee-info {
    flex: 1;
    min-width: 0;
}

.organization-item .employee-title {
    margin-top: 2px;
    font-size: var(--font-size-sm);
    color: var(--text-tertiary);
}

</style>
