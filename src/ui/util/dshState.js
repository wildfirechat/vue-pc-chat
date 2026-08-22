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
 * AI 会话类型（原 DSH）：'single'（line 2 单聊）/
 * 'group'（line 2 群聊）/ null（非 AI 会话）。
 * 判断依据：会话 line === 2（AI 消息统一使用 line 2，普通消息 line 0，朋友圈 line 1）。
 */
export function dshConversationKind(conversation) {
    if (!conversation || !conversation.target) return null;
    // AI 会话统一使用 line 2
    if (conversation.line !== 2) return null;
    return conversation.type === ConversationType.Group ? 'group' : 'single';
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
