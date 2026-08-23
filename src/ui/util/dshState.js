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
 * AI 会话类型（原 DSH）：'group'（群聊会话 line 2）/ null（非 AI 会话）。
 * 设计：单聊（与机器人私聊）是全局控制面板，不是 AI 会话；
 * AI 对话仅限群聊会话 line 2（AI 消息统一使用 line 2，普通消息 line 0，朋友圈 line 1）。
 */
export function dshConversationKind(conversation) {
    if (!conversation || !conversation.target) return null;
    // AI 会话 = 群聊且 line === 2；单聊不判 AI（控制面板）
    if (conversation.type !== ConversationType.Group || conversation.line !== 2) return null;
    return 'group';
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

/** 数字格式化：整数不带小数，否则保留 1 位。 */
function fmtNum(n) {
    if (n === undefined || n === null || Number.isNaN(n)) return null;
    return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10);
}

/**
 * 会话状态里的 Token/上下文计量 → 一行展示文本（客户端展示用）。
 * 字段来自插件推送的 scope=31 状态（type=1）：
 *   context.usedPct / cacheHitRatePct / speed.tokensPerSec / turn.outputTokens
 *   usage.totalTokens / reason / error / interaction
 * 返回 '' 表示没有可展示的计量信息。
 */
export function dshMetricsText(state) {
    if (!state || typeof state !== 'object') return '';
    const parts = [];

    // 交互等待：优先提示在等什么
    if (state.state === 'waiting_user') {
        parts.push(state.interaction === 'approval' ? '🔐 等待审批' : '🤔 等待确认');
    }

    // 上下文占用（下一请求预估成本 / 模型窗口）
    if (state.context && typeof state.context.usedPct === 'number') {
        parts.push(`上下文 ${fmtNum(state.context.usedPct)}%`);
    }
    // 缓存命中率（累计口径）
    if (typeof state.cacheHitRatePct === 'number') {
        parts.push(`缓存 ${fmtNum(state.cacheHitRatePct)}%`);
    }
    // 本轮生成速度 + 输出 token
    if (state.speed && typeof state.speed.tokensPerSec === 'number') {
        parts.push(`${fmtNum(state.speed.tokensPerSec)} tok/s`);
    }
    if (state.turn && typeof state.turn.outputTokens === 'number' && state.turn.outputTokens > 0) {
        parts.push(`本轮 ${state.turn.outputTokens} tok`);
    }
    // 累计用量
    if (state.usage && typeof state.usage.totalTokens === 'number') {
        parts.push(`累计 ${state.usage.totalTokens} tok`);
    }
    // 结果原因 / 错误
    if (state.reason === 'error') {
        parts.push(`⚠️ ${state.error || '出错了'}`);
    } else if (state.reason === 'cancelled') {
        parts.push('已取消');
    }
    return parts.join(' · ');
}
