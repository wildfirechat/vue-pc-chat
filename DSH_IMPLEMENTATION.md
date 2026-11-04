# DSH 内置实现说明（v4 第一版）

> 对应设计：`DSH_EMBEDDED_DESIGN_V4.md`
> 状态：代码已落地第一版，完成构建验证；尚未在真实 gateway/IM 环境做端到端联调。

## 1. 已完成

### 权限体系（本轮）

- 插件新增 `access.privateOwnerOnly`、`interaction.approvalOwnerOnly`、`security.allowGuestTurns`；默认值保持旧行为，桌面端宿主显式注入严格值。
- 私聊仅 owner/管理员；未注册群继续静默忽略；`/stop` 仅任务发起人/群创建者/owner 可执行；`/allow` 增加群创建者权限。
- 群内审批：guest 发起的敏感工具调用默认由机器人 owner 审批，审批卡片带 `requestedBy`/`approver`，客户端隐藏非审批人的按钮。
- 宿主强制 `DSH_PERMISSION_MODE=workspace-write`，不继承宿主机权限模式；`dsh-runtime.json` 去除 secret/apiKey。
- DSH 会话详情侧栏新增 Permissions 徽标；设置页新增「权限」Tab；审批卡片展示发起人/审批人。
- 新增权限审计：插件写 `$DSH_HOME/wildfire-audit.jsonl`（0600、2MB 轮转），记录准入拒绝、管理命令、权限变更、审批请求/结果/超时、越权作答；Host `getAudit` + IPC `dsh-get-audit`，设置页展示最近 80 条。
- 详见 `DSH_PERMISSIONS.md`。

### 应用服务（`../im-app_server`）

- 已移除模型 Provider 配置、全局 AI key、`/ai/**` 代理、`AiTokenService`/`AiProxyController`。
- 已移除 `/robot/provision`、机器人开通服务、机器人 DTO、机器人网关/IM 机器人配置。
- 应用服务只保留 IM 登录、好友/群组/消息等业务能力，不再感知 DSH 机器人或 AI Agent。

### 独立 AI Agent 服务（`../ai-agent-server`）

- 新增 Java 8+ / Spring Boot 2.7 服务（推荐 JDK 17）：IM authCode + 机器人开通、用户/全局配置（用户优先、全局回退）、OpenAI 兼容中转、SSE 透传、token 计量/费用/预算/日限额、审计、JPA 数据库、双端口管理后台、Shiro 权限。
- 客户端设置页新增「AI 服务」Tab：填写服务地址，连接时通过 IM SDK `wfc.getAuthCode('admin', 2, host)` 自动获取 authCode；主进程只加密保存客户端 Key 和 AI 配置，自动重启 Host 注入服务地址/Key/模型。
- 机器人开通也移到 AI 服务：`POST /provision`（IM authCode 鉴权）创建/复用 IM 机器人、设置好友和网关回调，并在同一响应返回 AI 配置；客户端用返回的 robot + config 启动 Host。
- 客户端 AI 服务地址默认在 `src/config.js` 的 `Config.AI_AGENT_SERVER`（当前 `http://192.168.1.87:8090`），也可在「AI 服务」页覆盖并保存到 safeStorage；authCode 不落盘，由 IM SDK 获取。
- IM 连接状态变为 `ConnectionStatusConnected` 后，`HomePage` 自动调用 `provisionDsh()` 完成 `/provision`，无需手工点击；登录用户信息到达时也会补触发一次。
- `DSH_AI_AGENT_STATUS/LOGIN/SET_SERVER/CLEAR` IPC；`dsh-ai-agent.enc` 使用 safeStorage 加密；Renderer 只拿脱敏视图。

### Electron PC 客户端

- Main 进程新增：
  - `src/dsh/main/provisionStore.js`：`safeStorage` 加密缓存，按 userId 分区。
  - `src/dsh/main/provisionService.js`：缓存 AI 服务返回的 robot 凭据；实际 `/provision` 由 AI 服务执行。
  - `src/dsh/main/hostManager.js`：启动/停止/重启 DSH Host 子进程；生成 `dsh-runtime-patch.yml`（gateway/robot/workspace/AI provider）；日志；自动重启。
  - `src/background.js`：初始化服务、IPC、退出/登出停止 Host。
  - `src/ipcEventType.js`：DSH IPC 事件。
