import {reactive} from 'vue';
import todoApi from "../../api/todoApi";
import {CODE_FEATURE_DISABLED} from "../../api/appServiceAuth";
import Config from "../../config";
import MessageContentType from "../../wfc/messages/messageContentType";

/**
 * 待办的应用级状态：功能是否可用、三个列表、待处理计数。与 wf-enterprise-chat 的 TodoStore 对应。
 *
 * 列表页、详情、会话里的卡片都读它、改它，改完一处其余地方跟着刷新。
 * 功能是否可用由主窗口连上 IM 后调 /api/todo/stat 探测（服务端 app.feature.todo=false 时 404），结果存在本地，
 * 下次启动先按存的值显示入口，避免入口闪一下；子窗口直接读存的值。
 */

export const TodoBox = {
    // 待处理：我负责、我没完成、没结束
    PENDING: 'pending',
    // 我分配的：我建的、负责人里有别人的群待办，没结束
    ASSIGNED: 'assigned',
    // 已完成：我那份完成了，或已结束
    DONE: 'done',
};

const BOXES = [TodoBox.PENDING, TodoBox.ASSIGNED, TodoBox.DONE];
const AVAILABLE_KEY = 'todo_available';
const DONE_PAGE_SIZE = 50;

export function isTodoMessageType(type) {
    return type === MessageContentType.Todo || type === MessageContentType.Todo_Activity || type === MessageContentType.Todo_Notify;
}

function readAvailable() {
    try {
        return localStorage.getItem(AVAILABLE_KEY) === '1';
    } catch (e) {
        return false;
    }
}

function writeAvailable(value) {
    try {
        value ? localStorage.setItem(AVAILABLE_KEY, '1') : localStorage.removeItem(AVAILABLE_KEY);
    } catch (e) {
        // ignore
    }
}

const state = reactive({
    // 服务端开了待办功能，决定所有入口显不显示（客户端关掉待办时 probe 会置为 false）
    available: readAvailable(),
    // {pending, overdue}
    stat: null,
    items: {pending: [], assigned: [], done: []},
    cursors: {pending: null, assigned: null, done: null},
    loaded: {pending: false, assigned: false, done: false},
    loading: {pending: false, assigned: false, done: false},
    errors: {pending: null, assigned: null, done: null},
    // 每次有待办变动加一，详情看到它变了就重拉自己那一条
    revision: 0,
});

// 列表页不在时收到变动，只记一笔，下次打开再拉
let stale = false;
// 列表页是否开着（开着时变动合并刷新）
let listVisible = 0;
let refreshTimer = null;
const scheduled = new Set();

const todoStore = {
    state,

    /**
     * 调一次 stat：成功即可用；服务端返回「功能未开启」就隐藏入口；网络不通等其它错误不改变现状
     */
    async probe() {
        if (!Config.TODO_SERVER) {
            this._setAvailable(false);
            return;
        }
        try {
            state.stat = await todoApi.stat();
            this._setAvailable(true);
        } catch (e) {
            if (e && e.errorCode === CODE_FEATURE_DISABLED) {
                this._setAvailable(false);
            }
        }
    },

    _setAvailable(value) {
        state.available = value;
        writeAvailable(value);
    },

    /** 退出登录：清掉上个账号的一切 */
    reset() {
        BOXES.forEach(box => {
            state.items[box] = [];
            state.cursors[box] = null;
            state.loaded[box] = false;
            state.loading[box] = false;
            state.errors[box] = null;
        });
        state.stat = null;
        stale = false;
        this._setAvailable(false);
    },

    /** 已完成还有下一页 */
    hasMore(box) {
        return box === TodoBox.DONE && !!state.cursors[box];
    },

    async refresh(box) {
        state.loading[box] = true;
        try {
            let page = await todoApi.list(box, null, box === TodoBox.DONE ? DONE_PAGE_SIZE : null);
            state.items[box] = (page && page.items) || [];
            state.cursors[box] = (page && page.nextCursor) || null;
            state.loaded[box] = true;
            state.errors[box] = null;
        } catch (e) {
            state.errors[box] = e;
        } finally {
            state.loading[box] = false;
        }
    },

    /**
     * 没拉过就拉一次（会话里的卡片用来判断「我还没完成」），失败了不自动重试。
     * 可以在渲染时调：真正的请求挪到微任务里，同一轮里多张卡片只发一次
     */
    ensureLoaded(box) {
        if (!state.available || state.loaded[box] || state.loading[box] || state.errors[box] || scheduled.has(box)) {
            return;
        }
        scheduled.add(box);
        Promise.resolve().then(() => {
            scheduled.delete(box);
            this.refresh(box);
        });
    },

    async loadMore(box) {
        let cursor = state.cursors[box];
        if (!cursor || state.loading[box]) {
            return;
        }
        state.loading[box] = true;
        try {
            let page = await todoApi.list(box, cursor, DONE_PAGE_SIZE);
            state.items[box] = state.items[box].concat((page && page.items) || []);
            state.cursors[box] = (page && page.nextCursor) || null;
        } catch (e) {
            state.errors[box] = e;
        } finally {
            state.loading[box] = false;
        }
    },

    /** 三个列表 + 计数一起刷新 */
    async refreshAll() {
        stale = false;
        await Promise.all([...BOXES.map(box => this.refresh(box)), this._refreshStat()]);
    },

    /** 列表页打开时调：没拉过或者期间有变动才拉 */
    ensureFresh() {
        if (stale || BOXES.some(box => !state.loaded[box])) {
            return this.refreshAll();
        }
        return Promise.resolve();
    },

    async _refreshStat() {
        try {
            state.stat = await todoApi.stat();
        } catch (e) {
            // ignore
        }
    },

    /** 列表页可见性（列表页 activated / deactivated 时调） */
    setListVisible(visible) {
        listVisible += visible ? 1 : -1;
        if (listVisible < 0) {
            listVisible = 0;
        }
    },

    /**
     * 有待办变了（自己改的、收到群待办卡片 / 待办通知）。列表页开着就合并 300ms 内的多次变动刷一次，没开就只记下来
     */
    invalidate() {
        if (!state.available) {
            return;
        }
        state.revision++;
        if (!listVisible) {
            stale = true;
            this._refreshStat();
            // 会话里的卡片靠「待处理」列表判断要不要显示「完成」按钮，拉过的话也要跟着更新
            if (state.loaded[TodoBox.PENDING]) {
                clearTimeout(refreshTimer);
                refreshTimer = setTimeout(() => this.refresh(TodoBox.PENDING), 300);
            }
            return;
        }
        clearTimeout(refreshTimer);
        refreshTimer = setTimeout(() => this.refreshAll(), 300);
    },

    /** 自己刚改完一条（接口返回了最新状态）：先就地替换，勾选框立刻跟上，再整体刷新 */
    applyChanged(todo) {
        BOXES.forEach(box => {
            let list = state.items[box];
            let i = list.findIndex(t => t.id === todo.id);
            if (i >= 0) {
                list.splice(i, 1, todo);
            }
        });
        this.invalidate();
    },

    applyDeleted(id) {
        BOXES.forEach(box => {
            state.items[box] = state.items[box].filter(t => t.id !== id);
        });
        this.invalidate();
    },

    /** 这条待办在不在我的「待处理」里（会话卡片上的「完成」按钮用） */
    isMinePending(todoId) {
        if (!state.available) {
            return false;
        }
        this.ensureLoaded(TodoBox.PENDING);
        return state.items[TodoBox.PENDING].some(t => String(t.id) === String(todoId));
    },
};

export default todoStore;
