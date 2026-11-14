/**
 * AI 面板诊断日志（临时排查用）。
 *
 * 目的：把「插件写入 scope=31 type=3 的载荷」与「沙箱/会话解析过程」落盘到
 * `<dshHome>/wildfire-panel-debug.log`，用于定位「面板显示旧值 / 沙箱改不动」这类
 * 客户端读取与插件写入不一致的问题（插件 logger 输出只在 dsh 进程 stdout，
 * 不落文件，排查时不方便）。
 */
import { appendFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { dshHomePath } from "./utils.js";

/** 面板诊断日志文件路径。 */
export const PANEL_DEBUG_LOG = dshHomePath("wildfire-panel-debug.log");

/** 追加一行面板诊断日志（同时写文件与插件 logger；任何失败都不影响主流程）。 */
export function panelDebug(logger: any, message: string): void {
  const line = `${new Date().toISOString()} ${message}\n`;
  try {
    mkdirSync(path.dirname(PANEL_DEBUG_LOG), { recursive: true });
    appendFileSync(PANEL_DEBUG_LOG, line);
  } catch {
    // 忽略：日志失败不影响主流程
  }
  try {
    logger?.info?.(`[wildfire] ${message}`);
  } catch {
    // 忽略
  }
}
