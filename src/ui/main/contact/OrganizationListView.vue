<template>
    <section>
        <ul>
            <li v-for="(organization, index) in rootOrganizations" :key="index" @click="showOrganization(organization)">
                <div class="organization-item"
                     v-bind:class="{active: sharedContactState.currentOrganization && sharedContactState.currentOrganization.id === organization.id}">
                    <img class="avatar" :src="organization.portrait ? organization.portrait : defaultPortraitUrl">
                    <div class="item-info">
                        <p class="single-line">{{ organization.name }}</p>
                    </div>
                </div>
            </li>
            <!-- 根组织下面再列出自己直属的部门，点了直接进（对齐 wf-enterprise-chat） -->
            <li v-for="organization in myOrganizations" :key="'my-' + organization.id" @click="showOrganization(organization)">
                <div class="organization-item"
                     v-bind:class="{active: sharedContactState.currentOrganization && sharedContactState.currentOrganization.id === organization.id}">
                    <img class="avatar" :src="organization.portrait ? organization.portrait : defaultDepartmentPortraitUrl">
                    <div class="item-info">
                        <p class="single-line">{{ organization.name }}</p>
                    </div>
                </div>
            </li>
            <!-- 组织架构入口下独立的「机器人」item，和根组织 / 部门平级；没有机器人数据时不显示 -->
            <li v-if="organizationRobots.length" @click="showRobots">
                <div class="organization-item robot-item" v-bind:class="{active: sharedContactState.currentOrganizationRobots}">
                    <img class="avatar robot-avatar" :src="robotPortraitUrl">
                    <div class="item-info">
                        <p class="single-line">机器人</p>
                    </div>
                    <span class="robot-count">{{ organizationRobots.length }}</span>
                </div>
            </li>
        </ul>
    </section>

</template>

<script>
import store from "../../../store";
import organizationServerApi from "../../../api/organizationServerApi";
import Config from "../../../config";
import wfc from "../../../wfc/client/wfc";

export default {
    name: "OrganizationListView",
    props: {},
    data() {
        return {
            sharedContactState: store.state.contact,
            rootOrganizations: [],
            myOrganizations: [],
            defaultPortraitUrl: Config.DEFAULT_ORGANIZATION_PORTRAIT_URL,
            defaultDepartmentPortraitUrl: Config.DEFAULT_DEPARTMENT_PORTRAIT_URL,
            robotPortraitUrl: Config.DEFAULT_ROBOT_PORTRAIT_URL,
        }
    },
    computed: {
        organizationRobots() {
            return this.sharedContactState.organizationRobots;
        },
    },
    mounted() {
        // 启动时已经请求过的话这里直接复用；组织结构服务没登录好时补一次
        store.loadOrganizationRobots();
        organizationServerApi.getRootOrganization()
            .then(orgs => {
                this.rootOrganizations = orgs;
            })
            .catch(error => {
                this.$notify({
                    text: '组织结构服务异常',
                    type: 'error'
                })
                console.error(error);
            })
        this.loadMyOrganizations();
    },
    methods: {
        // 自己直属的部门：组织关系里标了 bottom 的那些
        async loadMyOrganizations() {
            try {
                const relationships = await organizationServerApi.getRelationShip(wfc.getUserId()) || [];
                const orgIds = [...new Set(relationships.filter(r => r.bottom).map(r => r.organizationId))];
                if (orgIds.length) {
                    const orgs = await organizationServerApi.getOrganizations(orgIds);
                    this.myOrganizations = (orgs || []).filter(o => o && o.id);
                }
            } catch (e) {
                console.error('load my organizations failed', e);
            }
        },
        showOrganization(organization) {
            store.setCurrentOrganization(organization)
        },
        // 进入独立的机器人列表（第三栏），与组织树节点分开
        showRobots() {
            store.setCurrentOrganizationRobots();
        },
    },
}
</script>

<style scoped>
.avatar {
    width: var(--size-avatar-contact);
    height: var(--size-avatar-contact);
}

.organization-item {
    padding: 8px 4px 8px 30px;
    display: flex;
    font-size: var(--font-size-sm);
    align-items: center;
}

.organization-item:hover {
    background-color: var(--background-item-hover);
}

.organization-item.active {
    background-color: var(--background-item-placeholder);
}

.item-info {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    padding-left: 8px;
}

/* 「机器人」item：带彩色背景的机器人图标，右侧显示个数，跟组织条目同一行高 */
.robot-item .robot-avatar {
    border-radius: var(--radius-sm);
}

.robot-count {
    flex-shrink: 0;
    margin-right: 8px;
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
}

.organization-item span {
    /*margin-left: 10px;*/
}

</style>
