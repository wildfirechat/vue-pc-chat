<template>
    <div class="todo-dialog todo-detail" :class="{embedded: !asDialog, 'window-controls': !asDialog && windowControls}">
        <div class="todo-dialog-header">
            <span class="todo-title">待办详情</span>
            <span v-if="todo && isCreator" class="todo-icon-button" @click.stop="menuShown = !menuShown">
                <i class="icon-ion-android-more-horizontal"></i>
                <div v-if="menuShown" class="todo-menu" @click.stop>
                    <div @click="edit">编辑待办</div>
                    <div v-if="isGroup" @click="setClosed(!todo.closed)">{{ todo.closed ? '重新打开' : '结束待办' }}</div>
                    <div class="todo-danger" @click="remove">删除待办</div>
                </div>
            </span>
            <span v-if="asDialog" class="todo-icon-button" @click="close"><i class="icon-ion-close"></i></span>
        </div>

        <div class="todo-detail-body">
            <div v-if="loading && !todo" class="todo-empty">加载中…</div>
            <div v-else-if="deleted" class="todo-empty">该待办已删除</div>
            <div v-else-if="error && !todo" class="todo-empty">
                <a href="javascript:" @click="load">加载失败，点击重试</a>
            </div>
            <template v-else-if="todo">
                <div class="todo-detail-content">
                    <span class="todo-checkbox" :class="{checked: checked}"><i class="icon-ion-checkmark"></i></span>
                    <p :class="{done: checked}">{{ todo.content }}</p>
                    <span class="todo-chip" :class="state">{{ stateLabel }}</span>
                </div>

                <div v-if="todo.dueAt > 0" class="todo-detail-row">
                    <span class="todo-detail-label">截止时间</span>
                    <span :class="{'todo-danger': overdue}">{{ formatTime(todo.dueAt) }}{{ overdue ? '（已逾期）' : '' }}</span>
                </div>
                <div v-if="todo.dueAt > 0" class="todo-detail-row">
                    <span class="todo-detail-label">提醒</span>
                    <span>{{ remindLabel(todo.remindBefore) }}</span>
                </div>
                <div v-if="todo.source && todo.source.digest" class="todo-detail-row">
                    <span class="todo-detail-label">来源</span>
                    <a href="javascript:" class="todo-quote todo-detail-source" title="跳到原消息" @click="openSource">{{ sourceText }}</a>
                </div>
                <div v-if="isGroup" class="todo-detail-row">
                    <span class="todo-detail-label">所在群</span>
                    <a href="javascript:" @click="openGroup">{{ groupName }}</a>
                </div>
                <div class="todo-detail-row">
                    <span class="todo-detail-label">创建人</span>
                    <span>{{ userName(todo.creatorId) }}<span class="todo-muted">　创建于 {{ formatTime(todo.createdAt) }}</span></span>
                </div>

                <!-- 群待办：负责人与各自状态，没完成的在前 -->
                <div v-if="isGroup" class="todo-detail-assignees">
                    <div class="todo-detail-assignees-title">
                        <span>负责人</span>
                        <span v-if="todo.assigneeCount > 1" class="todo-muted">{{ todo.doneCount }}/{{ todo.assigneeCount }} 已完成</span>
                        <a v-if="isCreator && !todo.status" href="javascript:" @click="addAssignees"><i class="icon-ion-plus"></i> 添加负责人</a>
                    </div>
                    <div v-if="todo.assigneeCount > 1" class="todo-progress">
                        <div class="todo-progress-bar">
                            <div :style="{width: (todo.doneCount * 100 / todo.assigneeCount) + '%'}"></div>
                        </div>
                    </div>
                    <div v-for="a in assignees" :key="a.userId" class="todo-detail-assignee">
                        <img :src="portrait(a.userId)" alt="">
                        <span class="todo-detail-assignee-name">{{ userName(a.userId) }}</span>
                        <span v-if="a.done" class="todo-muted">{{ a.doneAt ? formatTime(a.doneAt) + ' 完成' : '已完成' }}</span>
                        <span v-else class="todo-muted">未完成</span>
                        <span v-if="isCreator && assignees.length > 1" class="todo-icon-button" title="移除负责人"
                              @click="removeAssignee(a.userId)"><i class="icon-ion-close"></i></span>
                    </div>
                </div>
                <p v-if="todo.myDone != null && todo.closed" class="todo-detail-hint">待办已结束，创建人重新打开后才能修改完成状态</p>
            </template>
        </div>

        <div v-if="todo && !deleted && (canUrge || canToggleDone)" class="todo-dialog-footer">
            <button v-if="canUrge" class="todo-button" :disabled="busy" @click="urge">催办</button>
            <button v-if="canToggleDone" class="todo-button" :class="{primary: !todo.myDone}" :disabled="busy"
                    @click="setDone(!todo.myDone)">{{ todo.myDone ? '标记未完成' : '标记完成' }}
            </button>
        </div>
    </div>
</template>

