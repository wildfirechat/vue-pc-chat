/**
 * Workspace (working directory) resolution for agent sessions.
 *
 * The agent's cwd is written into the dsh session header at creation time and
 * is immutable afterwards, so switching workspace for a conversation means
 * disposing the old session and recreating it with the new cwd.
 *
 * Modes:
 * - "global"      every conversation runs in `path` (default process.cwd())
 * - "per-session" each conversation gets `sessionDir/<sessionId>`
 * - "mapped"      conversation key -> dir from `map`, falling back to `path`
 *
 * A runtime override map (set by the `/cwd` command) takes precedence over all
 * configured modes and is scoped per conversation key.
 */
import type { WildfireConfig } from "./config.js";
export declare class WorkspaceResolver {
    private config;
    private logger;
    private overrides;
    private loaded;
    private saveTimer;
    constructor(config: WildfireConfig, logger?: any);
    /** Load persisted `/cwd` overrides from disk (call once at startup). */
    init(): Promise<void>;
    /**
     * Resolve the workspace directory for a conversation and ensure it exists.
     * @param key       IM conversation key (`wildfire:user:<id>` / `wildfire:group:<id>`)
     * @param sessionId dsh SessionId for the conversation (used for per-session dirs)
     */
    resolve(key: string, sessionId: string): Promise<string>;
    /** Current effective directory for a conversation (may not exist yet). */
    peek(key: string, sessionId: string): Promise<string>;
    /**
     * 项目根目录（workspace.root 的生效值）。所有项目都在此目录下：
     * `/cwd` 的相对路径按此解析，`/create-group auto` 的自动目录默认也在此之下。
     */
    root(): string;
    /**
     * Resolve a user-supplied path (`/cwd` command) WITHOUT requiring it to
     * exist (used by the create-confirmation flow):
     * - `~` / `~/x`  -> home directory
     * - absolute path -> as-is
     * - relative path -> `path.join(root(), input)`（项目根目录下）
     * Returns `{ resolved, exists, isDir }`; null when outside `allowedRoots`.
     * Note: for missing dirs the fence is compared lexically (realpath needs an
     * existing entry); existing roots are realpath-canonicalized when possible.
     */
    resolveUserPath(input: string): Promise<{
        resolved: string;
        exists: boolean;
        isDir: boolean;
    } | null>;
    /**
     * Validate a user-supplied directory (`/cwd` command): must exist, be a
     * directory, and (when configured) sit inside one of `allowedRoots`.
     * Relative paths resolve under `root()`. Returns the realpath on success,
     * null on failure.
     */
    validateUserPath(input: string): Promise<string | null>;
    /** Runtime override (from `/cwd` command), highest precedence. */
    setOverride(key: string, dir: string): void;
    /** 该会话当前的运行时目录 override（`/cwd` 绑定）；没有则 undefined。 */
    peekOverride(key: string): string | undefined;
    /** Remove the runtime override for a conversation (back to configured modes). */
    clearOverride(key: string): void;
    /** Persist overrides to disk (debounced). */
    private persistOverrides;
    /** Write the override map now (called on debounce and on plugin stop). */
    flush(): Promise<void>;
    /** Map lookup supporting both the full key and the bare id after the prefix. */
    private mapLookup;
}
//# sourceMappingURL=workspace.d.ts.map