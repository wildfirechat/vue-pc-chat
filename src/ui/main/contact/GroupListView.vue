<template>
    <section>
        <ul>
            <li v-for="(group, index) in sharedContactState.favGroupList" :key="index" @click="showGroup(group)">
                <div class="group-item"
                     v-bind:class="{active: sharedContactState.currentGroup && sharedContactState.currentGroup.target === group.target}">
                    <img class="avatar" :src="group.portrait">
                    <span class="single-line">{{ group.remark ? group.remark : group.name }}</span>
                </div>
            </li>
        </ul>
    </section>

</template>

<script>
import store from "../../../store";

export default {
    name: "GroupListView",
    props: {},
    data() {
        return {
            sharedContactState: store.state.contact,
        }
    },
    methods: {
        showGroup(group) {
            store.setCurrentGroup(group)
        }
    },
}
</script>

<style scoped>
.avatar {
    width: 32px;
    height: 32px;
    border-radius: 3px;
    object-fit: cover;
}

.group-item {
    height: 50px;
    padding: 5px 10px 5px 30px;
    display: flex;
    font-size: 13px;
    align-items: center;
    color: var(--text-primary);
}

.group-item:hover{
    background-color: var(--bg-secondary);
}

.group-item.active {
    background-color: var(--bg-tertiary);
}

.group-item span {
    margin-left: 10px;
}

</style>
