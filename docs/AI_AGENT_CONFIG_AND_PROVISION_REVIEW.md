# AI Agent 服务：配置分层与 `/provision` 机制审查

> 范围：`../ai-agent-server`（provision / 中转 / 管理）、`vue-pc-chat`（Electron 主进程缓存与 Host 注入）。
> 目的：回答两件事——**全局设置与个人设置的处理是否符合逻辑**；**服务端改配置后客户端是否需要重新 `/provision`**。
> 状态：**审查结论已在两个仓库落地**（见 §0.1）；`robot-gateway` 插件已升到 0.2.2，源码、`dist`、本机 5 份 profile 安装副本和 tgz 都已更新，重启 Host/插件后生效。

## 0.1 实施状态

| 审查项 | 状态 | 落地位置 |
|---|---|---|
| 后台个人配置写入（`config` 嵌套） | ✅ | `AdminController.updateUser/createUser` + `applyUserConfig` |
| `enabled` / `configured` 语义统一 | ✅ | `StoreService.effective` + README §6 |
| 全局回退无开关（始终回退）+ 个人端点 Key 边界 | ✅ | `StoreService.effective`（2026-11 调整，见 §0.2） |
| 白名单取交集 + 始终包含生效模型 | ✅ | `StoreService.mergeAllowed`、`ProxyService` |
| `0` 值/预算/`maxTokens` 校验 | ✅ | `AdminController` 写入期校验 + `StoreService` 兜底 |
| 真实 `configVersion` | ✅ | `UserEntity.configUpdatedAt` + `StoreService.configVersion` |
| `GET /api/me/config`（ETag、不滑 TTL） | ✅ | `ClientConfigController` + `ClientConfigService.build(..., false)` |
| `/provision` 解耦（robot 失败仍下发 config） | ✅ | `RobotController` + `RobotProvisionResponse.robotError/warnings` |
| `/provision` 限流（成功不再占用严格配额） | ✅ | `RobotController`（IP 硬上限 + 失败配额 + 用户配额） |
| `keyIssuedAt`/`lastLoginAt` 定向更新 | ✅ | `UserRepository.updateLastLoginAt/updateClientKey` |
| 回调失败 warning | ✅ | `RobotProvisionService.ensureCallback` + `StoreService.recordProvisionResult` |
| 回调告警在管理后台展示 | ✅ | `userView.lastProvisionAt/lastWarnings` + 后台用户编辑弹窗 |
| 仅用服务专属标记认领机器人 + 前缀兜底 | ✅ | `RobotProvisionService.belongsToThisService` |
| 客户端启动校验 `expiresAt` | ✅ | `dshClient.provisionDsh` |
| 5 分钟配置轮询 / 401 自动重开 / 403 停用 | ✅ | `aiAgentService.fetchConfig`、`dshClient.syncDshConfig`、`HomePage` |
| Host 按配置哈希重启 | ✅ | `background.provisionFingerprint` |
| UI 三态 + 重试按钮 | ✅ | `AI.vue`、`DshModelSettings.vue` |
| 失败提示按原因分类 | ✅ | `robot-gateway/dsh-plugin.js@0.2.2`（`src/failures.ts` + `dist`） |
| 管理端 N+1 / 整表扫描 | ✅ | 一次加载全局配置传给 `effective/userView`；用户按月聚合、用量分页、概览限定窗口 |
| 审计记录变更字段 | ✅ | `AdminController.globalChanges/userConfigChanges` |
| `/v1` 响应带 `X-WF-Config-Version` | ✅ | `ProxyService` |
| clientKey 绝对寿命 + 自动轮换 | ✅ | `AppProperties.clientKeyMaxAgeHours`、`AuthService.clientKey`、`UserRepository.updateClientKey` |
| 插件更新 | ✅ 本机 | `dsh-plugin.js@0.2.2`、tgz，以及 5 份已安装 profile 副本 |

**剩余（非代码）**：

- 0.2.2 的 npm 发布：本机 5 份 profile 已直接更新；其他机器需要发布 0.2.2 或分发新 tgz。
- 重启才生效：`dsh web` / DSH Host / 桌面应用需重启一次加载新插件与新主进程逻辑。

## 0.2 2026-11 设计调整

