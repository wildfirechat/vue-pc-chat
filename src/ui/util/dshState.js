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
const DSH_METRICS_TYPE = 2; // 2=Token 统计（与运行状态分开，低频累积数据）
const DSH_PANEL_TYPE = 3; // 3=AI 面板数据（组合查询结果，面板打开/更新后刷新）

export function dshStateKey(conversation) {
    return `${conversation.type}-${conversation.line}-${conversation.target}_${DSH_STATE_TYPE}`;
}

export function dshMetricsKey(conversation) {
    return `${conversation.type}-${conversation.line}-${conversation.target}_${DSH_METRICS_TYPE}`;
}

export function dshPanelKey(conversation) {
    return `${conversation.type}-${conversation.line}-${conversation.target}_${DSH_PANEL_TYPE}`;
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

/**
 * Read the DSH Token 统计 of a conversation (scope=31, type=2 计量).
 * 独立于运行状态（type=1）：回合结束必推（含出错/取消），带 metricsAt 时间戳。
 * Returns null when unset/invalid.
 */
export async function getDshMetrics(conversation) {
    if (!conversation || !conversation.target || !isDshConversation(conversation)) return null;
    try {
        const raw = await wfc.getUserSetting(UserSettingScope.Conversation_User_Setting, dshMetricsKey(conversation));
        if (!raw) return null;
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (e) {
        return null;
    }
}

/**
 * Read the AI 面板数据 of a conversation (scope=31, type=3).
 * 组合查询（DSH_Command 207 query）结果：model/effort/sandbox/plan/cwd/sessionId/dirs。
 * Returns null when unset/invalid.
 */
export async function getDshPanelData(conversation) {
    if (!conversation || !conversation.target || !isDshConversation(conversation)) return null;
    try {
        const raw = await wfc.getUserSetting(UserSettingScope.Conversation_User_Setting, dshPanelKey(conversation));
        if (!raw) return null;
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        return parsed && typeof parsed === 'object' ? parsed : null;
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
 * Token 统计（scope=31 type=2 计量）→ 一行展示文本。
 * 字段：context.usedPct / cacheHitRatePct / speed.tokensPerSec /
 *      turn.outputTokens / usage.totalTokens
 * 运行态提示（waiting/reason/error）走 dshStatusHint（type=1），不在此处。
 * 返回 '' 表示没有可展示的统计。
 */
export function dshMetricsText(metrics) {
    if (!metrics || typeof metrics !== 'object') return '';
    const parts = [];

    // 上下文占用（下一请求预估成本 / 模型窗口）
    if (metrics.context && typeof metrics.context.usedPct === 'number') {
        parts.push(`上下文 ${fmtNum(metrics.context.usedPct)}%`);
    }
    // 缓存命中率（累计口径）
    if (typeof metrics.cacheHitRatePct === 'number') {
        parts.push(`缓存 ${fmtNum(metrics.cacheHitRatePct)}%`);
    }
    // 本轮生成速度 + 输出 token
    if (metrics.speed && typeof metrics.speed.tokensPerSec === 'number') {
        parts.push(`${fmtNum(metrics.speed.tokensPerSec)} tok/s`);
    }
    if (metrics.turn && typeof metrics.turn.outputTokens === 'number' && metrics.turn.outputTokens > 0) {
        parts.push(`本轮 ${metrics.turn.outputTokens} tok`);
    }
    // 累计用量
    if (metrics.usage && typeof metrics.usage.totalTokens === 'number') {
        parts.push(`累计 ${metrics.usage.totalTokens} tok`);
    }
    return parts.join(' · ');
}

/**
 * 运行态提示（scope=31 type=1 状态）→ 一段文本：
 *   waiting_user → 🤔 等待确认 / 🔐 等待审批；reason=error → ⚠️ 错误；cancelled → 已取消
 * 返回 '' 表示无提示。
 */
export function dshStatusHint(state) {
    if (!state || typeof state !== 'object') return '';
    if (state.state === 'waiting_user') {
        return state.interaction === 'approval' ? '🔐 等待审批' : '🤔 等待确认';
    }
    if (state.reason === 'error') {
        return `⚠️ ${state.error || '出错了'}`;
    }
    if (state.reason === 'cancelled') {
        return '已取消';
    }
    return '';
}
