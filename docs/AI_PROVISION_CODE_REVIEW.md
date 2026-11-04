# AI 开通 / 中转 / 计费链路代码审查

审查范围：

- 客户端：`vue-pc-chat`（Electron 主进程 provision/缓存/Host 注入 + Renderer 设置页）
- 服务端：`../ai-agent-server`（`/provision`、`/v1/chat/completions`、认证、配额、计费、管理端）

## 0. 结论摘要

整体链路设计是成立的：

`IM authCode → POST /provision → 主进程加密缓存 robotSecret/clientKey → Host 注入 baseUrl/apiKey → POST /v1/chat/completions → 服务端校验 clientKey、转发 Provider、计量计费`

后端 `mvn test` 在临时副本中通过（本机 workspace 的 `target` 被沙箱保护，不能直接写，故复制到 `/tmp` 执行）。  
但代码里有几类问题会直接影响“所有模型调用都走后端认证/计费”这个目标，以及凭据安全、并发配额和手动连接可用性。

按优先级：

- **P0（上线前必须处理）**：自定义模型直连绕过中转/计费；`/provision` 无限流导致 DoS/审计表膨胀；chunked 请求绕过体积限制；`/provision` 响应含长期凭据却无 `no-store`；机器人复用可能接管同 owner 的其他机器人并覆盖 callback；`configured` 标志错误；`effective.isEnabled()` 未执行。
- **P1（计费正确性/稳定性）**：月预算全表扫描；预算预留用 `maxTokens` 而非请求值；失败请求计费；`usage.model` 字段长度不足；SSE 计量截断/漏算；强制 `stream_options` 兼容性；客户端 token 续期空操作；切换服务失败先清旧配置；手动登录/清除后 Renderer 状态不同步。
- **P2（安全加固/部署）**：默认口令、默认 HTTP、AES/HMAC 密钥与密文同库、clientKey 无过期、Electron `nodeIntegration`、子进程 env 传密钥、safeStorage 明文回退、callback 地址硬编码、Docker 管理端口绑定等。

---

## 1. P0：上线前必须处理

### 1.1 自定义模型直连，绕过 `/v1` 的认证、配额与计费

**位置**

- `src/ui/main/dsh/DshModelSettings.vue:20-35, 65-80`
- `src/background.js:1734-1786`（`DSH_ADD_MODEL` / `DSH_UPDATE_MODEL`）
- `src/dsh/main/hostManager.js:162-175`（把用户模型加入 `llm-pi-ai` providers）
- `src/dsh/main/modelStore.js`

**问题**

服务端下发的默认模型走 `config.baseUrl`（即后端 `/v1`），这部分是正确的。  
但「模型配置」页允许用户添加任意 OpenAI-compatible 模型：任意 `baseUrl` + 任意 `apiKey`。Host overlay 会把这些 provider 一起写入 `llm-pi-ai`，而 `model.allowModelCommand: true`，用户可在会话里 `/model` 切换到自定义 provider。

这些请求由 Host 直接发往用户填写的 `baseUrl`，**不经过后端 `/v1`**，因此：

- 没有 clientKey 校验；
- 没有模型白名单；
- 没有每用户/全局并发、日限额、月预算；
- 没有 usage 记录、审计、计费。

更直接的是，当服务端默认模型未配置时，`DshModelSettings.vue` 明确提示「请添加至少一个自定义模型；第一个自定义模型会作为默认模型」，等于引导用户绕过后端。

**判断**

如果产品目标是「所有大模型调用都必须走后端中转并计费」，这是一个**计费/权限绕过**，优先级最高。  
如果 BYOK 是刻意保留的能力，则必须在产品上明确「计费只覆盖服务端默认模型」，并且不能把自定义模型当作服务端未配置时的兜底，否则额度体系形同虚设。

**建议**

- 方案 A（推荐，符合当前需求）：移除/隐藏「添加模型」入口，或只允许填写 `providerId/model` 等展示字段，`baseUrl` 固定为后端 `/v1`，`apiKey` 固定为 clientKey。
- 方案 B：保留 BYOK，但明确标记为「不走平台计费」，并在服务端关闭默认模型兜底提示；同时对自定义 `baseUrl` 做 SSRF/协议校验。
- 无论哪种方案，`hostManager._writeOverlay` 都不应把「用户可编辑的 baseUrl + apiKey」直接当作计费链路。