- 全局配置去掉 `enabled`（“启用全局配置”），改为 `defaultUserEnabled`（“新用户默认开通”），只影响之后创建 / 首次 IM 登录的用户；已有用户由列表启动/停止控制。
- 全局字段**始终**作为回退基线，不再提供“关闭全局回退”开关；要关闭回退请清空全局 Key/baseUrl/model。
- 个人 `baseUrl` 必须同时配置个人 Key；否则保存返回 400。运行时对存量数据也按未配置处理，全局 Key **绝不**发到个人 `baseUrl`。
- 用户列表删除按钮改为启动/停止；新增 `POST /api/admin/users/{id}/enable|disable`，只改 `enabled`、不碰配置、不吊销 clientKey；`DELETE` API 保留但 UI 不再展示。
- 管理端全局 API 字段 `enabled` → `defaultUserEnabled`（仅自带后台使用，`/provision`、`/v1` 契约不变）。
- 全局/个人 Key 的清除从复选框改为「当前 Key」旁的暂存按钮：点击后显示「保存后清除 / 撤销」，保存时统一提交，避免误点立即删除；个人 Base URL 非空时禁止只清 Key。
- 管理后台适配海量数据：用户列表服务端分页/前缀搜索，用量页用户筛选改为服务端搜索选择器 + 清除筛选；概览/用量的 summary、按用户、按模型、趋势改为 SQL 聚合，不再加载整段时间的用量行；审计改为服务端 `page/total` + 时间范围/事件类型筛选；`ai_usage` 增加 `(model,ts)`、`ai_users` 增加 `(name)`、`ai_audit` 增加 `(kind,ts)` 索引。

## 0. 结论摘要

1. **通过管理后台保存的个人设置完全写不进数据库**：后台提交的是 `{ config: { ... } }`，`PUT /api/admin/users/{id}` 读的是顶层 `body.has("baseUrl")`。所有个人 Provider 字段（baseUrl / apiKey / model / 价格 / 限额 / 白名单）保存后被静默丢弃（直接调 API 用扁平字段仍可用）。
2. **`enabled` 与 `configured` 是两套互相矛盾的判定**：`configured` 用“合并后的三段式是否齐全”，`enabled` 用“用户自己的三段式是否齐全或全局开关”。于是会出现“`configured=true` 但 `enabled=false`”的客户端无法使用、后端却认为已配置的状态。
3. **全局开关只关了半扇门**：`global.enabled=false` 只禁用全局 Provider Key，全局的 baseUrl / model / 价格 / 限额仍会作为回退值下发。
4. **`/provision` 没有真正的“配置变更”信号**：`forceRefresh` 服务端只打日志；`configVersion` 是环境变量 `ROBOT_CONFIG_VERSION`，与配置修改无关；客户端也不消费它。
5. **需要重新 `/provision` 的场景是“客户端投影的配置”**（模型、白名单、推理参数、baseUrl、clientKey、gatewayUrl）；纯服务端转发用的 Provider Key / baseUrl 改了**不需要**。当前唯一的自动刷新是客户端 30 分钟定时器，且冷启动、断线重连都不会校验缓存。

---

## 1. 链路与职责

```text
Electron 主进程                         ai-agent-server                    上游 Provider
  │  POST /provision {authCode}  ──────▶  IM authCode 校验
  │                                      ├─ 机器人开通/复用（IM Admin SDK）──▶ IM Server
  │  ◀──── {robot, config, version} ─────┤  config = 合并后的生效配置
  │                                      └─ 写 lastLoginAt / keyIssuedAt
  ├─ safeStorage 缓存（robotSecret / clientKey / model ...）
  ├─ 写 dsh-runtime-patch.yml + 启动 DSH Host（env 注入 baseUrl/apiKey）
  │
  └─ DSH Host ── POST /v1/chat/completions ──▶ 校验 clientKey ──▶ 转发 ──▶ Provider
                                               （enabled / configured / 白名单 / 配额 / 计费）
```

关键事实：**客户端把 `/provision` 的结果“烘”进了子进程的启动参数**。所以 `/v1` 侧的鉴权、配额、Provider 转发是“每次请求实时读库”，而模型名、白名单、推理参数、代理地址是“启动时快照”。两条路径的生效方式不同，这是后文所有时序问题的根源。

---

## 2. 配置分层审查

### 2.1 现状规则

