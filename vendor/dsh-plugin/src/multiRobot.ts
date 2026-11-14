/**
 * Multi-robot group routing.
 *
 * Wildfire gateway delivers every group message to every robot. In a group
 * with more than one robot:
 * - explicit @mentions are authoritative;
 * - messages from robots are ignored, except an owner `assign` targeted at us;
 * - with no @mention, the owner robot decides: reply itself or send a visible
 *   `@target` assignment.
 *
 * The router is intentionally rule-based for v1 (tags/keywords). A model-based
 * owner router can replace `chooseTarget` without changing the transport.
 */

const CONV_TYPE_GROUP = 1;
const META_TTL_MS = 15_000;

export interface RobotSection {
  workspaceId?: string;
  workspaceName?: string;
  sessionId?: string;
  sessionTitle?: string;
  hostId?: string;
  role?: string;
  tags?: string[];
  displayName?: string;
}

export interface GroupMeta {
  broker?: { type?: string; id?: string };
  robots: Record<string, RobotSection>;
}

interface CacheEntry {
  at: number;
  meta: GroupMeta | null;
}

const metaCache = new Map<string, CacheEntry>();

function parseJson(value: any): any {
  if (!value) return null;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return null;
  }
}

export function parseGroupMeta(extra: any): GroupMeta | null {
  const root = parseJson(extra);
  if (!root || typeof root !== "object") return null;
  const wfds = root.wfds || root;
  if (!wfds || typeof wfds !== "object" || !wfds.robots) return null;
  const robots: Record<string, RobotSection> = {};
  for (const [robotId, value] of Object.entries(wfds.robots)) {
    if (value && typeof value === "object") robots[robotId] = value as RobotSection;
  }
  return {
    broker: wfds.broker,
    robots,
  };
}

export async function loadGroupMeta(
  client: any,
  groupId: string,
  force = false
): Promise<GroupMeta | null> {
  const cached = metaCache.get(groupId);
  const now = Date.now();
  if (!force && cached && now - cached.at < META_TTL_MS) return cached.meta;
  try {
    const result = await client.getGroupInfo(groupId);
    const info = result && result.result ? result.result : result;
    const meta = parseGroupMeta(info && info.extra);
    metaCache.set(groupId, { at: now, meta });
    return meta;
  } catch {
    metaCache.set(groupId, { at: now, meta: null });
    return null;
  }
}

export function invalidateGroupMeta(groupId: string): void {
  metaCache.delete(groupId);
}

function normalizeMentions(payload: any): string[] {
  const raw = payload && (payload.mentionedTarget || payload.mentionedTargets || payload.mentioned_target);
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  if (typeof raw === "string") {
    const parsed = parseJson(raw);
    if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    return raw.split(",").map(s => s.trim()).filter(Boolean);
  }
  return [];
}

function parseAssign(payload: any): any {
  const extra = parseJson(payload && payload.extra);
  const wfds = extra && (extra.wfds || extra);
  if (!wfds || wfds.op !== "assign") return null;
  return wfds;
}

function isRobotSender(meta: GroupMeta, sender: string): boolean {
  if (!meta) return false;
  if (meta.robots[sender]) return true;
  return !!(meta.broker && meta.broker.type === "robot" && meta.broker.id === sender);
}

function ownerRobotId(meta: GroupMeta): string | null {
  if (meta.broker && meta.broker.type === "robot" && meta.broker.id) return String(meta.broker.id);
  return null;
}

/**
 * Rule-based target selection. Returns the local robot when no other robot's
 * tag matches, so the owner remains the default responder.
 */
export function chooseTarget(text: string, meta: GroupMeta, localRobotId: string): string {
  const lower = (text || "").toLowerCase();
  const candidates = Object.entries(meta.robots)
    .filter(([id]) => id !== localRobotId)
    .map(([id, section]) => ({ id, tags: (section.tags || []).map(t => String(t).toLowerCase()) }));
  const matches = candidates.filter(c => c.tags.some(t => t && lower.includes(t)));
  if (matches.length === 1) return matches[0].id;
  return localRobotId;
}

async function sendVisibleAssign(
  client: any,
  groupId: string,
  line: number,
  targetRobotId: string,
  targetName: string,
  messageUid: string | number,
  note: string,
  ownerRobotId: string,
  excerpt: string
): Promise<void> {
  const label = targetName || targetRobotId;
  const detail = note || excerpt;
  const text = `@${label} 这条请你处理${detail ? `：${detail}` : ""}`;
  const payload: any = {
    type: 1,
    searchableContent: text,
    content: text,
    mentionedType: 1,
    mentionedTarget: [targetRobotId],
    extra: JSON.stringify({
      wfds: {
        op: "assign",
        fromRobotId: ownerRobotId,
        targetRobotId,
        messageUid,
        note,
        ts: Date.now(),
      },
    }),
  };
  const result = await client.sendMessage({ type: CONV_TYPE_GROUP, target: groupId, line }, payload);
  if (result && typeof result.isSuccess === "function" && !result.isSuccess()) {
    throw new Error(result.getMsg ? result.getMsg() : "assign send failed");
  }
}

