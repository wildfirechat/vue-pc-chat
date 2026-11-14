/**
 * DSH group registry — the ONLY source of truth for "this group is a DSH
 * workspace". Admission must come from this plugin-owned persisted registry:
 * group `extra` is writable by any member in the Wildfire IM permission model
 * (and is no longer written by this plugin), so it can never serve as identity.
 *
 * Persisted file: <dshHome>/wildfire-groups.json（$DSH_HOME 优先）
 */
export interface DshGroupRecord {
    /** The user who ran /create-group (management authority for this workspace). */
    creatorUserId: string;
    /** Workspace directory chosen at creation (auto/catalog/path). */
    workspaceDir: string;
    /** Creation time. */
    createdAt: number;
}
export declare class DshGroupRegistry {
    private logger;
    private file;
    private groups;
    private loaded;
    private saveTimer;
    constructor(logger?: any, file?: string);
    init(): Promise<void>;
    /** Whether this group is a DSH workspace (registry hit). */
    isDshGroup(groupId: string): boolean;
    get(groupId: string): DshGroupRecord | undefined;
    getCreator(groupId: string): string | undefined;
    /** Register a group created by /create-group. */
    register(groupId: string, creatorUserId: string, workspaceDir: string): void;
    /** Remove a group (destroyed via /destroy-group or dismissed via 108). */
    unregister(groupId: string): boolean;
    /** List all registered DSH groups (sorted by creation time). */
    list(): Array<{
        groupId: string;
        record: DshGroupRecord;
    }>;
    private persist;
    flush(): Promise<void>;
}
//# sourceMappingURL=registry.d.ts.map