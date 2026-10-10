<template>
    <div class="todo-notify" :class="{out: message.direction === 0}" @click="open">
        <div class="todo-notify-title">
            <i :class="urge ? 'icon-ion-android-hand' : 'icon-ion-android-alarm-clock'"></i>
            <span>{{ title }}</span>
        </div>
        <p class="todo-notify-content">{{ content.content }}</p>
        <p v-if="content.dueAt > 0" class="todo-notify-due" :class="{'todo-danger': overdue}">
            {{ formatTime(content.dueAt) }}{{ overdue ? ' 已逾期' : ' 截止' }}
        </p>
        <div class="todo-notify-footer">
            <span>查看详情</span>
            <button v-if="canDone" class="todo-button primary" :disabled="busy" @click.stop="done">完成</button>
        </div>
    </div>
</template>

<script>
import Message from "../../../../../wfc/messages/message";
import TodoNotifyMessageContent from "../../../../../wfc/messages/todoNotifyMessageContent";
import todoApi from "../../../../../api/todoApi";
import todoStore from "../../../../todo/todoStore";
import {showTodoDetail} from "../../../../todo/todoUi";
import {formatTodoTime, todoUserName} from "../../../../todo/todoUtil";
import '../../../../todo/todo.css';

/**
 * 待办通知（1102）：待办助手单聊发来的到点提醒 / 催办
 */
export default {
    name: "TodoNotifyMessageContentView",
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
        urge() {
            return this.content.kind === TodoNotifyMessageContent.KIND_URGE;
        },
        title() {
            if (this.urge && this.content.operatorId) {
                return `${todoUserName(this.content.operatorId, this.content.groupId)} 催你完成待办`;
            }
            return '待办提醒';
        },
        overdue() {
            return this.content.dueAt > 0 && this.content.dueAt < Date.now();
        },
        canDone() {
            this.todoState.revision;
            return todoStore.isMinePending(this.content.todoId);
        },
    },
    methods: {
        formatTime: formatTodoTime,
        open() {
            if (this.content.todoId) {
                showTodoDetail(this, this.content.todoId);
            }
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
}
</script>

<style scoped>
.todo-notify {
    margin: 0 8px;
    width: 260px;
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

.todo-notify-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: var(--font-size-sm, 13px);
    font-weight: 600;
    color: var(--text-primary);
}

.todo-notify-title i {
    color: var(--status-warning);
    font-size: 15px;
}

.todo-notify-content {
    font-size: var(--font-size-sm, 13px);
    line-height: 1.5;
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    word-break: break-all;
}

.todo-notify-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 4px;
    padding-top: 8px;
    border-top: 1px solid var(--border-secondary);
}

.todo-notify-footer .todo-button {
    height: 24px;
    padding: 0 12px;
    font-size: var(--font-size-xs, 12px);
}
</style>
