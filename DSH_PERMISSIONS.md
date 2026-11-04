# DSH Agent 权限模型

> 适用：`vue-pc-chat`（dsh_local）+ `dsh-plugin.js`（wildfire profile）+ `im-app_server`（online1）
> 状态：桌面端默认策略、群内审批归属、权限展示已落地；仅密钥托管/按用户配额仍待后端改造。

## 1. 目标

1. **安装即用**：登录后自动开通个人机器人，默认就是安全配置，不需要用户理解 DSH 的沙箱细节。
2. **权限分明**：谁能对话、谁能管理、谁能审批、Agent 能写哪里，四处边界都能在 UI / 命令里看到。
3. **最小惊讶**：默认 `workspace-write + ask`，只有明确切换才会放开；危险档位有醒目标识。

## 2. 角色

| 角色 | 判定 | 能力 |
|---|---|---|
| 机器人 owner | `robot.owner`（provision 返回值 / `getProfile`） | 私聊控制面板；建/销毁工作区；改模型、沙箱、审批；审批群内敏感操作 |
| 管理员 | `access.adminUsers` | 与 owner 相同的管理/审批能力（桌面端默认仅 owner） |
| 群创建者 | 插件注册表 `creatorUserId` | 本群 `/cwd`、`/sandbox`、`/approval`、`/allow`、`/kick` 等管理命令 |
| 群成员 | 已注册 DSH 群的成员 | 与 Agent 对话；不能改设置；敏感操作需 owner 审批 |
| 陌生人 | 非 owner 私聊，或未注册群 | 私聊明确拒绝；未注册群静默忽略 |
| 远程机器人 | `extra.wfds.robots[other]` | 只读展示；发送与管理由各自 owner/实例负责 |

## 3. 准入（能不能对话）

- **私聊**：`access.privateOwnerOnly=true` 时只有 owner/管理员可用；其他人收到“仅限 owner 私聊”。桌面端默认开启。
- **群聊**：只处理插件注册表里的 DSH 群（`/create`、`/bind-workspace` 创建/绑定）。普通群、别人拉机器人进的群一律忽略，避免被借道执行本机工具。
- **成员发起任务**：`security.allowGuestTurns` 默认 `true`（协作群）；设为 `false` 后只有 owner/管理员能发起 Agent 回合，成员仍可查看群消息。
- **限频**：`security.maxMessagesPerMinute` 可按会话限流，防止 token 被刷。

## 4. 工具权限（Agent 能做什么）

DSH 把文件权限拆成两个独立开关，均按会话持久化：

| 开关 | 取值 | 含义 |
|---|---|---|
| `sandbox` | `read-only` | 只读；任何写操作被拒绝 |
| | `workspace-write` | 只可写会话工作区（默认） |
| | `danger-full-access` | 不限制文件写入 |
| `approval` | `ask` | 需要审批的操作弹 DSH_Approval 卡片（默认） |
| | `never` | 不弹卡片；需要审批的操作直接拒绝（无人值守） |

- 桌面端宿主强制 `DSH_PERMISSION_MODE=workspace-write`，不继承宿主机可能更宽松的设置。
- 会话级切换：`/sandbox <mode>`、`/approval ask|never`，或会话输入框的 AI 面板。
- `/sandbox` 与权限预设同名时会同时对齐 approval（`read-only`/`workspace-write` → `ask`，`danger-full-access` → `never`）。
- 工作区边界由 DSH `sandbox-policy` 使用会话不可变 `cwd` 计算，不是应用自己做的字符串校验。

## 5. 审批归属（谁能点“同意”）

- 默认 `interaction.approvalOwnerOnly=false`：任务发起人审批（兼容通用部署）。
- 桌面端注入 `approvalOwnerOnly=true`：**群成员触发的敏感操作由机器人 owner 审批**，成员不能自己放行自己发起的写操作。
- 审批卡片新增字段：
  - `requestedBy`：发起该回合的 IM 用户；
  - `approver`：有权审批的人（与发起人不同时才下发）。
- 客户端：非 approver 看到“仅 X 可审批”，不显示同意/拒绝按钮；服务端仍做二次校验（`handleApprovalResult` / `handleTextReply`）。
- `ask_user` 仍由任务发起人回答（问题是给发起人的，不是给 owner 的）。
- `/stop` 仅任务发起人、群创建者、owner/管理员可执行，旁观者不能打断别人的任务。

## 6. 管理命令权限

| 命令 | 私聊 | 群聊 |
|---|---|---|
| `/help` | 已准入用户 | 已准入成员（按权限过滤） |
| `/create`、`/destroy`、`/workspaces`、`/jobs`、`/goal`、`/new` | owner/管理员 | 不允许（提示去私聊） |
| `/cwd`、`/ls` | owner/管理员 | 群创建者/管理员（`/ls` 查询开放） |
| `/model`、`/effort`、`/sandbox`、`/approval`、`/plan`、`/compact`、`/reset`、`/mode`、`/preset` | owner/管理员 | 群创建者/管理员 |
| `/allow`、`/disallow`、`/allowlist` | owner/管理员 | 群创建者/管理员 |
| `/kick`、`/invite`、`/mute`、`/unmute`、`/members` | 仅群内 | 群创建者/管理员 |
| `/bind-workspace` | 仅群内 | 机器人 owner |

