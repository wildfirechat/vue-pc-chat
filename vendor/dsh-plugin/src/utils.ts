/**
 * Utility functions: group-chat trigger policy and payload extraction.
 * Logic mirrors the openclaw plugin (`openclaw-plugin.js/src/utils.ts`).
 */

import os from "node:os";
import path from "node:path";
import type { WildfireConfig } from "./config.js";

/**
 * dsh home 目录：`$DSH_HOME` 优先（多实例隔离的关键），否则 `~/.dsh`。
 *
 * dsh 自己就是这么解析的（`@deepseek-ai/dsh-home-paths` 的 `DSH_HOME_ENV`）：
 * 显式配置 > `$DSH_HOME` > `~/.dsh`。插件自建的状态文件（会话 epoch、/cwd 绑定、
 * 白名单、群注册表、会话模式、诊断日志）都放在这里，因此
 * `DSH_HOME=/path/to/inst dsh --profile wildfire` 能让一个机器上的多个实例完全隔离。
 *
 * 注意：`~` 的用户目录展开（如 `/cwd ~/xxx`）语义上是「登录用户的家目录」，
 * 仍应使用 `os.homedir()`，不要用这个函数。
 */
export function dshHome(): string {
  const fromEnv = (process.env.DSH_HOME ?? "").trim();
  return fromEnv.length > 0 ? path.resolve(fromEnv) : path.join(os.homedir(), ".dsh");
}

/** 插件状态文件/日志路径（统一放在 dsh home 下）。 */
export function dshHomePath(...segments: string[]): string {
  return path.join(dshHome(), ...segments);
}

/** Message payload type constants (Wildfire IM). */
export const MESSAGE_TYPE_TEXT = 1;
export const MESSAGE_TYPE_VOICE = 2;
export const MESSAGE_TYPE_IMAGE = 3;
export const MESSAGE_TYPE_VIDEO = 4;
export const MESSAGE_TYPE_FILE = 5;

/**
 * 解析客户端「引用消息」：野火客户端发引用时，把被引消息信息 base64 编码放在
 * payload.binaryContent（本网关收到的 payload 里该二进制字段名为 base64edData，
 * 见入站日志 keys），形如 {"quote":{"u":messageUid,"i":userId,"n":userName,
 * "d":digest/原文摘要}}（文本正文仍在 searchableContent，不含引用原文）。
 * 返回解码后的 quote 对象；无引用/解析失败返回 null。
 * 解码容错与 vue-pc-chat TextMessageContent.decode 一致：
 * - base64 字符串可能带尾随垃圾 → 截到最后一个 '}'；
 * - "u" 可能是数值或字符串，JSON 解析都能处理。
 */
export function decodeQuoteFromPayload(payload: any): any {
  const b64 = payload?.binaryContent ?? payload?.base64edData ?? payload?.localBinaryContent;
  if (!b64) {
    return null;
  }
  try {
    let buf: Buffer;
    if (typeof b64 === "string") {
      buf = Buffer.from(b64, "base64");
    } else if (b64 instanceof Uint8Array) {
      buf = Buffer.from(b64);
    } else {
      buf = Buffer.from(new Uint8Array(b64 as ArrayBuffer));
    }
    let str = buf.toString("utf8");
    const end = str.lastIndexOf("}");
    if (end >= 0) {
      str = str.slice(0, end + 1);
    }
    // long 精度保护：wire 上 quote 的 "u"(被引消息uid) 是裸 JSON 数字，直接 JSON.parse
    // 会变成 JS double 丢精度（超过 Number.MAX_SAFE_INTEGER 时相邻 uid 会碰撞）。与
    // vue-pc-chat TextMessageContent.decode 同款处理：先把 "u":<digits> 替换成带引号
    // 的字符串再 parse，保证返回的 uid 是精确字符串。
    str = str.replace(/"u"\s*:\s*(\d+)/, '"u":"$1"');
    const obj = JSON.parse(str);
    if (!obj || typeof obj !== "object") {
      return null;
    }
    return obj.quote ? obj.quote : obj;
  } catch {
    return null;
  }
}

