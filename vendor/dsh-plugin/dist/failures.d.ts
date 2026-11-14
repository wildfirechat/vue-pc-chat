/**
 * 回合失败的分类与用户提示文案。
 *
 * 背景：dsh 的 `turn/end` 以 `{kind:"error", error:{message,code,status}}` 收尾时，
 * 插件旧行为把这种回合当成「无输出」静默取消气泡 —— 用户发消息「没有反应」，
 * 无法判断是欠费、鉴权过期、限流还是网络问题。这里把 dsh 的 provider-neutral
 * 失败事实翻译成可读的 IM 提示（尤其是 402 欠费必须点名要求充值）。
 *
 * 独立成模块的原因：纯函数、无副作用，便于离线单测（见 scripts/compat-check 的
 * 失败分类探针）。
 */
/** 回合失败的事实（来自 turn/end 的 `reason.error`，或派发时抛出的异常）。 */
export interface TurnFailure {
    code: string;
    status?: number;
    raw: string;
}
/** 从 turn/end 的 reason 里提取失败信息（仅 `kind === "error"` 时存在）。 */
export declare function extractTurnFailure(reason: any): TurnFailure | undefined;
/** turn/end 的 reason.kind（对象形态取 kind，字符串形态原样返回，小写）。 */
export declare function turnReasonKind(reason: any): string;
/**
 * 把模型/传输失败翻译成给 IM 用户的提示。
 * 优先按 HTTP status / 稳定 code 判定，再用大小写无关的文案兜底。
 */
export declare function describeTurnFailure(failure: TurnFailure): string;
//# sourceMappingURL=failures.d.ts.map