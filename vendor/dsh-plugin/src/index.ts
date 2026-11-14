/**
 * Wildfire IM channel plugin for DeepSeek Harness.
 *
 * Cordis plugin — install into a dsh profile and activate via the profile's
 * patch layer (see README.md / DSH_INTEGRATION.md).
 */

import { startClient, stopClient, getConnectedClient, isClientReady } from "./clients.js";
import { turnOwners } from "./inbound.js";
import { getConfig, getSessionConfig, validateConfig } from "./config.js";
import type { WildfireConfig } from "./config.js";
import { AgentSessionManager } from "./agent.js";
import { WorkspaceResolver } from "./workspace.js";
import { AccessController } from "./access.js";
import { ModelSelector } from "./model.js";
import { InteractionManager, type CardSender, type ConversationTarget } from "./interactive.js";
import { DshGroupRegistry } from "./registry.js";
import { buildPayload } from "./protocol.js";
import { WhitelistFilter } from "./whitelist.js";
import { AuditLog } from "./audit.js";
import { TextMessageContent } from "@wildfirechat/server-sdk";
import { panelDebug } from "./panelDebug.js";

export const name = "wildfire";

// cordis 4: accessing an undeclared service property throws
// (`cannot get property "x" without inject`), so every service used must be
// injected. `userQuestions` / `attachments` / `sessionPersistence` / `goals`
// are provided by the base bundle.
export const inject = ["agents", "sessions", "agentDefaultModel", "userQuestions", "attachments", "sessionPersistence", "goals", "systemPrompt"];

/**
 * Plugin entry.
 * @param ctx - Cordis context of the dsh process.
 * @param config - config from the profile patch row (`config` field).
 */
