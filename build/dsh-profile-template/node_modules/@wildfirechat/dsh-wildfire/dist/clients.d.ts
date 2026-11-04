/**
 * Wildfire robot-gateway client lifecycle (single account).
 *
 * Uses the same `@wildfirechat/robot-gateway-client-sdk` as the openclaw
 * plugin; only the inbound callback routing differs (dsh dispatch instead of
 * openclaw's runtime).
 */
import { RobotServiceClient } from "@wildfirechat/robot-gateway-client-sdk";
import type { WildfireConfig } from "./config.js";
export declare function isClientConnected(): boolean;
/**
 * 底层 WebSocket 是否处于「已鉴权」状态。
 * 只看 isClientConnected() 不够：鉴权状态可能在连接仍打开时丢失
 *（例如网关回了错误的 connect 帧），此时所有请求都会本地抛 Not authenticated。
 */
export declare function isClientAuthenticated(): boolean;
/** 既连着、又已鉴权，才算真正可用（看门狗用这个判断）。 */
export declare function isClientReady(): boolean;
export declare function getClient(): RobotServiceClient | null;
export declare function getConnectedClient(): RobotServiceClient | null;
/** Connect to the Wildfire gateway as the configured robot. */
export declare function startClient(api: any, config: WildfireConfig): Promise<void>;
/** Disconnect and release the client. */
export declare function stopClient(api?: any): Promise<void>;
//# sourceMappingURL=clients.d.ts.map