<template>
    <span class="todo-avatars">
        <img v-for="uid in shown" :key="uid" :src="portrait(uid)" :style="{width: size + 'px', height: size + 'px'}" alt="">
    </span>
</template>

<script>
import wfc from "../../wfc/client/wfc";
import Config from "../../config";
import './todo.css';

// 一串负责人头像（叠在一起）
export default {
    name: "TodoAvatars",
    props: {
        userIds: {type: Array, default: () => []},
        groupId: {type: String, default: ''},
        max: {type: Number, default: 3},
        size: {type: Number, default: 18},
    },
    computed: {
        shown() {
            return (this.userIds || []).slice(0, this.max);
        },
    },
    methods: {
        portrait(uid) {
            let userInfo = wfc.getUserInfo(uid, false, this.groupId || '');
            return (userInfo && userInfo.portrait) || Config.DEFAULT_PORTRAIT_URL;
        },
    },
}
</script>
