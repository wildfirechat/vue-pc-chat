<template>
    <div class="todo-dialog group-todo">
        <div class="todo-dialog-header">
            <span class="todo-title">群待办</span>
            <span class="todo-icon-button" title="新建群待办" @click="create"><i class="icon-ion-plus"></i></span>
            <span class="todo-icon-button" @click="close"><i class="icon-ion-close"></i></span>
        </div>
        <div class="group-todo-tabs">
            <span :class="{active: !finished}" @click="switchTab(false)">进行中</span>
            <span :class="{active: finished}" @click="switchTab(true)">已结束</span>
        </div>
        <div class="group-todo-list" @scroll="onScroll">
            <div v-if="loading && !items.length" class="todo-empty">加载中…</div>
            <div v-else-if="error && !items.length" class="todo-empty">
                <a href="javascript:" @click="refresh">加载失败，点击重试</a>
            </div>
            <div v-else-if="!items.length" class="todo-empty">{{ finished ? '群里还没有已结束的待办' : '群里没有进行中的待办' }}</div>
            <template v-else>
                <TodoListItem v-for="todo in items" :key="todo.id" :todo="todo" :show-creator="true"
                              @select="open" @changed="refresh"/>
            </template>
        </div>
    </div>
</template>

<script>
import todoApi from "../../api/todoApi";
import todoStore from "./todoStore";
import TodoListItem from "./TodoListItem.vue";
import {showTodoDetail, showTodoEdit} from "./todoUi";
import './todo.css';

const PAGE_SIZE = 50;

/**
 * 某个群的全部待办（群聊信息 →「群待办」），群成员都能看。进行中的一次给全，已结束的分页。
 */
export default {
    name: "GroupTodoView",
    props: {
        groupId: {type: String, required: true},
    },
    data() {
        return {
            finished: false,
            items: [],
            cursor: null,
            loading: false,
            error: null,
            todoState: todoStore.state,
        };
    },
    created() {
        this.refresh();
    },
    watch: {
        'todoState.revision'() {
            this.refresh();
        },
    },
    methods: {
        switchTab(finished) {
            if (this.finished === finished) {
                return;
            }
            this.finished = finished;
            this.items = [];
            this.refresh();
        },
        async refresh() {
            let finished = this.finished;
            this.loading = true;
            try {
                let page = await todoApi.groupList(this.groupId, finished, null, finished ? PAGE_SIZE : null);
                if (finished !== this.finished) {
                    return;
                }
                this.items = (page && page.items) || [];
                this.cursor = (page && page.nextCursor) || null;
                this.error = null;
            } catch (e) {
                this.error = e;
                this.$notify({text: e.message, type: 'error'});
            } finally {
                this.loading = false;
            }
        },
        async loadMore() {
            if (!this.finished || !this.cursor || this.loading) {
                return;
            }
            this.loading = true;
            try {
                let page = await todoApi.groupList(this.groupId, true, this.cursor, PAGE_SIZE);
                this.items = this.items.concat((page && page.items) || []);
                this.cursor = (page && page.nextCursor) || null;
            } catch (e) {
                this.error = e;
            } finally {
                this.loading = false;
            }
        },
        onScroll(e) {
            let el = e.target;
            if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) {
                this.loadMore();
            }
        },
        open(todo) {
            showTodoDetail(this, todo.id);
        },
        async create() {
            let todo = await showTodoEdit(this, {groupId: this.groupId, groupTodo: true});
            if (todo) {
                this.refresh();
            }
        },
        close() {
            this.$modal.hide('group-todo-modal');
        },
    },
    components: {
        TodoListItem,
    },
}
</script>

<style scoped>
.group-todo {
    height: 70vh;
}

.group-todo-tabs {
    flex: 0 0 auto;
    display: flex;
    gap: 20px;
    padding: 0 16px;
    border-bottom: 1px solid var(--border-secondary);
    font-size: var(--font-size-sm, 13px);
}

.group-todo-tabs span {
    padding: 10px 0;
    cursor: pointer;
    color: var(--text-secondary);
    border-bottom: 2px solid transparent;
}

.group-todo-tabs span.active {
    color: var(--accent-color);
    border-bottom-color: var(--accent-color);
}

.group-todo-list {
    flex: 1;
    overflow-y: auto;
}
</style>
