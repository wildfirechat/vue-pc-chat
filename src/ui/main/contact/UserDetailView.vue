<template>
    <section class="user-detail-container">
        <!-- 通讯录里点好友：和会话里点头像弹出的资料卡用同一个组件，查看头像、所属部门、更多信息、
             同组织判定、文件传输助手特判等都只维护一份（对齐 wf-enterprise-chat user_info_widget） -->
        <UserCardView :key="user.uid" :user-info="user" class="embedded-user-card"/>
    </section>
</template>

<script>
import UserCardView from "../user/UserCardView.vue";

export default {
    name: "UserDetailView",
    components: {
        UserCardView,
    },
    props: {
        user: {
            type: Object,
            required: true,
        },
    },
}
</script>

<style lang="css" scoped>
.user-detail-container {
    border-top-right-radius: var(--main-border-radius);
    border-bottom-right-radius: var(--main-border-radius);
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding-top: 60px;
    overflow-y: auto;
}

.user-detail-container .embedded-user-card {
    width: 360px;
    border-radius: var(--radius-md);
    box-shadow: 0 2px 12px 0 var(--background-mask, rgba(0, 0, 0, 0.1));
}
</style>
