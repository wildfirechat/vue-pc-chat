import Config from "../../config";
import {showFeatureDialog} from "../util/featureDialog";
import PollHome from "./PollHome.vue";
import PollCreate from "./PollCreate.vue";
import PollList from "./PollList.vue";
import PollDetail from "./PollDetail.vue";

// 弹窗宽度与 wf-enterprise-chat 一致，高度随内容、最高不超过它的高度。桌面端不做弹窗套弹窗：入口选完即关，再开下一个；
// 只有「我的投票 → 投票详情」叠在列表上，关了详情回到列表。

function pollServiceReady(vm) {
    if (!Config.getPollServer()) {
        vm.$notify({text: vm.$t('poll.service_not_configured'), type: 'error'});
        return false;
    }
    return true;
}

/** 投票入口：发起投票 / 我的投票 */
export function showPollHome(vm, groupId) {
    if (!pollServiceReady(vm)) {
        return;
    }
    showFeatureDialog(vm, {
        component: PollHome, route: '/poll', query: {groupId},
        name: 'poll-home-modal', width: 400, height: 240,
    });
}

export function showPollCreate(vm, groupId) {
    showFeatureDialog(vm, {
        component: PollCreate, route: '/poll/create', query: {groupId},
        name: 'poll-create-modal', width: 460, height: 620, clickToClose: false,
    });
}

export function showPollList(vm, groupId) {
    showFeatureDialog(vm, {
        component: PollList, route: '/poll/list', query: {groupId},
        name: 'poll-list-modal', width: 460, height: 560,
    });
}

/**
 * 投票详情。从消息进入（fromMessage）是投票模式；创建者从「我的投票」进入是管理模式（结束 / 删除 / 导出）。
 * @param vm
 * @param {{pollId: string|number, groupId?: string, fromMessage?: boolean, messageId?: number, stack?: boolean, onClosed?: Function}} options
 */
export function showPollDetail(vm, {pollId, groupId, fromMessage = false, messageId = 0, stack = false, onClosed}) {
    if (!pollServiceReady(vm)) {
        return;
    }
    let query = {pollId: String(pollId), groupId: groupId || ''};
    if (fromMessage) {
        query.fromMessage = '1';
    }
    if (messageId) {
        query.messageId = String(messageId);
    }
    showFeatureDialog(vm, {
        component: PollDetail, route: '/poll/detail', query,
        name: 'poll-detail-modal', width: 460, height: 620, stack, onClosed,
    });
}
