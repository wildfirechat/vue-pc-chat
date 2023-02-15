<template>
    <section class="organization-tree-container">
        <div class="member-list-container">
            <ul>
                <li v-for="(org, index) in subOrganizations" :key="org.id">
                    <div class="organization-item"
                         @click.stop="clickOrganizationItem(org)">
                        <input type="checkbox" style="margin-right: 10px"
                               v-bind:value="org"
                               :checked="isOrganizationChecked(org)">
                        <img :src="org.portrait ? org.portrait : defaultDepartmentPortraitUrl">
                        <p class="name">{{ org.name }}</p>
                        <p class="button" @click.stop="onShowSubOrganizationButtonClick(org)">下级</p>
                    </div>
                </li>
                <li v-for="(employee, index) in employees" :key="employee.employeeId">
                    <div class="organization-item "
                         @click.stop="clickEmployeeItem(employee)">
                        <input type="checkbox" style="margin-right: 10px"
                               v-bind:value="employee"
                               :checked="isEmployeeChecked(employee)">
                        <img :src="employee.portrait ? employee.portrait : defaultEmployeePortraitUrl">
                        <p class="name">{{ employee.name }}</p>
                    </div>
                </li>
            </ul>
        </div>
    </section>
</template>

<script>
import Config from "../../../config";
import organizationServerApi from "../../../api/organizationServerApi";
import UserInfo from "../../../wfc/model/userInfo";
import store from "../../../store";

export default {
    name: "CheckableOrganizationTreeView",
    props: {},
    components: {},
    data() {
        return {
            subOrganizations: [],
            employees: [],
            currentOrganizationPathList: [],
            defaultDepartmentPortraitUrl: Config.DEFAULT_DEPARTMENT_PORTRAIT_URL,
            defaultEmployeePortraitUrl: Config.DEFAULT_PORTRAIT_URL,
            activeTippy: null,
        }
    },
    mounted() {
        // this.loadAndShowOrganization(this.sharedContactState.currentOrganization);
        organizationServerApi.getRootOrganization()
            .then(orgs => {
                if (orgs.length > 0) {
                    this.loadAndShowOrganization(orgs[0])
                }
            })
    },
    methods: {
        loadAndShowOrganization(org) {
            this.loadAndShowOrganizationById(org.id);
        },
        loadAndShowOrganizationById(orgId) {
            organizationServerApi.getOrganizationEx(orgId)
                .then(res => {
                    this.subOrganizations = res.subOrganizations;
                    this.employees = res.employees;
                });
            organizationServerApi.getOrganizationPath(orgId)
                .then(orgs => {
                    this.currentOrganizationPathList = orgs.reverse();
                    this.$emit('organization-path-update', this.currentOrganizationPathList);
                })
        },
        employeeToUserInfo(employee) {
            let userInfo = new UserInfo();
            userInfo.uid = employee.employeeId;
            userInfo.name = employee.name;
            userInfo.displayName = employee.name;
            userInfo.portrait = employee.portrait ? employee.portrait : Config.DEFAULT_PORTRAIT_URL;
            userInfo.gender = employee.gender;
            userInfo.mobile = employee.mobile;
            userInfo.email = employee.email;
            userInfo.updateDt = employee.updateDt;
            //0 normal; 1 robot; 2 thing;
            userInfo.type = 1;
            userInfo.deleted = 0;
            return userInfo;
        },

        onShowSubOrganizationButtonClick(org) {
            // TODO 如果该部门已选中，则不可以展开下级
            this.loadAndShowOrganization(org);
        },

        isOrganizationChecked(org) {
            return store.isOrganizationPicked(org);
        },

        clickOrganizationItem(org) {
            store.pickOrUnpickOrganization(org);
        },

        isEmployeeChecked(employee) {
            return store.isUserPicked(this.employeeToUserInfo(employee));
        },

        clickEmployeeItem(employee) {
            store.pickOrUnpickUser(this.employeeToUserInfo(employee));
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

.member-list-container {
    margin: 5px 5px 20px 5px;
    flex: 1;
    overflow-y: scroll;
}

.organization-item {
    display: flex;
    flex-direction: row;
    align-items: center;
    height: 56px;
    padding: 0 20px;
    border-radius: 5px;
    font-size: 14px;
}

.organization-item:hover {
    background: #d6d6d6;
}

.organization-item img {
    width: 40px;
    height: 40px;
    border-radius: 5px;
    margin-right: 10px;
}

.organization-item .button {
    justify-self: flex-end;
    margin-left: auto;
    padding: 5px;
    font-size: 14px;
    color: #4168e0;
}

.organization-item .button:hover {
    background: #dbe1f0;
    border-radius: 5px;
}

</style>
