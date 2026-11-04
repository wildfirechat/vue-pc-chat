# Electron 内置 DSH 设计方案 v4
## Gateway 直连 + dsh-plugin + Electron 子进程 Host + Owner 可见 @ 路由

> 版本：v4.0（最终设计稿，未写实现代码）
> 适用项目：`vue-pc-chat`（Electron 22 + Vue 3 + 野火 IM PC SDK）
> 参考：`../robot-gateway/dsh-plugin.js`、`../robot-gateway/client.js`、`../im-app_server`、`../server-sdk.js`
> 取代：v1/v2/v3 的消息传输、工作区/会话/群组与多机器人模型。

---

> **实现状态（第一版）**：应用服务 `/robot/provision`、Electron provision/加密缓存/Host 子进程、AI 状态页/工作区聚合、dsh-plugin 多机器人路由与 210 元数据已落地并通过构建验证。owner 路由 v1 为 tags 规则匹配；Host runtime 打包目录、guest 元数据重试、主 IM 列表分组标题仍待补。详见 `DSH_IMPLEMENTATION.md`。

## 0. 最终结论

### 0.1 一句话模型

> **每台电脑一个用户、一个机器人、一个 DSH Host；Host 作为 Electron 子进程运行 `dsh-plugin.js`，通过 gateway（ws/wss）直连野火 IM；群消息由 gateway 推给插件，插件用 gateway client 发送；多机器人时由 owner 机器人裁决，owner 用可见 `@robot_b` 指派，目标机器人回复；一个工作区多个群，每个群对每个机器人只有一个会话；换目录 = 新建群。**

### 0.2 已定决策

| # | 决策 |
|---|---|
| 1 | 一个用户只允许一台电脑登录；多端登录被踢；一个机器人绑定一个用户 |
| 2 | 群主机器人不能被踢/转让；只有保持现状或解散两种可能 |
| 3 | 多机器人无 @ 时，由 owner 裁决：自己回、可见 @ 指派、或不回 |
| 4 | 只操作工作区文件；不做工作区外访问 |
| 5 | 工作区对应多个群，每个群对每个机器人只有一个会话；换目录 = 新建群 |
| 6 | 暂不做 robotSecret/AI Key 轮换 |
| 7 | 群只能群成员邀请；机器人 owner 退出/被踢，机器人也必须退出；owner 必须在场 |
| 8 | 多机器人消息共享，所有机器人都收到 |
| 9 | 不回复就静默，不发可见空消息 |
| 10 | IM 传输改为 **gateway 直连**，不再走本机消息 RPC |
| 11 | DSH Host 作为 **Electron 子进程**运行 |
| 12 | 不使用 MCP 作为主链路；核心发送用 gateway client |
| 13 | 群主机器人离线时，工作暂停；接受 |

### 0.3 关键约束

1. **owner 必须在场**：Host 绑定 owner 登录态；owner 退出/被踢，Host 停止，机器人退出（群主机器人则解散群）。
2. **gateway 是硬依赖**：gateway 不可达，机器人离线；需要 ws/wss 网络与证书。
3. **每个群对每个机器人只有一个会话**：换目录不能保留当前 session，只能新建群/新 session。
4. **群主机器人稳定**：不做转让/踢出；broker 不需要选举。
5. **不回复静默**：不发空文本；需要可观测性时只写本地/DSH 面板。
6. **无本地消息 RPC**：消息/状态走 gateway + IM；Electron 只保留 Host 生命周期 IPC。

---

## 1. 总体架构

```
电脑 A（用户 A + 机器人 A）
┌──────────────────────────────────────────────────────────────┐
│ Electron                                                     │
│  Renderer（用户 A 的 IM 客户端）                              │
│   - 群聊/卡片/207 命令/scope31 状态                           │
│   - 工作区聚合/控制面板                                       │
│        │ 最小 IPC（启动/停止/日志）                            │
│  Main                                                        │
│   - ProvisionStore（robot/secret/gatewayUrl/AI 配置）         │
│   - DshHostManager（子进程生命周期）                           │
│        │ spawn                                                │
│  DSH Host（本机 Node 22.19+）                                 │
│   - dsh-plugin.js（Cordis 插件）                              │
│   - 本机 workspace / sessions                                 │
│   - gateway client（ws/wss）                                  │
└──────────────────────────────────────────────────────────────┘
        │ WSS/WS
        ▼
┌──────────────────┐        ┌──────────────────────────┐
│ robot-gateway     │◀──────▶│ 野火 IM 服务              │
│ /robot/gateway    │        │ 群/消息/机器人/在线状态    │
└──────────────────┘        └──────────────────────────┘
        ▲
        │ 用户 A 的 IM 客户端（人类账号）也在群里
```

