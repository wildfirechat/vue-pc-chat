/**
 * Permission audit trail.
 *
 * Append-only JSONL under `$DSH_HOME/wildfire-audit.jsonl`, rotated at 2 MB.
 * The desktop client reads it through the Host (`DSH_GET_AUDIT`) and shows the
 * latest entries on the Permissions page. Logging must never break message
 * handling, so every failure is swallowed after a warning.
 */
export declare class AuditLog {
    private file;
    private logger;
    private queue;
    private maxBytes;
    constructor(logger?: any, file?: string, maxBytes?: number);
    /**
     * Record one permission-sensitive event. `kind` is a stable dotted id
     * (`approval.requested`, `command.denied`, ...); callers add actor/target
     * and any details worth keeping.
     */
    record(kind: string, fields?: Record<string, unknown>): void;
    /** Wait for queued writes (plugin dispose / tests). */
    flush(): Promise<void>;
    private append;
}
//# sourceMappingURL=audit.d.ts.map