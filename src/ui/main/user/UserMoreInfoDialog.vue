<template>
    <div class="more-info-dialog">
        <h3 class="dialog-title">更多信息</h3>
        <div class="section-title">
            和他(她)的群聊
            <span v-if="!loading" class="count">({{ groups.length }})</span>
        </div>
        <div v-if="loading" class="state">加载中…</div>
        <div v-else-if="groups.length === 0" class="state">暂无共同群聊</div>
        <ul v-else class="group-list">
            <li v-for="group in groups" :key="group.target" @click="openGroup(group)">
                <img class="avatar" :src="group.portrait" alt="" @error="onAvatarError"/>
                <span class="single-line group-name">{{ group._displayName || group.name }}</span>
                <i class="icon-ion-ios-arrow-right row-chevron"></i>
            </li>
        </ul>
        <div class="dialog-actions">
            <button class="close-btn" @click="close">关闭</button>
        </div>
    </div>
</template>

<script>
import wfc from "../../../wfc/client/wfc";
import Config from "../../../config";
import Conversation from "../../../wfc/model/conversation";
import ConversationType from "../../../wfc/model/conversationType";
import store from "../../../store";

/**
 * 用户「更多信息」：目前只有「和他(她)的群聊」（对齐 wf-enterprise-chat d2a8e82e、990ac36d）。
 */
export default {
    name: "UserMoreInfoDialog",
    props: {
        userId: {
            type: String,
            required: true,
        },
    },
    data() {
        return {
            loading: true,
            groups: [],
        }
    },
    mounted() {
        this.loadCommonGroups();
    },
    methods: {
        loadCommonGroups() {
            wfc.getCommonGroups(this.userId, (groupIds) => {
                this.groups = (groupIds || []).map(id => {
                    let info = wfc.getGroupInfo(id, false);
                    return info ? info : {target: id, name: id, portrait: Config.DEFAULT_GROUP_PORTRAIT_URL};
                });
                this.loading = false;
            }, () => {
                this.loading = false;
            });
        },
        openGroup(group) {
            let conversation = new Conversation(ConversationType.Group, group.target, 0);
            store.setCurrentConversation(conversation);
            if (this.$router && this.$router.currentRoute.value.path !== '/home') {
                this.$router.replace('/home');
            }
            this.close();
        },
        onAvatarError(e) {
            e.target.src = Config.DEFAULT_GROUP_PORTRAIT_URL;
        },
        close() {
            this.$modal.hide('user-more-info-modal');
        },
    },
}
</script>

<style lang="css" scoped>
.more-info-dialog {
    padding: 20px 24px;
    min-width: 320px;
    max-height: 480px;
    display: flex;
    flex-direction: column;
    background-color: var(--background-primary);
    color: var(--text-primary);
}

.dialog-title {
    font-size: var(--font-size-lg);
    font-weight: 500;
    margin-bottom: 12px;
}

.section-title {
    font-size: var(--font-size-sm);
    color: var(--text-hint);
    margin-bottom: 8px;
}

.count {
    color: var(--text-hint);
}

.state {
    padding: 20px 0;
    text-align: center;
    color: var(--text-hint);
    font-size: var(--font-size-sm);
}

.group-list {
    list-style: none;
    margin: 0;
    padding: 0;
    overflow-y: auto;
    flex: 1;
}

.group-list li {
    display: flex;
    align-items: center;
    padding: 8px 4px;
    cursor: pointer;
    border-radius: var(--radius-sm);
}

.group-list li:hover {
    background-color: var(--background-item-hover);
}

.group-list .avatar {
    width: 36px;
    height: 36px;
    border-radius: var(--default-portrait-border-radius);
    flex-shrink: 0;
}

.group-name {
    flex: 1;
    min-width: 0;
    margin-left: 10px;
}

.row-chevron {
    color: var(--text-hint);
}

.dialog-actions {
    display: flex;
    justify-content: flex-end;
    margin-top: 12px;
}

.close-btn {
    height: 32px;
    padding: 0 20px;
    border: none;
    border-radius: var(--radius-sm);
    background-color: var(--button-primary-bg);
    color: var(--button-primary-text);
    cursor: pointer;
}
</style>
