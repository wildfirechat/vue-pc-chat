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
export function extractTurnFailure(reason: any): TurnFailure | undefined {
  if (!reason || typeof reason !== "object" || reason.kind !== "error") return undefined;
  const err = reason.error ?? {};
  return {
    code: String(err.code ?? "UNKNOWN"),
    ...(typeof err.status === "number" ? { status: err.status } : {}),
    raw: String(err.message ?? "unknown error"),
  };
}

/** turn/end 的 reason.kind（对象形态取 kind，字符串形态原样返回，小写）。 */
export function turnReasonKind(reason: any): string {
  if (reason && typeof reason === "object") return String(reason.kind ?? "").toLowerCase();
  return String(reason ?? "").toLowerCase();
}

/**
 * 把模型/传输失败翻译成给 IM 用户的提示。
 * 优先按 HTTP status / 稳定 code 判定，再用大小写无关的文案兜底。
 */
export function describeTurnFailure(failure: TurnFailure): string {
  const { code, status, raw } = failure;
  const lower = raw.toLowerCase();
  if (
    status === 402 ||
    code === "QUOTA" ||
    lower.includes("insufficient balance") ||
    lower.includes("insufficient_quota") ||
    lower.includes("余额")
  ) {
    return "⚠️ 模型服务余额不足（402），本条消息未能处理。请为 DeepSeek 账号充值后重新发送。";
  }
  // The AI relay returns 403 for policy/config problems that are not
  // credential failures (model whitelist, disabled user). Classify them by
  // message before the generic 401/403 branch, otherwise users are told to
  // "check the API key" when the admin changed a whitelist or disabled them.
  if (
    lower.includes("not allowed") ||
    lower.includes("whitelist") ||
    lower.includes("allowlist")
  ) {
    return "⚠️ 当前模型不在服务端白名单（403），请在「模型配置」中切换模型或重新开通后重试。";
  }
  if (lower.includes("disabled")) {
    return "⚠️ AI 服务已被管理员停用（403），请联系管理员恢复账号。";
  }
  if (
    lower.includes("not configured") ||
    lower.includes("missing provider") ||
    lower.includes("provider key") ||
    lower.includes("缺少 provider")
  ) {
    return "⚠️ 服务端尚未配置模型（缺少 Provider Key / Base URL / 模型），请联系管理员。";
  }
  if (
    status === 401 ||
    status === 403 ||
    code === "AUTH" ||
    lower.includes("invalid api key") ||
    lower.includes("unauthorized")
  ) {
    return "⚠️ 模型服务鉴权失败（401/403），请检查 API Key / 凭据配置后重试。";
  }
  if (
    status === 429 ||
    code === "RATE_LIMIT" ||
    lower.includes("rate limit") ||
    lower.includes("too many requests")
  ) {
    return "⚠️ 模型服务限流（429），请稍等片刻再试。";
  }
  if (
    code === "TRANSPORT" ||
    lower.includes("fetch failed") ||
    lower.includes("timeout") ||
    lower.includes("econn")
  ) {
    return "⚠️ 连接模型服务失败（网络/超时），请稍后重试。";
  }
  const detail = raw.length > 160 ? `${raw.slice(0, 160)}…` : raw;
  return `⚠️ 模型调用失败（${code}${status ? ` ${status}` : ""}）：${detail}`;
}
