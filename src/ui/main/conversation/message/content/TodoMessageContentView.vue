<template>
    <div class="todo-card" :class="{out: message.direction === 0}" @click="open">
        <!-- 新建时那张卡：内容、截止、负责人、进度 -->
        <template v-if="content.isCreate()">
            <div class="todo-card-head">
                <i class="icon-ion-android-checkbox-outline"></i>
                <span>群待办</span>
                <span class="todo-chip" :class="state">{{ stateLabel }}</span>
            </div>
            <p class="todo-card-content" :class="{deleted: content.deleted}">{{ content.content }}</p>
            <span v-if="content.srcDigest" class="todo-quote todo-card-quote">{{ quote }}</span>
            <div v-if="content.dueAt > 0" class="todo-card-field">
                <span>截止</span>
                <span :class="{'todo-danger': state === 'overdue'}">{{ formatTime(content.dueAt) }}</span>
            </div>
            <div class="todo-card-field">
                <span>负责人</span>
                <TodoAvatars :user-ids="content.assignees" :group-id="groupId"/>
                <span class="todo-card-names">{{ names(content.assignees, content.assigneeCount) }}</span>
            </div>
            <div v-if="content.assigneeCount > 1" class="todo-progress todo-card-progress">
                <div class="todo-progress-bar">
                    <div :style="{width: progress + '%'}"></div>
                </div>
                <span>{{ content.doneCount }}/{{ content.assigneeCount }}</span>
            </div>
        </template>

        <!-- 之后每个动作的记录卡：谁做了什么 + 当时的进度 -->
        <template v-else>
            <div class="todo-card-action">
                <i :class="actionIcon"></i>
                <span>{{ actionText }}</span>
            </div>
            <p class="todo-card-content small" :class="{deleted: content.deleted}">{{ content.content }}</p>
            <p v-if="content.added.length" class="todo-card-meta">新增 {{ names(content.added) }}</p>
            <p v-if="content.removed.length" class="todo-card-meta">移除 {{ names(content.removed) }}</p>
            <p v-if="content.action === 'edit' && content.dueAt > 0" class="todo-card-meta">{{ formatTime(content.dueAt) }} 截止</p>
            <div v-if="showActivityProgress" class="todo-progress todo-card-progress">
                <div class="todo-progress-bar">
                    <div :style="{width: progress + '%'}"></div>
                </div>
                <span>{{ content.doneCount }}/{{ content.assigneeCount }}</span>
            </div>
        </template>

        <div v-if="content.isCreate()" class="todo-card-footer">
            <span>查看详情</span>
            <!-- 按我现在的状态显示（不看快照）：我是负责人且还没完成 -->
            <button v-if="canDone" class="todo-button primary" :disabled="busy" @click.stop="done">完成</button>
        </div>
    </div>
</template>

<script>
import Message from "../../../../../wfc/messages/message";
import todoApi from "../../../../../api/todoApi";
import todoStore from "../../../../todo/todoStore";
import TodoAvatars from "../../../../todo/TodoAvatars.vue";
import {showTodoDetail} from "../../../../todo/todoUi";
import {formatTodoTime, todoNames, todoStateLabel, todoStateOf} from "../../../../todo/todoUtil";
import TodoMessageContent from "../../../../../wfc/messages/todoMessageContent";
import '../../../../todo/todo.css';

/**
 * 群待办卡片（1101 / 1103）。卡片是发出那一刻的快照，点开详情总是取服务端最新状态。
 */