export interface MultiRobotDecision {
  handled: boolean;
  force?: boolean;
  bypassWhitelist?: boolean;
  text?: string;
  reason?: string;
  targetRobotId?: string;
}

/**
 * Decide whether this robot should process an inbound group message.
 * Called only for normal chat messages (not 200-209 / 104-125 / slash commands).
 */
export async function routeMultiRobotMessage(args: {
  client: any;
  config: any;
  sender: string;
  conv: any;
  payload: any;
  text: string;
  messageUid?: string | number;
  logger?: any;
}): Promise<MultiRobotDecision> {
  const { client, config, sender, conv, payload, logger } = args;
  if (!client || !conv || conv.type !== CONV_TYPE_GROUP) return { handled: false };
  const localRobotId = String(config.robotId || "");
  if (!localRobotId) return { handled: false };

  const meta = await loadGroupMeta(client, String(conv.target));
  if (!meta) return { handled: false };
  const robotIds = Object.keys(meta.robots);
  if (robotIds.length <= 1) return { handled: false };

  const ownerId = ownerRobotId(meta);
  if (!ownerId) return { handled: false };
  const mentions = normalizeMentions(payload);
  const senderRobot = isRobotSender(meta, String(sender));
  const assign = parseAssign(payload);

  // A robot message is never normal chat. The only exception is an owner
  // assignment addressed to this robot.
  if (senderRobot) {
    if (assign && String(assign.targetRobotId || "") === localRobotId) {
      let originalText = args.text;
      const uid = assign.messageUid;
      if (uid) {
        try {
          const original = await client.getMessage(uid);
          const msg = original && original.result ? original.result : original;
          const p = msg && (msg.payload || msg.messageContent || msg);
          const content = p && (p.searchableContent || p.content);
          if (content && typeof content === "string") originalText = content;
        } catch (e) {
          logger?.warn?.(`[wildfire] assign original message fetch failed: ${String((e as any)?.message ?? e)}`);
        }
      }
      const note = assign.note ? String(assign.note) : "";
      return {
        handled: false,
        force: true,
        bypassWhitelist: true,
        text: note ? `${originalText}\n\n[owner 补充] ${note}` : originalText,
        reason: "owner-assign",
      };
    }
    return { handled: true, reason: "robot-message" };
  }

  if (mentions.length > 0) {
    if (mentions.includes(localRobotId)) {
      return { handled: false, force: true, reason: "mentioned" };
    }
    return { handled: true, reason: "mentioned-other" };
  }

  // No @mention: only the owner routes; guests stay silent.
  if (localRobotId !== ownerId) {
    return { handled: true, reason: "no-mention-guest" };
  }

  const target = chooseTarget(args.text, meta, localRobotId);
  if (target && target !== localRobotId) {
    const section = meta.robots[target] || {};
    const targetName = section.displayName || target;
    try {
      await sendVisibleAssign(
        client,
        String(conv.target),
        Number(conv.line ?? 2),
        target,
        targetName,
        args.messageUid || (payload && (payload.messageUid || payload.messageId)) || "",
        "",
        ownerId,
        (args.text || "").slice(0, 80)
      );
      logger?.info?.(`[wildfire] owner assigned message to ${target}`);
      return { handled: true, reason: "owner-assigned", targetRobotId: target };
    } catch (e: any) {
      logger?.warn?.(`[wildfire] owner assign failed: ${String((e as any)?.message ?? e)}`);
      // Fall through: owner answers itself if the visible assign cannot be sent.
    }
  }
  return { handled: false, force: true, reason: "owner-reply", targetRobotId: localRobotId };
}


export interface MetadataSection extends RobotSection {
  updatedAt?: number;
}

function parseMetadataPayload(payload: any): any {
  const candidates = [payload && payload.content, payload && payload.extra];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const parsed = parseJson(candidate);
    if (parsed && parsed.op) return parsed;
  }
  return null;
}

async function readExtra(client: any, groupId: string): Promise<any | null> {
  try {
    const result = await client.getGroupInfo(groupId);
    const info = result && result.result ? result.result : result;
    if (!info || !info.extra) return {};
    return parseJson(info.extra);
  } catch {
    return null;
  }
}