---

### 1.2 `/provision` 没有频率限制，失败请求还会写审计表

**位置**

- `src/main/java/.../web/RobotController.java:35-43`
- `src/main/java/.../service/ProxyService.java:98-100, 383-390`
- `src/main/java/.../store/StoreService.java:340-352`

**问题**

`/provision` 是未认证端点（只靠 authCode）。每次请求都会：

1. 调 IM SDK `applicationGetUserInfo`；
2. 失败时 `store.recordAudit("auth.login.failed", ...)` 写一条 `ai_audit`。

没有 IP/全局令牌桶。攻击者可以用任意 authCode 高频请求，造成：

- IM Admin API 被刷；
- `ai_audit` 表快速膨胀（保留 120 天），磁盘/DB 压力；
- 审计查询变慢。

`ProxyService` 也有同类问题：`allowRate` 达到上限后直接返回 false，不再增加计数；随后每次 429 都会 `audit("proxy.denied", "rate-limit")` 写库。持有合法 clientKey 的用户可以持续刷 429，把审计表打满。

**建议**

- `/provision` 增加按 IP + authCode 摘要的令牌桶（例如 10/min/IP），失败审计采样（如同 IP 每分钟最多 1 条）或异步批量写。
- `ProxyService` 的 denied 审计做限流/采样；不要把每一次 429 都落库。
- 审计写入改为异步队列，避免阻塞请求路径。

---

### 1.3 请求体大小限制只看 `Content-Length`，chunked 可绕过

**位置**

- `src/main/java/.../web/RequestSizeFilter.java:31-48`
- `src/main/java/.../web/ProxyController.java:20`
- `src/main/java/.../service/ProxyService.java:34, 72-75`

**问题**

`RequestSizeFilter` 只在存在 `Content-Length` 时检查大小。  
但 `ProxyController` 使用 `@RequestBody byte[] body`，Spring 会先**完整读取**请求体；`ProxyService` 里的 `rawBody.length > MAX_BODY` 是读完之后才检查。

攻击者（甚至未认证）可以用 `Transfer-Encoding: chunked` 发送超大 body，绕过 20MB/2MB 限制，造成单请求内存占用过高；并发下可 OOM。

**建议**

- 在 Tomcat 层设置 `server.tomcat.max-swallow-size` / `max-http-form-post-size`，或写一个 `HttpServletRequestWrapper` 限制 `InputStream` 读取上限。
- 不要依赖 `@RequestBody byte[]` 做“先读后判”；可以在 Controller 里用 `request.getInputStream()` 限流读取，或使用 Servlet 3.1 异步 + 计数流。
- `/provision` 同样需要限制（目前 2MB 也只查 header）。

---

### 1.4 `/provision` 响应包含长期凭据，但没有 `Cache-Control: no-store`

**位置**

- `src/main/java/.../web/SecurityHeadersFilter.java:36-38`
- `src/main/java/.../web/RobotController.java:50-53`
- `src/main/java/.../service/ClientConfigService.java:39-40`

**问题**

`/provision` 响应同时包含：

- `robot.robotSecret`（长期机器人凭据）；
- `config.apiKey`（长期 clientKey）。

`SecurityHeadersFilter` 只对 `/api/` 设置 `Cache-Control: no-store`，`/provision` 没有。  
虽然 POST 响应通常不被共享缓存缓存，但部分反向代理/客户端/调试代理会缓存，且这是明显的敏感响应，应该显式禁止。

**建议**

- `SecurityHeadersFilter` 对 `/provision`、`/v1/`、`/ai/v1/` 都设置 `Cache-Control: no-store, no-cache` 和 `Pragma: no-cache`。
- 生产强制 HTTPS；见 3.2。

---

### 1.5 机器人复用不校验来源，可能接管同 owner 的其他机器人并覆盖 callback

**位置**

- `src/main/java/.../service/RobotProvisionService.java:68-85`（`findOwned`）
- `src/main/java/.../service/RobotProvisionService.java:150-157`（`ensureCallback`）
- 创建时写入的标记：`RobotProvisionService.java:122-128`（`extra.source=wf-ai-agent`、`robotExtra.provider=dsh`）

**问题**

