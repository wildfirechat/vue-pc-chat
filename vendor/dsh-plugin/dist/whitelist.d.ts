/**
 * Whitelist filter — admission control for the robot.
 *
 * Sources of admission (any one suffices when the whitelist is enabled):
 *   - the robot owner (read via `getProfile()`, `whiteList.includeOwner`)
 *   - static `whiteList.allowedUsers` / `allowedGroups`
 *   - the dynamic list managed via `/allow` / `/disallow` (persisted to disk)
 */
import type { WildfireConfig } from "./config.js";
export declare class WhitelistFilter {
    private config;
    private logger;
    private persistFile;
    private owner;
    private extraUsers;
    private loaded;
    private saveTimer;
    constructor(config: WildfireConfig, logger?: any, persistFile?: string);
    /** Set the robot owner (fetched via getProfile after connecting). */
    setOwner(owner: string | undefined): void;
    /** Load the persisted dynamic allowlist (call once at startup). */
    init(): Promise<void>;
    /**
     * @returns true = process, false = ignore
     */
    shouldProcess(senderId: string, targetId: string, isGroup: boolean): boolean;
    /** Add a user to the dynamic allowlist (idempotent, persisted). */
    addUser(userId: string): void;
    /** Remove a user from the dynamic allowlist (idempotent, persisted). */
    removeUser(userId: string): void;
    /** Current dynamic allowlist (sorted). */
    listExtraUsers(): string[];
    get deniedMessage(): string;
    /** Persist the dynamic list (debounced). */
    private persist;
    /** Write the dynamic list now (called on debounce and on plugin stop). */
    flush(): Promise<void>;
}
//# sourceMappingURL=whitelist.d.ts.map