<template>
    <section class="robot-list-container">
        <div class="title-bar">
            <h2 class="title">机器人</h2>
            <span class="title-desc">组织架构机器人</span>
        </div>
        <div class="robot-list">
            <ul>
                <li v-for="robot in robots" :key="robot.uid">
                    <div class="robot-item" @click="startConversation(robot)">
                        <img :src="robot.portrait" alt="" @error="onPortraitError">
                        <div class="robot-info">
                            <p class="name single-line">{{ robot._displayName || robot.displayName }}</p>
                            <p class="robot-id single-line">{{ robot.uid }}</p>
                        </div>
                        <i class="row-chevron icon-ion-ios-arrow-right"></i>
                    </div>
                </li>
                <li v-if="robots.length === 0">
                    <p class="no-result">暂无机器人</p>
                </li>
            </ul>
        </div>
    </section>
</template>

<script>
import store from "../../../store";
import Config from "../../../config";
import Conversation from "../../../wfc/model/conversation";
import ConversationType from "../../../wfc/model/conversationType";

/**
 * 联系人页第三栏的「机器人」列表：组织架构里配置的机器人，跟组织树分开显示。
 * 点一个机器人直接发起单聊（机器人不是好友，资料卡意义不大）
 */
export default {
    name: "OrganizationRobotListView",
    data() {
        return {
            sharedContactState: store.state.contact,
            defaultPortraitUrl: Config.DEFAULT_ROBOT_PORTRAIT_URL,
        }
    },
    computed: {
        robots() {
            return this.sharedContactState.organizationRobots;
        },
    },
    methods: {
        startConversation(robot) {
            let conversation = new Conversation(ConversationType.Single, robot.uid, 0);
            store.setCurrentConversation(conversation);
            this.$router.replace('/home');
        },
        onPortraitError(e) {
            e.target.src = this.defaultPortraitUrl;
        },
    },
}
</script>

<style lang="css" scoped>

.robot-list-container {
    display: flex;
    height: 100%;
    flex-direction: column;
    border-top-right-radius: var(--main-border-radius);
    border-bottom-right-radius: var(--main-border-radius);
}

/* 标题栏与组织架构等第三栏统一：60px 高、16px 字号 */
.title-bar {
    display: flex;
    align-items: center;
    padding: 0 20px;
    height: 60px;
    flex-shrink: 0;
    border-bottom: 1px solid var(--border-primary);
}

.title {
    font-size: var(--font-size-lg);
    font-weight: 500;
    color: var(--text-primary);
    margin: 0;
}

.title-desc {
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
}

.robot-list {
    margin: 4px 4px 20px 4px;
    flex: 1;
    overflow-y: auto;
}

.robot-item {
    display: flex;
    flex-direction: row;
    align-items: center;
    height: 56px;
    padding: 0 20px;
    border-radius: var(--radius-md);
    font-size: var(--font-size-base);
    cursor: pointer;
}

.robot-item:hover {
    background: var(--background-item-hover);
}

.robot-item img {
    width: 40px;
    height: 40px;
    flex-shrink: 0;
    border-radius: var(--radius-sm);
    margin-right: 8px;
}

.robot-info {
    flex: 1;
    min-width: 0;
}

.robot-id {
    margin-top: 2px;
    font-size: var(--font-size-sm);
    color: var(--text-tertiary);
}

.robot-item .row-chevron {
    flex-shrink: 0;
    margin-left: auto;
    font-size: var(--font-size-lg);
    color: var(--text-tertiary);
}

.no-result {
    padding: 20px;
    color: var(--text-secondary);
    text-align: center;
    font-size: var(--font-size-base);
}

</style>
