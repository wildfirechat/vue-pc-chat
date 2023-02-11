<template>
    <section>
        <ul>
            <li v-for="(organization, index) in sharedContactState.organizationList" :key="index" @click="showOrganization(organization)">
                <div class="organization-item"
                     v-bind:class="{active: sharedContactState.currentOrganization && sharedContactState.currentOrganization.organizationId === organization.organizationId}">
                    <img class="avatar" :src="organization.portrait">
                    <span class="single-line">{{ organization.name}}</span>
                </div>
            </li>
        </ul>
    </section>

</template>

<script>
import store from "@/store";

export default {
    name: "OrganizationListView",
    props: {},
    data() {
        return {
            sharedContactState: store.state.contact,
        }
    },
    methods: {
        showOrganization(organization) {
            store.setCurrentOrganization(organization)
        }
    },
}
</script>

<style scoped>
.avatar {
    width: 40px;
    height: 40px;
    border-radius: 3px;
}

.organization-item {
    height: 50px;
    padding: 5px 10px 5px 30px;
    display: flex;
    font-size: 13px;
    align-items: center;
}

.organization-item.active {
    background-color: #d6d6d6;
}

.organization-item span {
    margin-left: 10px;
}

</style>