async function writeOwnerMeta(
  client: any,
  groupId: string,
  line: number,
  ownerRobotId: string,
  updater: (wfds: any) => void
): Promise<number | null> {
  const extra = await readExtra(client, groupId);
  if (!extra || typeof extra !== "object") return null;
  const wfds = extra.wfds && typeof extra.wfds === "object" ? extra.wfds : {};
  wfds.v = 2;
  wfds.broker = wfds.broker && wfds.broker.type ? wfds.broker : { type: "robot", id: ownerRobotId };
  wfds.robots = wfds.robots && typeof wfds.robots === "object" ? wfds.robots : {};
  updater(wfds);
  wfds.rev = (Number(wfds.rev) || 0) + 1;
  wfds.updatedAt = Date.now();
  extra.wfds = wfds;
  const result = await client.modifyGroupInfo(groupId, 2, JSON.stringify(extra), [line], null);
  if (result && typeof result.isSuccess === "function" && !result.isSuccess()) return null;
  invalidateGroupMeta(groupId);
  return wfds.rev;
}

async function sendMetadataMessage(client: any, groupId: string, line: number, data: any): Promise<void> {
  await client.sendMessage({ type: CONV_TYPE_GROUP, target: groupId, line }, {
    type: 210,
    searchableContent: "",
    content: JSON.stringify(data),
    persistFlag: 4,
  });
}

/**
 * Handle a 210 AGENT_METADATA message. Returns true when consumed.
 * Only the owner robot writes group extra; guests send `set` and receive `ack`.
 */
export async function handleMetadataMessage(args: {
  client: any;
  config: any;
  sender: string;
  conv: any;
  payload: any;
  logger?: any;
}): Promise<boolean> {
  const { client, config, sender, conv, payload, logger } = args;
  if (!client || !conv || conv.type !== CONV_TYPE_GROUP) return false;
  const data = parseMetadataPayload(payload);
  if (!data) return false;
  const groupId = String(conv.target);
  const line = Number(conv.line ?? 2);
  const localRobotId = String(config.robotId || "");

  if (data.op === "set") {
    if (String(sender) !== String(data.robotId)) {
      logger?.warn?.(`[wildfire] metadata set rejected: sender=${sender} robotId=${data.robotId}`);
      return true;
    }
    const meta = await loadGroupMeta(client, groupId, true);
    if (!meta) return true;
    const owner = ownerRobotId(meta);
    if (!owner || owner !== localRobotId) {
      return true; // not the broker
    }
    const section = data.section && typeof data.section === "object" ? data.section : null;
    if (!section || String(section.workspaceId || "").length === 0) return true;
    const rev = await writeOwnerMeta(client, groupId, line, owner, wfds => {
      wfds.robots[String(data.robotId)] = {
        ...section,
        role: String(data.robotId) === owner ? "owner" : "guest",
        updatedAt: Date.now(),
      };
    });
    if (rev !== null) {
      await sendMetadataMessage(client, groupId, line, {
        v: 2,
        op: "ack",
        requestId: data.requestId,
        robotId: data.robotId,
        rev,
        ok: true,
      }).catch((e: any) => logger?.warn?.(`[wildfire] metadata ack failed: ${String(e?.message ?? e)}`));
      logger?.info?.(`[wildfire] metadata updated for ${data.robotId}, rev=${rev}`);
    }
    return true;
  }

  if (data.op === "ack") {
    logger?.info?.(`[wildfire] metadata ack: robot=${data.robotId} rev=${data.rev}`);
    return true;
  }
  return true;
}

/**
 * Guest publishes its section to the owner via 210. No-op when we are owner.
 */
export async function publishGuestMetadata(args: {
  client: any;
  config: any;
  groupId: string;
  line: number;
  section: MetadataSection;
  logger?: any;
}): Promise<boolean> {
  const { client, config, groupId, line, section, logger } = args;
  const localRobotId = String(config.robotId || "");
  const meta = await loadGroupMeta(client, groupId, true);
  if (!meta) return false;
  const owner = ownerRobotId(meta);
  if (!owner || owner === localRobotId) return false;
  try {
    await sendMetadataMessage(client, groupId, line, {
      v: 2,
      op: "set",
      requestId: `${localRobotId}-${Date.now()}`,
      groupId,
      robotId: localRobotId,
      section: { ...section, updatedAt: Date.now() },
    });
    logger?.info?.(`[wildfire] published metadata to owner ${owner}`);
    return true;
  } catch (e: any) {
    logger?.warn?.(`[wildfire] publish metadata failed: ${String(e?.message ?? e)}`);
    return false;
  }
}