- Renderer 新增：
  - `src/dsh/renderer/dshClient.js`：开通/缓存/状态/重启/日志 IPC。
  - `src/dsh/renderer/state.js`：只保存公开信息（不保存 secret）。
  - `src/ui/main/AI.vue`：DSH 状态页 + 工作区/群会话聚合列表 + 刷新/重启/日志/清除凭据。
  - `src/ui/main/HomePage.vue`：Electron 下显示 DSH 入口；登录后自动开通。
  - `src/ui/main/conversationList/ConversationItemView.vue`：line2 群的 workspace 名称/多机器人徽标。
- 默认 Agent 模式：Host overlay 写入 `session.preset: standard`，新群默认标准模式；已有群如果持久化过 `wfim-deploy-advisor`，需在群内发 `/preset standard` 或面板切换。

- 打包（自包含 runtime）：
  - `scripts/prepare-dsh-runtime.js` 把 Node 22.19+、`@deepseek-ai/dsh`、wildfire profile 复制到 `build/dsh-runtime/`；`build/dsh-runtime/{node,dsh,profile,VERSION}` 已 gitignore。
  - `vue.config.js` 已把 `dsh-runtime` 放入 `extraResources`。
  - Host 优先使用 `resources/dsh-runtime/{node,dsh}`，并把 bundled profile 首次复制到 `userData/dsh-home/profiles/wildfire`；之后固定使用 app-local `DSH_HOME`，不依赖宿主机 `~/.dsh`。
  - 开发环境优先使用仓库内 `build/dsh-runtime`；先执行一次 `npm run prepare-dsh-runtime`，否则回退宿主机 `dsh`/`~/.dsh`。
  - 找不到 bundled runtime 时才回退 PATH 的 `dsh`（开发环境）。

### UI（V5 实施）

- 新增 `/home/dsh`：按消息 Tab 对齐——左侧 DSH 栏从 x=60 开始，宽度 `var(--list-panel-width)`；右侧 `ConversationView` 从 x=321 开始。工作区/会话中栏 + 聊天；会话详情 `DshPlanSidebar`（Plan/Tasks/Files/Context）默认收起，聊天头部右上角 ⚙ 展开，侧栏 × 收起。
- 新增 `/home/dsh` 的「新建工作区」：目录选择/Host 目录选择器、`/create <path>`、创建后轮询并自动选中新会话。
- 同一工作区新建会话：Host 读取 `wildfire-workspaces.json`，用原目录继续 `/create <path>`，workspaceId 由 `robotId:dir` 哈希稳定。
- 工作区聚合优先按目录映射（`path:<dir>`），不依赖群 extra 同步时机；插件启动时把 `wildfire-groups.json` 的历史 workspaceDir 迁移到 overrides，旧群也能继续在同一工作区新建会话。
- 消息页永久过滤 line2，去掉 AI 过滤 Tab；DSH 未读移到左侧 DSH 图标；line2 通知跳 `#/home/dsh?session=<groupId>`。
- `/home/ai` 保留为 DSH 设置页，顶部「返回 DSH」。
- 远程机器人不裁剪消息：右栏始终显示完整群消息；机器人切换只影响 plan/context。
- 新增 IPC：`DSH_GET_WORKSPACES`、`DSH_OPEN_PATH`、`DSH_PICK_DIRECTORY`，以及 Host 的 gateway/routing/log 读取。
- 规划侧栏读取 scope31 panel/state/metrics，并从 208 task card / goal 消息提取任务；完整 plan 快照仍需插件补数据源。
- 侧栏新增机器人切换（多机器人群，远程 plan 有数据时只读展示）和 Files 文件列表（cwd 下前 30 项，可打开）。
- 侧栏新增 Permissions：文件沙箱/审批策略徽标，进入会话时发 207 query 拉取 type=3 面板数据。
- 设置页新增「权限」Tab：默认策略、角色边界、会话级命令说明；非本机 ws:// 网关显示未加密警告。
- DSH 左侧新增「插件」入口：展示 runtime/profile 插件清单，支持打开插件目录；安装/卸载/启停尚未接。
- 只展开当前工作区；新增整行「新会话」；空状态输入框回车在新会话时作为群名；设置固定左下角。
- 会话行支持重命名，工作区支持打开目录。
- 工作区支持本地别名重命名（localStorage，按目录路径），不修改服务端目录。
- 多机器人详情栏支持机器人切换；Files 读取 cwd 前 30 项；空状态输入作为新会话群名。
- 新增工作区名称输入、本地别名、排序（最近/名称）；会话 `⋯` 菜单支持重命名/在消息中打开/复制群 ID；详情栏支持拖拽调宽并持久化。
- 设置页新增「模型」Tab：服务端 provision 的 AI 配置只读；可添加/编辑/删除多个 OpenAI-compatible 自定义模型，API Key 用 safeStorage 加密。
- Host overlay 支持多 provider：服务端默认使用中性 ID `default`；自定义模型使用用户填写的 `providerId`（留空按名称生成，需唯一），各自 `apiKeyEnv`；有服务端默认时默认模型固定为服务端，没有时第一个自定义模型为默认。模型保存后自动重启 Host。
- 关闭 dsh 内置 `llm-deepseek` / `llm-deepseek-account` 路由，避免 `/model` 出现没有凭据的 `deepseek-flash`、`deepseek-v4-pro`。