<script>
import wfc from "../../wfc/client/wfc";
import store from "../../store";
import Config from "../../config";
import todoApi, {TodoApi} from "../../api/todoApi";
import todoStore from "./todoStore";
import {showTodoEdit} from "./todoUi";
import {
    formatTodoTime,
    todoChecked,
    todoOverdue,
    todoRemindLabel,
    todoSourceConversation,
    todoStateLabel,
    todoStateOf,
    todoUserName
} from "./todoUtil";
import ConversationType from "../../wfc/model/conversationType";
import Conversation from "../../wfc/model/conversation";
import './todo.css';

/**
 * 待办详情。弹窗（会话里的卡片、群待办列表）和待办页右栏共用。
 *
 * 权限（服务端也会校验）：负责人标记完成 / 未完成自己那份；创建人编辑、增减负责人（群待办）、结束 / 重新打开（群待办）、
 * 催办（群待办，有没完成的人）、删除；群待办所在群的成员只看。
 */
export default {
    name: "TodoDetailView",
    props: {
        todoId: {type: Number, required: true},
        asDialog: {type: Boolean, default: false},
    },
    emits: ['deleted'],
    data() {
        return {
            todo: null,
            loading: false,
            error: null,
            busy: false,
            menuShown: false,
            me: wfc.getUserId(),
            todoState: todoStore.state,
            // Windows / Linux 右上角有窗口按钮，待办页右栏的标题栏要给它们让位置
            windowControls: store.state.misc.isElectronWindowsOrLinux,
        };
    },
    created() {
        this.load();
    },
    mounted() {
        document.addEventListener('click', this.hideMenu);
    },
    beforeUnmount() {
        document.removeEventListener('click', this.hideMenu);
    },
    watch: {
        todoId() {
            this.todo = null;
            this.load();
        },
        // 别处改了待办（列表勾选、收到卡片）：重拉自己这一条
        'todoState.revision'() {
            if (this.todo && !this.busy) {
                this.load();
            }
        },
    },
    computed: {
        deleted() {
            return this.error && this.error.errorCode === TodoApi.CODE_NOT_EXIST;
        },
        isCreator() {
            return this.todo && this.todo.creatorId === this.me;
        },
        isGroup() {
            return this.todo && !!this.todo.groupId;
        },
        checked() {
            return todoChecked(this.todo);
        },
        overdue() {
            return todoOverdue(this.todo);
        },
        state() {
            return todoStateOf(this.todo);
        },
        stateLabel() {
            return todoStateLabel(this.state);
        },
        groupName() {
            let groupInfo = wfc.getGroupInfo(this.todo.groupId);
            return groupInfo ? (groupInfo.remark || groupInfo.name) : this.todo.groupId;
        },
        sourceText() {
            let source = this.todo.source;
            let groupId = source.convType === ConversationType.Group ? source.target : '';
            let name = source.senderId ? todoUserName(source.senderId, groupId) : '';
            return name ? `${name}：${source.digest}` : source.digest;
        },
        assignees() {
            let list = (this.todo.assignees || []).slice();
            // 没完成的排前面
            list.sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0));
            return list;
        },
        // 负责人：标记完成 / 未完成。创建人结束了的不能改，要先重新打开
        canToggleDone() {
            return this.todo.myDone != null && !this.todo.closed;
        },
        // 创建人：催办还没完成的人
        canUrge() {
            return this.isCreator && this.isGroup && this.todo.status !== 1
                && (this.todo.assignees || []).some(a => !a.done && a.userId !== this.me);
        },
    },
    methods: {
        formatTime: formatTodoTime,
        remindLabel: todoRemindLabel,
        userName(uid) {
            return todoUserName(uid, this.todo && this.todo.groupId);
        },
        portrait(uid) {
            let userInfo = wfc.getUserInfo(uid, false, (this.todo && this.todo.groupId) || '');
            return (userInfo && userInfo.portrait) || Config.DEFAULT_PORTRAIT_URL;
        },
        hideMenu() {
            this.menuShown = false;
        },
        async load() {
            this.loading = true;
            try {
                this.todo = await todoApi.get(this.todoId);
                this.error = null;
            } catch (e) {
                this.error = e;
                if (e && e.errorCode === TodoApi.CODE_NOT_EXIST) {
                    this.todo = null;
                }
            } finally {
                this.loading = false;
            }
        },
        async run(action, toast) {
            if (this.busy) {
                return false;
            }
            this.busy = true;
            try {
                let todo = await action();
                this.todo = todo;
                todoStore.applyChanged(todo);
                toast && this.$notify({text: toast, type: 'success'});
                return true;
            } catch (e) {
                this.$notify({text: e.message, type: 'error'});
                return false;
            } finally {
                this.busy = false;
            }
        },
        // 打开详情多半就是为了勾掉它：弹窗形态勾完就关掉，回到来的地方；待办页右栏常驻，不关
        async setDone(done) {
            let ok = await this.run(() => todoApi.setDone(this.todoId, done), done ? '已标记完成' : '已标记未完成');
            if (ok && this.asDialog) {
                this.close();
            }
        },
        setClosed(closed) {
            this.menuShown = false;
            this.run(() => todoApi.setClosed(this.todoId, closed));
        },
        async urge() {
            if (this.busy) {
                return;
            }
            this.busy = true;
            try {
                let count = await todoApi.urge(this.todoId);
                this.$notify({text: `已催办 ${count} 人`, type: 'success'});
            } catch (e) {
                this.$notify({text: e.message, type: 'error'});
            } finally {
                this.busy = false;
            }
        },
        async edit() {
            this.menuShown = false;
            let edited = await showTodoEdit(this, {editing: this.todo});
            if (edited) {
                this.todo = edited;
            }
        },
        remove() {
            this.menuShown = false;
            this.$alert({
                title: '删除待办',
                content: '删除后负责人也看不到这条待办，确定删除？',
                confirmText: '删除',
                confirmCallback: async () => {
                    try {
                        await todoApi.delete(this.todoId);
                        todoStore.applyDeleted(this.todoId);
                        if (this.asDialog) {
                            this.close();
                        } else {
                            this.$emit('deleted', this.todoId);
                        }
                    } catch (e) {
                        this.$notify({text: e.message, type: 'error'});
                    }
                },
            });
        },
        addAssignees() {
            let members = store.getGroupMemberUserInfos(this.todo.groupId, true);
            let current = (this.todo.assignees || []).map(a => a.userId);
            this.$pickContact({
                title: '添加负责人',
                users: members,
                initialCheckedUsers: members.filter(u => current.indexOf(u.uid) >= 0),
                showCategoryLabel: false,
                successCB: users => {
                    let add = users.map(u => u.uid).filter(uid => current.indexOf(uid) < 0);
                    if (add.length) {
                        this.run(() => todoApi.changeAssignees(this.todoId, add, []));
                    }
                },
            });
        },
        removeAssignee(userId) {
            this.run(() => todoApi.changeAssignees(this.todoId, [], [userId]));
        },
        // 跳回来源消息：本地找不到那条消息就只打开会话并提示
        openSource() {
            let source = this.todo.source;
            let message = source.messageUid ? wfc.getMessageByUid(source.messageUid) : null;
            if (!message) {
                this.$notify({text: '原消息已不存在', type: 'info'});
            }
            this.openConversation(todoSourceConversation(source), message);
        },
        openGroup() {
            this.openConversation(new Conversation(ConversationType.Group, this.todo.groupId, 0));
        },
        openConversation(conversation, focusMessage = null) {
            if (!store.state.misc.isMainWindow) {
                return;
            }
            if (this.asDialog) {
                this.close();
            }
            store.setCurrentConversation(conversation);
            if (this.$router.currentRoute.value.path !== '/home') {
                this.$router.replace('/home');
            }
            if (focusMessage) {
                // 会话里已经加载了这条消息就滚过去
                setTimeout(() => this.$eventBus.$emit('scrollToMessage', focusMessage.messageId), 300);
            }
        },
        close() {
            this.$modal.hide('todo-detail-modal-' + this.todoId);
        },
    },
}
</script>