`findOwned(owner)` 直接遍历 `im.userRobots(owner)`，取第一个 `robotInfo` 成功且 `owner` 匹配的机器人，**完全不检查创建时写入的 `extra` / `robotExtra`**。  
随后 `ensureCallback(c)` 无条件把该机器人的 callback 覆盖成本服务的 `ROBOT_CALLBACK_URL`。

如果同一个 IM 用户在别的业务里也有机器人（SDK 的 `getUserRobots` 是按 owner 查全部），本服务会：

- 复用那个机器人；
- 把它的 callback 改到本服务；
- 把它的 secret 返回给 DSH 客户端。

这会直接破坏其他机器人集成。

**建议**

- `findOwned` 只接受 `robot.getExtra()` 中 `source=wf-ai-agent`（或 `robotExtra.provider=dsh`）且 owner 匹配的机器人；否则 `continue` 并创建新机器人。
- `ensureCallback` 只对本服务创建的机器人调用；如果发现 callback 与期望不一致，先记录/告警，不要静默覆盖。
- 给机器人 `extra` 增加 `appId`/`tenant` 字段，避免跨环境复用。

---

### 1.6 `configured` 判断错误：把客户端 Key 当成 Provider 已配置

**位置**

- `src/dsh/main/provisionStore.js:107-116`
- `src/background.js:1500-1516`
- `src/main/java/.../service/ClientConfigService.java:37-40`

**问题**

`ClientConfigService` 返回的 `config.apiKey` 是**客户端 Key**（`wfai...`），不是 Provider Key；`config.configured` 才是「Provider 是否配置完整」。

但客户端：

```js
// applyAiAgentConfig
ai: {
  apiKey: cfg.apiKey, // 客户端 Key
  ...
}
```

```js
// DshProvisionStore.publicView
ai: {
  ...
  configured: !!ai.apiKey, // 客户端 Key 永远存在
}
```

因此，即使后端 `config.configured=false`（没有 Provider Key / 没有 baseUrl / 没有 model），前端仍然显示「已配置」，Host 也会写入 provider（因为 `ai.baseUrl && ai.model && ai.apiKey` 都成立），最终请求 `/v1` 得到 503。

**建议**

- `applyAiAgentConfig` 复制 `configured: cfg.configured !== false`、`enabled: cfg.enabled !== false`。
- `DshProvisionStore.publicView` 使用 `ai.configured`（明确布尔），不要用 `!!ai.apiKey` 推断。
- `_writeOverlay` 在 `ai.configured === false` 时不要添加默认 provider，或让 Host 启动但 UI 明确提示「服务端未配置 Provider」。
- `DshModelSettings.serverConfigured` 同步改为读取 `ai.configured`。

---

### 1.7 `effective.isEnabled()` 计算了但 `/v1` 不检查

**位置**

- `src/main/java/.../service/ProxyService.java:86-97`（只检查 `user.isEnabled`，没有 `effective.isEnabled`）
- `src/main/java/.../store/StoreService.java:247-254`
- `src/main/java/.../service/ClientConfigService.java:37`

**问题**

`StoreService.effective` 计算了一个 `enabled`：

```java
boolean userReady = !userKey.isEmpty() && !c.getBaseUrl().trim().isEmpty()
    && !c.getModel().trim().isEmpty();
out.setEnabled(user.isEnabled() && (userReady || g.isEnabled()));
```

当全局 `enabled=false`、用户有自己的 Provider Key、但 baseUrl/model 回退全局时：

- `configured=true`（key + global base/model 齐全）；
- `enabled=false`（userReady=false 且 g.enabled=false）。

`/provision` 会把 `enabled:false` 返回给客户端，但 `/v1` 只检查 `user.isEnabled()` 和 `effective.isConfigured()`，**不检查 `effective.isEnabled()`**，所以请求仍然放行。  
这使“全局禁用/用户未就绪”的语义失效，客户端与后端判断不一致。

**建议**

- `/v1` 在 `effective` 取出后增加：
  ```java
  if (!effective.isEnabled()) { audit(...); writeError(403, "AI is disabled", "auth_error"); return; }
  ```
- 同时统一 `StoreService.effective`：如果全局 `enabled=false`，是否还允许 baseUrl/model 回退？建议 `pick` 对 global 值也看 `g.isEnabled()`，或把 `enabled` 的语义改成“仅用户自身完整配置才为 true”。
- `ClientConfigService` 在 `enabled=false` 时可以不返回 `apiKey`，避免客户端误启动。