### 1.1 消息流

**入站（人类消息 → 机器人）**

```
人类在群里发消息
  → IM → robot-gateway → 每个机器人的 DSH Host（WebSocket）
  → dsh-plugin inbound
  → 过滤/解析 @/owner 路由
  → DSH Agent
```

**出站（机器人 → 群）**

```
DSH Agent 输出
  → dsh-plugin
  → gateway client.sendMessage
  → robot-gateway → IM → 群
```

**UI**

- 人类客户端是普通群成员，直接看到机器人的消息；
- 状态/面板通过 `scope=31` + `207 Agent_Command`，复用现有客户端；
- Electron 不参与消息转发。

### 1.2 组件职责

| 组件 | 职责 |
|---|---|
| Electron Renderer | IM 登录、群聊、卡片、工作区聚合、控制面板；不转发消息 |
| Electron Main | 调 `/robot/provision`、加密缓存、启动/停止 Host、日志 |
| DSH Host | 本机 DSH 运行时、dsh-plugin、workspace/session |
| dsh-plugin | gateway 连接、入站过滤、owner 路由、发送、207/scope31 |
| robot-gateway | 机器人 WebSocket 接入、在线状态、消息转发 |
| 应用服务 | 开通机器人、返回 gatewayUrl/IM 地址/AI 配置 |
| IM 服务 | 群、消息、机器人、在线状态 |

---

## 2. 应用服务 provision

### 2.1 接口

```
POST /robot/provision
authToken: <Shiro session id>
Body: { clientId, platform, forceRefresh, configVersion }
```

返回：

```json
{
  "robot": {
    "robotId": "robot_ab12cd34ef56",
    "robotSecret": "******",
    "gatewayUrl": "wss://gateway.example.com/robot/gateway",
    "owner": "userId",
    "displayName": "DSH 助手"
  },
  "ai": {
    "provider": "openai-compatible",
    "baseUrl": "https://app.example.com/ai/v1",
    "apiKey": "wfa_short_lived_token",
    "model": "deepseek-v4-pro",
    "reasoningEffort": "high",
    "models": [...]
  },
  "features": {
    "line": 2,
    "workspaceMode": "multi-group-per-workspace",
    "sessionMode": "one-session-per-group-per-robot",
    "multiRobot": true
  },
  "configVersion": 3
}
```

### 2.2 gatewayUrl 规则

- 支持 `ws://` 和 `wss://`；
- 生产默认 `wss://`；内网/开发允许 `ws://`；
- 必须是完整 URL（含 `/robot/gateway` 路径）；
- 客户端校验 scheme/host；`ws://` 非 localhost 时 UI 提示“非加密连接”；
- gateway URL 变化时，Host 重启并重连；

### 2.3 缓存

- Main 用 `safeStorage` 加密缓存 `{robot, ai, configVersion}`；
- Renderer 不解析/不持久化 secret；
- `forceRefresh` 重新拉取；
- 机器人绑定唯一 userId；不需要 host lease（一用户一电脑）。

> 应用服务不持久化用户↔机器人绑定；每次 provision 调 `UserAdmin.getUserRobots(userId)`，取第一个属于该用户的机器人；列表为空才创建。错误码/配置项沿用 v2 §4。

---

## 3. Host 子进程

### 3.1 生命周期

```
登录成功
  → Main 调 provision
  → Main spawn DSH Host（自带 Node）
  → Host 加载 dsh-plugin，连接 gateway
  → 机器人上线
  → 用户退出/关闭 app
  → Main 优雅停止 Host
  → gateway 断开，机器人离线
```

- 单实例锁：一个 app 一个 Host；
- Host 崩溃：指数退避重启；gateway 重连；
- Host 日志：stderr → 文件；Main 提供“打开日志/重启”；
- Host 退出：先让插件断开 gateway，再 kill；
- **不做本地消息 RPC**；Main 只负责 spawn/stop/health/log。

### 3.2 配置注入

