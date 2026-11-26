<template>
    <div v-if="orgSections.length" class="organization-sections-container">
        <div v-for="section in orgSections" :key="section.rootOrg.id"
             :ref="el => setSectionRef(section.rootOrg.id, el)"
             class="organization-root-section">
            <div @click="toggleRootOrgSection(section)" class="category-item-container">
                <i class="arrow right" v-bind:class="{down: section.expanded}"></i>
                <div class="category-item">
                    <span class="title single-line">{{ section.rootOrg.name }}</span>
                    <span v-if="sectionDesc(section) !== ''" class="desc">{{ sectionDesc(section) }}</span>
                </div>
            </div>
            <div v-show="section.expanded" class="organization-section">
                <div v-if="section.pathList.length > 1" class="pick-source-nav">
                    <div :ref="el => setNavRef(section.rootOrg.id, el)" class="pick-source-nav-scroll">
                        <ul>
                            <li>
                                <a href="#" @click.prevent="loadAndShowOrganization(section, section.rootOrg)">全部</a>
                            </li>
                            <li v-for="org in section.pathList.slice(1)" :key="org.id">
                                <a href="#" @click.prevent="loadAndShowOrganization(section, org)">{{ org.name }}</a>
                            </li>
                        </ul>
                    </div>
                </div>
                <section class="organization-tree-container">
                    <div class="member-list-container">
                        <ul>
                            <template v-if="!searchMode">
                                <li v-for="org in section.subOrganizations" :key="org.id">
                                    <div class="organization-item"
                                         v-bind:class="{clickable: !isOrganizationChecked(org)}"
                                         @click.stop="onShowSubOrganizationButtonClick(section, org)">
                                        <span class="checkbox-wrapper" @click.stop="clickOrganizationItem(org)">
                                            <input type="checkbox"
                                                   v-bind:value="org"
                                                   :checked="isOrganizationChecked(org)">
                                        </span>
                                        <img :src="org.portrait ? org.portrait : defaultDepartmentPortraitUrl">
                                        <p class="name single-line">{{ org.name }}({{ org.memberCount || 0 }})</p>
                                    </div>
                                </li>
                                <li v-for="employee in section.employees" :key="employee.employeeId">
                                    <div class="organization-item clickable"
                                         @click.stop="clickEmployeeItem(employee)">
                                        <span class="checkbox-wrapper">
                                            <input type="checkbox"
                                                   v-bind:value="employee"
                                                   :checked="isEmployeeChecked(employee)">
                                        </span>
                                        <img :src="employeePortraitUrl(employee)">
                                        <div class="employee-info">
                                            <p class="name single-line">{{ employee.name }}</p>
                                            <p v-if="employee.title" class="employee-title single-line">{{ employee.title }}</p>
                                        </div>
                                    </div>
                                </li>
                            </template>
                            <template v-else>
                                <li v-if="section.searchResults.length === 0">
                                    <p class="no-result">无搜索结果</p>
                                </li>
                                <li v-for="employee in section.searchResults" :key="'search-' + employee.employeeId">
                                    <div class="organization-item clickable"
                                         @click.stop="clickEmployeeItem(employee)">
                                        <span class="checkbox-wrapper">
                                            <input type="checkbox"
                                                   v-bind:value="employee"
                                                   :checked="isEmployeeChecked(employee)">
                                        </span>
                                        <img :src="employeePortraitUrl(employee)">
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
            </div>
        </div>
    </div>
</template>

<script>
import Config from "../../../config";
import organizationServerApi from "../../../api/organizationServerApi";
import store from "../../../store";