---

## 2. P1：计费正确性、性能与客户端状态

### 2.1 月预算检查每次请求全表扫描

**位置**

- `src/main/java/.../service/ProxyService.java:164-168`
- `src/main/java/.../store/StoreService.java:366-369`

```java
for (UsageRecord row : store.usageSince(StoreService.monthStartTs())) {
    if (guardUserId.equals(row.getUserId())) spent += row.getCost();
}
```

`usageSince` 是 `findByTsGreaterThanEqualOrderByTsDesc(since)`，会把这个月**所有用户**的 usage 全部加载到内存，再按 userId 过滤。  
每个 `/v1` 请求都做一次，复杂度 O(本月总请求数)，整体 O(N²)；请求量上来后 DB/内存都会被打爆。

**建议**

- `UsageRepository` 增加：
  ```java
  @Query("select coalesce(sum(u.cost),0) from UsageEntity u where u.userId=?1 and u.ts>=?2")
  double sumCostByUserSince(String userId, long since);
  ```
- 或 `findByUserIdAndTsGreaterThanEqual`，只查当前用户。
- 日限额同理，用 `countByUserIdAndTsBetween` 而不是 `usageForDay(...).size()`。

### 2.2 预算预留用 `maxTokens` 而不是请求的 `max_tokens`

**位置**

- `src/main/java/.../service/ProxyService.java:169-175`

```java
double reserveUsd = (inputEstimate / 1_000_000D) * effective.getInputPrice()
    + (effective.getMaxTokens() / 1_000_000D) * effective.getOutputPrice();
```

默认 `maxTokens=393216`。如果 output price 非 0，每个请求预留下的金额可能远大于实际消耗；月预算稍小就会大量 402，即使用户实际只用了几百 token。

**建议**

- 从 `body.max_tokens` / `max_completion_tokens` 取实际请求值（clamp 后），没有则用一个较小的默认 reserve（例如 4096），不要直接用全局最大。
- 或者把 reserve 做成配置项 `app.budget-reserve-tokens`。

### 2.3 上游失败也计费，错误请求可能重复记

**位置**

- `src/main/java/.../service/ProxyService.java:296-314`

非流式路径在上游返回 4xx/5xx 时，`extractUsage` 拿不到 usage 就 `estimate(requestText, choices)`，然后 `record` 扣费。  
`catch` 里又用 `estimate(requestText, "")` 记录一次。  
如果 `record` 自己因 DB 异常抛出，catch 还会再 `record` 一次，可能重复。

**判断**

如果计费口径是“实际 token 消耗”，失败请求不应扣费；如果只是想统计请求数，应把 `cost=0`、`billable=false` 区分开。

**建议**

- `record` 增加 `billable` 参数；上游非 2xx 或客户端中断时 `billable=false`，仍记录 status/latency 供统计。
- `record` 用 `try/catch` 包住，避免 catch 中二次写。
- 明确“失败是否计入日限额/月预算”，目前会计入。

### 2.4 `UsageEntity.model` 长度 128，但 Proxy 允许 200

**位置**

- `src/main/java/.../db/UsageEntity.java:17-18`
- `src/main/java/.../service/ProxyService.java:116-118`

Proxy 校验 `model.length() > 200` 才拒绝，但 DB 列是 `@Column(length = 128)`。  
在 MySQL 严格模式下，129–200 字符的 model 会在 `recordUsage` 时抛 `Data too long`，而这时上游请求已经成功、响应已经写给客户端，造成“请求成功但计费记录丢失/接口 500”。

**建议**

- 列改为 `length = 256`，或 Proxy 校验改为 128。
- 同时在 `record` 里对 model 做截断兜底。

### 2.5 SSE 计量截断/漏算

**位置**

- `src/main/java/.../service/ProxyService.java:129-131, 259-278, 423-426`

问题点：

1. `requestText` 超过 2MB 直接截断；body 上限是 20MB，超大 prompt 会少算输入 token。
2. `outputText` 只累计 `choices[0].delta.content`，不累计 `reasoning_content`、`tool_calls` 等；推理模型会少算输出 token。
3. `estimate` 用 `length()/3`；中文大约 1 token/字，`/3` 会严重低估（英文约 4 字符/token，也不精确）。
4. SSE 每个 chunk 用 `new String(buffer, UTF_8)`，多字节字符跨 8KB 边界会被替换成 `�`，既影响 `outputText` 也影响 JSON 解析（usage 行通常是 ASCII，问题较小）。
5. `captured` StringBuilder 累计了但从未使用，白占内存。