- gatewayUrl/robotId/AI provider 等非敏感配置可走 profile patch；
- robotSecret/AI Key 走 0600 runtime 文件或 stdio `configure`，启动后删除/清内存；
- 不把 secret 放命令行参数（ps 可见）；
- Host 只监听 stdio/本地文件，不开公网端口。

### 3.3 owner 在场

- Host 与 owner 登录态绑定：owner 退出登录 → Main 停止 Host；
- app 关闭 → Host 停止；
- owner 退群/被踢 → 插件收到群成员变更 → 机器人退出（群主机器人解散群）；
- gateway 断开 = 机器人离线，客户端在线状态正确。

---

## 4. dsh-plugin 复用与改造

### 4.1 直接复用

| 能力 | 现状 |
|---|---|
| gateway WebSocket 连接 | `client.ts` / `RobotServiceClient` |
| 收消息/发消息/流式 | `inbound.ts` |
| 200–209 卡片 | `interactive.ts` / `protocol.ts` |
| 207 命令 / scope31 状态 | `inbound.ts` / `agent.ts` |
| 会话/工作区/resume | `agent.ts` / `workspace.ts` |
| 模型/effort/preset | `model.ts` / `agent.ts` |
| 在线状态 | gateway `/robot/set_online` |
| 多实例隔离 | 一实例一 `$DSH_HOME` |

### 4.2 需要改造

1. **gatewayUrl 从 provision 注入**（支持 ws/wss）。
2. **多机器人 owner 路由**：
   - 有 @：被 @ 的机器人回复；
   - 无 @：owner 裁决；
   - owner 可见 `@robot_b` 指派；
   - 目标机器人收到指派后回复；
   - 不回复静默。
3. **一个工作区多个群，每个群对每个机器人一个会话**：
   - 不再在一个群里切多个会话；
   - 新会话 = 新群；
   - 群名 = 会话名。
4. **群 `extra` 按 robotId 分区**；owner 机器人 broker；其他机器人请求更新。
5. **owner 退出/被踢**：
   - 群主机器人 → 解散群；
   - 普通机器人 → quitGroup；
   - Host 停止。
6. **仅工作区文件**：所有文件/附件/外发限制在 workspace。
7. **去掉本机消息桥接/server-sdk 主链路/MCP 主链路**。

---

## 5. 多机器人 owner 路由

### 5.1 基本规则

| 场景 | 行为 |
|---|---|
| 消息 @robot_b | robot_b 回复；owner 不插手 |
| 消息 @owner | owner 回复 |
| 消息 @多个机器人 | 被 @ 的都回复 |
| 消息无 @ | **只有 owner 裁决** |
| owner 裁决自己回 | owner 正常回复 |
| owner 裁决别人回 | owner 发可见 `@robot_b` 指派 |
| owner 裁决不回 | 静默 |
| owner 离线 | 不裁决，工作暂停（接受） |

### 5.2 owner 裁决

owner 收到无 @ 消息后：

```
1. 规则优先：关键词/tags/最近上下文 → 目标机器人
2. 规则不确定 → 轻量 router 模型：
     {action: "reply" | "assign" | "none", targetRobotId?, note?}
3. 尽量使用在线状态；拿不到可靠在线状态时，按 tags 选择，assign 后超时 fallback
4. 目标离线/无响应：owner 可自己回、换人，或接受本轮无回复
5. action=assign → 发可见 @robot_b 指派消息
6. action=reply → owner 自己回复
7. action=none → 静默
```

- router 只由 owner 跑一次，不是 N 个机器人各跑一次；
- router 用独立 prompt/小 max_tokens，不污染 owner 会话；
- 目标机器人选择依据：tags、在线状态、最近是否已回复、优先级；
- 解析失败 → 默认 `none` 或 owner 自己回（可配置）。

### 5.3 可见 @ 指派

owner 发送一条正常文本消息：

```
@robot_b 这条请你处理：<补充信息>
```

- 用结构化 mention：`mentionedType=1`、`mentionedTargets=[robot_b]`；
- `MessagePayload.extra` 带机器可读信息：

```json
{
  "wfds": {
    "op": "assign",
    "fromRobotId": "robot_owner",
    "targetRobotId": "robot_b",
    "messageUid": 123456789,
    "note": "补充信息",
    "ts": 1787470000000
  }
}
```

- 人类看到 `@robot_b ...`，知道谁被指派；
- robot_b 收到后：
  - 校验 sender == owner、target == 自己、op == assign；
  - 取原始 `messageUid` 的消息内容 + `note` 作为本轮输入；
  - 回复；
  - 不把 owner 的指派文本当成新的用户消息重复处理。
