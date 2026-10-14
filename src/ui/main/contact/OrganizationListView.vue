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
        }
    },
    mounted() {
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

.organization-item span {
    /*margin-left: 10px;*/
}

</style>