**建议**

- 用 `CharsetDecoder` 增量解码，保留跨 chunk 的字节尾巴。
- 累计 `delta.content`、`delta.reasoning_content`、`delta.tool_calls` 的文本。
- 估算至少按“中文/英文/其他”分类，或接入 tokenizer；预留/计费上限不要依赖 `/3`。
- 如果上游不返回 usage，考虑直接拒绝流式（要求 `include_usage`）或按更保守的系数计费。

### 2.6 强制注入 `stream_options.include_usage` 的兼容性

**位置**

- `src/main/java/.../service/ProxyService.java:195-204`

只要 `stream=true`，就会强制写 `stream_options.include_usage=true`。  
不少“OpenAI-compatible”实现并不支持 `stream_options`，会直接 400，导致本来可用的 Provider 变成不可用。

**建议**

- 增加 Provider 配置项 `supportsStreamUsage`（默认 true，可关）。
- 或者首次 400 时去掉 `stream_options` 重试一次，并标记该 Provider 不支持。
- 如果不支持 usage，回退到估算，而不是让请求失败。

### 2.7 客户端 token 续期是空操作，`expiresAt` 永远 0

**位置**

- `src/dsh/renderer/dshClient.js:30-35`
- `src/ui/main/HomePage.vue:202-209, 468`
- `src/dsh/main/aiAgentService.js:168`
- `src/ui/main/AI.vue:224`

`HomePage` 每 30 分钟调用 `provisionDsh(false)`，但 `provisionDsh` 第一步 `DSH_GET_CACHED` 命中缓存就直接返回，根本不会请求服务端。  
同时 `DshAiAgentService.publicView` 把 `expiresAt` 硬编码成 0，`provision` 保存 config 时也没有保存 `expiresAt`，所以 `AI.vue` 永远显示「服务端直连 key」，不会显示到期时间，也不会触发续期。

**后果**

- 管理端轮换 clientKey 后，客户端仍用旧 key，Host 持续 401，直到用户手动点「刷新开通」。
- 后端如果以后给 clientKey 加过期时间，客户端完全不会处理。

**建议**

- `DshAiAgentService.provision` 保存 `expiresAt`；`applyAiAgentConfig` 传递。
- `provisionDsh` 缓存命中时检查 `expiresAt`（例如剩余 < 10 分钟则强制刷新）。
- `/v1` 返回 401 `auth_error` 时，Host/主进程触发一次强制 re-provision（注意防止死循环）。
- 修正 UI 文案：当前是“代理 clientKey”，不是“服务端直连 key”。

### 2.8 切换服务失败会先清掉旧配置

**位置**

- `src/dsh/main/aiAgentService.js:100`
- `src/dsh/main/provisionService.js:35-37`

```js
this.rememberServer(userId, base, true); // 请求前就切换并删除旧 config
...
response = await axios.post(`${base}/provision`, ...)
```

如果新地址不可达/返回错误，旧 `config` 已经被删除。`DshProvisionService.provision` 在失败时返回旧缓存 robot，但 `resolveAiAgentConfig` 已经拿不到 config，Host 会被重启成没有 AI provider 的状态。

**建议**

- `rememberServer` 只在 `/provision` 成功后调用；失败时保留旧 `serverUrl/config`。
- 或者先把新配置写到临时记录，成功后再原子替换。

### 2.9 手动登录/清除后 Renderer 全局状态不同步

**位置**

- `src/background.js:1673-1697`（`DSH_AI_AGENT_LOGIN`）
- `src/dsh/renderer/dshClient.js:85-101`（`loginDshAiAgent`）
- `src/dsh/renderer/dshClient.js:160-163`（`clearDshProvision`）
- 只有 `provisionDsh` 会调用 `setDshProvision` + dispatch `dsh-provision-updated`（`dshClient.js:32-35, 52-56`）

