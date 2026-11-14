/**
 * Wildfire robot-gateway client lifecycle (single account).
 *
 * Uses the same `@wildfirechat/robot-gateway-client-sdk` as the openclaw
 * plugin; only the inbound callback routing differs (dsh dispatch instead of
 * openclaw's runtime).
 */

import fs from "node:fs";
import { RobotServiceClient } from "@wildfirechat/robot-gateway-client-sdk";
import type { WildfireConfig } from "./config.js";
import { handleIncomingMessage } from "./inbound.js";
import { dshHomePath } from "./utils.js";

function writeGatewayStatus(api: any, connected: boolean, extra: Record<string, any> = {}): void {
  try {
    const file = dshHomePath("wildfire-gateway-status.json");
    const data = {
      connected,
      updatedAt: Date.now(),
      ...extra,
    };
    fs.writeFileSync(file, JSON.stringify(data), { mode: 0o600 });
  } catch (e: any) {
    api?.logger?.warn?.("[wildfire] write gateway status failed: " + String(e?.message ?? e));
  }
}

let client: RobotServiceClient | null = null;
let connected = false;

export function isClientConnected(): boolean {
  return connected && client !== null;
}

/**
 * 底层 WebSocket 是否处于「已鉴权」状态。
 * 只看 isClientConnected() 不够：鉴权状态可能在连接仍打开时丢失
 *（例如网关回了错误的 connect 帧），此时所有请求都会本地抛 Not authenticated。
 */
export function isClientAuthenticated(): boolean {
  if (!client) return false;
  try {
    return client.isAuthenticated() === true;
  } catch {
    return false;
  }
}

/** 既连着、又已鉴权，才算真正可用（看门狗用这个判断）。 */
export function isClientReady(): boolean {
  return isClientConnected() && isClientAuthenticated();
}

export function getClient(): RobotServiceClient | null {
  return client;
}

export function getConnectedClient(): RobotServiceClient | null {
  return client && connected ? client : null;
}

/** Connect to the Wildfire gateway as the configured robot. */
export async function startClient(api: any, config: WildfireConfig): Promise<void> {
  if (client) {
    api.logger?.warn?.("[wildfire] client already exists");
    return;
  }

  client = new RobotServiceClient(
    config.gatewayUrl!,
    {
      onMessage: (message: any) => handleIncomingMessage(api, message, config),
      onConnectionChanged: (isConnected: boolean) => {
        connected = isConnected;
        writeGatewayStatus(api, isConnected, {
          robotId: config.robotId,
          gatewayUrl: config.gatewayUrl,
        });
        api.logger?.info?.(`[wildfire] connection changed: ${isConnected}`);
      },
      onError: (error: Error) => {
        api.logger?.error?.("[wildfire] error:", error);
      },
    },
    {
      timeout: 30,
      reconnectInterval: 5000,
      // 心跳 60s：与网关 HEARTBEAT_TIMEOUT（3min）匹配，静默失联约 2~4 分钟显示离线
      heartbeatInterval: 60000,
      // 平台号：默认不配置 —— SDK 按运行环境自动探测（Linux=7 / macOS=4 / Windows=3），
      // 网关据此设置 im-server 的机器人在线平台（/robot/set_online）。
      // 仅特殊场景需要覆盖时配置 config.gatewayPlatform。
      platform: config.gatewayPlatform,
    }
  );

  const isConn = await client.connect(
    config.robotId!,
    config.robotSecret!,
    30,
    config.gatewayPlatform
  );
  if (isConn) {
    connected = true;
    writeGatewayStatus(api, true, {
      robotId: config.robotId,
      gatewayUrl: config.gatewayUrl,
    });
    api.logger?.info?.(`[wildfire] connected as ${config.robotId}`);
  } else {
    // 区分鉴权失败与网络失败（两者 connect() 都返回 false）：
    // 网络错误时底层 ws 从未连接成功（connected=false）；
    // 鉴权失败/鉴权超时时 ws 已连上但未通过鉴权（connected=true）。
    const wsConnected = (client as any)?.connectionManager?.client?.connected === true;
    try {
      client.close(); // 释放鉴权失败后残留的 ws 连接，避免 socket 泄漏
    } catch {
      // ignore
    }
    client = null;
    writeGatewayStatus(api, false, {
      robotId: config.robotId,
      gatewayUrl: config.gatewayUrl,
      error: wsConnected ? "authentication failed" : "connect failed",
    });
    if (wsConnected) {
      api.logger?.error?.(
        `[wildfire] authentication failed for robot ${config.robotId} (check robotId / robotSecret / gatewayUrl)`
      );
      const err = new Error("Authentication failed for the robot (check robotId/robotSecret)");
      (err as any).code = "AUTH_FAILED";
      throw err;
    }
    api.logger?.error?.("[wildfire] failed to connect");
    throw new Error("Failed to connect to Wildfire IM");
  }
}

/** Disconnect and release the client. */
export async function stopClient(api?: any): Promise<void> {
  if (client) {
    try {
      client.close();
      api?.logger?.info?.("[wildfire] disconnected");
    } catch (err) {
      api?.logger?.error?.("[wildfire] error stopping:", err);
    }
    client = null;
    connected = false;
  }
  writeGatewayStatus(api, false, { error: "disconnected" });
}
