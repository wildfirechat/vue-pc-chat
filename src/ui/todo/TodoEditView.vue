<template>
    <div class="todo-dialog todo-edit">
        <div class="todo-dialog-header">
            <span class="todo-title">{{ editing ? '编辑待办' : '新建待办' }}</span>
            <span class="todo-icon-button" @click="close(null)"><i class="icon-ion-close"></i></span>
        </div>
        <div class="todo-edit-body">
            <div class="todo-edit-content">
                <textarea ref="input" v-model="content" rows="4" placeholder="要做什么" maxlength="2000"></textarea>
                <span class="todo-edit-counter" :class="{'todo-danger': tooLong}">{{ contentLength }}/{{ maxContent }}</span>
            </div>

            <!-- 来源消息：可移除 -->
            <div v-if="sourceShown" class="todo-edit-field">
                <span class="todo-edit-label">来源</span>
                <div class="todo-edit-value todo-edit-source">
                    <span class="todo-quote">{{ sourceText }}</span>
                    <span class="todo-icon-button" title="移除" @click="sourceRemoved = true"><i class="icon-ion-close"></i></span>
                </div>
            </div>

            <div class="todo-edit-field">
                <span class="todo-edit-label">截止时间</span>
                <div class="todo-edit-value todo-edit-due">
                    <span class="todo-option" :class="{selected: !dueAt}" @click="dueAt = 0">不设置</span>
                    <span v-for="s in dueShortcuts" :key="s.time" class="todo-option" :class="{selected: dueAt === s.time}"
                          @click="setDue(s.time)">{{ s.label }}</span>
                    <input type="datetime-local" class="todo-datetime" :class="{selected: customDue}" :value="dueInputValue"
                           :min="minDueInputValue" @change="onCustomDue($event.target.value)">
                </div>
            </div>

            <div v-if="dueAt" class="todo-edit-field">
                <span class="todo-edit-label">提醒</span>
                <div class="todo-edit-value">
                    <select v-model.number="remindBefore" class="todo-select">
                        <option v-for="r in remindOptions" :key="r" :value="r">{{ remindLabel(r) }}</option>
                    </select>
                </div>
            </div>

            <!-- 负责人：只在群里新建时出现（编辑时在详情里增减） -->
            <div v-if="groupId && !editing" class="todo-edit-field">
                <span class="todo-edit-label">负责人</span>
                <div class="todo-edit-value todo-edit-assignees">
                    <label class="todo-edit-all">
                        <input type="checkbox" v-model="allMembers">所有人
                    </label>
                    <template v-if="!allMembers">
                        <span v-for="uid in assignees" :key="uid" class="todo-assignee-tag">
                            {{ uid === me ? '我自己' : userName(uid) }}
                            <i v-if="assignees.length > 1" class="icon-ion-close" @click="removeAssignee(uid)"></i>
                        </span>
                        <span class="todo-option" @click="pickAssignees"><i class="icon-ion-plus"></i> 添加</span>
                    </template>
                </div>
            </div>

            <p v-if="postToGroup" class="todo-edit-hint">发布后群里会收到这张待办卡片，负责人会被 @</p>
        </div>
        <div class="todo-dialog-footer">
            <button class="todo-button" @click="close(null)">取消</button>
            <button class="todo-button primary" :disabled="!canSubmit" @click="submit">{{ busy ? '提交中…' : (editing ? '保存' : '创建') }}</button>
        </div>
    </div>
</template>

<script>
import wfc from "../../wfc/client/wfc";
import store from "../../store";
import todoApi from "../../api/todoApi";
import todoStore from "./todoStore";
import {
    TODO_MAX_CONTENT,
    TODO_REMIND_DEFAULT,
    TODO_REMIND_OPTIONS,
    TodoRemind,
    todoDueShortcuts,
    todoRemindLabel,
    todoUserName
} from "./todoUtil";
import './todo.css';

function pad(n) {
    return n < 10 ? '0' + n : '' + n;
}