export default {
    name: "TodoMessageContentView",
    props: {
        message: {
            type: Message,
            required: true,
        }
    },
    data() {
        return {
            busy: false,
            todoState: todoStore.state,
        };
    },
    computed: {
        content() {
            return this.message.messageContent;
        },
        groupId() {
            return this.message.conversation.target;
        },
        state() {
            return todoStateOf(this.content);
        },
        stateLabel() {
            return todoStateLabel(this.state);
        },
        progress() {
            return this.content.assigneeCount ? this.content.doneCount * 100 / this.content.assigneeCount : 0;
        },
        quote() {
            let name = this.content.srcSenderId ? todoNames([this.content.srcSenderId], this.groupId) : '';
            return name ? `${name}：${this.content.srcDigest}` : this.content.srcDigest;
        },
        canDone() {
            // 依赖 revision，待办变了要重新判断
            this.todoState.revision;
            return !this.content.deleted && !this.content.isFinished() && todoStore.isMinePending(this.content.todoId);
        },
        showActivityProgress() {
            return this.content.assigneeCount > 1 && !this.content.deleted && this.content.action !== TodoMessageContent.ACTION_EDIT;
        },
        actionText() {
            let c = this.content;
            return {
                [TodoMessageContent.ACTION_DONE]: c.isAllDone() ? '完成了待办，全部完成' : '完成了待办',
                [TodoMessageContent.ACTION_UNDONE]: '取消了完成',
                [TodoMessageContent.ACTION_CLOSE]: '结束了待办',
                [TodoMessageContent.ACTION_REOPEN]: '重新打开了待办',
                [TodoMessageContent.ACTION_ASSIGNEES]: '调整了负责人',
                [TodoMessageContent.ACTION_DELETE]: '删除了待办',
            }[c.action] || '修改了待办';
        },
        actionIcon() {
            return {
                [TodoMessageContent.ACTION_DONE]: 'icon-ion-checkmark-circled done',
                [TodoMessageContent.ACTION_DELETE]: 'icon-ion-close danger',
            }[this.content.action] || 'icon-ion-android-checkbox-outline';
        },
    },
    methods: {
        formatTime: formatTodoTime,
        names(userIds, total = 0) {
            return todoNames(userIds, this.groupId, total);
        },
        open() {
            if (!this.content.todoId || this.content.deleted) {
                return;
            }
            showTodoDetail(this, this.content.todoId);
        },
        async done() {
            this.busy = true;
            try {
                todoStore.applyChanged(await todoApi.setDone(this.content.todoId, true));
            } catch (e) {
                this.$notify({text: e.message, type: 'error'});
            } finally {
                this.busy = false;
            }
        },
    },
    components: {
        TodoAvatars,
    },
}
</script>

<style scoped>
.todo-card {
    margin: 0 8px;
    width: 280px;
    padding: 12px;
    border-radius: var(--radius-md, 8px);
    background-color: var(--background-primary);
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: var(--font-size-xs, 12px);
    color: var(--text-secondary);
}

.todo-card-head, .todo-card-action {
    display: flex;
    align-items: center;
    gap: 6px;
}

.todo-card-head span:nth-child(2) {
    flex: 1;
}

.todo-card-head i {
    color: var(--accent-color);
    font-size: 15px;
}

.todo-card-action {
    font-size: var(--font-size-sm, 13px);
    font-weight: 500;
    color: var(--text-primary);
}

.todo-card-action i {
    color: var(--accent-color);
}

.todo-card-action i.done {
    color: var(--status-success);
}

.todo-card-action i.danger {
    color: var(--text-danger);
}

.todo-card-content {
    font-size: var(--font-size-base, 14px);
    font-weight: 600;
    line-height: 1.4;
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 4;
    -webkit-box-orient: vertical;
    word-break: break-all;
}

.todo-card-content.small {
    font-size: var(--font-size-sm, 13px);
    font-weight: normal;
    color: var(--text-secondary);
    -webkit-line-clamp: 2;
}

.todo-card-content.deleted {
    text-decoration: line-through;
    color: var(--text-tertiary);
}

.todo-card-field {
    display: flex;
    align-items: center;
    gap: 6px;
}

.todo-card-field > span:first-child {
    flex: 0 0 40px;
    color: var(--text-tertiary);
}

.todo-card-names {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    color: var(--text-primary);
}

.todo-card-meta {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
}

.todo-card-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 4px;
    padding-top: 8px;
    border-top: 1px solid var(--border-secondary);
}

.todo-card-footer .todo-button {
    height: 24px;
    padding: 0 12px;
    font-size: var(--font-size-xs, 12px);
}
</style>
