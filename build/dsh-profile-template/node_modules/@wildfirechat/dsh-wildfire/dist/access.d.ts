/**
 * Access control: admission is the whitelist's job; this controller gates the
 * management commands (`/cwd`, `/model`, `/effort`, `/reset`).
 *
 * - Private chat: allowed when no admins are configured, or the sender is an
 *   admin user.
 * - Group chat (`/cwd`): allowed for members of an admin group, or for the
 *   group owner when `access.groupOwnerCanManage` is on (the robot must be a
 *   group member so `getGroupInfo` succeeds).
 * - `/model`, `/effort`, `/reset` stay private-chat only (enforced by
 *   inbound.ts).
 */
import type { WildfireConfig } from "./config.js";
/** Resolves the owner of a group; null when unknown (robot not a member, ...). */
export type GroupOwnerResolver = (groupId: string) => Promise<string | null>;
export declare class AccessController {
    private config;
    private resolveGroupOwner;
    private owner;
    constructor(config: WildfireConfig, resolveGroupOwner?: GroupOwnerResolver);
    /** Remember the robot owner (read from getProfile after connecting). */
    setOwner(owner: string | undefined): void;
    /** Whether the sender may use the private (control-panel) chat. */
    canUsePrivate(senderId: string): boolean;
    /** Whether the sender may run a private-chat management command. */
    canRunCommand(senderId: string): boolean;
    /**
     * Whether the sender may manage the workspace of this conversation.
     * Private: admin gate. Group: admin group members or the group owner.
     */
    canManageWorkspace(senderId: string, convTarget: string, isGroup: boolean): Promise<boolean>;
    /** Human-readable admin list for `/help`-style replies. */
    describe(): string;
}
//# sourceMappingURL=access.d.ts.map