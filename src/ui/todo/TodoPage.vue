<template>
    <section class="todo-page">
        <section class="todo-list-panel">
            <div class="todo-list-header">
                <span class="todo-list-title">待办</span>
                <span class="todo-icon-button" title="新建待办" @click="create"><i class="icon-ion-plus"></i></span>
            </div>
            <div class="todo-tabs">
                <span v-for="tab in tabs" :key="tab.box" :class="{active: box === tab.box}" @click="box = tab.box">
                    {{ tab.label }}<em v-if="tab.box === 'pending' && pendingCount > 0">{{ pendingCount }}</em>
                </span>
            </div>
            <div class="todo-list" @scroll="onScroll">
                <div v-if="state.loading[box] && !items.length" class="todo-empty">加载中…</div>
                <div v-else-if="state.errors[box] && !items.length" class="todo-empty">
                    <a href="javascript:" @click="refresh">加载失败，点击重试</a>
                </div>
                <div v-else-if="!items.length" class="todo-empty">
                    {{ emptyText }}
                    <template v-if="box === 'pending'"><br>在群聊工具栏里新建待办分给大家，或右键消息设为待办</template>
                </div>
                <template v-else>
                    <TodoListItem v-for="todo in items" :key="todo.id" :todo="todo" :active="selectedId === todo.id"
                                  @select="selectedId = todo.id"/>
                    <div v-if="hasMore" class="todo-load-more">{{ state.loading[box] ? '加载中…' : '' }}</div>
                </template>
            </div>
        </section>
        <section class="todo-detail-panel">
            <TodoDetailView v-if="selectedId" :key="selectedId" :todo-id="selectedId" @deleted="selectedId = 0"/>
            <div v-else class="todo-empty todo-detail-placeholder">
                <i class="icon-ion-android-checkbox-outline"></i>
                <p>选择一条待办查看详情</p>
            </div>
        </section>
    </section>
</template>

<script>
import todoStore, {TodoBox} from "./todoStore";
import TodoListItem from "./TodoListItem.vue";
import TodoDetailView from "./TodoDetailView.vue";
import {showTodoEdit} from "./todoUi";
import './todo.css';

/**
 * 待办页（侧栏「待办」页签）：左边「待处理 / 我分配的 / 已完成」三个列表，右边常驻详情。
 */
export default {
    name: "TodoPage",
    data() {
        return {
            state: todoStore.state,
            box: TodoBox.PENDING,
            selectedId: 0,
            tabs: [
                {box: TodoBox.PENDING, label: '待处理'},
                {box: TodoBox.ASSIGNED, label: '我分配的'},
                {box: TodoBox.DONE, label: '已完成'},
            ],
        };
    },
    activated() {
        todoStore.setListVisible(true);
        todoStore.ensureFresh();
    },
    deactivated() {
        todoStore.setListVisible(false);
    },
    computed: {
        items() {
            return this.state.items[this.box];
        },
        hasMore() {
            return todoStore.hasMore(this.box);
        },
        pendingCount() {
            return this.state.stat ? this.state.stat.pending : this.state.items[TodoBox.PENDING].length;
        },
        emptyText() {
            return {
                [TodoBox.PENDING]: '没有待处理的事项',
                [TodoBox.ASSIGNED]: '还没有分配给别人的待办',
                [TodoBox.DONE]: '还没有完成的待办',
            }[this.box];
        },
    },
    methods: {
        refresh() {
            todoStore.refresh(this.box);
        },
        onScroll(e) {
            let el = e.target;
            if (this.hasMore && el.scrollTop + el.clientHeight >= el.scrollHeight - 40) {
                todoStore.loadMore(this.box);
            }
        },
        async create() {
            let todo = await showTodoEdit(this);
            if (todo) {
                this.box = TodoBox.PENDING;
                this.selectedId = todo.id;
            }
        },
    },
    components: {
        TodoListItem,
        TodoDetailView,
    },
}
</script>

<style scoped>
.todo-page {
    flex: 1;
    display: flex;
    height: 100%;
    min-width: 0;
}

.todo-list-panel {
    width: var(--list-panel-width);
    flex: 0 0 var(--list-panel-width);
    height: 100%;
    display: flex;
    flex-direction: column;
    border-right: 1px solid var(--border-primary);
    background: var(--background-secondary);
}

.todo-list-header {
    flex: 0 0 60px;
    display: flex;
    align-items: center;
    padding: 0 12px 0 16px;
    -webkit-app-region: drag;
}

.todo-list-header .todo-icon-button {
    -webkit-app-region: no-drag;
}

.todo-list-title {
    flex: 1;
    font-size: var(--font-size-lg, 16px);
    font-weight: 500;
}

.todo-tabs {
    flex: 0 0 auto;
    display: flex;
    gap: 16px;
    padding: 0 16px;
    border-bottom: 1px solid var(--border-primary);
    font-size: var(--font-size-sm, 13px);
}

.todo-tabs span {
    padding: 8px 0;
    cursor: pointer;
    color: var(--text-secondary);
    border-bottom: 2px solid transparent;
    white-space: nowrap;
}

.todo-tabs span.active {
    color: var(--accent-color);
    border-bottom-color: var(--accent-color);
}

.todo-tabs em {
    font-style: normal;
    margin-left: 4px;
    padding: 0 5px;
    border-radius: 8px;
    font-size: 11px;
    color: var(--text-on-accent);
    background: var(--background-badge);
}

.todo-list {
    flex: 1;
    overflow-y: auto;
}

.todo-load-more {
    height: 32px;
    line-height: 32px;
    text-align: center;
    font-size: var(--font-size-xs, 12px);
    color: var(--text-hint);
}

.todo-detail-panel {
    flex: 1;
    min-width: 0;
    height: 100%;
    background: var(--background-primary);
}

.todo-detail-placeholder {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
}

.todo-detail-placeholder i {
    font-size: 48px;
    color: var(--border-strong);
}
</style>
