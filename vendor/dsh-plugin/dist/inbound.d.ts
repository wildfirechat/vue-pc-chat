/**
 * Inbound message handling: Wildfire PushMessage -> dsh Agent dispatch with
 * streaming replies back to Wildfire.
 *
 * Mirrors the openclaw plugin's `inbound.ts` for filtering/serialization and
 * replaces the openclaw reply dispatch with the dsh AgentSessionManager.
 */
import type { WildfireConfig } from "./config.js";
export declare const turnOwners: Map<string, string>;
export declare function handleIncomingMessage(api: any, message: any, config: WildfireConfig): Promise<void>;
//# sourceMappingURL=inbound.d.ts.map