### UI（V4 第一轮，已被 V5 取代入口）

- DSH 页：概览 / 工作区 / 群组 / 机器人 / 诊断 五个 Tab；顶部固定「打开单聊机器人」「创建新会话」「重启 Host」。
- 工作区：按 workspace 聚合群会话，显示群 ID、remote badge、成员/rev/broker/robots。
- 群组：群成员数、workspace、rev、broker、机器人 session/本机/远程；支持打开、重命名。
- 主 IM 列表：按 workspace 插入分组标题，群会话只出现一次；保留 AI/多机器人/workspace badge。
- 群聊页：沿用已有 Agent 状态、思考中、停止按钮、机器人多行在线状态。
- 新增「路由」页：读取 `wildfire-routing.jsonl`，展示多机器人 owner 的 assign/reply/none 记录。
- 新增「日志」页：主进程读取 Host 日志尾部 400 行，支持刷新/打开文件。
- 概览/机器人页增加 gateway 实时状态：插件写 `wildfire-gateway-status.json`，Host 读取并随 `getStatus` 返回；页面 4s 轮询。
- 群销毁/目录切换仍走群内 AgentPanel（已有 `/destroy` 与 `/cwd`），DSH 页暂不重复放危险操作。

### 打包不再要求本机安装 dsh

- `prepare-dsh-runtime.js` 不再依赖 `npm root -g` 的 dsh，也不再要求 `~/.dsh/profiles/wildfire`。
- DSH 核心缺省从 npm 临时安装到 `build/.dsh-deps`（`@deepseek-ai/dsh@0.2.0-rc.2`，可用 `DSH_VERSION` 覆盖）；也可用 `DSH_SOURCE` 指向已有副本。
- profile 使用仓库内的 `build/dsh-profile-template`（约 3.8MB，已含 wildfire 插件及其 node_modules），不再从宿主机复制。
- Node 使用构建机的 Node >=22.19（或 `DSH_NODE_BINARY`）；构建机首次需要网络下载 dsh 包，CI 可缓存 `build/.dsh-deps`。
- 目标平台的原生模块必须在对应平台构建；交叉编译请使用目标平台 CI 或预置目标 runtime。

### 宿主机隔离审计（打包版）

- 运行时只用 `Resources/dsh-runtime/node` + `Resources/dsh-runtime/dsh`；缺 runtime 直接报错，不再回退宿主机 `dsh`。
- `DSH_HOME` 固定为 `userData/dsh-home`；忽略宿主机 `DSH_HOME`，只保留本应用显式 `WF_DSH_HOME` 覆盖。
- 忽略宿主机 `DSH_PROFILE` / `DSH_COMMAND`；只使用 `WF_DSH_PROFILE` / `WF_DSH_COMMAND` 显式覆盖。
- bundled profile 在 prepare 时清理：`cordis.patch.yml.bak-*`、`pnpm-lock`、`.pnpm`、旧 `llm-pi-ai`、真实 gateway/robotSecret、宿主机 workspace 路径；写入干净的 profile patch。
- 不继承宿主机 `DEEPSEEK_API_KEY`；内置 `llm-deepseek` / `llm-deepseek-account` 关闭。
- 已用 `DSH_HOME=/Users/rain/.dsh DSH_PROFILE=hostprofile` 启动打包版验证：实际使用 `Resources/dsh-runtime` 和临时 `userData/dsh-home`，未读宿主机 `~/.dsh`。
- 仍保留的宿主机依赖：构建时运行 `prepare-dsh-runtime` 需要本机 dsh/profile；Agent shell 工具仍使用系统 PATH 里的 git/python 等 OS 命令，这不是 DSH runtime/home 共用。

