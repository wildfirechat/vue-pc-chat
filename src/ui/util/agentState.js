/**
 * Agent conversation runtime state (scope=31 user setting).
 *
 * 服务端 key（v2）：`<convType>-<line>-<target>_<type>_<机器人uid>`
 * —— 写入方是机器人，key 末尾由 im-server 按请求身份追加该机器人的 uid。
 * 客户端不预知机器人 uid，统一用「前缀 + 槽位」扫描本地 scope=31 设置表
 * （后缀通配，兼容任意机器人与将来的多机器人会话）。
 */

import wfc from "../../wfc/client/wfc";
import UserSettingScope from "../../wfc/client/userSettingScope";
import ConversationType from "../../wfc/model/conversationType";

const AGENT_STATE_TYPE = 1; // 1=状态 (business convention)
const AGENT_METRICS_TYPE = 2; // 2=Token 统计（与运行状态分开，低频累积数据）
const AGENT_PANEL_TYPE = 3; // 3=AI 面板数据（组合查询结果，面板打开/更新后刷新）

/** scope=31 key 前缀：`<convType>-<line>-<target>_<type>_`（服务端在其后追加机器人 uid）。 */
function agentSlotPrefix(conversation, slot) {
    return `${conversation.type}-${conversation.line}-${conversation.target}_${slot}_`;
}

/** 扫描 scope=31 本地设置表，返回首个 key 以 prefix 开头的 value；无匹配返回 null。 */
function findSettingByPrefix(prefix) {
    try {
        const all = wfc.getUserSettings(UserSettingScope.Conversation_User_Setting);
        if (!all) return null;
        // 核心可能返回三种形态：Map / UserSettingEntry[]（{key,value}）/ 键值对象——统一归一为 [key,value] 对
        let pairs;
        if (all instanceof Map) {
            pairs = [...all.entries()];
        } else if (Array.isArray(all)) {
            pairs = all.map(e => [e && e.key !== undefined ? e.key : (e && e[0]), e && e.value !== undefined ? e.value : (e && e[1])]);
        } else {
            pairs = Object.entries(all);
        }
        for (const [key, value] of pairs) {
            if (key && key.indexOf(prefix) === 0) return value;
        }
    } catch (e) {
        // 忽略：底层不可用时按"无状态"处理
    }
    return null;
}

/** 群 extra 是否带 {"dsh":true} 标记（容错：非 JSON 时返回 false）。 */
export function isAgentGroupExtra(extra) {
    if (!extra) return false;
    try {
        return !!JSON.parse(extra).dsh;
    } catch (e) {
        return false;
    }
}

/**
 * AI 会话类型（原 Agent）：'group'（群聊会话 line 2）/ null（非 AI 会话）。
 * 设计：单聊（与机器人私聊）是全局控制面板，不是 AI 会话；
 * AI 对话仅限群聊会话 line 2（AI 消息统一使用 line 2，普通消息 line 0，朋友圈 line 1）。
 */
export function agentConversationKind(conversation) {
    if (!conversation || !conversation.target) return null;
    // AI 会话 = 群聊且 line === 2；单聊不判 AI（控制面板）
    if (conversation.type !== ConversationType.Group || conversation.line !== 2) return null;
    return 'group';
}

/**
 * 是否 Agent 会话。非 Agent 会话不查询/不展示 Agent 状态。
 */
export function isAgentConversation(conversation) {
    return agentConversationKind(conversation) !== null;
}

/**
 * Read the Agent runtime state of a conversation. Returns null when unset/invalid.
 */
export async function getAgentState(conversation) {
    if (!conversation || !conversation.target || !isAgentConversation(conversation)) return null;
    try {
        const raw = findSettingByPrefix(agentSlotPrefix(conversation, AGENT_STATE_TYPE));
        if (!raw) return null;
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        return parsed && parsed.state ? parsed : null;
    } catch (e) {
        return null;
    }
}

/**
 * Read the Agent Token 统计 of a conversation (scope=31, type=2 计量).
 * 独立于运行状态（type=1）：回合结束必推（含出错/取消），带 metricsAt 时间戳。
 * Returns null when unset/invalid.
 */
export async function getAgentMetrics(conversation) {
    if (!conversation || !conversation.target || !isAgentConversation(conversation)) return null;
    try {
        const raw = findSettingByPrefix(agentSlotPrefix(conversation, AGENT_METRICS_TYPE));
        if (!raw) return null;
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (e) {
        return null;
    }
}

/**
 * Read the AI 面板数据 of a conversation (scope=31, type=3).
 * 组合查询（AGENT_Command 207 query）结果：model/effort/sandbox/plan/cwd/sessionId/dirs。
 * Returns null when unset/invalid.
 */
export async function getAgentPanelData(conversation) {
    if (!conversation || !conversation.target || !isAgentConversation(conversation)) return null;
    try {
        const raw = findSettingByPrefix(agentSlotPrefix(conversation, AGENT_PANEL_TYPE));
        if (!raw) return null;
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (e) {
        return null;
    }
}

/** Human label for the state (i18n keys resolved by the caller). */
export function agentStateLabel(state) {
    const map = {
        idle: 'agent.status.idle',
        running: 'agent.status.running',
        waiting_user: 'agent.status.waiting',
        done: 'agent.status.done',
    };
    return map[state] || null;
}

/** Compact dot class for list badges. */
export function agentStateClass(state) {
    return `agent-dot-${state || 'idle'}`;
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
 * 运行态提示（waiting/reason/error）走 agentStatusHint（type=1），不在此处。
 * 返回 '' 表示没有可展示的统计。
 */
export function agentMetricsText(metrics) {
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
export function agentStatusHint(state) {
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