`StoreService.effective()`（[StoreService.java:216-269](../../ai-agent-server/src/main/java/cn/wildfirechat/aiagent/store/StoreService.java#L216-L269)）的合并规则：

| 字段 | 个人 | 全局 | 备注 |
|---|---|---|---|
| `baseUrl` / `model` / `reasoningEffort` | 非空优先 | 回退 | **不受** `global.enabled` 影响 |
| `maxTokens` / `contextWindow` | 非 null 优先 | 回退 | 最终硬编码兜底 393216 / 1048576 |
| `inputPrice` / `cachedInputPrice` / `outputPrice` | 非 null 优先 | 回退 | cached 为空时按 inputPrice |
| `allowedModels` | 非空优先 | 回退 | 都是空 → 只允许生效模型 |
| `monthlyBudget` / `dailyRequestLimit` | 非 null 优先 | 回退 | **0 = 不限** |
| `providerApiKey` | 非空优先 | 仅 `global.enabled=true` 时回退 | 这是全局开关**唯一**作用点 |
| `configured` | `key && baseUrl && model` 齐全 | | 用合并后的值 |
| `enabled` | `user.enabled && (用户自己的 key+baseUrl+model 齐全 || global.enabled)` | | 与 `configured` 不同源 |

方向是对的（字段级继承 + `source` 回显 + 不向前端泄露 Provider Key），但下面几处不符合逻辑。

### 2.2 P0：通过后台保存时，个人设置根本写不进去

- 管理后台提交体（[app.js:273-300](../../ai-agent-server/src/main/resources/static/app.js#L273-L300)）：

```js
{ name, externalId, note, enabled,
  config: { baseUrl, apiKey, clearApiKey, model, reasoningEffort,
            maxTokens, contextWindow, inputPrice, cachedInputPrice,
            outputPrice, allowedModels, monthlyBudget, dailyRequestLimit } }
```

- 服务端读取（[AdminController.java:285-301](../../ai-agent-server/src/main/java/cn/wildfirechat/aiagent/web/AdminController.java#L285-L301)）：

```java
if (body.has("baseUrl")) c.setBaseUrl(...);
if (body.has("model")) c.setModel(...);
...
```

`body` 顶层只有 `name/externalId/note/enabled/config`，`body.has("baseUrl")` 恒为 `false`。**个人设置全部被忽略**，但接口仍返回 200 与“已保存”。

复现：管理后台编辑用户 → 填 Provider Base URL → 保存 → 重新打开该用户 → 字段为空。

> 附带：`POST /api/admin/users` 也只接受 `externalId/name/note/enabled`，不接受 `config`；创建后再编辑又走上面这条坏路径，等于**个人配置完全没有可用的录入通道**（只能直接改库或调 API）。

**建议**：`updateUser` 优先读 `body.path("config")`，保留顶层扁平字段作为兼容；补写接口测试（保存后 GET 必须能读回）。

### 2.3 P0：`enabled` / `configured` 两套判定

```java
boolean complete = key非空 && baseUrl非空 && model非空;
out.setConfigured(complete);

boolean userReady = userKey非空 && userBaseUrl非空 && userModel非空; // 只看个人
out.setEnabled(user.isEnabled() && (userReady || g.isEnabled()));
```

由此产生的状态：

| 场景 | `configured` | `enabled` | 后果 |
|---|---|---|---|
| 个人有 key+baseUrl，model 来自全局；全局关闭 | **true** | **false** | 客户端 `hostManager` 要求 `enabled && configured` 才注入模型 → 后台显示“已配置”，客户端却没有模型 |
| 个人 key+baseUrl+model 齐全；全局关闭 | true | true | 符合 BYOK 预期 |
| 全局开着但没有任何 Key | false | **true** | `/v1` 走到 503 `config_error`；`enabled` 这个字段失去意义 |
| 个人 key+baseUrl+model 齐全；个人被禁用 | true | false | 正确 |

根因：`configured` 描述“合并结果是否完整”，`enabled` 描述“用户是否被允许 + 用户自己的配置是否完整”，两者既不同源也不同层。

**建议**：只保留一个“可用”判定，`enabled` 回归纯策略位：

```java
enabled   = user.isEnabled();                 // 管理员是否允许该用户
configured = key && baseUrl && model;         // 生效凭据是否完整
usable    = enabled && configured;            // 客户端/代理统一用这个
```

客户端现有 `enabled && configured` 的门控保持不变，只是语义终于自洽。

### 2.4 P1：全局开关只关了一半（历史；已在 §0.2 调整中移除该开关）

[StoreService.java:222-258](../../ai-agent-server/src/main/java/cn/wildfirechat/aiagent/store/StoreService.java#L222-L258)：`global.enabled` 只参与 `providerApiKey` 的回退，`baseUrl/model/价格/限额/白名单` 照样回退。效果：

- 管理员点“关闭全局”后，依赖全局 Key 的用户确实不可用了；但**个人自带 Key 的用户仍会继承全局的 model / baseUrl / 价格**，只是拿不到全局 Key（如果个人没 Key，就是“配置不完整”）。
- `globalView()` 把这个开关展示成“全局配置启用”，与真实语义（“允许使用全局 Provider Key”）不一致。

**建议**（二选一，推荐 A）：

- **A. 全有或全无**：`global.enabled=false` 时**所有**全局字段都不参与回退，用户要么有完整的个人配置，要么不可用。心智模型最简单，也符合“总开关”的直觉。
- **B. 改名**：把字段改成 `allowGlobalProviderKey`，并在后台文案里明确“只影响全局 Key 的回退”。

### 2.5 P1：白名单与“生效模型”自相矛盾

合并（[StoreService.java:235-245](../../ai-agent-server/src/main/java/cn/wildfirechat/aiagent/store/StoreService.java#L235-L245)）与校验（[ProxyService.java:137-145](../../ai-agent-server/src/main/java/cn/wildfirechat/aiagent/service/ProxyService.java#L137-L145)）：

```java
boolean modelAllowed = allowed != null && !allowed.isEmpty()
    ? allowed.contains(model)
    : model.equals(effective.getModel());
```

两个问题：

1. **默认模型可能不在自己的白名单里**。全局 `model=deepseek-chat`、`allowedModels=[deepseek-reasoner]` → 客户端默认用 `deepseek-chat` 发请求 → 每次 403 `model_error`。
2. **个人白名单整体替换全局白名单**。如果全局白名单是平台策略（限制可用模型），个人列表可以把它**扩大**，等于绕过。

**建议**：

- 保存时校验：白名单非空则必须包含生效 `model`（或自动补进去）。
- 运行时放行：`model.equals(effective.getModel()) || allowed.contains(model)`。
- 合并规则改为**交集**：`user ∩ global`（两者都非空时），并且始终并入 `effective.model`。

### 2.6 P1：`0` 的语义不一致（含一个会截断输出的坑）

1. **全局 `maxTokens` 可以被写成 0**：后台保存用 `Number(value) || 0`（[app.js:388](../../ai-agent-server/src/main/resources/static/app.js#L388)），清空即提交 0；服务端 `asInt` 不拦 0（[AdminController.java:200](../../ai-agent-server/src/main/java/cn/wildfirechat/aiagent/web/AdminController.java#L200)）；`toModel` 只在 `null` 时兜底 393216（[StoreService.java:451](../../ai-agent-server/src/main/java/cn/wildfirechat/aiagent/store/StoreService.java#L451)）→ 生效 `maxTokens=0`。
   - 代理侧 `clampTokenField` 会 clamp 到 `max(1, 0)=1`：请求里带 `max_tokens` 时被压成 **1 token**；不带时预算预留也按 1 token 算（预算形同虚设）。
   - 客户端 overlay 用 `Number(ai.maxTokens) || 8192` 兜底（[hostManager.js:242-250](../src/dsh/main/hostManager.js#L242-L250)）→ 客户端以为 8192，服务端按 1 执行，**静默截断且两边不一致**。
2. **个人 `0` 可以突破全局上限**：`monthlyBudget` / `dailyRequestLimit` 的 `0` 表示“不限”，而个人值非 null 就优先。管理员本想给全局设上限，某用户记录里是 0 就直接变成无限。
3. 全局 `contextWindow=0` 同理会下发 0（客户端兜底 1048576，仅显示/校验层不一致）。

**建议**：

- `maxTokens` / `contextWindow` 写入必须 `> 0`，否则视为“回退/默认”；前端清空应提交 `null` 而不是 0。
- 预算/限额：`0 = 继承`，另加显式 `unlimited` 开关；或取更严格者 `stricter(user, global)`（0 视为 ∞）。
- 若产品确实要求“个人 0 = 不限”，至少在后台把“会覆盖全局上限”写清楚并二次确认。

### 2.7 P2：其余不一致

| 项 | 问题 | 建议 |
|---|---|---|
| `reasoningEffort` | `pick()` 没有兜底常量，全局清空后下发 `""`；`EffectiveConfig` 里的 `"high"` 默认值实际不生效 | 与 maxTokens 一致，给 `"high"` 兜底 |
| 价格 | 个人可设 0（免费）或负数，无校验 | 校验 `>= 0`；0 是否允许按产品定 |
| 写入校验 | baseUrl 协议、model 长度、`maxTokens < contextWindow` 都不在写入期校验，错误延迟到请求期变成 502/503 | 管理端保存时校验并返回 400 |
| `user.updatedAt` | 每次 `/provision` 都会 `saveUser` 刷新 `updatedAt`，不能当“配置版本” | 新增独立的 `configUpdatedAt` / `configRev` |
| 全局 Key 状态 | `globalView()` 只有 `hasApiKey`，后台读的是 `g.apiKeyMasked`（[app.js:364](../../ai-agent-server/src/main/resources/static/app.js#L364)）→ 永远显示“未配置” | 返回 `apiKeyMasked` |

### 2.8 建议的目标语义

把“Provider 身份”收敛成一个**不可拆的三元组**，其余字段仍可字段级覆盖：

```text
若个人侧任意一项（key/baseUrl/model）被设置：
    要求三项齐全（保存时校验），使用个人三元组
否则若 global.enabled：
    使用全局三元组
否则：
    configured = false

enabled    = user.enabled
configured = key && baseUrl && model
usable     = enabled && configured

参数（effort/maxTokens/contextWindow/价格）：个人 ?? (global.enabled ? 全局 : 默认值)
白名单：交集(个人, 全局) ∪ {生效 model}
配额：更严格(个人, 全局)，0 视为 ∞
```

这样 `enabled`、`configured`、`source` 三者不会互相打架，后台也能用一句“个人覆盖 / 全局回退 / 无”解释清楚。

---

## 3. `/provision` 审查

### 3.1 现状时序

`POST /provision`（[RobotController.java:57-88](../../ai-agent-server/src/main/java/cn/wildfirechat/aiagent/web/RobotController.java#L57-L88)）：

1. 按 IP 限流（成功请求也计数）；
2. 读 body 里的 `authCode`（也接受 header）；
3. `AuthService.login` → IM SDK 校验 → `findOrCreateByExternalId`；
4. `RobotProvisionService.provision` → `get_user_robots` → `get_robot_info` →（必要时 `create_robot`）→ `setCallback` → `setUserFriend`；
5. `ClientConfigService.build` → `clientKey()`（**写库刷新 keyIssuedAt**）；
6. 返回 `{robot, config, features, configVersion, updatedAt}`。

### 3.2 问题清单

| # | 级别 | 问题 | 位置 |
|---|---|---|---|
| 1 | P1 | `forceRefresh` 服务端只用于日志，不改变任何行为 | [RobotProvisionService.java:46,63](../../ai-agent-server/src/main/java/cn/wildfirechat/aiagent/service/RobotProvisionService.java#L46-L64) |
| 2 | P0 | `configVersion` 是静态环境变量，与配置修改无关；客户端也不消费 | [AppProperties.java:35](../../ai-agent-server/src/main/java/cn/wildfirechat/aiagent/config/AppProperties.java#L35)、[RobotProvisionService.java:239](../../ai-agent-server/src/main/java/cn/wildfirechat/aiagent/service/RobotProvisionService.java#L239) |
| 3 | P1 | 机器人失败会 502 整个 `/provision`，AI 配置也拿不到 | [RobotProvisionService.java:54-57](../../ai-agent-server/src/main/java/cn/wildfirechat/aiagent/service/RobotProvisionService.java#L54-L57) |
| 4 | P1 | 每次调用 4~5 次 IM Admin API + 2 次全行写库；`saveUser` 是“读当前行再整行覆盖”，机器人开通期间的管理端修改可能被旧快照覆盖 | [AuthService.java:58-73](../../ai-agent-server/src/main/java/cn/wildfirechat/aiagent/service/AuthService.java#L58-L73) |
| 5 | P1 | 每 IP 30/min 把成功请求也算进去；NAT 后几十人同时首登会 429，而首登没有缓存可退 | [RobotController.java:90-101](../../ai-agent-server/src/main/java/cn/wildfirechat/aiagent/web/RobotController.java#L90-L101) |
| 6 | P1 | 机器人回调设置失败只 `warn`，客户端仍拿到 `gatewayUrl`，消息可能永远不通，且没有状态回传 | [RobotProvisionService.java:185-193](../../ai-agent-server/src/main/java/cn/wildfirechat/aiagent/service/RobotProvisionService.java#L185-L193) |
| 7 | P2 | `isOurs()`（带 `robot_<owner>_` 前缀兜底）是死代码，实际只用 JSON 标记判定归属 | [RobotProvisionService.java:113-138](../../ai-agent-server/src/main/java/cn/wildfirechat/aiagent/service/RobotProvisionService.java#L113-L138) |
| 8 | P2 | `locks` 按 owner 只增不减 | 同上 `:38` |

关于第 7 条补充：当前 im-server 的 `get_robot_info` 会返回 `extra` / `robotExtra`（`OutputRobot.fromRobot` 里有 `setRobotExtra(robot.getExtra())`），所以标记判定能工作；但一旦换 SDK/IM 版本不返回 extra，`belongsToThisService` 恒 false → **每 30 分钟新建一个机器人**。前缀兜底应该接回去。

关于机器人归属标记：`robotExtra={"provider":"dsh"}` 是**通用 provider 枚举值**（robot-gateway 的协议里 `provider` 可为 `dsh`/`openclaw`…）。用它判定“这是我的机器人”过宽：别的集成只要也写 `provider=dsh`，本服务就会接管它、覆盖 callback、并把 secret 下发给客户端。建议只认 `extra.source="wf-ai-agent"` 这种服务专属标记。

### 3.3 安全补充：clientKey 的 TTL 语义

`clientKey` 每次 provision 都刷新 `keyIssuedAt`（[AuthService.java:63-73](../../ai-agent-server/src/main/java/cn/wildfirechat/aiagent/service/AuthService.java#L63-L73)），校验时按 `keyIssuedAt + TTL` 判过期。含义是：

- TTL 不是“单 token 寿命”，而是“用户最近一次 provision 之后 7 天”。
- 只要合法客户端还在定时刷新，**泄露出去的同一把 Key 会一直有效**；吊销只能靠 `rotate-key`。
- `config.expiresAt` 因此永远 ≈ now + 7d，UI 上的“到期时间”没有实际意义。

这不是 bug，但需要在文档/后台写清楚：TTL 防的是“废弃账号”，不是“泄露凭据”；轮换才是吊销手段。

---

## 4. 直接回答：服务端改配置后，要不要重新 `/provision`？

### 4.1 分场景

| 改动 | 服务端何时生效 | 客户端需要重新 `/provision`？ | 现在实际生效时间 |
|---|---|---|---|
| 全局/个人 Provider **Key** | `/v1` 立即（每次读库） | **不需要**（客户端不持有 Provider Key） | 立即 |
| 全局/个人 Provider **baseUrl**（上游） | `/v1` 立即 | **不需要** | 立即 |
| **生效模型 `model`** | 立即（`/v1` 用它判默认模型） | **需要**（Host 启动参数 + overlay 模型目录） | ≤30 分钟（定时器）或手动“刷新开通” |
| **`allowedModels`** | 立即（`/v1` 白名单） | **需要** | 同上；且**只改白名单时 Host 不会重启**（见 4.3） |
| `reasoningEffort` / `maxTokens` / `contextWindow` | `maxTokens` 在 `/v1` 立即 clamp；其余是客户端展示/请求参数 | **需要** | ≤30 分钟 |
| **禁用/启用用户、全局开关** | `/v1` 立即 403/恢复 | 禁用**不需要**；重新启用通常立即恢复，但若停用超过 Key TTL 则**必须**刷新 | 启用后 ≤30 分钟（仅 TTL 过期时） |
| **轮换 clientKey** / TTL 过期 | 旧 Key 立即 401 | **必须**，否则全部请求失败 | ≤30 分钟（若 IM 在线） |
| **`PUBLIC_BASE_URL` / `PUBLIC_PROXY_BASE`** | 只影响 `/provision` 的返回值 | **必须**（缓存里是旧代理地址） | ≤30 分钟 |
| **`ROBOT_GATEWAY_URL`**（gatewayUrl） | 只影响 `/provision` 返回值 | **必须**；且 Host 必须重连 | ≤30 分钟，但**当前不会重启 Host**（见 4.3） |
| 配额 / 限流 / 价格 | `/v1` 立即 | 不需要 | 立即 |
| 机器人 displayName / portrait | 只影响 `/provision` | 展示层需要 | ≤30 分钟 |

一句话：**改“转发侧”的东西不需要；改“客户端投影”的东西需要，而客户端拿到新配置的唯一正式通道就是 `/provision`。**

### 4.2 为什么客户端会“报错”

`/v1` 的错误体是 `{"error":{"message","type"}}`，常见映射：

| HTTP | `type` | 触发场景 | 重新 `/provision` 能否解决 |
|---|---|---|---|
| 401 | `auth_error` | Key 轮换、TTL 过期、`APP_SECRET` 变更 | ✅ 能（前提是 authCode 还能拿到） |
| 403 | `auth_error` | 用户被禁用 / AI 被禁用 | ❌ 管理员先恢复；恢复后下一轮刷新（≤30 分钟） |
| 403 | `model_error` | 模型不在白名单 / 旧模型名 | ✅ 能（同时需要 Host 重启） |
| 503 | `config_error` | Provider 未配置、上游 baseUrl 非法 | ⚠️ 重新 provision 只会拿到 `configured=false`；要管理员先修 |
| 429 | `quota_error` / `rate_limit` | 日限额、月预算、并发、限流 | ❌ 无效 |
| 上游 4xx/5xx | 透传 | 上游余额不足 / 鉴权 / 故障 | ❌ 无效 |

修复前 robot-gateway 插件把 **401/403 一律翻译成“模型服务鉴权失败，请检查 API Key”**（[robot-gateway/dsh-plugin.js/src/failures.ts](../../robot-gateway/dsh-plugin.js/src/failures.ts)），所以“模型被移出白名单”“用户被停用”在聊天里也会显示成“检查 API Key”。本次已让插件先按文案区分白名单 / 停用 / 未配置，再回落到通用鉴权失败（§0.1）。

### 4.3 当前实现的三个薄弱点

1. **冷启动 / 重连不校验缓存**
   `provisionDsh(false)` 命中缓存就直接返回（[dshClient.js:30-35](../src/dsh/renderer/dshClient.js#L30-L35)，[provisionService.js:26-27](../src/dsh/main/provisionService.js#L26-L27)），`HomePage.maybeProvisionDsh()` 在启动和每次连接成功时都会走这条路径（[HomePage.vue:189-214, 352-393](../src/ui/main/HomePage.vue#L189-L214)）。缓存里没有对 `expiresAt` 的判断 → **离线超过 7 天再启动，Host 会带着过期 Key 跑，最长 30 分钟全部 401**。
2. **唯一的自动刷新是 30 分钟定时器，且依赖 IM 在线**
   [HomePage.vue:470](../src/ui/main/HomePage.vue#L470) 每 30 分钟 `provisionDsh(true)`；此时若 IM 未连上，取 authCode 失败，再等 30 分钟。没有“启动即校验”。
3. **Host 重启条件漏字段**
   [background.js:1557-1564](../src/background.js#L1557-L1564) 的 `sameCredentials` 只比较 `baseUrl/apiKey/model/reasoningEffort/maxTokens/contextWindow/robotSecret`。`allowedModels`、`enabled`、`configured`、`gatewayUrl` 变了都**不会重启 Host** → 白名单更新后 `/model` 里看不到新模型；网关地址变更后仍连旧地址。

另外：后台“重试开通”按钮绑定的是 `@click="refreshProvision"`（[AI.vue:41](../src/ui/main/AI.vue#L41)），Vue 会把 MouseEvent 当 `forceRefresh` 传进去才“恰好”强制刷新；`bootstrap()` 显式传 `false` 则只读缓存。属于可工作的脆弱写法。

---

## 5. 改造建议

### 5.1 目标接口契约

```http
POST /provision                      # 保留：IM authCode → 机器人 + 配置
Authorization: -
Body: { authCode, forceRefresh }
→ 200 { robot, config, configVersion, warnings: [] }
   warnings 例：["robot_callback_failed"]；robot 失败不再拖垮 config

GET /api/me/config                   # 新增：廉价配置刷新（无 IM 调用、无 authCode）
Authorization: Bearer <clientKey>
If-None-Match: "<configVersion>"
→ 304  版本未变
→ 200  { config, configVersion }    与 /provision 的 config 完全同构
→ 401  触发一次强制 /provision
→ 403  标记 disabled（停止重试，提示管理员）
```

`configVersion` 用**真实配置修订号**，而不是环境变量：

- `GlobalConfigEntity` 已有 `updatedAt`；`UserEntity` 新增 `configUpdatedAt`（只在配置字段变化时更新，不被 provision 的 `lastLoginAt/keyIssuedAt` 污染）。
- `configVersion = global.configUpdatedAt + ":" + user.configUpdatedAt`（或一个自增 `rev`）。
- `/provision` 与 `/api/me/config` 返回同一个值；`/v1` 的响应头也带上 `X-WF-Config-Version`（便于排查）。

### 5.2 服务端改动（按优先级）

**P0**

1. 修 `PUT /api/admin/users/{id}` 的 `config` 嵌套读取；补保存→读取的接口测试。
2. 统一 `enabled/configured`（2.3），`global.enabled` 作为全字段回退开关（2.4）。
3. `configVersion` 改为真实修订号；新增 `GET /api/me/config` + ETag。
4. `/provision` 解耦：机器人失败返回 200 + `robotError/warnings`，config 照常下发。
5. 写入期校验：`maxTokens>0`、`maxTokens<contextWindow`、价格/预算 `>=0`、baseUrl 为 http(s)；`0` 表示“继承/默认”而不是“生效值”。
6. 白名单：保存时并入生效 model；个人与全局取交集；`/v1` 永远放行生效 model。

**P1**

7. provision 限流改为“按失败/按 IP+authCode 摘要”，成功路径按用户维度；或提高到与 NAT 规模匹配。
8. 回调设置失败回传 warning，并在管理端用户详情里展示“回调未生效”。
9. `keyIssuedAt` 改为定向 `UPDATE`，避免全行覆盖与无谓写放大。
10. 接回 `isOurs()` 前缀兜底；归属标记只认 `source=wf-ai-agent`。

**P2**

11. 审计记录“改了哪些字段”（不记密钥值）。
12. `/provision` 支持 `If-None-Match`（版本未变返回 304 + 仅 robot 段）。

### 5.3 客户端改动（按优先级）

1. **启动/重连即校验**：`provisionDsh(false)` 命中缓存时检查 `expiresAt`（缺省或剩余 < 24h 则强制刷新）；或登录后固定做一次真实 provision，缓存只作离线兜底。
2. **用 `/api/me/config` 轮询代替 30 分钟的 authCode provision**：主进程每 5 分钟 + 窗口聚焦 + 网络恢复时拉一次；版本变化才更新缓存/重启 Host。省掉大量 IM Admin 调用，也不依赖 IM 在线。
3. **401/403 自动恢复**：轮询 401 → 强制 `/provision` 一次（带冷却与次数上限，防循环）；403 → 进入 disabled 状态并提示“管理员已停用”，不再无脑重试。
4. **Host 重启条件改为配置哈希**：对 `{baseUrl, apiKey, model, allowedModels, reasoningEffort, maxTokens, contextWindow, enabled, configured, gatewayUrl, robotSecret}` 求哈希，任何一项变化都重启。这样白名单/网关/开关变更都能生效。
5. UI 区分三态：`未配置` / `已配置但被停用` / `可用`；后台“重试开通”显式传 `true`，不要依赖事件对象。
6. 失败提示按 `error.type` 分类（或先按文案兜底），避免把所有 403 都说成“API Key 错误”。

### 5.4 兼容与灰度

- `GET /api/me/config` 是新增端点，旧客户端不受影响；客户端可先做“启动校验 + Host 哈希重启”，再做轮询。
- `/provision` 保持现有字段不变，只新增 `warnings` / 真实 `configVersion`；旧的静态 `configVersion` 语义变化需要同步后端 README 与客户端展示。
- `enabled` 语义调整要同步客户端：现有 `hostManager` 已经要求 `enabled && configured`，改完后行为只会更一致，不会放开权限。

---

## 6. 管理端与统计的连带问题（顺带发现）

1. **用户列表 N+1 全表扫描**：`GET /api/admin/users` 在循环里对每个用户执行 `usageSince(monthStart)` 再内存过滤（[AdminController.java:224-235](../../ai-agent-server/src/main/java/cn/wildfirechat/aiagent/web/AdminController.java#L224-L235)）。1000 个用户 = 1000 次“整月用量”查询 + 1000 次全量对象构建。应改为一次聚合查询（`group by user_id`）。
2. **概览/用量接口整表加载**：`overview` 用 `usageSnapshot()`（全部历史），`/api/admin/usage` 也是先全表再过滤（[AdminController.java:143,339](../../ai-agent-server/src/main/java/cn/wildfirechat/aiagent/web/AdminController.java#L143)）。120 天保留期 + 每次请求一行，数据量会很快失控。应下推到 SQL（时间范围 + limit）。
3. **全局 Key 状态显示错**：`globalView()` 不返回 `apiKeyMasked`，后台永远显示“未配置”（见 2.7）。
4. `overview` 里 `configured` 统计对每个用户调一次 `effective()`（两次查询 + 解密），同样是 N+1。

---

## 7. 验证清单

服务端单测（现有 `mvn test` 之外补充）：

- [ ] 管理端保存个人 config → GET 能读回（覆盖 baseUrl/apiKey/model/价格/限额/白名单）。
- [ ] 全局关闭 + 个人完整配置 → `configured=true, enabled=true, usable=true`。
- [ ] 全局关闭 + 个人只有 Key → `configured=false`（且 `enabled` 不再与之矛盾）。
- [ ] 全局 `maxTokens=0` 被拒（400）或按默认处理；请求不再被 clamp 到 1。
- [ ] 白名单不含生效 model → 保存时自动补入；`/v1` 请求生效 model 返回 200。
- [ ] 个人白名单 ⊆ 全局白名单。
- [ ] `/provision` 机器人创建失败 → 200 + `robotError`，config 正常。
- [ ] `configVersion` 在修改全局/个人配置后变化，未修改时不变。
- [ ] `GET /api/me/config` 支持 `If-None-Match` → 304。

客户端手工场景：

- [ ] 轮换 Key → 客户端在下一轮轮询/启动时自动恢复，无需手动。
- [ ] 改全局 `allowedModels` → 5 分钟内 `/model` 出现新模型（Host 已重启）。
- [ ] 离线 8 天后启动 → 自动重新 provision，不出现长时间 401。
- [ ] 改 `ROBOT_GATEWAY_URL` → Host 重连新网关。
- [ ] 禁用用户 → 聊天内提示“账号已停用”，而不是“检查 API Key”。

---

## 8. 文件索引

| 主题 | 文件 |
|---|---|
| 配置合并 / 生效 | [StoreService.java](../../ai-agent-server/src/main/java/cn/wildfirechat/aiagent/store/StoreService.java) |
| 个人/全局写入 | [AdminController.java](../../ai-agent-server/src/main/java/cn/wildfirechat/aiagent/web/AdminController.java) |
| 管理后台表单 | [app.js](../../ai-agent-server/src/main/resources/static/app.js) |
| `/provision` | [RobotController.java](../../ai-agent-server/src/main/java/cn/wildfirechat/aiagent/web/RobotController.java)、[RobotProvisionService.java](../../ai-agent-server/src/main/java/cn/wildfirechat/aiagent/service/RobotProvisionService.java)、[AuthService.java](../../ai-agent-server/src/main/java/cn/wildfirechat/aiagent/service/AuthService.java) |
| 客户端配置下发 | [ClientConfigService.java](../../ai-agent-server/src/main/java/cn/wildfirechat/aiagent/service/ClientConfigService.java) |
| `/v1` 校验与配额 | [ProxyService.java](../../ai-agent-server/src/main/java/cn/wildfirechat/aiagent/service/ProxyService.java) |
| 客户端 provision 缓存 | [provisionService.js](../src/dsh/main/provisionService.js)、[provisionStore.js](../src/dsh/main/provisionStore.js) |
| 客户端 Host 注入 | [hostManager.js](../src/dsh/main/hostManager.js)、[background.js](../src/background.js) |
| 客户端刷新时机 | [HomePage.vue](../src/ui/main/HomePage.vue)、[AI.vue](../src/ui/main/AI.vue) |
| 错误提示分类 | [robot-gateway/dsh-plugin.js/src/failures.ts](../../robot-gateway/dsh-plugin.js/src/failures.ts) |
