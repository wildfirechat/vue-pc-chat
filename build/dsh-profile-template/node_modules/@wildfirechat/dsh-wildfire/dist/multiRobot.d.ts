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
    broker?: {
        type?: string;
        id?: string;
    };
    robots: Record<string, RobotSection>;
}
export declare function parseGroupMeta(extra: any): GroupMeta | null;
export declare function loadGroupMeta(client: any, groupId: string, force?: boolean): Promise<GroupMeta | null>;
export declare function invalidateGroupMeta(groupId: string): void;
/**
 * Rule-based target selection. Returns the local robot when no other robot's
 * tag matches, so the owner remains the default responder.
 */
export declare function chooseTarget(text: string, meta: GroupMeta, localRobotId: string): string;
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
export declare function routeMultiRobotMessage(args: {
    client: any;
    config: any;
    sender: string;
    conv: any;
    payload: any;
    text: string;
    messageUid?: string | number;
    logger?: any;
}): Promise<MultiRobotDecision>;
export interface MetadataSection extends RobotSection {
    updatedAt?: number;
}
/**
 * Handle a 210 AGENT_METADATA message. Returns true when consumed.
 * Only the owner robot writes group extra; guests send `set` and receive `ack`.
 */
export declare function handleMetadataMessage(args: {
    client: any;
    config: any;
    sender: string;
    conv: any;
    payload: any;
    logger?: any;
}): Promise<boolean>;
/**
 * Guest publishes its section to the owner via 210. No-op when we are owner.
 */
export declare function publishGuestMetadata(args: {
    client: any;
    config: any;
    groupId: string;
    line: number;
    section: MetadataSection;
    logger?: any;
}): Promise<boolean>;
//# sourceMappingURL=multiRobot.d.ts.map