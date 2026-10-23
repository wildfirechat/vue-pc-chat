/**
 * Utility functions: group-chat trigger policy and payload extraction.
 * Logic mirrors the openclaw plugin (`openclaw-plugin.js/src/utils.ts`).
 */
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
export declare function dshHome(): string;
/** 插件状态文件/日志路径（统一放在 dsh home 下）。 */
export declare function dshHomePath(...segments: string[]): string;
/** Message payload type constants (Wildfire IM). */
export declare const MESSAGE_TYPE_TEXT = 1;
export declare const MESSAGE_TYPE_VOICE = 2;
export declare const MESSAGE_TYPE_IMAGE = 3;
export declare const MESSAGE_TYPE_VIDEO = 4;
export declare const MESSAGE_TYPE_FILE = 5;
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
export declare function decodeQuoteFromPayload(payload: any): any;
/** Conversation type constants (Wildfire IM). */
export declare const CONV_TYPE_SINGLE = 0;
export declare const CONV_TYPE_GROUP = 1;
export declare const CONV_TYPE_CHANNEL = 2;
/**
 * Decide whether a group message should trigger a reply.
 *
 * Default (`requireMention` unset or false): every group message triggers —
 * no @mention required.
 * With `requireMention: true`: @mention / question-mark suffix / help
 * keywords trigger, otherwise the group stays quiet.
 */
export declare function shouldRespondToGroupMessage(text: string, messageData: any, config: WildfireConfig): boolean;
/** Extract text and optional media URL from a message payload. */
export declare function extractPayloadInfo(payload: any): {
    text: string;
    mediaUrl?: string;
};
/** Compact preview for log lines. */
export declare function safePreview(value: string, maxLen?: number): string;
/**
 * IM conversation key for a message. Lowercased so the key is stable across
 * client casings and matches the deterministic dsh SessionId derivation.
 */
export declare function conversationKey(isGroup: boolean, targetId: string): string;
/** 结构化深比较（键顺序无关），用于状态去重等场景。 */
export declare function deepEqual(a: unknown, b: unknown): boolean;
//# sourceMappingURL=utils.d.ts.map