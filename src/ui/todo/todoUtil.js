import wfc from "../../wfc/client/wfc";
import Conversation from "../../wfc/model/conversation";

// 内容上限，与服务端一致
export const TODO_MAX_CONTENT = 500;

// 提醒选项：提前多少分钟，-1 = 不提醒，0 = 截止时
export const TodoRemind = {
    NONE: -1,
    AT_DUE: 0,
    MIN15: 15,
    HOUR1: 60,
    DAY1: 1440,
};
export const TODO_REMIND_OPTIONS = [TodoRemind.NONE, TodoRemind.AT_DUE, TodoRemind.MIN15, TodoRemind.HOUR1, TodoRemind.DAY1];
// 设了截止时间时的默认提醒
export const TODO_REMIND_DEFAULT = TodoRemind.MIN15;

export function todoRemindLabel(remindBefore) {
    switch (remindBefore) {
        case TodoRemind.NONE:
            return '不提醒';
        case TodoRemind.AT_DUE:
            return '截止时';
        case TodoRemind.MIN15:
            return '提前 15 分钟';
        case TodoRemind.HOUR1:
            return '提前 1 小时';
        case TodoRemind.DAY1:
            return '提前 1 天';
        default:
            return `提前 ${remindBefore} 分钟`;
    }
}

function pad(n) {
    return n < 10 ? '0' + n : '' + n;
}

/** 待办里的时间写法：今天 18:00 / 明天 09:00 / 昨天 18:00 / 10月10日 18:00 / 2027年1月3日 18:00 */
export function formatTodoTime(ms) {
    let dt = new Date(ms);
    let now = new Date();
    let hm = `${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
    let startOf = d => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    let days = Math.round((startOf(dt) - startOf(now)) / 86400000);
    if (days === 0) {
        return `今天 ${hm}`;
    }
    if (days === 1) {
        return `明天 ${hm}`;
    }
    if (days === -1) {
        return `昨天 ${hm}`;
    }
    if (dt.getFullYear() === now.getFullYear()) {
        return `${dt.getMonth() + 1}月${dt.getDate()}日 ${hm}`;
    }
    return `${dt.getFullYear()}年${dt.getMonth() + 1}月${dt.getDate()}日 ${hm}`;
}

/** 截止时间的快捷选项：今天 18:00（已经过了就不给）、明天 18:00、下周一 18:00 */
export function todoDueShortcuts() {
    let now = new Date();
    let today18 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 18);
    let tomorrow18 = new Date(today18.getTime());
    tomorrow18.setDate(tomorrow18.getDate() + 1);
    // 下周一：今天是周一也算下一个周一（getDay 周日为 0）
    let weekday = now.getDay() === 0 ? 7 : now.getDay();
    let nextMonday18 = new Date(today18.getTime());
    nextMonday18.setDate(nextMonday18.getDate() + (1 - weekday + 7));
    let shortcuts = [];
    if (now < today18) {
        shortcuts.push({time: today18.getTime(), label: '今天 18:00'});
    }
    shortcuts.push({time: tomorrow18.getTime(), label: '明天 18:00'});
    shortcuts.push({time: nextMonday18.getTime(), label: '下周一 18:00'});
    return shortcuts;
}

// 卡片 / 详情上的状态：进行中 / 已逾期 / 已完成（全员完成）/ 已结束 / 已删除
export const TodoState = {
    OPEN: 'open',
    OVERDUE: 'overdue',
    ALL_DONE: 'allDone',
    ENDED: 'ended',
    DELETED: 'deleted',
};

export function todoStateOf({status, closed, deleted = false, dueAt, doneCount, assigneeCount}) {
    if (deleted) {
        return TodoState.DELETED;
    }
    if (status === 1) {
        return closed || doneCount < assigneeCount ? TodoState.ENDED : TodoState.ALL_DONE;
    }
    if (dueAt > 0 && dueAt < Date.now()) {
        return TodoState.OVERDUE;
    }
    return TodoState.OPEN;
}

export function todoStateLabel(state) {
    return {
        [TodoState.OPEN]: '进行中',
        [TodoState.OVERDUE]: '已逾期',
        [TodoState.ALL_DONE]: '已完成',
        [TodoState.ENDED]: '已结束',
        [TodoState.DELETED]: '已删除',
    }[state];
}

/** 列表里勾选框的状态：负责人看自己那份，非负责人（我分配的）看整条 */
export function todoChecked(todo) {
    return todo.myDone != null ? todo.myDone : todo.status === 1;
}

/** 截止时间已过、我这边还没处理完 */
export function todoOverdue(todo) {
    return todo.dueAt > 0 && todo.status !== 1 && todo.myDone !== true && todo.dueAt < Date.now();
}

export function isGroupTodo(todo) {
    return !!todo.groupId;
}

/** 用户显示名：群待办优先用群名片 */
export function todoUserName(userId, groupId = '') {
    if (!userId) {
        return '';
    }
    let userInfo = wfc.getUserInfo(userId, false, groupId || '');
    return wfc.getGroupMemberDisplayNameEx ? wfc.getGroupMemberDisplayNameEx(userInfo) : userInfo.displayName;
}

/** 一串名字：张三、李四、王五 等 8 人 */
export function todoNames(userIds, groupId = '', total = 0, maxNames = 3) {
    let names = (userIds || []).slice(0, maxNames).map(uid => todoUserName(uid, groupId));
    let count = Math.max(total, (userIds || []).length);
    let text = names.join('、');
    if (count > names.length) {
        text += ` 等 ${count} 人`;
    }
    return text;
}

/** 来源一行：来自 群名 / 来自 张三 */
export function todoSourceLabel(todo) {
    if (todo.groupId) {
        let groupInfo = wfc.getGroupInfo(todo.groupId);
        return groupInfo ? `来自 ${groupInfo.remark || groupInfo.name}` : '';
    }
    let source = todo.source;
    if (source && source.convType === 1 && source.target) {
        let groupInfo = wfc.getGroupInfo(source.target);
        return groupInfo ? `来自 ${groupInfo.remark || groupInfo.name}` : '';
    }
    if (source && source.senderId && source.senderId !== wfc.getUserId()) {
        return `来自 ${todoUserName(source.senderId)}`;
    }
    if (source && source.convType === 0 && source.target && source.target !== wfc.getUserId()) {
        return `来自 ${todoUserName(source.target)}`;
    }
    return '';
}

export function todoSourceConversation(source) {
    return new Conversation(source.convType, source.target, source.line || 0);
}

/** 截到指定字符数（按码点，不切开 emoji） */
export function clipText(text, max) {
    let chars = Array.from(text || '');
    return chars.length <= max ? (text || '') : chars.slice(0, max).join('');
}