207 面板指令（`DSH_Command`）走同一套 `authorizePanelCmd`，不会绕过上面的限制。

## 7. 宿主注入的默认值

`src/dsh/main/hostManager.js` 写入 `dsh-runtime-patch.yml`：

```yaml
- id: wildfire
  config:
    access:
      adminUsers: ["<owner>"]
      privateOwnerOnly: true
    interaction:
      approvalOwnerOnly: true
    security:
      allowGuestTurns: true
    workspace:
      root: "<userData>/dsh-workspaces"
      allowCwdCommand: true
    model:
      allowModelCommand: true
```

同时：

- 强制 `DSH_PERMISSION_MODE=workspace-write`；
- 删除继承的 `DEEPSEEK_API_KEY`；
- `robotSecret` 通过 `robotSecretEnv: WF_ROBOT_SECRET` 从环境注入，不写入 YAML；
- `dsh-runtime.json` 不再写 `robotSecret` / `ai.apiKey`。

## 8. UI

- **DSH 会话详情侧栏 → Permissions**：文件沙箱、审批策略两枚徽标；危险档位红色，工作区可写橙色，只读/每次询问绿色。
- **设置 → 权限**：默认策略、角色边界、会话级命令说明、管理员与工作区根。
- **审批卡片**：工具名、原因、发起人、审批人；非审批人按钮隐藏。
- **设置 → 权限 → 最近权限事件**：读取本机审计日志，按时间倒序展示最近 80 条。

## 9. 审计

插件把权限相关事件追加到 `<DSH_HOME>/wildfire-audit.jsonl`（权限 0600，2MB 轮转为 `.1`），Host 通过 `getAudit()` / IPC `dsh-get-audit` 读取，设置页展示。

| `kind` | 触发点 | 关键字段 |
|---|---|---|
| `admission.denied` | 私聊非 owner、白名单拒绝 | `actor` `reason` |
| `command.executed` | 放行的管理命令 | `command` `arg` |
| `command.denied` | 命令权限不足（文本/207 面板） | `command` `reason` `source` |
| `permission.changed` | `/sandbox`、`/approval` 生效 | `sandbox` `approval` `preset` `source` |
| `approval.requested` | 弹出审批卡片 | `toolName` `requestedBy` `approver` |
| `approval.decided` | 同意/拒绝 | `actor` `outcome` `source` |
| `approval.timeout` | 审批超时 | `toolName` `requestedBy` |
| `interaction.denied` | 非审批人点同意/作答 | `actor` `interaction` |

日志写入失败只记 warning，不影响消息处理；它记录的是本机行为，不能替代服务端审计。

## 10. 验收

1. 用非 owner 账号私聊机器人 → 应收到“仅限 owner 私聊”。
2. 在未注册的普通群 @ 机器人 → 无回复、无工具执行。
3. owner 建群并邀请成员；成员让 Agent 写文件 → owner 收到审批卡片，成员看不到同意按钮。
4. 成员尝试 `/sandbox danger-full-access` → 提示需要群创建者/管理员。
5. 成员尝试 `/stop` owner 的任务 → 被拒绝。
6. 会话详情侧栏显示 `工作区可写 / 每次询问`；切换后徽标随 type=3 刷新。
7. 设置 → 权限 显示 owner、工作区根、默认策略。
8. 设置 → 权限 → 最近权限事件 应出现 `approval.requested` / `approval.decided` / `permission.changed` 等记录。

## 11. AI 密钥与配额（ai-agent-server）

应用服务**不再承载模型 Provider 配置、AI Key、`/ai/**` 代理、`/provision` 或机器人网关配置**；`AiTokenService` / `AiProxyController` / `ai.*` / `ai_agent.*` / `agent.public_url` 已移除。

机器人开通也移到 AI 服务：

```properties
IM_ADMIN_URL=http://im:80
IM_ADMIN_SECRET=...
ROBOT_GATEWAY_URL=ws://gateway:8884/robot/gateway
ROBOT_CALLBACK_URL=http://gateway:8885/robot/recvmsg
PUBLIC_BASE_URL=https://ai.example.com
```

流程：

1. 客户端「AI 服务」填写服务地址；连接时通过 IM SDK 获取 authCode。
2. 客户端 `POST /provision`，AI 服务调用 IM Admin 校验 authCode，按 IM userId 查找/首次自动创建用户。
3. AI 服务按 `externalId` 查询/创建 IM 机器人、设置好友和 callback，并在同一个响应里返回 robot + AI 配置（代理地址、客户端 Key、模型、价格/配额）。
4. 客户端把 robot + AI 配置注入 DSH Host；模型请求只走 AI 服务的 `/v1/chat/completions`。

应用服务只负责 IM 登录和业务接口，不参与机器人开通、模型请求、计费或 Key 管理。

## 12. 仍待补

1. **AI 服务未部署/未登录时无机器人和模型**：应用服务不再提供机器人或 `ai.*` 兜底；生产必须部署 `ai-agent-server`，客户端填写服务地址后由 IM SDK 自动获取 authCode 登录。
2. **工作区允许根目录**：`/cwd` 依赖群创建者/管理员授权，尚未提供 UI 管理 `workspace.allowedRoots`；如需限制可选目录，应在设置页增加根目录白名单。
3. **远程机器人权限**：远程 plan/工具不可见；跨机器人的审批归属仍由各自 owner 负责。
