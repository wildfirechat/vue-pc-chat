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

import { homedir } from "node:os";
import path from "node:path";
import { mkdir, readFile, realpath, stat, writeFile } from "node:fs/promises";
import type { WildfireConfig, WildfireWorkspaceConfig } from "./config.js";
import { getWorkspaceConfig } from "./config.js";

type RequiredWorkspaceConfig = Required<WildfireWorkspaceConfig>;

/**
 * 符号链接感知的路径规范化：向上找到第一个【已存在】的祖先并 realpath，
 * 再把剩余（不存在的）路径段拼接回去。
 * 用于对尚不存在的目录做围栏校验——否则路径中的符号链接
 * （如 /data/link -> /etc）会让之后的 mkdir 实际落在围栏外。
 */
async function realpathPrefix(p: string): Promise<{ prefix: string; tail: string[] }> {
  const tail: string[] = [];
  let cur = p;
  for (;;) {
    try {
      return { prefix: await realpath(cur), tail };
    } catch {
      const parent = path.dirname(cur);
      if (parent === cur) return { prefix: p, tail }; // 连根都不存在：原样返回
      tail.unshift(path.basename(cur));
      cur = parent;
    }
  }
}

export class WorkspaceResolver {
  private config: RequiredWorkspaceConfig;
  private logger: any;
  private overrides = new Map<string, string>();
  private loaded = false;
  private saveTimer: NodeJS.Timeout | undefined;

  constructor(config: WildfireConfig, logger?: any) {
    this.config = getWorkspaceConfig(config);
    this.logger = logger;
  }

  /** Load persisted `/cwd` overrides from disk (call once at startup). */
  async init(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    if (!this.config.persist) return;
    try {
      const raw = await readFile(this.config.persistFile, "utf8");
      const data = JSON.parse(raw);
      if (data && typeof data === "object" && data.overrides) {
        for (const [key, dir] of Object.entries<string>(data.overrides)) {
          this.overrides.set(key, dir);
        }
        this.logger?.info?.(
          `[wildfire] loaded ${this.overrides.size} persisted workspace overrides from ${this.config.persistFile}`
        );
      }
    } catch (err: any) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
        this.logger?.warn?.(`[wildfire] failed to load workspace overrides: ${err.message}`);
      }
    }
  }

  /**
   * Resolve the workspace directory for a conversation and ensure it exists.
   * @param key       IM conversation key (`wildfire:user:<id>` / `wildfire:group:<id>`)
   * @param sessionId dsh SessionId for the conversation (used for per-session dirs)
   */
  async resolve(key: string, sessionId: string): Promise<string> {
    await this.init();
    const override = this.overrides.get(key);
    let dir: string;
    if (override) {
      dir = override;
    } else {
      switch (this.config.mode) {
        case "per-session":
          dir = path.join(this.config.sessionDir || this.config.path, sessionId);
          break;
        case "mapped":
          dir = this.mapLookup(key) ?? this.config.path;
          break;
        default:
          dir = this.config.path;
      }
    }
    await mkdir(dir, { recursive: true });
    return dir;
  }

  /** Current effective directory for a conversation (may not exist yet). */
  async peek(key: string, sessionId: string): Promise<string> {
    await this.init();
    const override = this.overrides.get(key);
    if (override) return override;
    switch (this.config.mode) {
      case "per-session":
        return path.join(this.config.sessionDir || this.config.path, sessionId);
      case "mapped":
        return this.mapLookup(key) ?? this.config.path;
      default:
        return this.config.path;
    }
  }

  /**
   * 项目根目录（workspace.root 的生效值）。所有项目都在此目录下：
   * `/cwd` 的相对路径按此解析，`/create-group auto` 的自动目录默认也在此之下。
   */
  root(): string {
    return this.config.root;
  }

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
  async resolveUserPath(
    input: string
  ): Promise<{ resolved: string; exists: boolean; isDir: boolean } | null> {
    const trimmed = input.trim();
    let expanded: string;
    if (trimmed === "~" || trimmed.startsWith("~/")) {
      expanded = path.join(homedir(), trimmed.slice(1));
    } else if (path.isAbsolute(trimmed)) {
      expanded = trimmed;
    } else {
      expanded = path.join(this.root(), trimmed);
    }
    const resolved = path.normalize(expanded);
    if (this.config.allowedRoots.length > 0) {
      const roots = await Promise.all(
        this.config.allowedRoots.map((r) => realpath(r).catch(() => path.resolve(r)))
      );
      // 已存在路径：realpath 直接命中（与旧行为一致）；
      // 不存在路径：realpathPrefix 把已存在祖先的 realpath 与剩余段拼接，
      // 使符号链接无法把待创建目录带出围栏。
      const { prefix, tail } = await realpathPrefix(resolved);
      const effective = tail.length > 0 ? path.join(prefix, ...tail) : prefix;
      const inside = roots.some(
        (root) => root && (effective === root || effective.startsWith(root + path.sep))
      );
      if (!inside) return null;
    }
    let exists = false;
    let isDir = false;
    try {
      const info = await stat(resolved);
      exists = true;
      isDir = info.isDirectory();
    } catch {
      // ENOENT etc. — caller decides whether to create
    }
    return { resolved, exists, isDir };
  }

  /**
   * Validate a user-supplied directory (`/cwd` command): must exist, be a
   * directory, and (when configured) sit inside one of `allowedRoots`.
   * Relative paths resolve under `root()`. Returns the realpath on success,
   * null on failure.
   */
  async validateUserPath(input: string): Promise<string | null> {
    const info = await this.resolveUserPath(input);
    if (!info || !info.exists || !info.isDir) return null;
    try {
      return await realpath(info.resolved);
    } catch {
      return info.resolved;
    }
  }

  /** Runtime override (from `/cwd` command), highest precedence. */
  setOverride(key: string, dir: string): void {
    this.overrides.set(key, dir);
    this.logger?.info?.(`[wildfire] workspace override: ${key} -> ${dir}`);
    this.persistOverrides();
  }

  /** 该会话当前的运行时目录 override（`/cwd` 绑定）；没有则 undefined。 */
  peekOverride(key: string): string | undefined {
    return this.overrides.get(key);
  }

  /** Remove the runtime override for a conversation (back to configured modes). */
  clearOverride(key: string): void {
    this.overrides.delete(key);
    this.logger?.info?.(`[wildfire] workspace override cleared: ${key}`);
    this.persistOverrides();
  }

  /** Persist overrides to disk (debounced). */
  private persistOverrides(): void {
    if (!this.config.persist) return;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.saveTimer = undefined;
      this.flush().catch((err: unknown) =>
        this.logger?.warn?.(`[wildfire] failed to persist workspace overrides: ${String(err)}`)
      );
    }, 500);
  }

  /** Write the override map now (called on debounce and on plugin stop). */
  async flush(): Promise<void> {
    if (!this.config.persist) return;
    const dir = path.dirname(this.config.persistFile);
    await mkdir(dir, { recursive: true });
    const data = { overrides: Object.fromEntries(this.overrides) };
    await writeFile(this.config.persistFile, JSON.stringify(data, null, 2));
  }

  /** Map lookup supporting both the full key and the bare id after the prefix. */
  private mapLookup(key: string): string | undefined {
    if (this.config.map[key]) return this.config.map[key];
    const stripped = key.replace(/^wildfire:(user|group):/i, "");
    if (stripped !== key && this.config.map[stripped]) return this.config.map[stripped];
    return undefined;
  }
}