export function apply(ctx: any, config: any): void {
  // 父进程（Electron 主进程）退出后，DSH Host 不能变成孤儿。
  // 每 5 秒检查父 PID；应用被强杀、崩溃或未走优雅 stop 时也能自动退出。
  const parentPid = Number(process.env.WF_PARENT_PID || 0);
  if (parentPid > 0) {
    const parentWatchdog = setInterval(() => {
      try {
        process.kill(parentPid, 0);
      } catch {
        process.exit(0);
      }
    }, 5000);
    parentWatchdog.unref?.();
  }

  // Outbound-media convention: tell every agent that files it creates in its
  // workspace can be handed to the IM user via [image:path]/[file:path] markers
  // (the plugin uploads them and strips the marker; paths outside the workspace
  // fence are rejected). Mirrors the sandbox-policy systemPrompt.context hook.
  try {
    ctx.inject?.(["systemPrompt"], (scope: any) => {
      scope.systemPrompt.context({
        name: "wildfire:media",
        order: 220,
        text: () =>
          "你通过野火IM机器人与用户对话。需要把本机文件/图片交付给用户时，" +
          "优先调用 dsh 原生 present 工具：present({files:[{path:\"绝对路径\"}]})；" +
          "如果 present 不可用，再在回复文本中插入标记（支持多个）：[image:绝对路径]（图片）、[file:绝对路径]（任意文件）。" +
          "路径必须是绝对路径且位于当前工作区内（工作区外的文件会被拒绝，请先复制到工作区）。" +
          "插件会把 present 声明的文件或标记对应的文件作为图片/文件消息发送。" +
          "不要在回复中声称“已发送/已发给你”却没有实际调用 present 或插入标记。",
      });
      // 不回复约定（方案 B：消息照常进入 agent 上下文，由 agent 决定本条是否回复）：
      // agent 认为不需要文字回复时，整条只输出 NO_REPLY；插件检测到整段等于
      // NO_REPLY 会发送取消消息(type 20)，不向用户发送正文。
      scope.systemPrompt.context({
        name: "wildfire:no-reply",
        order: 230,
        text: () =>
          "不回复约定：用户消息会被正常处理并计入上下文，但如果你判断本条不需要文字回复" +
          "（例如用户明确说“别回复/不要回复”，或你只是确认收到而没有要补充的内容），" +
          "则整条回复只输出一个词 NO_REPLY（不含引号、不附带任何其它文字）。" +
          "插件检测到整段文本等于 NO_REPLY 时会把生成气泡取消（type 20），不会向用户发送正文。" +
          "注意：正常回复的正文中不要出现 NO_REPLY 字样（会被误判为不回复）。",
      });
    });
  } catch {
    // systemPrompt service unavailable — the convention still works if the
    // model is told about the markers in-conversation.
  }
  // dsh's default logger only buffers messages (no console sink), so in a
  // GUI-less profile nothing would be visible. Export to stderr ourselves.
  // `levels.default` 必须 ≥ warn(2)：cordis 的导出过滤是 `threshold < level`
  // 即跳过，缺省 threshold=1 会把 warn 也过滤掉（与默认缓冲出口同样的问题）。
  try {
    ctx.logger?.exporter?.({
      levels: { default: 2 },
      export: (message: any) => {
        const time = new Date(message.ts).toISOString().slice(11, 19);
        const args = (message.args ?? [])
          .map((a: any) => (a instanceof Error ? a.message : String(a)))
          .join(" ");
        process.stderr.write(`[${time}] [${message.type}] [${message.name}] ${args}\n`);
      },
    });
  } catch {
    // logger exporter unavailable — ignore
  }

  const logger = ctx.logger("wildfire");
  const cfg: WildfireConfig = { ...getConfig(ctx, config) };
  // Secrets should not be materialized into the profile patch: the desktop
  // host passes them through the environment and names the variable here.
  if (!cfg.robotSecret && cfg.robotSecretEnv) {
    const fromEnv = process.env[cfg.robotSecretEnv];
    if (fromEnv) cfg.robotSecret = fromEnv;
  }

  // Connection watchdog (assigned inside the init IIFE; cleared on dispose).
  let watchdog: ReturnType<typeof setInterval> | null = null;

  // Group-owner lookup for `/cwd` authorization in group chats (the robot must
  // be a member of the group for getGroupInfo to succeed).
  const resolveGroupOwner = async (groupId: string): Promise<string | null> => {
    const client = getConnectedClient();
    if (!client) return null;
    try {
      const info = await client.getGroupInfo(groupId);
      return info?.code === 0 ? (info?.result?.owner ?? null) : null;
    } catch {
      return null;
    }
  };

  // The API object handed to clients/inbound (mirrors openclaw's `api`).
  const api: {
    logger: any;
    config: WildfireConfig;
    ctx: any;
    wildfireAgents: AgentSessionManager;
    workspace: WorkspaceResolver;
    access: AccessController;
    models: ModelSelector;
    interactions: InteractionManager;
    whitelist: WhitelistFilter;
    registry: DshGroupRegistry;
    audit: AuditLog;
    robotOwner: string | undefined;
  } = {
    logger,
    config: cfg,
    ctx,
    workspace: new WorkspaceResolver(cfg, logger),
    access: new AccessController(cfg, resolveGroupOwner),
    models: new ModelSelector(cfg, ctx, logger),
    whitelist: new WhitelistFilter(cfg, logger),
    registry: new DshGroupRegistry(logger),
    audit: new AuditLog(logger),
    robotOwner: undefined,
    interactions: new InteractionManager(
      cfg,
      logger,
      {
        sendText: async (target: ConversationTarget, text: string) => {
          const client = getConnectedClient();
          if (!client) throw new Error("Wildfire not connected");
          const content = new TextMessageContent();
          content.content = text;
          const conversation = {
            type: target.conv.type,
            target: target.conv.type === 0 ? target.sender : target.conv.target,
            line: target.conv.line, // 回复到会话所在线路
          };
          const result = await client.sendMessage(conversation, content.encode());
          if (!result?.isSuccess?.()) {
            logger.warn?.(`[wildfire] interaction send failed: ${result?.getMsg?.() ?? "unknown"}`);
          }
        },
        sendCard: async (
          target: ConversationTarget,
          type: number,
          data: unknown,
          summary: string,
          persistFlag: number
        ) => {
          const client = getConnectedClient();
          if (!client) throw new Error("Wildfire not connected");
          const payload = buildPayload(type, data, summary, persistFlag);
          const conversation = {
            type: target.conv.type,
            target: target.conv.type === 0 ? target.sender : target.conv.target,
            line: target.conv.line, // 卡片发到会话所在线路
          };
          const result = await client.sendMessage(conversation, payload);
          if (!result?.isSuccess?.()) {
            throw new Error(result?.getMsg?.() ?? "card send failed");
          }
          // 优先读 messageUidString（gateway 新增的字符串字段，避免 int64 精度丢失）；
          // 老 gateway 没有该字段时回退 messageUid。
          const uid = String(
            result?.getResult()?.messageUidString ??
              result?.getResult()?.messageUid ??
              ""
          );
          logger.info?.(
            `[wildfire] card sent: type=${type}, uid=${uid}, summary=${summary.slice(0, 60)}`
          );
          return uid;
        },
        updateCard: async (messageId: string, type: number, data: unknown, summary: string) => {
          const client = getConnectedClient();
          if (!client) return;
          const payload = buildPayload(type, data, summary, 1);
          const result = await client.updateMessage(messageId, payload);
          const r = result as any;
          logger.info?.(
            `[wildfire] updateMessage called: messageId=${messageId}, type=${type}, code=${r?.code ?? r?.getCode?.()}, msg=${r?.msg ?? r?.getMsg?.() ?? "ok"}`
          );
        },
        setConversationState: async (key: string, payload: Record<string, unknown>) => {
          const client = getConnectedClient();
          if (!client) return;
          const target = api.interactions.getConversation(key);
          if (!target) return;
          // scope=31 conversation user setting: private → target = the other
          // user; group → target = groupId. type=1 = 状态 (business convention).
          const conversation =
            target.conv.type === 0
              ? { type: 0, target: target.sender, line: target.conv.line }
              : { type: target.conv.type, target: target.conv.target, line: target.conv.line };
          const result = await client.updateConversationUserSetting(
            conversation,
            1,
            JSON.stringify(payload)
          );
          if (result?.code !== 0) {
            logger.warn?.(`[wildfire] conversation state set failed: ${result?.msg ?? result?.code}`);
          } else {
            logger.info?.(
              `[wildfire] conversation state set: key=${key}, type=${conversation.type}, target=${conversation.target}, value=${JSON.stringify(payload)}`
            );
          }
        },
        setConversationMetrics: async (key: string, payload: Record<string, unknown>) => {
          const client = getConnectedClient();
          if (!client) return;
          const target = api.interactions.getConversation(key);
          if (!target) return;
          // scope=31 conversation user setting, type=2 = Token 统计
          // （与 type=1 运行状态分开，键 `<convType>-<line>-<target>_2`）。
          const conversation =
            target.conv.type === 0
              ? { type: 0, target: target.sender, line: target.conv.line }
              : { type: target.conv.type, target: target.conv.target, line: target.conv.line };
          const result = await client.updateConversationUserSetting(
            conversation,
            2,
            JSON.stringify(payload)
          );
          if (result?.code !== 0) {
            logger.warn?.(`[wildfire] conversation metrics set failed: ${result?.msg ?? result?.code}`);
          } else {
            logger.info?.(
              `[wildfire] conversation metrics set: key=${key}, type=${conversation.type}, target=${conversation.target}, value=${JSON.stringify(payload)}`
            );
          }
        },
        setConversationPanelData: async (key: string, payload: Record<string, unknown>) => {
          const client = getConnectedClient();
          if (!client) return;
          const target = api.interactions.getConversation(key);
          if (!target) return;
          // scope=31 conversation user setting, type=3 = AI 面板数据
          // （组合查询结果，键 `<convType>-<line>-<target>_3`）。
          const conversation =
            target.conv.type === 0
              ? { type: 0, target: target.sender, line: target.conv.line }
              : { type: target.conv.type, target: target.conv.target, line: target.conv.line };
          const result = await client.updateConversationUserSetting(
            conversation,
            3,
            JSON.stringify(payload)
          );
          if (result?.code !== 0) {
            logger.warn?.(`[wildfire] conversation panel data set failed: ${result?.msg ?? result?.code}`);
          } else {
            logger.info?.(
              `[wildfire] conversation panel data set: key=${key}, type=${conversation.type}, target=${conversation.target}, value=${JSON.stringify(payload)}`
            );
            // 诊断：记录写出的 type=3 载荷（客户端应读到的最新值）
            const p: any = payload;
            panelDebug(
              logger,
              `panel.write type=3 conv=${conversation.type}-${conversation.line}-${conversation.target} ` +
                `sandbox=${p?.sandbox?.current ?? "-"} model=${p?.model?.current ?? "-"} ` +
                `effort=${p?.effort?.current ?? "-"} plan=${JSON.stringify(p?.plan ?? null)} ` +
                `cwd=${p?.cwd ?? "-"} sessionId=${p?.sessionId ?? "-"} bytes=${JSON.stringify(payload).length}`
            );
          }
        },
      } satisfies CardSender,
      (sessionId: string) => api.wildfireAgents.keyForSessionId(sessionId),
      (key: string) => turnOwners.get(key),
      () => api.robotOwner || process.env.WF_OWNER_USER_ID,
      { record: (kind, fields) => api.audit.record(kind, fields) }
    ),
    wildfireAgents: new AgentSessionManager(
      ctx,
      logger,
      getSessionConfig(cfg),
      // Resolve the working directory for each conversation before agent creation.
      (key, sessionId) => api.workspace.resolve(key, sessionId),
      // Resolve the model selection for each conversation before agent creation.
      // The live session (resume path) lets the resolver honour the session's
      // durable model/effort record; the override provider reports an explicit
      // runtime switch that still needs to be written into the session log.
      (key: string, session?: any) => api.models.resolve(key, session),
      // 在每个 agent scope 绑定 subagent 事件 → 任务卡片（scoped 事件全局监听不到）
      (agentCtx: any, agent?: any) => api.interactions.bindAgentScope(agentCtx, agent),
      (key: string) => api.models.peekOverride(key),
      // preset 挂载失败 → 该会话的 agent 没有任何工具：必须让用户看到（一次性告警），
      // 而不是只在日志里 warn 一声继续跑。
      (key: string, presetId: string, message: string) => {
        api.interactions.notifyWarning(
          key,
          `preset-mount:${presetId}`,
          `⚠️ 本会话的 agent preset「${presetId}」挂载失败，Agent 将没有任何工具（只能输出文本、无法执行操作）。\n` +
            `原因: ${message}\n` +
            "请检查该 profile 的 preset 组成（agent-presets 及其依赖的 Host 模块）后重启 dsh。"
        );
      }
    ),
  };

  // cordis 4 has no `ready` event — initialize after the loader tree settles,
  // exactly like the web-runtime and headless runner (fire-and-forget so the
  // loader does not deadlock waiting on this apply).
  void (async () => {
    try {
      await ctx.get("loader")?.await?.();
    } catch (err) {
      logger.warn?.(`[wildfire] loader await failed: ${String(err)}`);
    }

    const error = validateConfig(cfg);
    if (error) {
      logger.error(`[wildfire] invalid config: ${error}`);
      return;
    }
    try {
      // Register the interactive seams AFTER the loader tree settled: in the
      // web profile the Host apiproxy has already claimed the userQuestions
      // provider, and registering first would crash ITS activation instead.
      api.interactions.register(ctx);
      // 任务进度卡片（208）：subagent 事件是 scoped 分发，需在每个 agent 的
      // setup(agentCtx) 里绑定（AgentSessionManager 的 agentScopeBinder）。
      api.interactions.registerTaskFeed(ctx);
      // Load persisted state (workspace bindings + dynamic allowlist + DSH registry + session epochs).
      await api.workspace.init();
      await api.whitelist.init();
      await api.registry.init();
      // 迁移：已有 DSH 群的目录写回 workspace overrides，保证升级后
      // “同一工作区继续新建会话”和 UI 按目录聚合都能拿到路径。
      for (const entry of api.registry.list()) {
        if (entry.record && entry.record.workspaceDir) {
          api.workspace.setOverride(`wildfire:group:${entry.groupId}`, entry.record.workspaceDir);
        }
      }
      await api.wildfireAgents.init();

      // Connect with retry: the gateway may be briefly down (restart, network).
      // The SDK auto-reconnects once connected; a failed FIRST connect needs
      // our own exponential backoff so the robot recovers when the gateway
      // comes back. Reused by the watchdog below (belt-and-braces against a
      // stuck SDK reconnect).
      let connectPromise: Promise<void> | null = null;
      const connectWithRetry = (): Promise<void> => {
        if (connectPromise) return connectPromise;
        connectPromise = (async () => {
          let attempt = 0;
          let authReported = false;
          for (;;) {
            try {
              await startClient(api, cfg);
              break;
            } catch (err: any) {
              attempt += 1;
              // 鉴权失败（凭据/配置错误）与网络故障分开处理：
              // 前者是永久性错误，只报错一次，之后按固定 60s 慢速重试
              // （等运营者修正配置后自动恢复），不再指数退避刷屏；
              // 后者保持指数退避直至网关恢复。
              if (err?.code === "AUTH_FAILED") {
                if (!authReported) {
                  authReported = true;
                  logger.error?.(
                    `[wildfire] ${String(err)} — will retry every 60s until fixed`
                  );
                } else {
                  logger.info?.(`[wildfire] auth retry pending (attempt ${attempt})`);
                }
                await new Promise((resolve) => setTimeout(resolve, 60_000));
                continue;
              }
              const delay = Math.min(30_000, 5_000 * 2 ** Math.min(attempt - 1, 4));
              // error level: dsh's default logger level hides warn in GUI-less profiles
              logger.error?.(
                `[wildfire] connect failed (attempt ${attempt}), retrying in ${delay}ms: ${String(err)}`
              );
              await new Promise((resolve) => setTimeout(resolve, delay));
            }
          }
        })().finally(() => {
          connectPromise = null;
        });
        return connectPromise;
      };

      await connectWithRetry();

      // Watchdog: if the connection drops and neither the SDK reconnect nor the
      // first-connect loop recovers within the window, tear down and reconnect
      // from scratch. Guards against the SDK's "Already authenticated" zombie
      // (gateway restarts previously left the client permanently dead).
      const WATCHDOG_MS = 15_000;
      watchdog = setInterval(() => {
        void (async () => {
          if (isClientReady()) return;
          if (connectPromise) return; // a connect/reconnect is already in flight
          // 不仅看 TCP 连接，还要看鉴权状态：鉴权丢失时连接可能仍然开着，
          // 此时所有请求都会本地失败（Not authenticated），必须重建客户端。
          logger.warn?.("[wildfire] watchdog: connection lost or unauthenticated, reconnecting...");
          await stopClient(api).catch(() => {});
          await connectWithRetry().catch(() => {});
        })();
      }, WATCHDOG_MS);

      // Fetch the robot profile to learn its owner (whitelist auto-admission).
      try {
        const profile = await getConnectedClient()?.getProfile();
        const owner = profile?.code === 0 ? (profile?.result?.owner ?? undefined) : undefined;
        api.whitelist.setOwner(owner);
        api.access.setOwner(owner);
        api.robotOwner = owner;
      } catch (err: any) {
        logger.warn?.(`[wildfire] failed to fetch robot profile: ${err.message}`);
      }

      logger.info("[wildfire] service started");
    } catch (err) {
      logger.error("[wildfire] failed to start:", err);
    }
  })();

  ctx.on("dispose", async () => {
    if (watchdog) clearInterval(watchdog);
    await stopClient(api);
    api.interactions.dispose();
    await api.workspace.flush().catch(() => {});
    await api.whitelist.flush().catch(() => {});
    await api.registry.flush().catch(() => {});
    await api.audit.flush().catch(() => {});
    await api.wildfireAgents.disposeAll();
    logger.info("[wildfire] service stopped");
  });

  logger.info("[wildfire] plugin loaded");
}

export default apply;