`AI.vue` 手动「连接并应用」后只更新了组件内的 `this.provision`；`dshState.provision` 仍是旧值，`DshWorkspace`、会话列表等监听 `dsh-provision-updated` 的组件不会刷新。  
`disconnectAiAgent` / `clearProvision` 也没有清 `dshState.provision` 或 dispatch 事件。

**建议**

- `loginDshAiAgent`、`clearDshAiAgent`、`clearDshProvision` 统一调用 `setDshProvision(...)` 并 dispatch 事件。
- 把 `AI.vue.provision` 改成从 `dshState` 派生，避免两套状态。

### 2.10 `resolveAiAgentConfig` 的 catch 重试同一个同步调用

**位置**

- `src/background.js:1481-1487`

```js
try {
    return await dshAiAgentService.resolve(userId);
} catch (e) {
    return await dshAiAgentService.resolve(userId).catch(() => null);
}
```

`resolve` 是同步函数，不会抛；即使抛，第二次调用同样会抛。这段 catch 没有意义，且 `resolve` 返回 null 时不会进 catch。

**建议**

- 删除 catch 重试；如果要“缓存丢失时强制刷新”，应调用 `provision` 或重新读取，而不是重复 `resolve`。

### 2.11 `forceRefresh` 服务端未使用

**位置**

- `src/main/java/.../service/RobotProvisionService.java:45-64`

`provision(user, forceRefresh)` 只在日志里打印 `force`；`findOwned` 仍复用第一个机器人，不会刷新 secret/callback。  
如果产品期望“强制刷新机器人凭据”，当前没有实现；如果不需要，建议删掉该参数，避免客户端误以为能刷新。

### 2.12 `allowedModels` / `expiresAt` 被客户端丢弃

**位置**

- `src/main/java/.../service/ClientConfigService.java:45-46`
- `src/dsh/main/aiAgentService.js:122-135`
- `src/background.js:1500-1516`

后端返回 `allowedModels`，客户端 `DshAiAgentService` 也保存了，但 `applyAiAgentConfig` 没有传给 `ai`，`hostManager._writeOverlay` 只写默认模型，所以 DSH 的 `/model` 里看不到服务端允许的其他模型。  
`expiresAt` 同样没有保存/传递。

**建议**

- 如果希望 `/model` 展示服务端白名单，`_writeOverlay` 为每个 allowed model 生成一个 model entry（同一个 provider），或至少把列表传给 UI。
- 如果暂不支持，删除这些字段或明确文档，避免“后端配了但客户端不生效”。

---

## 3. P2：安全加固与部署

### 3.1 默认口令/密钥

**位置**

- `ai-agent-server/src/main/resources/application.yml:52`（`ADMIN_INITIAL_PASSWORD:admin123456`）
- `ai-agent-server/src/main/resources/application.yml:60`（`IM_ADMIN_SECRET:123456`）
- `config.example.env` 同样的弱默认值

生产如果没有用环境变量覆盖，管理后台和 IM Admin 都是弱口令。`AdminBootstrap` 对默认口令只打印 “created with ADMIN_INITIAL_PASSWORD”，没有警告。

**建议**

- 默认值改为空，首次启动随机生成并打印一次；`IM_ADMIN_SECRET` 空则启动失败并提示必须配置。
- 启动时检测弱默认值并拒绝/告警。

### 3.2 默认明文 HTTP

**位置**

- `vue-pc-chat/src/config.js:31`（`http://192.168.1.87:8090`）
- `ai-agent-server/src/main/resources/application.yml:40`（`http://192.168.1.87:8090`）

authCode、clientKey、robotSecret 都会在这条 HTTP 链路上传输。局域网抓包即可拿到长期凭据。

**建议**

- 生产必须 HTTPS；客户端对非 loopback 的 `http://` 给出明显警告或直接拒绝。
- 服务端 `public-base-url` 默认空，强制部署时配置；不要把开发机 IP 写进默认值。

### 3.3 AES/HMAC 密钥与密文同库

**位置**

- `ai-agent-server/src/main/java/.../store/StoreService.java:73-84`（`ai_app_secret` 随机生成并存 DB）
- `ai-agent-server/src/main/java/.../store/CryptoService.java:21-26`

Provider Key 用 AES-GCM 加密存 `ai_users/ai_global_config`，但密钥 `ai_app_secret` 存在同一个数据库。  
拿到 DB dump 的人可以解密所有 Provider Key；同样可以拿到 HMAC 密钥伪造 clientKey。

