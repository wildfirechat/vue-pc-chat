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
import { getAccessConfig } from "./config.js";

/** Resolves the owner of a group; null when unknown (robot not a member, ...). */
export type GroupOwnerResolver = (groupId: string) => Promise<string | null>;

export class AccessController {
  private config: WildfireConfig;
  private resolveGroupOwner: GroupOwnerResolver;
  private owner: string | undefined;

  constructor(config: WildfireConfig, resolveGroupOwner: GroupOwnerResolver = async () => null) {
    this.config = config;
    this.resolveGroupOwner = resolveGroupOwner;
  }

  /** Remember the robot owner (read from getProfile after connecting). */
  setOwner(owner: string | undefined): void {
    this.owner = owner;
  }

  /** Whether the sender may use the private (control-panel) chat. */
  canUsePrivate(senderId: string): boolean {
    const access = getAccessConfig(this.config);
    if (!access.privateOwnerOnly) return true;
    if (this.owner && senderId === this.owner) return true;
    return access.adminUsers.includes(senderId);
  }

  /** Whether the sender may run a private-chat management command. */
  canRunCommand(senderId: string): boolean {
    const access = getAccessConfig(this.config);
    if (access.adminUsers.length === 0 && access.adminGroups.length === 0) {
      return true;
    }
    return access.adminUsers.includes(senderId) || (!!this.owner && senderId === this.owner);
  }

  /**
   * Whether the sender may manage the workspace of this conversation.
   * Private: admin gate. Group: admin group members or the group owner.
   */
  async canManageWorkspace(senderId: string, convTarget: string, isGroup: boolean): Promise<boolean> {
    const access = getAccessConfig(this.config);
    if (!isGroup) return this.canRunCommand(senderId);

    // Admin group: any member can manage.
    if (access.adminGroups.includes(convTarget)) return true;
    // Group owner (robot must be a member of the group to look this up).
    if (access.groupOwnerCanManage) {
      try {
        const owner = await this.resolveGroupOwner(convTarget);
        if (owner && owner === senderId) return true;
      } catch (err) {
        // fall through to deny
      }
    }
    return false;
  }

  /** Human-readable admin list for `/help`-style replies. */
  describe(): string {
    const access = getAccessConfig(this.config);
    const parts: string[] = [];
    if (access.adminUsers.length > 0) parts.push(`用户: ${access.adminUsers.join(", ")}`);
    if (access.adminGroups.length > 0) parts.push(`群组: ${access.adminGroups.join(", ")}`);
    if (parts.length === 0) parts.push("所有人（未配置管理员）");
    if (access.groupOwnerCanManage) parts.push("群主可在本群管理");
    return parts.join("；");
  }
}
