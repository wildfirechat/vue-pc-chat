<template>
    <div class="group-manage-dialog">
        <template v-if="!transferring">
            <h3 class="dialog-title">群管理</h3>
            <template v-if="isOwner">
                <div class="entry" @click="startTransfer">
                    <span>转让群主</span>
                    <i class="icon-ion-ios-arrow-right"></i>
                </div>
                <div class="entry danger" @click="onDismiss">
                    <span>解散群组</span>
                    <i class="icon-ion-ios-arrow-right"></i>
                </div>
            </template>
            <div v-else class="empty">你不是群主，没有可管理的操作</div>
        </template>
        <template v-else>
            <h3 class="dialog-title">选择新的群主</h3>
            <p class="hint">转让后你将不再是群主</p>
            <ul class="member-list">
                <li v-for="user in transferCandidates" :key="user.uid" @click="confirmTransfer(user)">
                    <img class="avatar" :src="user.portrait" alt="" @error="onAvatarError"/>
                    <span class="single-line member-name">{{ user._displayName || user.displayName || user.uid }}</span>
                </li>
            </ul>
            <div class="actions">
                <button class="cancel" @click="transferring = false">取消</button>
            </div>
        </template>
    </div>
</template>

<script>
import wfc from "../../../wfc/client/wfc";
import Config from "../../../config";

/**
 * 群管理：转让群主、解散群组（对齐 wf-enterprise-chat 2a554bfa，会话详情只留退出群聊）。
 */
export default {
    name: "GroupManageDialog",
    props: {
        groupId: {type: String, required: true},
        selfUserId: {type: String, required: true},
        members: {type: Array, default: () => []},
        isOwner: {type: Boolean, default: false},
        // 解散群组由宿主处理（要用会话的 activeStore）
        onDismiss: {type: Function, default: null},
    },
    data() {
        return {
            transferring: false,
        }
    },
    computed: {
        transferCandidates() {
            return (this.members || []).filter(u => u && u.uid && u.uid !== this.selfUserId);
        }
    },
    methods: {
        startTransfer() {
            this.transferring = true;
        },
        confirmTransfer(user) {
            this.$alert({
                showIcon: false,
                content: `确定把群主转让给「${user._displayName || user.displayName || user.uid}」？`,
                confirmText: '确定',
                cancelText: '取消',
                confirmCallback: () => {
                    wfc.transferGroup(this.groupId, user.uid, [0], null, () => {
                        this.$notify({text: '已转让群主', type: 'success'});
                        this.close();
                    }, (err) => {
                        console.error('transfer group error', err);
                        this.$notify({text: '转让群主失败', type: 'error'});
                    });
                },
                cancelCallback: () => {
                    // do nothing
                }
            });
        },
        onAvatarError(e) {
            e.target.src = Config.DEFAULT_PORTRAIT_URL;
        },
        close() {
            this.$modal.hide('group-manage-modal');
        },
    },
}
</script>

<style lang="css" scoped>
.group-manage-dialog {
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

.entry {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 4px;
    cursor: pointer;
    border-bottom: 1px solid var(--border-separator);
}

.entry:hover {
    background-color: var(--background-item-hover);
}

.entry.danger {
    color: var(--status-danger, #f56c6c);
}

.empty {
    padding: 20px 0;
    text-align: center;
    color: var(--text-hint);
    font-size: var(--font-size-sm);
}

.hint {
    font-size: var(--font-size-xs);
    color: var(--text-hint);
    margin-bottom: 8px;
}

.member-list {
    list-style: none;
    margin: 0;
    padding: 0;
    overflow-y: auto;
    flex: 1;
}

.member-list li {
    display: flex;
    align-items: center;
    padding: 8px 4px;
    cursor: pointer;
    border-radius: var(--radius-sm);
}

.member-list li:hover {
    background-color: var(--background-item-hover);
}

.member-list .avatar {
    width: 36px;
    height: 36px;
    border-radius: var(--default-portrait-border-radius);
    flex-shrink: 0;
}

.member-name {
    flex: 1;
    min-width: 0;
    margin-left: 10px;
}

.actions {
    display: flex;
    justify-content: flex-end;
    margin-top: 12px;
}

.actions .cancel {
    height: 32px;
    padding: 0 20px;
    border: 1px solid var(--border-primary);
    border-radius: var(--radius-sm);
    background-color: transparent;
    color: var(--text-primary);
    cursor: pointer;
}
</style>
