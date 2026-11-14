/**
 * Permission audit trail.
 *
 * Append-only JSONL under `$DSH_HOME/wildfire-audit.jsonl`, rotated at 2 MB.
 * The desktop client reads it through the Host (`DSH_GET_AUDIT`) and shows the
 * latest entries on the Permissions page. Logging must never break message
 * handling, so every failure is swallowed after a warning.
 */

import { appendFile, mkdir, rename, stat } from "node:fs/promises";
import path from "node:path";
import { dshHomePath } from "./utils.js";

export class AuditLog {
  private file: string;
  private logger: any;
  private queue: Promise<void> = Promise.resolve();
  private maxBytes: number;

  constructor(logger?: any, file?: string, maxBytes = 2 * 1024 * 1024) {
    this.logger = logger;
    this.file = file ?? dshHomePath("wildfire-audit.jsonl");
    this.maxBytes = maxBytes;
  }

  /**
   * Record one permission-sensitive event. `kind` is a stable dotted id
   * (`approval.requested`, `command.denied`, ...); callers add actor/target
   * and any details worth keeping.
   */
  record(kind: string, fields: Record<string, unknown> = {}): void {
    let line: string;
    try {
      line = `${JSON.stringify({ ts: new Date().toISOString(), kind, ...fields })}\n`;
    } catch (err: any) {
      this.logger?.warn?.(`[wildfire] audit serialize failed: ${String(err?.message ?? err)}`);
      return;
    }
    this.queue = this.queue
      .then(() => this.append(line))
      .catch((err: unknown) => {
        this.logger?.warn?.(`[wildfire] audit write failed: ${String(err)}`);
      });
  }

  /** Wait for queued writes (plugin dispose / tests). */
  async flush(): Promise<void> {
    await this.queue.catch(() => {});
  }

  private async append(line: string): Promise<void> {
    const dir = path.dirname(this.file);
    await mkdir(dir, { recursive: true });
    try {
      const info = await stat(this.file);
      if (info.size > this.maxBytes) {
        await rename(this.file, `${this.file}.1`).catch(() => {});
      }
    } catch {
      // file does not exist yet — nothing to rotate
    }
    await appendFile(this.file, line, { mode: 0o600 });
  }
}