/** Conversation type constants (Wildfire IM). */
export const CONV_TYPE_SINGLE = 0;
export const CONV_TYPE_GROUP = 1;
export const CONV_TYPE_CHANNEL = 2;

/**
 * Decide whether a group message should trigger a reply.
 *
 * Default (`requireMention` unset or false): every group message triggers —
 * no @mention required.
 * With `requireMention: true`: @mention / question-mark suffix / help
 * keywords trigger, otherwise the group stays quiet.
 */
export function shouldRespondToGroupMessage(
  text: string,
  messageData: any,
  config: WildfireConfig
): boolean {
  const mentionRequired = config.requireMention === true;

  // mention mode: @mention, question mark suffix, or help keywords trigger
  if (mentionRequired) {
    if (isMentioned(messageData, config.robotId)) {
      return true;
    }
    if (/.*[？?]$/.test(text)) {
      return true;
    }
    const keywords = (config.helpKeywords || "帮,请,分析,总结")
      .split(",")
      .map((k: string) => k.trim())
      .filter(Boolean);
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        return true;
      }
    }
    return false;
  }

  // default: all group messages trigger
  return true;
}

/**
 * Wildfire IM mention rules:
 * - mentionedType === 2: @everyone -> reply
 * - mentionedType === 1: @specific users -> reply only when the bot is among them
 */
function isMentioned(messageData: any, robotId?: string): boolean {
  try {
    const payload = messageData.payload;
    if (!payload) return false;
    const mentionedType = payload.mentionedType;
    if (mentionedType === 2) return true;
    if (mentionedType === 1) {
      const targets = payload.mentionedTarget;
      if (Array.isArray(targets) && targets.length > 0) {
        if (robotId) return targets.includes(robotId);
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

/** Extract text and optional media URL from a message payload. */
export function extractPayloadInfo(payload: any): { text: string; mediaUrl?: string } {
  const mediaUrl = pickMediaUrl(payload);
  switch (payload?.type) {
    case MESSAGE_TYPE_TEXT:
      return { text: payload.searchableContent || payload.content || "" };
    case MESSAGE_TYPE_VOICE: {
      const duration = payload.duration ? ` ${payload.duration}s` : "";
      return { text: `[语音${duration}]`, mediaUrl };
    }
    case MESSAGE_TYPE_IMAGE:
      return { text: "[图片]", mediaUrl };
    case MESSAGE_TYPE_VIDEO:
      return { text: "[视频]", mediaUrl };
    case MESSAGE_TYPE_FILE:
      return { text: `[文件] ${payload.searchableContent || ""}`, mediaUrl };
    default:
      return { text: `${payload?.searchableContent || "暂不支持的消息类型: " + payload?.type}` };
  }
}

function pickMediaUrl(payload: any): string | undefined {
  const candidates = [
    payload?.remoteMediaUrl,
    payload?.mediaUrl,
    payload?.remoteUrl,
    payload?.url,
  ];
  const normalized = candidates
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .find((v) => !!v);
  return normalized || undefined;
}

/** Compact preview for log lines. */
export function safePreview(value: string, maxLen = 120): string {
  if (!value) return "";
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= maxLen) return compact;
  return `${compact.slice(0, maxLen)}...`;
}

/**
 * IM conversation key for a message. Lowercased so the key is stable across
 * client casings and matches the deterministic dsh SessionId derivation.
 */
export function conversationKey(isGroup: boolean, targetId: string): string {
  return (isGroup ? `wildfire:group:${targetId}` : `wildfire:user:${targetId}`).toLowerCase();
}

/** 结构化深比较（键顺序无关），用于状态去重等场景。 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a as Record<string, unknown>);
  const kb = Object.keys(b as Record<string, unknown>);
  if (ka.length !== kb.length) return false;
  return ka.every(
    (k) =>
      Object.prototype.hasOwnProperty.call(b, k) &&
      deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])
  );
}