export default {
    name: "CheckableOrganizationTreeView",
    props: {
        searchQuery: {
            type: String,
            default: '',
        }
    },
    data() {
        return {
            orgSections: [],
            defaultDepartmentPortraitUrl: Config.DEFAULT_DEPARTMENT_PORTRAIT_URL,
            searchMode: false,
        }
    },
    watch: {
        searchQuery(newVal) {
            if (this._searchTimer) {
                clearTimeout(this._searchTimer);
            }
            const keyword = (newVal || '').trim();
            if (keyword) {
                // 搜索时自动展开被手动收起的根组织；清空搜索后恢复搜索前的展开状态
                this.orgSections.forEach(section => {
                    if (section.expandedBeforeSearch === null) {
                        section.expandedBeforeSearch = section.expanded;
                    }
                    section.expanded = true;
                });
                this._searchTimer = setTimeout(() => {
                    this.search(keyword);
                }, 300);
            } else {
                this._searchSeq = (this._searchSeq || 0) + 1;
                this.searchMode = false;
                this.orgSections.forEach(section => {
                    section.searchResults = [];
                    if (section.expandedBeforeSearch !== null) {
                        section.expanded = section.expandedBeforeSearch;
                        section.expandedBeforeSearch = null;
                    }
                });
            }
        }
    },
    mounted() {
        this._navRefs = new Map();
        this._sectionRefs = new Map();
        this._searchSeq = 0;
        this.ensureRootSectionsLoaded().then(sections => {
            if (sections.length === 0) {
                if (organizationServerApi.isServiceAvailable) {
                    this.$notify({
                        text: '组织结构服务异常',
                        type: 'error',
                    });
                }
                return;
            }
            sections.forEach(section => {
                this.loadOrganizationContent(section, section.rootOrg.id);
            });
            const keyword = (this.searchQuery || '').trim();
            if (keyword) {
                this.search(keyword);
            }
        });
    },
    beforeUnmount() {
        if (this._searchTimer) {
            clearTimeout(this._searchTimer);
        }
    },
    methods: {
        setSectionRef(rootOrgId, el) {
            if (!this._sectionRefs) {
                this._sectionRefs = new Map();
            }
            if (el) {
                this._sectionRefs.set(rootOrgId, el);
            } else {
                this._sectionRefs.delete(rootOrgId);
            }
        },
        setNavRef(rootOrgId, el) {
            if (!this._navRefs) {
                this._navRefs = new Map();
            }
            if (el) {
                this._navRefs.set(rootOrgId, el);
            } else {
                this._navRefs.delete(rootOrgId);
            }
        },
        scrollNavToEnd(rootOrgId) {
            this.$nextTick(() => {
                const nav = this._navRefs && this._navRefs.get(rootOrgId);
                if (nav) {
                    nav.scrollLeft = nav.scrollWidth;
                }
            });
        },
        scrollSectionIntoView(rootOrgId) {
            this.$nextTick(() => {
                const sectionEl = this._sectionRefs && this._sectionRefs.get(rootOrgId);
                if (!sectionEl) {
                    return;
                }
                const scrollContainer = sectionEl.closest('.pick-category-container');
                if (!scrollContainer) {
                    return;
                }
                const containerRect = scrollContainer.getBoundingClientRect();
                const sectionRect = sectionEl.getBoundingClientRect();
                const delta = sectionRect.top - containerRect.top;
                // 向上滚动列表后再点部门时，该根组织头部可能已滚出可视区上方，或可视空间不足；滚动使其内容完整呈现
                if (delta < 0 || containerRect.bottom - sectionRect.top < 160) {
                    scrollContainer.scrollTop = Math.max(0, scrollContainer.scrollTop + delta);
                }
            });
        },
        toggleRootOrgSection(section) {
            section.expanded = !section.expanded;
        },
        sectionDesc(section) {
            if (this.searchMode) {
                return section.searchResults.length;
            }
            if (section.rootOrg && section.rootOrg.memberCount > 0) {
                return section.rootOrg.memberCount;
            }
            return '';
        },
        /**
         * 加载根组织。组织结构服务的登录是登录成功后异步发起的，组件挂载时可能还没有 token，
         * 这里失败后补一次登录再重试；搜索时也会兜底调用，避免根组织为空导致搜不到人。
         */
        async ensureRootSectionsLoaded() {
            if (this.orgSections.length > 0) {
                return this.orgSections;
            }
            if (this._rootOrgsPromise) {
                return this._rootOrgsPromise;
            }
            this._rootOrgsPromise = (async () => {
                let rootOrganizations = [];
                try {
                    rootOrganizations = (await organizationServerApi.getRootOrganization()) || [];
                } catch (e) {
                    console.error('load root organizations failed', e);
                    try {
                        await organizationServerApi.login();
                        rootOrganizations = (await organizationServerApi.getRootOrganization()) || [];
                    } catch (e2) {
                        console.error('load root organizations failed after login', e2);
                    }
                }
                if (rootOrganizations.length > 0 && this.orgSections.length === 0) {
                    this.orgSections = rootOrganizations.map(org => ({
                        rootOrg: org,
                        expanded: true,
                        expandedBeforeSearch: null,
                        currentOrgId: org.id,
                        subOrganizations: [],
                        employees: [],
                        pathList: [org],
                        searchResults: [],
                    }));
                }
                return this.orgSections;
            })();
            try {
                return await this._rootOrgsPromise;
            } finally {
                this._rootOrgsPromise = null;
            }
        },
        loadAndShowOrganization(section, org) {
            // 同步更新面包屑路径，避免异步逐级请求导致面包屑延迟出现和列表抖动
            const existingIndex = section.pathList.findIndex(item => item.id === org.id);
            if (existingIndex >= 0) {
                section.pathList = section.pathList.slice(0, existingIndex + 1);
            } else {
                section.pathList = [...section.pathList, org];
            }
            this.scrollNavToEnd(section.rootOrg.id);
            this.scrollSectionIntoView(section.rootOrg.id);
            this.loadOrganizationContent(section, org.id);
        },
        loadOrganizationContent(section, orgId) {
            section.currentOrgId = orgId;
            const cached = organizationServerApi.getCachedOrganizationEx(orgId);
            if (cached) {
                section.subOrganizations = cached.subOrganizations || [];
                section.employees = cached.employees || [];
            } else {
                section.subOrganizations = [];
                section.employees = [];
            }
            organizationServerApi.getOrganizationEx(orgId)
                .then(res => {
                    if (section.currentOrgId !== orgId) return;
                    section.subOrganizations = (res && res.subOrganizations) || [];
                    section.employees = (res && res.employees) || [];
                })
                .catch(e => {
                    console.error('load organization ex failed', orgId, e);
                });
        },
        async search(keyword) {
            const seq = ++this._searchSeq;
            const sections = await this.ensureRootSectionsLoaded();
            if (seq !== this._searchSeq || sections.length === 0) {
                return;
            }
            try {
                const results = await Promise.all(sections.map(async section => {
                    const orgId = section.currentOrgId || section.rootOrg.id;
                    const list = await organizationServerApi.searchEmployee(orgId, keyword);
                    const employeeMap = new Map();
                    (list || []).forEach(e => employeeMap.set(e.employeeId, e));
                    return [...employeeMap.values()];
                }));
                if (seq !== this._searchSeq) {
                    return;
                }
                sections.forEach((section, index) => {
                    section.searchResults = results[index];
                });
                this.searchMode = true;
            } catch (e) {
                console.error('search employee error', e);
            }
        },
        onShowSubOrganizationButtonClick(section, org) {
            if (this.isOrganizationChecked(org)) {
                return;
            }
            this.loadAndShowOrganization(section, org);
        },

        isOrganizationChecked(org) {
            return store.isOrganizationPicked(org);
        },

        clickOrganizationItem(org) {
            store.pickOrUnpickOrganization(org);
        },

        isEmployeeChecked(employee) {
            return store.isUserPicked(organizationServerApi.employeeToUserInfo(employee));
        },

        clickEmployeeItem(employee) {
            store.pickOrUnpickUser(organizationServerApi.employeeToUserInfo(employee));
        },

        employeePortraitUrl(employee) {
            return organizationServerApi.employeePortraitUrl(employee);
        }
    },

}
</script>