### dsh-plugin（`../robot-gateway/dsh-plugin.js`）

- 新增 `src/multiRobot.ts`：
  - 群 `extra.wfds.robots` 解析、15s 缓存。
  - @mention 路由：只处理 @ 自己的；@ 别人的忽略。
  - 机器人消息默认忽略；owner 的 `assign` 指向自己时例外。
  - 无 @ 时：owner 规则路由（tags 命中则可见 `@target` 指派，否则 owner 自己回）；guest 静默。
  - 210 `AGENT_METADATA`：guest 上报 section，owner 合并写 `extra` 并 ack。
- `src/inbound.ts`：
  - 接入多机器人路由；`forceProcess` 绕过群触发；assign 绕过白名单。
  - `/create`、`/bind-workspace` 后写入 `extra.wfds.robots[robotId]`（owner）或向 owner 上报（guest）。
  - 210 消息在类型过滤之前处理。
- 构建：`npm run build` 通过。

## 2. 构建验证

本轮（权限体系）验证：

```bash
cd ../robot-gateway/dsh-plugin.js && npm run build          # tsc 通过
cd vue-pc-chat && npx vue-cli-service build                  # renderer 通过
CSC_IDENTITY_AUTO_DISCOVERY=false npx vue-cli-service electron:build --dir  # 主进程/打包通过
npm run prepare-dsh-runtime                                  # 621MB，内置新插件
```

- `build/dsh-runtime` 冒烟：用假 gateway（`ws://127.0.0.1:1`）+ 权限 overlay 启动，日志出现 `plugin loaded` / `approval answerer registered`，随后按预期重连失败，无配置解析错误。
- 打包产物 `dist_electron/mac-arm64/野火IM.app/Contents/Resources/dsh-runtime` 含 `VERSION` 与新插件 `dist`。
- 权限单测（Node 直接导入 `dist/access.js`）：owner 私聊通过、陌生人拒绝、legacy 默认保持放行。
- 审批/审计单测（Node 直接导入 `dist/interactive.js` / `dist/audit.js`）：guest 不能审批自己发起的写操作、owner 可以；`approval.requested` / `interaction.denied` / `approval.decided` 均落审计；JSONL 权限 0600。
- 后端 `mvn test` / `mvn -DskipTests package` 通过，`target/app-0.75.jar` 生成；应用服务已无机器人/AI 代码。
- AI Agent 服务 `mvn test` 9 个用例通过（JPA 配置优先级/加密、IM authCode 自动建用户、客户端 Key 轮换、Shiro 登录/CSRF/权限、合并 `/provision`、代理计量、IM Admin mock 机器人开通）。

历史验证：

```bash
# PC renderer
cd vue-pc-chat
npx vue-cli-service build

# PC Electron packaging (dir)
npx vue-cli-service electron:build --dir

# dsh plugin
cd ../robot-gateway/dsh-plugin.js
npm run build
```

结果：

- Renderer 构建通过（仅原有 pinyin/jieba 可选依赖 warning）。
- Electron main/preload 打包通过（仅 ws 可选依赖 warning）。
- dsh-plugin tsc 通过。

应用服务没有 Maven wrapper jar / 系统 mvn，使用 `javac` 对新文件做了编译验证；完整 Spring Boot 启动需要部署环境的 Maven/依赖。

另外对 macOS 打包产物做了启动冒烟：应用窗口/主进程正常启动，未因 DSH 初始化崩溃；未配置 AI 服务时 provision 会提示先连接 AI 服务。

**自包含 runtime 冒烟已通过**：用 `DSH_DEV_PROVISION` 指向假 provision 启动打包后的 app，日志显示：

```text
materialized bundled profile wildfire -> .../dsh-home/profiles/wildfire
starting: .../Resources/dsh-runtime/node/bin/node .../Resources/dsh-runtime/dsh/lib/bin.js --profile wildfire ...
[wildfire] plugin loaded
```

说明空白电脑不需要预装 Node/DSH/插件；runtime 已随 app 分发，profile 首次解压到 `userData/dsh-home`。插件 `npm pack` 已更新 `wildfirechat-dsh-wildfire-0.2.0.tgz`。

## 2.1 打包自包含 runtime

