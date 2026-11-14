/**
 * Whitelist filter — admission control for the robot.
 *
 * Sources of admission (any one suffices when the whitelist is enabled):
 *   - the robot owner (read via `getProfile()`, `whiteList.includeOwner`)
 *   - static `whiteList.allowedUsers` / `allowedGroups`
 *   - the dynamic list managed via `/allow` / `/disallow` (persisted to disk)
 */

import { homedir } from "node:os";
import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dshHomePath } from "./utils.js";
import type { WildfireConfig } from "./config.js";
import { getWhitelistConfig } from "./config.js";

export class WhitelistFilter {
  private config: WildfireConfig;
  private logger: any;
  private persistFile: string;
  private owner: string | undefined;
  private extraUsers = new Set<string>();
  private loaded = false;
  private saveTimer: NodeJS.Timeout | undefined;

  constructor(config: WildfireConfig, logger?: any, persistFile?: string) {
    this.config = config;
    this.logger = logger;
    this.persistFile =
      persistFile ?? getWhitelistConfig(config).persistFile ?? dshHomePath("wildfire-allowlist.json");
  }

  /** Set the robot owner (fetched via getProfile after connecting). */
  setOwner(owner: string | undefined): void {
    this.owner = owner;
    this.logger?.info?.(`[wildfire] robot owner: ${owner ?? "unknown"}`);
  }

  /** Load the persisted dynamic allowlist (call once at startup). */
  async init(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const raw = await readFile(this.persistFile, "utf8");
      const data = JSON.parse(raw);
      if (data && Array.isArray(data.users)) {
        for (const user of data.users) {
          if (typeof user === "string" && user) this.extraUsers.add(user);
        }
        this.logger?.info?.(
          `[wildfire] loaded ${this.extraUsers.size} dynamic whitelist users from ${this.persistFile}`
        );
      }
    } catch (err: any) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
        this.logger?.warn?.(`[wildfire] failed to load allowlist: ${err.message}`);
      }
    }
  }

  /**
   * @returns true = process, false = ignore
   */
  shouldProcess(senderId: string, targetId: string, isGroup: boolean): boolean {
    const wl = getWhitelistConfig(this.config);
    if (!wl.enabled) return true;

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
  addUser(userId: string): void {
    const trimmed = userId.trim();
    if (!trimmed) return;
    this.extraUsers.add(trimmed);
    this.logger?.info?.(`[wildfire] allowlist add: ${trimmed}`);
    this.persist();
  }

  /** Remove a user from the dynamic allowlist (idempotent, persisted). */
  removeUser(userId: string): void {
    const trimmed = userId.trim();
    this.extraUsers.delete(trimmed);
    this.logger?.info?.(`[wildfire] allowlist remove: ${trimmed}`);
    this.persist();
  }

  /** Current dynamic allowlist (sorted). */
  listExtraUsers(): string[] {
    return [...this.extraUsers].sort();
  }

  get deniedMessage(): string {
    return getWhitelistConfig(this.config).deniedMessage;
  }

  /** Persist the dynamic list (debounced). */
  private persist(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.saveTimer = undefined;
      this.flush().catch((err: unknown) =>
        this.logger?.warn?.(`[wildfire] failed to persist allowlist: ${String(err)}`)
      );
    }, 500);
  }

  /** Write the dynamic list now (called on debounce and on plugin stop). */
  async flush(): Promise<void> {
    const dir = path.dirname(this.persistFile);
    await mkdir(dir, { recursive: true });
    await writeFile(
      this.persistFile,
      JSON.stringify({ users: this.listExtraUsers() }, null, 2)
    );
  }
}