function toInputValue(ms) {
    let d = new Date(ms);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * 新建 / 编辑待办。与 wf-enterprise-chat 的 TodoEditScreen 对应：
 * - 群里打开（groupId 非空）时可以选负责人（默认自己）。指派了别人、选了所有人，或者从群聊工具栏进来（groupTodo），
 *   就是群待办，往群里发卡片；只有自己就是个人待办，不打扰群；
 * - 从消息新建时带上来源消息（source），可以移除。
 */
export default {
    name: "TodoEditView",
    props: {
        groupId: {type: String, default: ''},
        groupTodo: {type: Boolean, default: false},
        initialContent: {type: String, default: ''},
        source: {type: Object, default: null},
        editing: {type: Object, default: null},
    },
    data() {
        let editing = this.editing;
        let me = wfc.getUserId();
        return {
            me,
            maxContent: TODO_MAX_CONTENT,
            content: editing ? editing.content : (this.initialContent || ''),
            dueAt: editing ? (editing.dueAt || 0) : 0,
            remindBefore: editing && editing.dueAt ? editing.remindBefore : TODO_REMIND_DEFAULT,
            assignees: [me],
            allMembers: false,
            sourceRemoved: false,
            remindOptions: TODO_REMIND_OPTIONS,
            dueShortcuts: todoDueShortcuts(),
            busy: false,
        };
    },
    mounted() {
        this.$nextTick(() => this.$refs.input && this.$refs.input.focus());
    },
    computed: {
        contentLength() {
            return Array.from(this.content.trim()).length;
        },
        tooLong() {
            return this.contentLength > this.maxContent;
        },
        canSubmit() {
            return !this.busy && this.contentLength > 0 && !this.tooLong;
        },
        customDue() {
            return !!this.dueAt && !this.dueShortcuts.some(s => s.time === this.dueAt);
        },
        dueInputValue() {
            return this.customDue ? toInputValue(this.dueAt) : '';
        },
        minDueInputValue() {
            return toInputValue(Date.now());
        },
        sourceShown() {
            return !this.editing && this.source && !this.sourceRemoved;
        },
        sourceText() {
            let source = this.source;
            if (!source) {
                return '';
            }
            let groupId = source.convType === 1 ? source.target : '';
            let name = source.senderId ? todoUserName(source.senderId, groupId) : '';
            return name ? `${name}：${source.digest || ''}` : (source.digest || '');
        },
        // 群待办：发卡片到群里
        postToGroup() {
            return !!this.groupId && !this.editing
                && (this.groupTodo || this.allMembers || this.assignees.some(uid => uid !== this.me));
        },
    },
    methods: {
        remindLabel: todoRemindLabel,
        userName(uid) {
            return todoUserName(uid, this.groupId);
        },
        setDue(time) {
            if (!this.dueAt) {
                this.remindBefore = TODO_REMIND_DEFAULT;
            }
            this.dueAt = time;
        },
        onCustomDue(value) {
            if (!value) {
                return;
            }
            let time = new Date(value).getTime();
            if (!isNaN(time)) {
                this.setDue(time);
            }
        },
        removeAssignee(uid) {
            this.assignees = this.assignees.filter(u => u !== uid);
        },
        pickAssignees() {
            let members = store.getGroupMemberUserInfos(this.groupId, true);
            let checked = members.filter(u => this.assignees.indexOf(u.uid) >= 0);
            this.$pickContact({
                title: '选择负责人',
                users: members,
                initialCheckedUsers: checked,
                showCategoryLabel: false,
                successCB: users => {
                    let added = users.map(u => u.uid).filter(uid => this.assignees.indexOf(uid) < 0);
                    this.assignees = this.assignees.concat(added);
                },
            });
        },
        async submit() {
            if (!this.canSubmit) {
                return;
            }
            this.busy = true;
            let content = this.content.trim();
            let remindBefore = this.dueAt ? this.remindBefore : TodoRemind.NONE;
            try {
                let todo;
                if (this.editing) {
                    todo = await todoApi.update(this.editing.id, {content, dueAt: this.dueAt, remindBefore});
                    todoStore.applyChanged(todo);
                    this.$notify({text: '已保存', type: 'success'});
                } else {
                    let params = {
                        content,
                        dueAt: this.dueAt,
                        remindBefore,
                        assignees: this.allMembers ? [] : this.assignees,
                        allMembers: this.allMembers,
                    };
                    if (this.postToGroup) {
                        params.groupId = this.groupId;
                    }
                    if (this.sourceShown) {
                        params.source = this.source;
                    }
                    todo = await todoApi.create(params);
                    todoStore.invalidate();
                    this.$notify({text: todo.groupId ? '已在群里发布待办' : '已添加到待办', type: 'success'});
                }
                this.close(todo);
            } catch (e) {
                this.$notify({text: e.message, type: 'error'});
            } finally {
                this.busy = false;
            }
        },
        close(todo) {
            this.$modal.hide('todo-edit-modal', {todo});
        },
    },
}
</script>

<style scoped>
.todo-edit-body {
    padding: 14px 16px 4px;
    overflow-y: auto;
}

.todo-edit-content {
    position: relative;
}

.todo-edit-content textarea {
    width: 100%;
    box-sizing: border-box;
    resize: none;
    padding: 8px 10px 20px;
    border-radius: 4px;
    border: 1px solid var(--border-primary);
    background: var(--background-primary);
    color: var(--text-primary);
    font-size: var(--font-size-base, 14px);
    line-height: 1.5;
    outline: none;
}

.todo-edit-content textarea:focus {
    border-color: var(--accent-color);
}

.todo-edit-counter {
    position: absolute;
    right: 8px;
    bottom: 8px;
    font-size: var(--font-size-xs, 12px);
    color: var(--text-tertiary);
}

.todo-edit-field {
    display: flex;
    align-items: flex-start;
    padding-top: 12px;
    font-size: var(--font-size-sm, 13px);
}

.todo-edit-label {
    flex: 0 0 64px;
    line-height: 26px;
    color: var(--text-secondary);
}

.todo-edit-value {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
}

.todo-edit-source .todo-quote {
    flex: 1;
    min-width: 0;
}

.todo-option {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    height: 26px;
    padding: 0 10px;
    border-radius: 13px;
    border: 1px solid var(--border-primary);
    cursor: pointer;
    color: var(--text-primary);
    white-space: nowrap;
}

.todo-option:hover {
    border-color: var(--accent-color);
}

.todo-option.selected {
    border-color: var(--accent-color);
    color: var(--accent-color);
    background: var(--accent-color-subtle);
}

.todo-datetime, .todo-select {
    height: 26px;
    padding: 0 6px;
    border-radius: 4px;
    border: 1px solid var(--border-primary);
    background: var(--background-primary);
    color: var(--text-primary);
    font-size: var(--font-size-sm, 13px);
    outline: none;
}

.todo-datetime.selected {
    border-color: var(--accent-color);
    color: var(--accent-color);
}

.todo-edit-all {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-right: 6px;
    cursor: pointer;
}

.todo-assignee-tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    height: 26px;
    padding: 0 8px;
    border-radius: 13px;
    background: var(--background-tertiary);
}

.todo-assignee-tag i {
    cursor: pointer;
    color: var(--text-secondary);
    font-size: 12px;
}

.todo-edit-hint {
    padding-top: 12px;
    font-size: var(--font-size-xs, 12px);
    color: var(--text-secondary);
}
</style>