```bash
# 在目标平台（Node 22.19+，已安装 dsh 和 wildfire profile）执行
npm run prepare-dsh-runtime

# 可选：自定义源
DSH_NODE_BINARY=/path/to/node \
DSH_SOURCE=/path/to/@deepseek-ai/dsh \
DSH_PROFILE_SOURCE=$HOME/.dsh/profiles/wildfire \
npm run prepare-dsh-runtime

# 本地无签名冒烟
CSC_IDENTITY_AUTO_DISCOVERY=false npx vue-cli-service electron:build --dir
```

说明：

- `prepare-dsh-runtime` 会把本地 `dsh-plugin.js/dist` 覆盖进 bundled profile，避免 profile 里残留旧插件。
- runtime 约 620MB（Node ~112MB + DSH ~505MB + profile ~4MB），安装包会相应变大。
- 生产必须对 Node 二进制和所有 `.node` 做签名/公证；`npm run package` 现在按本机架构（`process.arch`，可用 `MAC_ARCH` 覆盖）打包，不再默认 universal，因为内置 Node 是单架构。
- `vue.config.js` 的 `signIgnore` 跳过 DSH runtime 中的字体 trie/JS 等非 Mach-O 二进制和 `extraResources` 图标，避免 osx-sign 把数据文件当代码签名；`.node/.dylib/.so` 仍会签名。
- universal 需要同时准备 arm64/x64 两套 Node 与原生模块，当前不作为默认；Intel 包请在 Intel 机器/CI 上执行 prepare+package。
- `DSH_DEV_PROVISION=/path/to/provision.json` 是开发/冒烟 hook，生产不会设置。

## 3. 联调前置

1. AI Agent 服务配置：
   ```properties
   IM_ADMIN_URL=http://your-im:80
   IM_ADMIN_SECRET=...
   ROBOT_GATEWAY_URL=ws://your-gateway:8884/robot/gateway
   ROBOT_CALLBACK_URL=http://your-gateway:8885/robot/recvmsg
   PUBLIC_BASE_URL=https://ai.example.com
   ```
2. IM Admin API 可用（`IM_ADMIN_URL`/`IM_ADMIN_SECRET`），AI 服务能访问。
3. 本机安装 DSH 22.19+，并准备 `wildfire` profile（含 `@wildfirechat/dsh-wildfire` 插件）。
4. 将本仓库 `dsh-plugin.js` 重新 build/pack/安装到 profile，确保使用新代码。
5. 启动 PC 客户端并登录，观察 `userData/logs/dsh-host.log` 与 DSH 日志。

## 4. 已知缺口 / 下一步

1. **Host runtime 发布**：本地已用 `scripts/prepare-dsh-runtime.js` 生成并验证；发布流水线需在每个目标平台运行该脚本（不能用 macOS 的 Node 二进制打 Windows 包），并对 `dsh-runtime/node` 与所有 `.node` 文件做签名/公证。
2. **owner 路由仍是规则版**：按 tags 命中；尚未接小模型 router。tags 目前可通过 `WF_DSH_TAGS` 环境变量注入。
3. **guest 元数据上报是 best-effort**：210 set/ack 已实现，但没有重试/回读确认；owner 离线时 guest section 不会更新。
4. **assign 的原始消息**：文本路径已通过 `messageUid` 回取；图片/文件/引用附件尚未完整回放。
5. **工作区聚合**：AI 页按 workspace 分组；主 IM 会话列表增加了 workspace 筛选 chips + 每个会话的 workspace/多机器人徽标，未插入虚拟列表分组标题。
6. **DSH profile 依赖**：Host 默认使用 `DSH_PROFILE=wildfire` 和 `~/.dsh`；生产需要固定 profile 并随包分发。
7. **端到端未跑**：没有真实 gateway/机器人凭据，未验证 provision → Host → gateway → 群消息全链路。
8. **机器人开通端到端未跑**：AI 服务的 IM Admin 机器人接口已用 mock 单测验证，但还没有真实 IM/gateway 凭据做 provision → Host → 群消息全链路。

## 5. 建议的明早验证顺序

1. 启动/部署 `im-app_server`、`ai-agent-server`，在客户端「AI 服务」填写地址并连接（authCode 自动获取），确认 AI 服务 `/provision` 返回 robot + config，Host 正常启动。
2. 看 `userData/dsh-host.log` 是否出现 `starting: dsh ...`，机器人是否在 IM 在线。
3. 在 line2 群发消息，确认机器人回复；`/create` 建群后确认群 `extra.wfds.robots` 写入。
4. 再邀请第二个机器人进群，确认 guest 210 上报、owner `extra` 合并、无 @ 时 owner 回复/指派、@ 时目标回复。