<style lang="css" scoped>

.category-item-container {
    height: 40px;
    display: flex;
    align-items: center;
    margin-left: 16px;
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
    flex: 1;
    min-width: 0;
    justify-content: space-between;
    align-items: center;
}

.category-item .title {
    flex: 1;
    min-width: 0;
    margin-right: 8px;
    font-size: var(--font-size-sm);
    font-weight: 500;
    color: var(--text-primary);
}

.category-item .desc {
    margin-right: 16px;
    flex-shrink: 0;
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

.organization-tree-container {
    display: flex;
    height: auto;
    flex-direction: column;
}

.member-list-container {
    flex: 1;
}

.organization-item {
    display: flex;
    flex-direction: row;
    align-items: center;
    height: 56px;
    padding: 0 20px;
    font-size: var(--font-size-base);
}

.organization-item.clickable {
    cursor: pointer;
}

.organization-item:hover {
    background: var(--background-item-hover);
}

.checkbox-wrapper {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 8px 12px 8px 0;
    cursor: pointer;
    flex-shrink: 0;
}

.checkbox-wrapper input[type="checkbox"] {
    cursor: pointer;
}

.organization-item img {
    width: 36px;
    height: 36px;
    flex-shrink: 0;
    border-radius: var(--default-portrait-border-radius);
    margin-right: 8px;
}

.organization-item .name {
    flex: 1;
    min-width: 0;
    margin: 0;
}

.no-result {
    padding: 20px;
    color: var(--text-secondary);
    text-align: center;
    font-size: var(--font-size-base);
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
