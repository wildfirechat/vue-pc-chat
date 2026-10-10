<template>
    <div class="todo-row" :class="{active}" @click="$emit('select', todo)">
        <span class="todo-checkbox" :class="{checked, disabled: !canToggle}" @click.stop="toggle">
            <i class="icon-ion-checkmark"></i>
        </span>
        <div class="todo-row-main">
            <p class="todo-row-content" :class="{done: checked}">{{ todo.content }}</p>
            <p v-if="meta.length" class="todo-row-meta">
                <span v-for="(m, i) in meta" :key="i" :class="{'todo-danger': m.danger}">{{ m.text }}</span>
            </p>
        </div>
    </div>
</template>

<script>
import todoApi from "../../api/todoApi";
import todoStore from "./todoStore";
import {formatTodoTime, todoChecked, todoOverdue, todoSourceLabel, todoUserName} from "./todoUtil";
import './todo.css';

// 待办列表的一行：勾选框（点了直接完成 / 取消完成）、内容、截止时间 · 来源 · 进度
export default {
    name: "TodoListItem",
    props: {
        todo: {type: Object, required: true},
        active: {type: Boolean, default: false},
        // 群待办列表里显示「谁发起」，不显示来源
        showCreator: {type: Boolean, default: false},
    },
    emits: ['select', 'changed'],
    data() {
        return {
            busy: false,
        };
    },
    computed: {
        checked() {
            return todoChecked(this.todo);
        },
        // 只有负责人能勾自己那份；创建人结束了的要先重新打开
        canToggle() {
            return this.todo.myDone != null && !this.todo.closed;
        },
        meta() {
            let todo = this.todo;
            let meta = [];
            if (todo.dueAt > 0) {
                let overdue = todoOverdue(todo);
                meta.push({text: formatTodoTime(todo.dueAt) + (overdue ? ' 已逾期' : ' 截止'), danger: overdue});
            }
            if (this.showCreator) {
                meta.push({text: `${todoUserName(todo.creatorId, todo.groupId)} 发起`});
            } else {
                let source = todoSourceLabel(todo);
                source && meta.push({text: source});
            }
            if (todo.groupId && todo.assigneeCount > 1) {
                meta.push({text: `${todo.doneCount}/${todo.assigneeCount} 已完成`});
            }
            return meta;
        },
    },
    methods: {
        async toggle() {
            if (!this.canToggle) {
                if (this.todo.closed && this.todo.myDone != null) {
                    this.$notify({text: '待办已结束，创建人重新打开后才能修改完成状态', type: 'info'});
                }
                return;
            }
            if (this.busy) {
                return;
            }
            this.busy = true;
            try {
                let todo = await todoApi.setDone(this.todo.id, !this.todo.myDone);
                todoStore.applyChanged(todo);
                this.$emit('changed', todo);
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
.todo-row {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 12px 14px;
    cursor: pointer;
    border-bottom: 1px solid var(--border-separator);
}

.todo-row:hover {
    background: var(--background-item-hover);
}

.todo-row.active {
    background: var(--background-item-active);
}

.todo-row .todo-checkbox {
    margin-top: 1px;
}

.todo-row-main {
    flex: 1;
    min-width: 0;
}

.todo-row-content {
    font-size: var(--font-size-sm, 13px);
    line-height: 1.5;
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    word-break: break-all;
}

.todo-row-content.done {
    color: var(--text-secondary);
    text-decoration: line-through;
}

.todo-row-meta {
    margin-top: 4px;
    font-size: var(--font-size-xs, 12px);
    color: var(--text-secondary);
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
}

.todo-row-meta span + span::before {
    content: ' · ';
    color: var(--text-secondary);
}
</style>