- **assign 是控制消息**：绕过普通群触发/白名单过滤，但仍校验 sender=owner、target=自己、消息未过期。
- assign 带 `ts`；目标机器人忽略超过 5 分钟的旧指派，避免上线后补回历史消息。
- 其他机器人看到 owner 的指派消息：忽略（机器人消息，除非 target 是自己且 op=assign）。
- owner 发完指派后不再回复同一 `messageUid`。

### 5.4 目标失败/NO_REPLY

- 目标机器人回复失败/`NO_REPLY`：
  - 发一条简短错误/“无法处理”，或
  - owner 在超时（如 30s）后 fallback 自己回；
  - v1 可先接受“目标不回 = 本轮无回复”，但建议至少让 owner 知道并可选 fallback。
- 在线状态没有可靠 API 时，owner 不阻塞：按 tags 选择，assign 后超时未回复再由 owner 决定是否 fallback。
- 目标离线：owner 不应指派；直接自己回或不回。

### 5.5 不回复

- 未 @ 的机器人：不回复，不显示。
- owner 裁决 none：不回复，不显示。
- 目标 NO_REPLY：不显示空消息。
- 可观测性：只写本地/DSH 面板日志，不发群消息。

---

## 6. 工作区 / 群 / 会话

### 6.1 模型

```
Workspace（本机目录）
  ├─ Group A（line2）= Session A（对每个机器人）
  ├─ Group B（line2）= Session B
  └─ Group C（line2）= Session C
```

- **一个工作区多个群**；
- **一个群对每个机器人只有一个会话**；
- 群名 = 会话名；
- 换目录 = 新建群/新会话，不在旧群里原地切；
- 旧群/旧 session 保留，切回旧群可 resume。

### 6.2 为什么换目录必须新建群

DSH session 的 cwd 在创建时固定，`resume` 会校验 cwd。换目录不能继续同一个 session，只能：

- 新建 session（新群），或
- 归档旧 session，切回旧目录时再 resume。

所以：

- **同一个工作区目录移动/重命名**：workspaceId 不变，只更新本地 path；
- **切换到另一个目录**：新建群；
- **不要在一个群里原地切目录**。

### 6.3 群创建

1. owner 机器人创建 line2 群：
   - name `DSH-<目录名>`；
   - members = owner 用户 + owner 机器人；
   - `toLines=[2]`；
   - `join_type=2`。
2. owner 写 initial `extra`：
   - `broker={type:'robot',id:ownerRobotId}`
   - `robots[ownerRobotId]={workspaceId,workspaceName,sessionId,hostId,role:'owner'}`
   - `policy`。
3. 本地创建 Workspace + Session；打开群。

多机器人：

- 群成员邀请其他机器人 + 它们的 owner；
- 新机器人加入后，创建/选择自己的本机工作区；
- 发 metadata 请求，owner broker 写 `extra.robots[newRobotId]`；
- 群内每个机器人各自 workspace/session，互不共享目录。

### 6.4 群 `extra`

```json
{
  "wfds": {
    "v": 2,
    "broker": {"type": "robot", "id": "robot_owner"},
    "rev": 7,
    "updatedAt": 1787470000000,
    "policy": {
      "replyMode": "owner_router",
      "noReply": "silent"
    },
    "robots": {
      "robot_owner": {
        "workspaceId": "ws_A",
        "workspaceName": "项目A",
        "sessionId": "wfpc-group-...-owner",
        "hostId": "host_a",
        "role": "owner",
        "tags": ["coding"],
        "rev": 3,
        "updatedAt": 1787470000000
      },
      "robot_b": {
        "workspaceId": "ws_B",
        "workspaceName": "项目B",
        "sessionId": "wfpc-group-...-b",
        "hostId": "host_b",
        "role": "guest",
        "tags": ["ops"],
        "rev": 1,
        "updatedAt": 1787470000000
      }
    }
  }
}
```

- 不写绝对路径；
- 只写 workspaceId/name/sessionId/hostId/tags；
- 保留其他字段，merge；
- owner 机器人是 broker（群主稳定，不转让）。

### 6.5 metadata 更新

- 其他机器人发透明 `210 AGENT_METADATA set`；
- owner 校验 sender、只写 `robots[sender]`；
- owner 用 gateway client `modifyGroupInfo(..., Modify_Group_Extra, json, [2], null)`；
- 回 ack；请求方也可 `getGroupInfo` 回读；
- owner 离线 → 请求 pending；工作暂停（接受）。

