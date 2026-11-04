/**
 * Agent × Wildfire IM structured interaction protocol (agent-agnostic).
 *
 * The 200-209 segment is the official Wildfire AI-interaction reservation
 * (INTERACTION_DESIGN.md §2.1); the protocol is NOT DSH-specific — any agent
 * provider (DSH / openclaw / …) may use the same cards, states and channels.
 *
 * Payload convention:
 *   payload.type              = AGENT_* type number
 *   payload.content           = JSON string (structured data)
 *   payload.searchableContent = human summary (search/notification visible)
 *   payload.persistFlag       = set by the sender (cards persist)
 *
 * scope=31 conversation user settings carry runtime state/metrics/panel:
 * key = `<convType>-<line>-<target>_<type>_<机器人uid>` (server appends the
 * writing robot's uid), payload JSON is provider-agnostic.
 */
/**
 * Wildfire IM message type numbers for agent interactions.
 * (Formerly exported as DSH_TYPE; AGENT_* is the canonical name.)
 */
export const AGENT_TYPE = {
    QUESTION: 200, // 机器人→用户 提问卡片（含选项）
    ANSWER: 201, // 用户→机器人 结构化回答
    APPROVAL: 202, // 机器人→用户 工具审批卡片
    APPROVAL_RESULT: 203, // 用户→机器人 审批结果
    // 204/205 已废弃：进度与状态改走 scope=31 会话用户设置推送（见 interactive.ts）
    GOAL: 206, // 机器人→用户 目标进度卡片（ver:2 通用载荷，见 AgentGoalPayload）
    COMMAND: 207, // 用户→机器人 AI 面板指令（透明消息，客户端不渲染）
    TASK_PROGRESS: 208, // 机器人→用户 任务进度卡片（ver:2 通用载荷，updateMessage 原地更新）
    COMMAND_RESULT: 209, // 机器人→用户 207 指令的应答（透明消息，客户端不渲染；见 §10）
};
/** 兼容别名（内部旧引用；wire 类型号不变）。 */
export const DSH_TYPE = AGENT_TYPE;
/** Build a message payload object (shape consumed by the Wildfire SDK sendMessage). */
export function buildPayload(type, data, summary, persistFlag) {
    return {
        type,
        content: JSON.stringify(data),
        searchableContent: summary,
        persistFlag,
    };
}
/** Parse payload.content JSON; returns null on failure. */
export function parseContent(payload) {
    try {
        const raw = typeof payload?.content === "string" ? payload.content : null;
        return raw ? JSON.parse(raw) : null;
    }
    catch {
        return null;
    }
}
/** Human summary for a question card (searchable/notification text). */
export function summarizeQuestion(data) {
    const first = data.questions[0];
    return first ? `🤔 ${first.header ? `【${first.header}】` : ""}${first.question}` : "🤔 需要你确认";
}
/** Human summary for an approval card. */
export function summarizeApproval(data) {
    const who = data.approver && data.approver !== data.requestedBy ? `，审批人 ${data.approver}` : "";
    return `🔐 工具审批：${data.toolName}${data.reason ? `（${data.reason}）` : ""}${who}`;
}
/** Human summary for a goal card (ver:2 title / v1 objective). */
export function summarizeGoal(data) {
    const title = data.title || data.objective || "目标";
    return `🎯 ${title}（${data.state ?? data.phase ?? ""}）`;
}
/** Task card summary (searchableContent/notification visible). */
export function summarizeTasks(data) {
    const running = data.tasks.filter((t) => t.status === "running").length;
    const total = data.tasks.length;
    if (total === 0)
        return "🧩 任务：无";
    return running > 0 ? `🧩 任务 ${total}（${running} 运行中）` : `🧩 任务 ${total}（${data.tasks.every((t) => t.status === "failed") ? "全部失败" : "全部完成"}）`;
}
/** Human summary for a 207 command result (209; searchableContent — not rendered). */
export function summarizeCommandResult(data) {
    if (data?.op === "dirs") {
        const n = data.dirs?.length ?? 0;
        return data.truncated ? `📂 AI 目录列表（${n}/${data.total ?? n}，已截断）` : `📂 AI 目录列表（${n}）`;
    }
    if (data?.op === "sessions") {
        return `🧠 最近会话（${data.sessions?.length ?? 0}）`;
    }
    if (data?.op === "switch") {
        return data.ok ? "🧠 已切换会话" : `🧠 切换会话失败${data.error ? `：${data.error}` : ""}`;
    }
    return "📂 AI 指令应答";
}
//# sourceMappingURL=protocol.js.map