**建议**

- 密钥放 KMS/环境变量/独立密钥文件（至少不与业务 DB 同库），启动时注入。
- 支持密钥轮换（双密钥解密、单密钥加密）。
- 文档不要把它描述成“DB 泄露也安全”；它只防 DB 行级读取，不防 DB dump。

### 3.4 客户端 Key 无过期

**位置**

- `ai-agent-server/src/main/java/.../service/AuthService.java:60-81`

clientKey = `wfai.<base64(userId)>.<HMAC(client:userId:keyVersion)>`，没有 `iat/exp`。  
一旦泄露，永久有效，直到管理员手动 `rotate-key`。`keyVersion` 只能全量轮换，不能按设备/会话吊销。

**建议**

- 加 `exp`（例如 7 天）和 `jti`，或改成短期 access token + refresh。
- 支持按设备吊销；至少记录签发时间/最后使用时间。

### 3.5 Electron 安全基线削弱了“secret 不下发 Renderer”的承诺

**位置**

- `vue-pc-chat/src/background.js:717-723`

```js
nodeIntegration: true,
contextIsolation: false,
webSecurity: false,
webviewTag: true,
```

主进程虽然做了 `publicView` 脱敏，但 Renderer 有完整 Node 权限，可以：

- `require('fs')` 读文件；
- `require('child_process')` 执行 `ps eww` 读取 Host 子进程 env 中的 `WF_AI_API_KEY` / `WF_ROBOT_SECRET`；
- 调用任意 IPC（当前 IPC handler 没有校验 `event.sender`）。

一旦有 XSS（消息内容、外链、webview），长期凭据就可能被读走。

**建议**

- 逐步迁移到 `contextIsolation:true` + `nodeIntegration:false` + preload `contextBridge` 白名单。
- `webSecurity:true`，避免关闭同源策略。
- 所有敏感 IPC handler 校验 `event.senderFrame.url` / 窗口身份。
- 子进程密钥不要放 env，改用 0600 临时文件/Unix socket/一次性 token。

### 3.6 子进程 env 传密钥

**位置**

- `vue-pc-chat/src/dsh/main/hostManager.js:294-309`

`WF_AI_API_KEY`、`WF_ROBOT_SECRET` 直接放在 Host 子进程环境变量里。同用户进程可通过 `/proc/<pid>/environ`（Linux）或 `ps eww`（macOS）读取。

**建议**

- 使用 0600 的临时配置文件/命名管道，Host 启动时读取后删除；或使用短期 token。
- 至少限制 Host 进程权限/用户。

### 3.7 safeStorage 不可用时明文落盘

**位置**

- `vue-pc-chat/src/dsh/main/provisionStore.js:45-58`
- `vue-pc-chat/src/dsh/main/aiAgentService.js:45-56`
- `vue-pc-chat/src/dsh/main/modelStore.js`

代码已有 warning，但仍会以 0600 明文写 `dsh-provision.enc` / `dsh-ai-agent.enc` / `dsh-models.enc`。在 Linux 无 keyring 的环境下，长期 clientKey/robotSecret 就是明文。

**建议**

- safeStorage 不可用时拒绝持久化，或要求用户每次重新 provision；至少不要把明文 secret 写入磁盘。
- 如果必须落盘，使用用户口令派生密钥（需要 UX 支持）。

### 3.8 回调地址硬编码 `http://host:8885`

**位置**

- `ai-agent-server/src/main/java/.../service/RobotProvisionService.java:160-167`

`callbackUrl()` 在未配置 `ROBOT_CALLBACK_URL` 时，从 `ROBOT_GATEWAY_URL` 取 host，硬编码 `http` 和 `8885`。生产如果 gateway 是 `wss`/HTTPS 或端口不同，callback 会错。

**建议**

- 强制配置 `ROBOT_CALLBACK_URL`，或从 gateway URL 的 scheme/port 推导（wss→https，端口可配）。

### 3.9 Docker 管理端口绑定

**位置**

- `ai-agent-server/Dockerfile`

`EXPOSE 8091`，但 `app.admin-address` 默认 `127.0.0.1`，容器内管理端口只监听 loopback，宿主机映射也访问不到；同时镜像默认 root 运行。

**建议**