<style scoped>
.todo-detail.embedded {
    height: 100%;
    max-height: none;
    background: var(--background-primary);
}

.todo-detail.embedded .todo-dialog-header {
    height: 60px;
    box-sizing: border-box;
}

.todo-detail.window-controls .todo-dialog-header {
    padding-right: 140px;
}

.todo-detail-body {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    min-height: 120px;
}

.todo-detail-content {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding-bottom: 12px;
}

.todo-detail-content .todo-checkbox {
    margin-top: 3px;
    cursor: default;
}

.todo-detail-content p {
    flex: 1;
    min-width: 0;
    font-size: var(--font-size-base, 14px);
    font-weight: 500;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-all;
}

.todo-detail-content p.done {
    color: var(--text-secondary);
    text-decoration: line-through;
}

.todo-detail-row {
    display: flex;
    align-items: flex-start;
    padding: 6px 0;
    font-size: var(--font-size-sm, 13px);
    line-height: 1.5;
}

.todo-detail-label {
    flex: 0 0 72px;
    color: var(--text-secondary);
}

.todo-detail-row a {
    color: var(--text-link);
}

.todo-detail-source {
    flex: 1;
    min-width: 0;
    color: var(--text-secondary) !important;
}

.todo-detail-assignees {
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px solid var(--border-secondary);
    font-size: var(--font-size-sm, 13px);
}

.todo-detail-assignees-title {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-bottom: 8px;
}

.todo-detail-assignees-title a {
    margin-left: auto;
    color: var(--text-link);
}

.todo-detail-assignees .todo-progress {
    padding-bottom: 8px;
}

.todo-detail-assignee {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 5px 0;
}

.todo-detail-assignee img {
    width: 28px;
    height: 28px;
    border-radius: 4px;
    object-fit: cover;
}

.todo-detail-assignee-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
}

.todo-detail-hint {
    margin-top: 12px;
    font-size: var(--font-size-xs, 12px);
    color: var(--text-secondary);
}
</style>
