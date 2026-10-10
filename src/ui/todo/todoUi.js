import TodoEditView from "./TodoEditView.vue";
import TodoDetailView from "./TodoDetailView.vue";
import GroupTodoView from "./GroupTodoView.vue";

/**
 * 打开新建 / 编辑待办的弹窗。
 * @param vm 任意组件实例（用它的 $modal）
 * @param {{groupId?: string, groupTodo?: boolean, initialContent?: string, source?: Object, editing?: Object}} props
 *   groupId 在群里打开时多一行「负责人」；groupTodo 从群聊工具栏进来的一定发卡片（哪怕只指派给自己）；
 *   source 从消息新建时带上来源消息；editing 编辑已有的待办
 * @return {Promise<Object|null>} 新建 / 保存后的待办，取消时为 null
 */
export function showTodoEdit(vm, props = {}) {
    return new Promise(resolve => {
        vm.$modal.show(TodoEditView, props, null, {
            name: 'todo-edit-modal',
            width: 460,
            height: 'auto',
            clickToClose: false,
            escToClose: true,
        }, {
            'before-close': event => resolve((event && event.params && event.params.todo) || null),
        });
    });
}

/** 打开待办详情弹窗（会话里的卡片、群待办列表用） */
export function showTodoDetail(vm, todoId) {
    vm.$modal.show(TodoDetailView, {todoId: Number(todoId), asDialog: true}, null, {
        name: 'todo-detail-modal-' + todoId,
        width: 480,
        height: 'auto',
        clickToClose: true,
        escToClose: true,
    });
}

/** 打开某个群的群待办列表弹窗 */
export function showGroupTodo(vm, groupId) {
    vm.$modal.show(GroupTodoView, {groupId}, null, {
        name: 'group-todo-modal',
        width: 520,
        height: 'auto',
        clickToClose: true,
        escToClose: true,
    });
}