- 明确文档：容器内需 `ADMIN_HOST=0.0.0.0` 并通过内网/反代访问，或不要 EXPOSE 管理端口。
- 增加非 root `USER`。

### 3.10 配额并发预留非原子

**位置**

- `src/main/java/.../service/ProxyService.java:150-181`

`pendingDaily.get()` / `pendingCostMicros.get()` 是 read-check-increment，不是 CAS；4 个并发请求可能同时通过检查，导致日限额/月预算小幅超限。

**建议**

- 用 `AtomicInteger.compareAndSet` 循环，或数据库行锁/计数表。
- 如果可接受少量超限，至少在注释里说明。

### 3.11 其它较小问题

- `ProxyService` 对非对象 JSON（数组/`null`）会走到 `(ObjectNode) body` 抛 `ClassCastException`，返回 502 而不是 400；应显式要求 JSON object。
- `ProxyService` 的 `n` 校验在并发/预算预留之后，`n!=1` 的请求会先占槽再 400；建议提前校验。
- `ProxyService` 的 `windows`、`userSlots`、`pendingDaily`、`pendingCostMicros` 按 userId 永久增长，用户量大时是内存泄漏；建议加清理/弱引用。
- `ProxyService` 使用 `HttpURLConnection` 默认跟随重定向，POST 302 可能变 GET；建议 `setInstanceFollowRedirects(false)`。
- `RobotController` 审计用 `request.getRemoteAddr()`，没有用 `ClientIpResolver`，反向代理后 IP 不准。
- `RobotProvisionService` 的 `locks` 按 owner 永久增长，未清理。
- `RobotProvisionService` 的 robotId 包含 owner，owner 含特殊字符/过长时可能超 IM 限制。
- `AdminController` 的 `adminLoginWindows` 按 IP 永久增长；管理登录被限后每次 429 仍写审计（管理端口默认 localhost，风险较低）。

---

## 4. 建议修复顺序

### 今天/本轮

1. `background.js:1686` 手动登录路径统一走 `resolveAiAgentConfig`，并补“无 ai 不启动 Host”的保护。
2. `provisionStore.publicView` 的 `configured` 改为读取 `ai.configured`；`applyAiAgentConfig` 传递 `configured/enabled`。
3. `dshClient` 的 `login/clear` 统一更新 `dshState` + dispatch 事件。
4. `aiAgentService.rememberServer` 改到 `/provision` 成功之后，失败保留旧配置。
5. `DshProvisionService` 缓存命中时检查 `expiresAt`/`configured`，不完整则强制刷新。

### 上线前

6. 处理自定义模型直连（删除/限制/明确不计费）。
7. `/provision` 加限流 + 审计采样；`ProxyService` denied 审计限流。
8. 请求体限制改成流式/容器级，防 chunked 绕过。
9. `SecurityHeadersFilter` 给 `/provision`、`/v1`、`/ai/v1` 加 `no-store`；生产 HTTPS。
10. `RobotProvisionService.findOwned` 按 `extra` 过滤，禁止覆盖其他机器人 callback。
11. `/v1` 检查 `effective.isEnabled()`；统一 `StoreService.effective` 语义。
12. `UsageEntity.model` 加长/校验；月预算查询改为按用户聚合。

### 迭代

13. 计费准确性：失败不计费/标记、SSE 增量 UTF-8、reasoning/tool_calls、tokenizer/更准估算、2MB 截断策略。
14. `stream_options` 兼容开关/回退。
15. 安全加固：密钥移出 DB、clientKey 过期/轮换、Electron contextIsolation、子进程密钥传递、默认口令/HTTP。

---

## 5. 验证说明

- 后端：`mvn test` 通过（在 `/tmp/wf-ai-review` 副本执行；workspace 的 `target` 目录被沙箱保护，`mvn` 无法写入 `target/classes/application.yml`，不是代码失败）。
- 客户端：本次未运行 Electron 端到端；DSH 手动登录/状态同步路径没有单测覆盖，1.6/2.9 都是静态审查确认的。
- 建议补三类测试：
  1. `/provision` 返回 `configured=false` 时，客户端不得显示“已配置”、Host 不得注入 provider；
  2. 手动 `DSH_AI_AGENT_LOGIN` 后 `provision.ai` 必须包含 `baseUrl/apiKey/model`；
  3. `/v1` 在 `effective.enabled=false` 时必须 403。
