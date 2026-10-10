import Config from "../config";
import {postWithAuthToken} from "./appServiceAuth";

/**
 * 待办接口：合并服务 wf-app-server 的 /api/todo/**（见其 docs/API.md「待办」）。
 * 鉴权与网盘、组织通讯录一样，整个应用服务共用一个 authToken。时间都是毫秒时间戳，messageUid 用字符串（超过 2^53）。
 *
 * 返回的待办：{id, creatorId, content, groupId, dueAt, remindBefore, remindAt, status(0 进行中 / 1 已结束),
 * closed(创建人手动结束), finishedAt, createdAt, updatedAt, source, assigneeCount, doneCount, myDone(我不是负责人时为 null),
 * assignees(只有详情带：[{userId, done, doneAt}])}
 */
export class TodoApi {
    // 错误码
    static CODE_NOT_EXIST = 8000;
    static CODE_CLOSED = 8007;

    _post(path, data = {}) {
        let baseUrl = Config.getTodoServer();
        if (!baseUrl) {
            return Promise.reject(new Error('未配置待办服务'));
        }
        return postWithAuthToken(baseUrl + path, data);
    }

    /**
     * 新建。带 groupId 是群待办（负责人只有自己也算，会往群里发卡片），不带是个人待办（不能指派给别人）
     * @param {{content: string, dueAt?: number, remindBefore?: number, groupId?: string, assignees?: string[], allMembers?: boolean, source?: Object}} params
     */
    create(params) {
        return this._post('', params);
    }

    /**
     * 我的待办列表
     * @param {string} box pending 待处理 / assigned 我分配的 / done 已完成（只有 done 分页）
     * @return {Promise<{items: Object[], nextCursor: string|null}>}
     */
    list(box, cursor = null, size = null) {
        let params = {box};
        if (cursor) {
            params.cursor = cursor;
        }
        if (size) {
            params.size = size;
        }
        return this._post('/list', params);
    }

    /**
     * 某个群的待办，当前群成员可看。finished=false 进行中一次给全，true 已结束分页
     */
    groupList(groupId, finished, cursor = null, size = null) {
        let params = {groupId, box: finished ? 'finished' : 'open'};
        if (cursor) {
            params.cursor = cursor;
        }
        if (size) {
            params.size = size;
        }
        return this._post('/group', params);
    }

    /**
     * {pending, overdue}；服务端关了待办功能时抛 errorCode 404 的错误，客户端据此隐藏入口
     */
    stat() {
        return this._post('/stat');
    }

    get(id) {
        return this._post(`/${id}`);
    }

    /** 改内容 / 截止 / 提醒（创建人），只改传了的字段 */
    update(id, {content, dueAt, remindBefore}) {
        let params = {};
        if (content !== undefined) {
            params.content = content;
        }
        if (dueAt !== undefined) {
            params.dueAt = dueAt;
        }
        if (remindBefore !== undefined) {
            params.remindBefore = remindBefore;
        }
        return this._post(`/${id}/update`, params);
    }

    /** 增减负责人（创建人，群待办） */
    changeAssignees(id, add = [], remove = []) {
        return this._post(`/${id}/assignees`, {add, remove});
    }

    /** 完成 / 取消完成自己那份（负责人） */
    setDone(id, done) {
        return this._post(`/${id}/done`, {done});
    }

    /** 结束 / 重新打开整条（创建人） */
    setClosed(id, closed) {
        return this._post(`/${id}/close`, {closed});
    }

    /** 催办没完成的负责人，返回催了几个人 */
    urge(id) {
        return this._post(`/${id}/urge`);
    }

    delete(id) {
        return this._post(`/${id}/delete`);
    }
}

const todoApi = new TodoApi();
export default todoApi;
