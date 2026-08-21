/**
 * DSH conversation runtime state (scope=31 user setting, type=1 状态).
 * The robot writes {state, phase, toolName, model, ...} JSON under the key
 * `<convType>-<line>-<target>_1`; every group member receives it as a user
 * setting (scope=31, conversation-scoped).
 */

import wfc from "../../wfc/client/wfc";
import UserSettingScope from "../../wfc/client/userSettingScope";
import ConversationType from "../../wfc/model/conversationType";

const DSH_STATE_TYPE = 1; // 1=状态 (business convention)

export function dshStateKey(conversation) {
    return `${conversation.type}-${conversation.line}-${conversation.target}_${DSH_STATE_TYPE}`;
}

/** 群 extra 是否带 {"dsh":true} 标记（容错：非 JSON 时返回 false）。 */
export function isDshGroupExtra(extra) {
    if (!extra) return false;
    try {
        return !!JSON.parse(extra).dsh;
    } catch (e) {
        return false;
    }
}

/**
 * DSH 会话类型：'single'（单聊且对方是机器人 UserInfo.type === 1）/
 * 'group'（群 extra 带 {"dsh":true} 标记）/ null（非 DSH 会话）。
 * 用户信息/群信息未缓存时返回 null，待 UserInfosUpdate/GroupInfosUpdate 后再判断。
 */
export function dshConversationKind(conversation) {
    if (!conversation || !conversation.target) return null;
    try {
        if (conversation.type === ConversationType.Single) {
            const userInfo = wfc.getUserInfo(conversation.target, false);
            return userInfo && userInfo.type === 1 ? 'single' : null;
        }
        if (conversation.type === ConversationType.Group) {
            const groupInfo = wfc.getGroupInfo(conversation.target, false);
            return isDshGroupExtra(groupInfo && groupInfo.extra) ? 'group' : null;
        }
    } catch (e) {
        return null;
    }
    return null;
}

/**
 * 是否 DSH 会话。非 DSH 会话不查询/不展示 DSH 状态。
 */
export function isDshConversation(conversation) {
    return dshConversationKind(conversation) !== null;
}

/**
 * Read the DSH runtime state of a conversation. Returns null when unset/invalid.
 */
export async function getDshState(conversation) {
    if (!conversation || !conversation.target || !isDshConversation(conversation)) return null;
    try {
        const raw = await wfc.getUserSetting(UserSettingScope.Conversation_User_Setting, dshStateKey(conversation));
        if (!raw) return null;
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        return parsed && parsed.state ? parsed : null;
    } catch (e) {
        return null;
    }
}

/** Human label for the state (i18n keys resolved by the caller). */
export function dshStateLabel(state) {
    const map = {
        idle: 'dsh.status.idle',
        running: 'dsh.status.running',
        waiting_user: 'dsh.status.waiting',
        done: 'dsh.status.done',
    };
    return map[state] || null;
}

/** Compact dot class for list badges. */
export function dshStateClass(state) {
    return `dsh-dot-${state || 'idle'}`;
}
