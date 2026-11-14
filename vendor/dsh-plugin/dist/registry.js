/**
 * DSH group registry — the ONLY source of truth for "this group is a DSH
 * workspace". Admission must come from this plugin-owned persisted registry:
 * group `extra` is writable by any member in the Wildfire IM permission model
 * (and is no longer written by this plugin), so it can never serve as identity.
 *
 * Persisted file: <dshHome>/wildfire-groups.json（$DSH_HOME 优先）
 */
import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dshHomePath } from "./utils.js";
export class DshGroupRegistry {
    logger;
    file;
    groups = new Map();
    loaded = false;
    saveTimer;
    constructor(logger, file) {
        this.logger = logger;
        this.file = file ?? dshHomePath("wildfire-groups.json");
    }
    async init() {
        if (this.loaded)
            return;
        this.loaded = true;
        try {
            const raw = await readFile(this.file, "utf8");
            const data = JSON.parse(raw);
            if (data && typeof data === "object" && data.groups) {
                for (const [groupId, record] of Object.entries(data.groups)) {
                    if (record && record.creatorUserId) {
                        this.groups.set(groupId, record);
                    }
                }
                this.logger?.info?.(`[wildfire] loaded ${this.groups.size} DSH groups from ${this.file}`);
            }
        }
        catch (err) {
            if (err.code !== "ENOENT") {
                this.logger?.warn?.(`[wildfire] failed to load DSH group registry: ${err.message}`);
            }
        }
    }
    /** Whether this group is a DSH workspace (registry hit). */
    isDshGroup(groupId) {
        return this.groups.has(groupId);
    }
    get(groupId) {
        return this.groups.get(groupId);
    }
    getCreator(groupId) {
        return this.groups.get(groupId)?.creatorUserId;
    }
    /** Register a group created by /create-group. */
    register(groupId, creatorUserId, workspaceDir) {
        this.groups.set(groupId, {
            creatorUserId,
            workspaceDir,
            createdAt: Date.now(),
        });
        this.logger?.info?.(`[wildfire] DSH group registered: ${groupId} (creator=${creatorUserId}, dir=${workspaceDir})`);
        this.persist();
    }
    /** Remove a group (destroyed via /destroy-group or dismissed via 108). */
    unregister(groupId) {
        const removed = this.groups.delete(groupId);
        if (removed) {
            this.logger?.info?.(`[wildfire] DSH group unregistered: ${groupId}`);
            this.persist();
        }
        return removed;
    }
    /** List all registered DSH groups (sorted by creation time). */
    list() {
        return [...this.groups.entries()]
            .map(([groupId, record]) => ({ groupId, record }))
            .sort((a, b) => a.record.createdAt - b.record.createdAt);
    }
    persist() {
        if (this.saveTimer)
            clearTimeout(this.saveTimer);
        this.saveTimer = setTimeout(() => {
            this.saveTimer = undefined;
            this.flush().catch((err) => this.logger?.warn?.(`[wildfire] failed to persist DSH group registry: ${String(err)}`));
        }, 500);
    }
    async flush() {
        const dir = path.dirname(this.file);
        await mkdir(dir, { recursive: true });
        const data = { groups: Object.fromEntries(this.groups) };
        await writeFile(this.file, JSON.stringify(data, null, 2));
    }
}
//# sourceMappingURL=registry.js.map