### 6.6 owner 退出 / 被踢

- 群主机器人的 owner 退出/被踢：
  - 群主机器人不能转让 → **解散群**；
  - IM 会发解散通知，不需要额外 Tip；
  - Host 停止。
- 普通机器人的 owner 退出/被踢：
  - 该机器人 `quitGroup`；
  - Host 停止；
  - owner 机器人下次写 extra 时清理其 section。
- owner 只是离线（未退出）：
  - Host 随 app 停止，gateway 断开，机器人离线；
  - 群保留；重新登录后 Host 重启、重连、resume。

---

## 7. IM 会话聚合

### 7.1 规则

| 场景 | IM 列表归属 |
|---|---|
| 单机器人群 | 该机器人的工作区 |
| 多机器人群，本机有机器人 | 本机机器人工作区；群只出现一次；多机器人徽标 |
| 多机器人群，本机无机器人 | “共享群” |
| 群 extra 缺失/解析失败 | 本地 binding 回退；再回退“未归类” |

- 工作区 = 目录；群 = 会话；
- 工作区下列出多个群（多个会话）；
- 多机器人群只在本机工作区出现一次，远程工作区只做徽标/详情；
- DSH 工作区页可做全量视图（本机/远程），允许重复。

### 7.2 示例

```
▼ 项目A（本机 · robot_a）
   DSH-项目A · 登录修复   [🤖A][🤖B]
   DSH-项目A · 接口排查   [🤖A]
▼ 项目B（远程 · robot_b，仅 DSH 页）
   DSH-项目B · 网关优化
▼ 共享群
   DSH-跨团队群 [🤖B][🤖C]
```

- 群名建议 `工作区 · 会话`；
- 群标题栏显示本机机器人 + 其他机器人状态；
- 远程工作区不提供“打开目录”。

---

## 8. UI

### 8.1 群聊页

```
┌──────────────────────────────────────────────────────────────┐
│ DSH-项目A · 登录修复  [🤖A 本机][🤖B 远程]  [● 在线]  [⚙]  │
├──────────────────────────────────────────────────────────────┤
│ Alice 10:02                                                  │
│ 这个接口超时怎么排查？                                        │
│                                                              │
│ 🤖 A 10:02                                                   │
│ @robot_b 这条请你处理：涉及网关日志。                          │
│                                                              │
│ 🤖 B 10:02                                                   │
│ 我先看下网关日志…                                             │
│ ...                                                          │
├──────────────────────────────────────────────────────────────┤
│ [输入框]  @  [发送] [停止]                                    │
└──────────────────────────────────────────────────────────────┘
```

- 无会话选择器：群就是会话；
- 机器人状态：在线/离线/思考中/回复中；
- owner 的可见 @ 指派正常显示；
- 不回复静默，不显示“已让行”。

### 8.2 工作区页

- 工作区列表：本机 + 远程（只读元数据）；
- 本机工作区下：多个群（会话）；
- 操作：新建群/会话、打开目录、重命名、解散、切换；
- 新建群 = 新建会话；
- 不提供“群内新建会话”。

### 8.3 控制面板

| 页面 | 内容 |
|---|---|
| 概览 | 本机机器人、gateway 状态、工作区/群数、在线状态 |
| 机器人 | robotId、owner、gatewayUrl、连接状态、AI 配置 |
| 工作区 | 本机工作区 + 远程元数据；群/会话列表 |
| 群组 | 成员、机器人、broker、policy、extra rev |
| 路由 | owner 路由记录：谁裁决、指派给谁、结果 |
| 日志 | gateway 连接、发送失败、metadata、Host 崩溃 |

### 8.4 状态

| 场景 | UI |
|---|---|
| gateway 连接中/断开 | 机器人离线/重连中 |
| owner 离线 | 群内工作暂停提示 |
| owner 退出/被踢 | 群解散/机器人退出 |
| 目标机器人离线 | owner 不指派/提示 |
| 不回复 | 聊天不显示；DSH 面板记录 |
| metadata 待同步 | 群/工作区 badge |

---

## 9. 安全

