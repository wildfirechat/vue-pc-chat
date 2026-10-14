<template>
    <section class="user-detail-container">
        <!-- 通讯录里点好友：和会话里点头像弹出的资料卡用同一个组件，查看头像、所属部门、共同群聊、
             同组织判定、文件传输助手特判等都只维护一份（对齐 wf-enterprise-chat user_info_widget）；
             page-mode 下不画成卡片，样式同原来的详情页 -->
        <UserCardView :key="user.uid" :user-info="user" page-mode/>
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
</style>
