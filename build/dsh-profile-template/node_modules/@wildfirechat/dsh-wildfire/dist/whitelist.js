/**
 * Whitelist filter — admission control for the robot.
 *
 * Sources of admission (any one suffices when the whitelist is enabled):
 *   - the robot owner (read via `getProfile()`, `whiteList.includeOwner`)
 *   - static `whiteList.allowedUsers` / `allowedGroups`
 *   - the dynamic list managed via `/allow` / `/disallow` (persisted to disk)
 */
import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dshHomePath } from "./utils.js";
import { getWhitelistConfig } from "./config.js";
export class WhitelistFilter {
    config;
    logger;
    persistFile;
    owner;
    extraUsers = new Set();
    loaded = false;
    saveTimer;
    constructor(config, logger, persistFile) {
        this.config = config;
        this.logger = logger;
        this.persistFile =
            persistFile ?? getWhitelistConfig(config).persistFile ?? dshHomePath("wildfire-allowlist.json");
    }
    /** Set the robot owner (fetched via getProfile after connecting). */
    setOwner(owner) {
        this.owner = owner;
        this.logger?.info?.(`[wildfire] robot owner: ${owner ?? "unknown"}`);
    }
    /** Load the persisted dynamic allowlist (call once at startup). */
    async init() {
        if (this.loaded)
            return;
        this.loaded = true;
        try {
            const raw = await readFile(this.persistFile, "utf8");
            const data = JSON.parse(raw);
            if (data && Array.isArray(data.users)) {
                for (const user of data.users) {
                    if (typeof user === "string" && user)
                        this.extraUsers.add(user);
                }
                this.logger?.info?.(`[wildfire] loaded ${this.extraUsers.size} dynamic whitelist users from ${this.persistFile}`);
            }
        }
        catch (err) {
            if (err.code !== "ENOENT") {
                this.logger?.warn?.(`[wildfire] failed to load allowlist: ${err.message}`);
            }
        }
    }
    /**
     * @returns true = process, false = ignore
     */
    shouldProcess(senderId, targetId, isGroup) {
        const wl = getWhitelistConfig(this.config);
        if (!wl.enabled)
            return true;
        // The robot owner is always admitted.
        if (wl.includeOwner && this.owner && senderId === this.owner) {
            return true;
        }
        // Static allowed users.
        if (wl.allowedUsers.length > 0 && wl.allowedUsers.includes(senderId)) {
            return true;
        }
        // Dynamic `/allow` list.
        if (this.extraUsers.has(senderId)) {
            return true;
        }
        // Static allowed groups.
        if (isGroup && wl.allowedGroups.length > 0 && wl.allowedGroups.includes(targetId)) {
            return true;
        }
        return false;
    }
    /** Add a user to the dynamic allowlist (idempotent, persisted). */
    addUser(userId) {
        const trimmed = userId.trim();
        if (!trimmed)
            return;
        this.extraUsers.add(trimmed);
        this.logger?.info?.(`[wildfire] allowlist add: ${trimmed}`);
        this.persist();
    }
    /** Remove a user from the dynamic allowlist (idempotent, persisted). */
    removeUser(userId) {
        const trimmed = userId.trim();
        this.extraUsers.delete(trimmed);
        this.logger?.info?.(`[wildfire] allowlist remove: ${trimmed}`);
        this.persist();
    }
    /** Current dynamic allowlist (sorted). */
    listExtraUsers() {
        return [...this.extraUsers].sort();
    }
    get deniedMessage() {
        return getWhitelistConfig(this.config).deniedMessage;
    }
    /** Persist the dynamic list (debounced). */
    persist() {
        if (this.saveTimer)
            clearTimeout(this.saveTimer);
        this.saveTimer = setTimeout(() => {
            this.saveTimer = undefined;
            this.flush().catch((err) => this.logger?.warn?.(`[wildfire] failed to persist allowlist: ${String(err)}`));
        }, 500);
    }
    /** Write the dynamic list now (called on debounce and on plugin stop). */
    async flush() {
        const dir = path.dirname(this.persistFile);
        await mkdir(dir, { recursive: true });
        await writeFile(this.persistFile, JSON.stringify({ users: this.listExtraUsers() }, null, 2));
    }
}
//# sourceMappingURL=whitelist.js.map