- 只操作 workspace 内文件；realpath 校验；防 symlink。
- 群 extra 不写路径/secret/token。
- gateway 用 wss；ws 仅内网/开发，UI 提示。
- robotSecret/AI Key 只在 Main/Host 内存/加密存储；Renderer 不持久化。
- owner 路由的 assign 校验 sender=owner、target=自己；人类伪造拒绝。
- 机器人消息不作为普通人类消息处理，防循环；只处理 owner assign。
- 远程成员触发本地工具：按群 policy，默认只读/拒绝外发；审批归本机 owner。
- 不回复静默；不产生空消息/未读。
- 日志脱敏。

---

## 10. 实施路线

### P0（3–4 周）：gateway 直连跑通

- 应用服务 provision 返回 gatewayUrl（ws/wss）。
- Main 启动 Host 子进程，注入配置。
- dsh-plugin 连接 gateway，单机器人收发、在线状态。
- 单工作区、单群、单会话。
- 现有 207/scope31 卡片/状态复用。
- 打包（自带 Node + Host + plugin）。

**验收**：登录 → 开通 → Host 启动 → 机器人上线 → 群聊 → 回复 → 关闭 app 离线。

### P1（3–4 周）：工作区多群 + 多机器人 owner 路由

- 工作区多群（每群一会话）。
- 多机器人入群、extra per-robot、owner broker。
- 无 @ owner 裁决：自己回/可见 @ 指派/不回。
- 目标机器人 assign 处理。
- owner 退出解散、普通机器人退出。
- IM 聚合。

**验收**：两个机器人同群；无 @ 时 owner 指派；@ 时目标回复；不回复静默；换目录新建群；owner 退出解散。

### P2（2–3 周）：控制面板 + 观测

- 控制面板全页。
- gateway 重连/健康/日志。
- 路由记录、metadata 同步状态。
- 文件外发策略、工具权限。
- 生产化签名/三平台。

**总计约 8–12 周**（1 Electron/Node + 1 前端 + 0.5 后端）。

---

## 11. 验收标准

- 单机器人：provision → Host → gateway 在线 → 群聊 → 流式/卡片/停止 → 关闭 app 离线。
- 多机器人：owner 无 @ 裁决；可见 @ 指派；目标回复；@ 优先；不回复静默。
- 工作区：多群/多会话；换目录新建群；旧群 session 可 resume。
- owner 退出：群主机器人解散；普通机器人退出。
- metadata：per-robot section；owner broker；其他机器人 pending/回读。
- 安全：仅 workspace 文件；extra 无路径/secret；assign 校验。
- 无本地消息 RPC；Host 子进程生命周期正常。

---

## 12. 与现有代码对接

| 现有 | 改造 |
|---|---|
| `src/api/appServerApi.js` | `provisionRobot()` 返回 gatewayUrl |
| `src/background.js` | `DshHostManager` 子进程、ProvisionStore、单实例 |
| `src/store.js` | 不再转发消息给 DSH；保留 IM 客户端/207/scope31 |
| `src/ui/main/conversation/*` | 群=会话；去掉群内会话切换；机器人状态/指派展示 |
| `src/ui/main/conversationList/*` | 工作区聚合；共享群 |
| `src/ui/main/AI.vue` | 工作区/控制面板入口 |
| `dsh-plugin.js` | gatewayUrl 从 provision 注入；owner 路由；per-robot extra；群=会话；owner 退出 |
| `im-app_server` | provision 增加 gatewayUrl；robot↔user 绑定 |
| `server-sdk.js` | 仅 fallback/admin；不做主链路 |
| `wf-robot-mcp-server.ts` | 不使用；保留为工具行为参考 |

---

## 13. 待确认的少量细节

1. **ws/wss 选择**：生产是否强制 wss？内网是否允许 ws？
2. **owner 路由失败**：目标机器人失败/NO_REPLY 时，owner 是否自动 fallback？建议可配置，默认不 fallback（保持简单）。
3. **远程工作区**：DSH 工作区页是否展示远程元数据？建议展示但只读。
4. **群解散通知**：确认 IM 解散通知已足够，不再发额外 Tip。
5. **控制面板深度**：v1 是否只做 207/scope31，还是需要本地 HTTP 控制？建议 v1 只做 207。

---

**一句话总结：**
**Host 作为 Electron 子进程跑 dsh-plugin，gateway 直连负责消息/在线状态；群=会话，工作区=多个群；多机器人由 owner 用可见 @ 指派；owner 不在就停工；不回复就静默；不做本地消息 RPC、不做 MCP 主链路。**
