# DeepSeek Harness 野火IM 插件

将野火IM 作为 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（`dsh`）的一个消息渠道：用户通过野火IM 客户端与机器人对话，消息进入 DSH Agent 执行，Agent 回复（含流式输出）实时回传。

> 本插件依赖 [robot-gateway](https://github.com/wildfirechat/robot-gateway)，请先部署 robot-gateway，并在野火IM 中创建机器人（可参考 BotFather 功能自动创建）。

设计文档：[DSH_INTEGRATION.md](../DSH_INTEGRATION.md)

## 版本兼容性（dsh）

| dsh 版本 | 状态 | 说明 |
| --- | --- | --- |
| **0.2.1-rc.2** | ✅ 已实测 | preset 服务改用 `@deepseek-ai/dsh-agent-preset-registry`（服务名/API 不变）；preset 定义由 `build-deploy.sh` 的 `scripts/enable-presets.mjs` 写入 profile（无需 `--patch`）；会话日志为 `session.v4.jsonl.zstd`，`sessionPersistence` 改用 `open(id,"read")`+`handle.read()` |
| 0.2.0-rc.2 | ✅ 已实测 | 同上 |
| **0.1.5-rc.3** | ✅ 已实测 | 流式走 `agent/assistant-stream`；`userQuestions` 走瀑布流；preset 需自行组成（见下） |
| 0.1.2-rc.1（npm `latest` / `next`） | ✅ 已实测 | `userQuestions` 走 Agent 作用域瀑布流 `user-questions/request` |
| 0.1.1-rc.2 / 0.1.1-rc.1 / 0.1.0-rc.7 | ✅ 已实测 | 走旧的 `userQuestions.registerProvider()`；流式走会话事件 `assistant/chunk` |
| 0.1.3+（含 alpha） | ✅ 已适配 | 会话事件 `assistant/chunk` 被移除，改为 process-local 的 `agent/assistant-stream`；插件两条路径都接，按 `(attemptId, index)` 去重 |

插件在运行时按能力探测选择接口，**一份构建同时兼容新旧 dsh**：

- `ctx.userQuestions.registerProvider()` 存在（≤ 0.1.1-rc.2）→ 注册 UI provider；
- 不存在（≥ 0.1.2-rc.1）→ 在根 context 监听 `user-questions/request` 瀑布流；不属于本机器人的请求调用 `next()` 让给其它 answerer（例如 Web GUI）；
- 流式增量：老版本读会话事件 `assistant/chunk`，新版本（≥ 0.1.3）监听 `agent/assistant-stream` 并把 `text-delta` 帧合成为同构事件复用同一套推送逻辑（根 ctx 监听器即可收到 scoped 分发）；按 `(attemptId, index)` 去重防 revision 重放，帧缺这两个字段时不做去重、直接转发。

`package.json` 的 peerDependencies 按「小版本行」逐条列出（node-semver 对预发布版本的匹配规则很严格：版本带 prerelease 时，只有同 `major.minor.patch` 且带 prerelease 的比较符才算匹配，`>=0.1.0-rc.7`、`*` 之类都匹配不到 `0.1.5-rc.3`）。

> **IM 专用 profile 的 preset 组成**：若 profile 只挂 `dsh-base` 并禁用了 base 的工具行（改由 preset 挂载），必须自行补上 preset 服务及其依赖的 Host 模块（例如 `@deepseek-ai/dsh-tool-subagent/model-selection-settings`），否则 preset 挂载失败、agent 会**没有任何工具**。插件启动时会校验 preset 是否存在（error 级报出可选值），挂载失败时还会向该会话发一次 IM 告警。
>
### 升级 dsh 到最新版

```bash
# 1. 升级 CLI（本机全局安装在 nvm 目录且属主是 root，需要 sudo）
sudo npm install -g @deepseek-ai/dsh@0.2.1-rc.2
dsh --version

# 2. 重新部署插件（SKIP_RESTART=1 只安装不重启）
cd dsh-plugin.js && SKIP_RESTART=1 ./build-deploy.sh wildfire   # 或 web

# 3. 重启（会中断正在进行的会话；web profile 按端口定位 PID，
#    实测该进程命令行对 pgrep/pkill 不可见，只能按 PID 杀）
kill $(lsof -nP -iTCP:3080 -sTCP:LISTEN -t)
cd /Users/rain/Workspace/robot-gateway && \
  nohup node "$(command -v dsh)" --profile web >> ~/.dsh/dsh-wildfire.log 2>&1 &
```

> 升级后 `~/.dsh/profiles/node_modules` 里的符号链接会在首次启动时自动指向新 CLI 安装目录（dsh 自己托管该目录）；若启动报缺包，`rm -rf ~/.dsh/profiles/node_modules` 后重启即可。

## 测试

### 1. 自动自检（推荐：离线、不碰生产）

```bash
cd dsh-plugin.js
./scripts/compat-check.sh                  # 用 PATH 上的 dsh
./scripts/compat-check.sh --no-probe       # 跳过瀑布流探针
./scripts/compat-check.sh /path/to/bin/dsh # 指定其它版本 dsh 验证
```

在临时 `DSH_HOME` 里用**假网关**（`ws://127.0.0.1:1`）启动插件并断言：

- `plugin loaded`，无 `Cannot find package` / `plugin tree failed to load`；
- `userQuestions` **只走一条**注册分支：≤ 0.1.1-rc.2 → `registerProvider`；≥ 0.1.2-rc.1 → `waterfall user-questions/request`；
- 探针调用 `ctx.userQuestions.ask()` → 插件先收到、对非本机器人会话调用 `next()`，探针 answerer 拿到请求并返回（`PROBE_REACHED` + `ASK_RESOLVED`），证明瀑布流链路与「让行」语义正确。

不接触 `~/.dsh`、不连真实网关、不影响运行中的实例；退出码 0=通过 / 1=失败（打印日志尾部）。

### 2. 手工端到端（野火 IM）

| 测试点 | 操作 | 预期 |
| --- | --- | --- |
| **ask_user 走 IM 卡片**（本次修复） | IM 里发：「用 ask_user_question 问我：咖啡还是茶？选项：咖啡/茶，别自己回答」 | 收到 DSH_Question 卡片；点选项或直接回文字；Agent 带答案继续 |
| 流式回复 | 问一个需要较长输出的问题 | 气泡逐字更新（≤0.1.2 走 `assistant/chunk`，≥0.1.3 走 `agent/assistant-stream`） |
| 权限审批 | 让 Agent 做一个需要审批的操作 | 收到 DSH_Approval 卡片，回「批准/拒绝」后继续 |
| 会话保持 | 重启 dsh 后继续同一会话 | 上下文仍在（走 `resume`） |
| 停止指令 | 发送「不要回复」类消息 | 气泡被取消（type 20），无正文 |

### 3. 日志确认

启动日志（dsh 的 stdout/stderr；用 `build-deploy.sh` 启动时在 `~/.dsh/dsh-wildfire.log`）应出现：

```
[wildfire] plugin loaded
[wildfire] userQuestions answerer registered (waterfall user-questions/request; ask_user via IM)
[wildfire] approval answerer registered (approvals via IM)
```

看到 `userQuestions provider registered (registerProvider; ...)` 说明跑的是 ≤ 0.1.1-rc.2 的旧 dsh，属正常分支（不是 bug）。

## 架构

```
野火客户端 ──► 野火IM ──► robot-gateway(:8884 WebSocket)
                                  │
                                  ▼
        dsh 进程（--profile web）内：本插件（Cordis plugin）
              │                              │
              │ RobotServiceClient           │ ctx.agents + session/event
              ▼                              ▼
        野火网关 SDK               DSH Agent（模型 + 工具 + goal）
```

## 安装

> **前置要求**：`dsh plugin` 依赖 [pnpm](https://pnpm.io/)（等价于在 profile 目录执行 `pnpm add`）。未安装时先 `npm install -g pnpm`（或 `corepack enable pnpm`），否则 `dsh plugin` 报 `pnpm not found on PATH`。

> **SDK 版本说明**：状态/进度推送依赖 `RobotServiceClient.updateConversationUserSetting`，该方法尚未发布到 npm。当前 `package.json` 以 `file:../client.js` 引用本仓库的本地 SDK 源码；待 SDK 新版本（≥1.0.6）发布后改回版本号依赖。**SDK 发布前**，`npm pack` 产物的 `file:../client.js` 相对依赖在安装侧（profile 目录）无法解析，需先按下面步骤 **1b** 改为本仓库绝对路径；SDK 发布后删除 1b 即可。

```bash
# 1. 构建并打包
cd dsh-plugin.js
npm install
npm run build
npm pack

# 1b. （仅 SDK 未发布时需要）把包内 SDK 依赖改为本仓库绝对路径
mkdir -p /tmp/wf-pack && tar -xzf wildfirechat-dsh-wildfire-0.1.0.tgz -C /tmp/wf-pack
node -e 'const fs=require("fs"),path=require("path");const p="/tmp/wf-pack/package/package.json";const j=JSON.parse(fs.readFileSync(p,"utf8"));j.dependencies["@wildfirechat/robot-gateway-client-sdk"]="file:"+path.resolve("../client.js");fs.writeFileSync(p,JSON.stringify(j,null,2)+"\n")'
cd /tmp/wf-pack && tar -czf wildfirechat-dsh-wildfire-0.1.0-local.tgz package && cd -

# 2. 安装到 dsh web profile
#    SDK 已发布时用原始 tgz；未发布时用 1b 生成的 -local tgz
dsh plugin --profile web add ./wildfirechat-dsh-wildfire-0.1.0.tgz

# 3. 激活并配置：编辑 ~/.dsh/profiles/web/cordis.patch.yml，追加：
# - insert:
#     - id: wildfire
#       name: '@wildfirechat/dsh-wildfire'
#       config:
#         gatewayUrl: ws://your_gateway_host:8884/robot/gateway
#         robotId: your_robot_id
#         robotSecret: your_robot_secret

# 4. 启动（若 dsh web 已在运行，必须先停掉再启动，插件才会加载）
#    web profile 监听 3080，按端口反查 PID 最可靠
kill $(lsof -nP -iTCP:3080 -sTCP:LISTEN -t)
dsh web
```

## 部署形态（web GUI 与 IM 不是二选一）

### 常见问题：`dsh` 命令找不到 / 如何后台运行

`npx @deepseek-ai/dsh web` 只是临时执行，**不会安装 `dsh` 命令**（所以 `dsh --version` 报 command not found）。建议全局安装：

```bash
npm install -g @deepseek-ai/dsh
dsh --version   # 确认可用（nvm 用户 bin 在 ~/.nvm/versions/node/<ver>/bin）
```

后台运行（机器人需 7×24 在线）：

```bash
# 简单方案
nohup dsh web > ~/.dsh/dsh-web.log 2>&1 &
tail -f ~/.dsh/dsh-web.log      # 查看启动日志
pkill -f "dsh web"              # 停止

# 不全局安装时的等价写法（--yes 跳过 npx 交互确认）
nohup npx --yes @deepseek-ai/dsh web > ~/.dsh/dsh-web.log 2>&1 &
```

macOS 建议用 launchd 开机自启（模板见 [DSH_INTEGRATION.md 部署章节](../DSH_INTEGRATION.md)），Linux 用 systemd。

- **并存模式**（`dsh web` profile + 本插件）：浏览器 GUI 与 IM 同时可用，**会话互通**（GUI 可查看/代答 IM 会话）。但 ask_user 提问、plan 审阅、工具审批归**浏览器**（无浏览器时挂起）；模型/工具/goal/流式回复两面共享
- **IM 专用模式**（自定义 profile，无 GUI）：提问/审批/plan 审阅**全部走 IM**，无人值守可用

### 常见问题：`dsh web` 启动了，但野火插件没有加载？

**profile 隔离**：DSH 的插件配置按 profile 隔离——插件包装在哪个 profile 的 `node_modules`、
patch 配在哪个 profile 的 `cordis.patch.yml`，就只在那个 profile 启动时加载。
`dsh web` 等价于 `dsh --profile web`，只加载 **web profile** 的 bundles 与 patch，
**不会**自动带上 `wildfire` profile（或其他 profile）里配置的插件。所以：

- 只在 `~/.dsh/profiles/wildfire` 配置过插件时，`dsh web` 起来后插件不会加载——这是预期行为；
- 让 `dsh web` 同时带起插件，需把插件也装进 web profile 并在其 patch 层激活：

```bash
# 1. 在 web profile 里安装插件包（等价于 pnpm add）
dsh plugin --profile web add ./wildfirechat-dsh-wildfire-0.1.0.tgz

# 2. 激活：编辑 ~/.dsh/profiles/web/cordis.patch.yml，insert 插件行 + tool-ask-user
#    （配置与 wildfire profile 相同，见下）

# 3. 停旧进程（同一 robotId 只允许一个连接），重启
pkill -f "dsh --profile wildfire"
dsh web
# 日志出现 [wildfire] connected as <robotId> 即加载成功
```

可用 `dsh --profile web --dump-config | grep wildfire` 检查插件行是否已就位。

### 切换到 IM 专用模式（3 步）

```bash
# 1. 创建 wildfire profile 并安装插件（自动初始化，bundles 默认 [dsh-base]）
dsh plugin --profile wildfire add ./wildfirechat-dsh-wildfire-0.1.0.tgz

# 2. 迁移配置：把 web profile 的插件配置复制过来
cp ~/.dsh/profiles/web/cordis.patch.yml ~/.dsh/profiles/wildfire/cordis.patch.yml

# 3. 停掉 web profile 进程，启动 IM 专用 profile
dsh --profile wildfire
```

**版本要求**：本插件 0.2.0 起同时适配 dsh 0.1.x 与 0.2.x（`peerDependencies` 声明）；dsh 0.2 起 preset 服务改由 `@deepseek-ai/dsh-agent-preset-registry` 提供（旧包 `@deepseek-ai/dsh-agent-presets` 已不存在），且 dsh 会**拒绝加载 peerDependencies 不匹配的插件**（日志：`incompatible with dsh …`）——升级 dsh 后请同步安装匹配的插件版本。

**自动启用（推荐，0.2.0 起）**：`build-deploy.sh` 默认执行 `scripts/enable-presets.mjs`，把「禁用 agent 平面行 + `agent-preset-registry` + 4 个官方 preset 定义（standard/ptc/minimal/cordis）+ 创造模式所需的两个 Host 行（`cordis-host-runner`、`cordis-inspect-providers`）」写进 profile 的 `cordis.patch.yml`（禁用清单与 preset 定义从已安装的 `dsh-web-app` bundle 抄取）。同时会把其它 profile 的 `vendor/*/cordis.patch.yml` 里声明的**自定义 preset**（如 `wfim-deploy-advisor` / `wfim-deploy-customer`）一并带过来（skills 在共享的 `$DSH_HOME/skills`，无需重复安装）。因此**装好插件并重启后，IM 面板的「Agent 模式」直接可选（含自定义档位）**，无需手工改 YAML。脚本幂等（每次按最新规则重建该块），写入前备份 `cordis.patch.yml.bak-<时间戳>`；不想用 preset 模式（工具来自 dsh-base 全局行，面板档位选择器会禁用）时：

```bash
ENABLE_PRESETS=0 ./build-deploy.sh wildfire
```

下面是该脚本自动完成的等价手工步骤（便于理解/排查）。

**重要**：IM 专用 profile 只加载 `dsh-base`，需要显式配置四件事，否则功能缺失：

1. `dsh-tool-ask-user` 不在任何 bundle 内，不启用则 Agent 没有 `ask_user` 工具（提问退化为模型直接发文本）；
2. **`agent-presets` 服务**：dsh 0.1.5 起「工具/prompt/委托后端」由 **agent preset**（能力档位：`standard`/`minimal`/`ptc`/`cordis`）按会话挂载，AI 面板的档位切换依赖它；
3. 与 2 配套，必须**禁用 dsh-base 的 agent 平面行**（`tool-bash`/`tool-fs`/`tool-skill`/`tool-goal`/`plan-mode`/`compaction-basic`/`tool-subagent*`/`tool-workflow`/`agent-instructions`/`tool-todo`/`tool-web` 等），否则会与 preset 内的同名工具**重复注册**。`dsh-web-app` bundle 自带这套禁用清单，IM 专用 profile 需手动抄一份。
4. **Host 侧 typert 模块 `subagent-model-selection-settings`**：standard preset 内的 `tool-subagent` 依赖它，缺失会导致整条 `delegation` 组（含 subagent/workflow）挂载失败 → **整个 preset 挂载失败 → agent 无任何工具**（日志：`requires ... in the Host scope` + `published without joining an agent preset`）。该行同样原本由 `dsh-web-app` 提供，IM 专用 profile 必须显式补上。

`~/.dsh/profiles/wildfire/cordis.patch.yml` 完整示例（禁用清单 + 四个 insert）：

```yaml
# ── 禁用 agent 平面行（与 dsh-web-app 的清单一致）──
- id: tool-plugin-manager
  disabled: true
- id: tool-bash
  disabled: true
- id: tool-pwsh
  disabled: true
- id: tool-jobs
  disabled: true
- id: tool-fs
  disabled: true
- id: tool-fs-search
  disabled: true
- id: skill-filesystem
  disabled: true
- id: tool-skill
  disabled: true
- id: command-goal
  disabled: true
- id: tool-goal
  disabled: true
- id: plan-mode
  disabled: true
- id: compaction-basic
  disabled: true
- id: command-compact
  disabled: true
- id: tool-result-pruner
  disabled: true
- id: tool-subagent-control
  disabled: true
- id: tool-subagent-list-agents
  disabled: true
- id: tool-subagent
  disabled: true
- id: tool-subagent-fork
  disabled: true
- id: workflow-ptc
  disabled: true
- id: tool-workflow
  disabled: true
- id: tool-ralph
  disabled: true
- id: agent-instructions
  disabled: true
- id: tool-todo
  disabled: true
- id: tool-web
  disabled: true

- insert:
    # Host 侧 typert 模块：standard preset 内的 tool-subagent 依赖它。
    # 缺失时报 "tool-subagent: `modelSelectionSettings` requires
    # @deepseek-ai/dsh-tool-subagent/model-selection-settings in the Host scope"
    # → delegation 组挂载失败 → 整个 preset 挂载失败 → agent 无任何工具。
    # 该行原本由 dsh-web-app bundle 提供，IM 专用 profile 必须显式补上。
    - id: subagent-model-selection-settings
      name: '@deepseek-ai/dsh-tool-subagent/model-selection-settings'
    # preset 注册表：dsh 0.2 起由 dsh-agent-preset-registry 提供 agentPresets 服务
    # （0.1.x 用 @deepseek-ai/dsh-agent-presets，0.2 起该包已不存在）
    - id: agent-preset-registry
      name: '@deepseek-ai/dsh-agent-preset-registry'
      config:
        default: standard
    - id: tool-ask-user
      name: '@deepseek-ai/dsh-tool-ask-user'
    - id: wildfire
      name: '@wildfirechat/dsh-wildfire'
      config:
        gatewayUrl: ws://...
        robotId: ...
        robotSecret: ...
        workspace:
          root: /Users/rain/Workspace
```

> 如果只想要「能跑」而不需要档位切换：也可以不启用 preset，此时工具直接来自 dsh-base 的全局行（保持上面 insert 里去掉 `agent-presets`、也**不要**加禁用清单）——两种模式二选一，**不可混用**（混用会导致同名工具重复注册）。此模式下 AI 面板的「Agent 模式」选择器会显示为禁用。

验证：日志出现 `agent preset mounted: standard (key=wildfire:group:...)`（preset 模式）、`userQuestions answerer registered (waterfall user-questions/request; ask_user via IM)` 与 `approval answerer registered`；Agent 的提问与审批消息出现在 IM 会话中。回切并存：停 wildfire profile，改跑 `dsh web`。

详见 [DSH_INTEGRATION.md 部署模式](../DSH_INTEGRATION.md)。

## 配置

| 配置项 | 必填 | 说明 |
|--------|------|------|
| `gatewayUrl` | 是 | 野火机器人网关 WebSocket 地址 |
| `robotId` | 是 | 机器人 ID |
| `robotSecret` | 是* | 机器人密钥；推荐改用 `robotSecretEnv` |
| `robotSecretEnv` | 否 | 从该环境变量读取 `robotSecret`（桌面端用 `WF_ROBOT_SECRET`），避免密钥落盘 |
| `gatewayPlatform` | 否 | 机器人平台号（**可选覆盖**，一般不需要配置）：默认 SDK 按运行环境自动探测（Linux=`7` / macOS=`4` / Windows=`3`，见野火 Platform）。网关用该平台调用 im-server `/robot/set_online` 设置机器人在线；仅当需模拟其他平台（如 `5`=WEB）时配置 |
| `aiLine` | 否 | AI 会话使用的线路（line），默认 `2`。设计：**单聊（与机器人私聊）= 全局控制面板**（管理命令，不进入 AI）；**AI 对话仅限群聊会话 line === aiLine**（默认 2）。群聊消息若线路不对（如 line 0 普通群）会回复提醒且不进入 AI；回复始终发到消息来源的会话线路 |
| `asrServer` | 否 | 语音转文字服务地址，配置后语音消息先转文字再进入 Agent |
| `mainSession.enabled` | 否 | 启用**主会话**：owner 私聊 + line0 普通群（非 DSH 群）共用同一个 dsh 会话。默认 `false`（桌面端注入 `true`） |
| `mainSession.groups` | 否 | 允许旁观的群 ID 列表（支持 `*`）；为空 = 所有非 DSH 群 |
| `mainSession.workspace` | 否 | 主会话工作目录，默认 `<dshHome>/main-workspace` |
| `mainSession.bufferLimit` | 否 | 每个群保留的最近消息条数，默认 200 |
| `mainSession.injectLimit` | 否 | 每回合注入的群聊上下文条数，默认 30 |
| `mainSession.notify` | 否 | 命中相关性时私聊提醒 owner，默认 `true` |
| `mainSession.notifyCooldownMs` | 否 | 同一个群的提醒冷却（毫秒），默认 600000（10 分钟） |
| `mainSession.notifyKeywords` | 否 | 额外的相关性关键词（命中即提醒） |
| `mainSession.groupReply` | 否 | owner 在群里 @ 机器人时的回复目标：`group`（默认，群里回）或 `owner`（私聊回） |
| `mainSession.history.enabled` | 否 | 把旁观的群消息按天/群写入历史 Markdown 文件，默认 `true` |
| `mainSession.history.dir` | 否 | 历史目录，默认 `<workspace>/group-history` |
| `mainSession.history.retainDays` | 否 | 历史保留天数，`0` = 永久保留（默认） |
| `requireMention` | 否 | 群聊触发模式：默认 `false` = 群内所有消息触发（无需@）；`true` = 需@或问号/关键词触发 |
| `helpKeywords` | 否 | 群聊触发关键词（逗号分隔），默认 `帮,请,分析,总结` |
| `whiteList.enabled` | 否 | 是否启用白名单，默认 `false` |
| `whiteList.allowedUsers` | 否 | 允许的用户 ID 列表 |
| `whiteList.allowedGroups` | 否 | 允许的群组 ID 列表 |
| `whiteList.deniedMessage` | 否 | 未授权时的回复文案 |
| `whiteList.includeOwner` | 否 | 机器人 owner 自动放行（经 `getProfile()` 获取），默认 `true` |
| `whiteList.persistFile` | 否 | 动态 `/allow` 名单持久化文件，默认 `<dshHome>/wildfire-allowlist.json`（`$DSH_HOME` 优先，否则 `~/.dsh`） |
| `session.idleTimeoutMs` | 否 | 会话空闲回收时间，默认 24h |
| `session.maxSessions` | 否 | 最大并发 Agent 会话数，默认 200 |
| `session.preset` | 否 | 每个 IM agent 挂载的 dsh agent-preset id，**默认 `standard`（无需配置即可用）**——功能完整的编码 Agent（bash/fs/skill/goal/plan/subagent 等全套工具）。背景：web profile 下 dsh-base 全局工具被 `dsh-web-app` 禁用、改由 preset 按会话挂载，插件已自动为每个 agent 挂载该默认 preset；仅需更换 preset 时才配置此项 |
| `streaming.throttleMs` | 否 | 流式推送节流（毫秒），默认 300 |
| `streaming.initialPlaceholder` | 否 | 占位消息文本，默认 `…` |
| `workspace.mode` | 否 | 工作目录模式：`global`（默认）/ `per-session` / `mapped` |
| `workspace.path` | 否 | 全局工作目录，默认 `process.cwd()`（DSH 进程启动目录） |
| `workspace.sessionDir` | 否 | `per-session` 模式的父目录，每个会话独立子目录 |
| `workspace.map` | 否 | `mapped` 模式：会话键（或裸用户/群 ID）→ 目录映射 |
| `workspace.allowedRoots` | 否 | 安全围栏：所有工作目录必须位于这些根目录内 |
| `workspace.root` | 否 | **项目根目录**：所有项目都在此目录下。`/cwd` 的相对路径按此解析、`/create-group auto` 自动目录也在此之下、`/ls` 默认列此目录。未配置时回退：`autoRoot` → 第一个 `allowedRoot` → `path` |
| `workspace.allowCwdCommand` | 否 | 允许 `/cwd`、`/ls` 命令（私聊+群聊，按权限），默认 `false` |
| `workspace.persist` | 否 | 持久化 `/cwd` 绑定到磁盘，默认 `true` |
| `workspace.persistFile` | 否 | 持久化文件，默认 `<dshHome>/wildfire-workspaces.json`（`$DSH_HOME` 优先，否则 `~/.dsh`） |
| `access.adminUsers` | 否 | 管理员用户 ID 列表（门控管理命令、审批） |
| `access.adminGroups` | 否 | 管理员群组 ID 列表 |
| `access.groupOwnerCanManage` | 否 | 群主可在本群执行 `/cwd`（需机器人入群），默认 `true` |
| `access.privateOwnerOnly` | 否 | 私聊仅 owner/管理员可用，默认 `false`（桌面端注入 `true`） |
| `model.default` | 否 | 默认模型预设 ID；省略则用 DSH 当前选择 |
| `model.allowed` | 否 | 可选：模型预设快捷方式 `{ id: { provider, model, reasoningEffort? } }`（主路径为 `/model` 的运行时目录，预设仅作快捷方式） |
| `model.map` | 否 | 按会话键（或裸用户/群 ID）固定模型预设 |
| `model.allowModelCommand` | 否 | 允许私聊 `/model`、`/effort` 命令，默认 `false` |
| `media.downloadDir` | 否 | 入站媒体临时目录，默认 `/tmp/wildfire-media` |
| `media.outboundEnabled` | 否 | 解析回复中的 `[image:path]`/`[media:path]` 标记并发送媒体，默认 `true` |
| `interaction.askUserEnabled` | 否 | 注册 userQuestions provider（Agent 提问→IM 回答），默认 `true` |
| `interaction.approvalEnabled` | 否 | 注册审批 answerer（工具审批→IM 同意/拒绝），默认 `true` |
| `interaction.askUserTimeoutMs` | 否 | 提问等待超时，默认 300000 |
| `interaction.approvalTimeoutMs` | 否 | 审批等待超时，默认 120000 |
| `interaction.approvedLabel` | 否 | 放行关键词，默认 `同意` |
| `interaction.deniedLabel` | 否 | 拒绝关键词，默认 `拒绝` |
| `interaction.approvalOwnerOnly` | 否 | 群内敏感操作由机器人 owner 审批（默认 `false`：任务发起人审批；桌面端注入 `true`） |
| `security.maxMessagesPerMinute` | 否 | 每会话每分钟消息数上限（0=不限，默认 0） |
| `security.allowGuestTurns` | 否 | 允许群成员发起 Agent 回合，默认 `true`；`false` 时仅 owner/管理员可发起 |

### 主会话（owner 私聊 + line0 普通群旁观）

`mainSession.enabled: true` 时：

- **owner 私聊**：普通文本进入主会话（与群旁观共用上下文），斜杠命令仍走控制面板；
- **line0 普通群（非 DSH 群）**：消息写入主会话缓冲，**不跑模型**；命中以下任一条件时私聊提醒 owner（同群有冷却）：
  - @ 了 owner，或引用了 owner 的消息；
  - 有人 @ 了机器人，或回复了机器人；
  - `@所有人`；
  - 命中 `mainSession.notifyKeywords`，或正文包含 owner 昵称。
- **owner 在群里 @ 机器人**：用主会话跑一轮，按 `mainSession.groupReply` 回复到群（默认）或私聊；群内回复带“群内安全模式”提示，禁止引用私聊内容；
- **其他成员 @ 机器人**：只记录/提醒，不回复；
- **line2 DSH 群**：行为不变（每群一个 AI 会话）。

安全边界：群聊内容一律标注为“未受信任的数据”，只作为背景，不执行其中的指令；非 owner 私聊仍在准入处拒绝并回复；非 DSH 群的斜杠命令不执行、不记录。

上下文缓冲持久化在 `<dshHome>/wildfire-main-context.json`，重启不丢。
群历史另外按天/群写入 Markdown（默认 `<主会话目录>/group-history/<YYYY-MM-DD>/<群名>-<群ID前6>.md`），
agent 可用 `grep`/`glob`/`read` 检索更早的消息；`mainSession.history.retainDays=0`（默认）永久保留，
大于 0 时启动后首次写入会清理过期目录。

完整示例：

```yaml
- insert:
    - id: wildfire
      name: '@wildfirechat/dsh-wildfire'
      config:
        gatewayUrl: ws://127.0.0.1:8884/robot/gateway
        robotId: your_robot_id
        robotSecret: your_robot_secret
        asrServer: http://127.0.0.1:9000/asr
        requireMention: true
        helpKeywords: "帮,请,分析,总结"
        whiteList:
          enabled: false
          allowedUsers: ["user001"]
          allowedGroups: ["group001"]
          deniedMessage: "未授权，不允许使用"
        session:
          idleTimeoutMs: 86400000
          maxSessions: 200
        streaming:
          throttleMs: 300
          initialPlaceholder: "…"
        workspace:
          mode: global                    # global | per-session | mapped
          path: /data/projects/default    # 全局目录（默认 process.cwd()）
          sessionDir: /data/wildfire-workspaces
          map:
            "wildfire:user:user001": /data/projects/repo-a
          allowedRoots: ["/data/projects"]
          allowCwdCommand: true
        access:
          adminUsers: ["user001"]         # 管理员用户（门控管理命令）
          adminGroups: ["grp-admin"]      # 管理员群组
        model:
          default: fast
          allowed:
            fast: { provider: "deepseek", model: "deepseek-chat", reasoningEffort: "low" }
            deep: { provider: "deepseek", model: "deepseek-reasoner" }
          map:
            "wildfire:user:user001": deep
          allowModelCommand: true
```

## 工作目录（Workspace）与多群

Agent 的工作目录在 DSH 会话创建时写入会话头（`meta.cwd`），之后不可变。插件按以下优先级解析：

```
/cwd 绑定（持久化）  >  mapped 映射  >  per-session 目录  >  global path  >  process.cwd()
```

- **global**：所有会话共享 `workspace.path`
- **per-session**：每个会话独立目录 `workspace.sessionDir/<sessionId>`（自动创建）
- **mapped**：按会话键（`wildfire:user:x` / `wildfire:group:x` 或裸 ID）映射到具体项目目录

### 多群场景（推荐）

每个群对应一个独立工作目录，动态绑定、重启不丢：

```
1. 野火IM 建群（如"项目A群"），把机器人拉进群
2. 群主在群里发:  /cwd /data/projects/project-a
3. 群成员 @机器人 提问 → 会话在 project-a 开启
4. 另建群同样绑定 /cwd /data/projects/project-b，互不干扰
```

`allowCwdCommand: true` 时命令（`/cwd`、`/ls` 私聊+群聊）：

| 命令 | 权限 | 行为 |
|------|------|------|
| `/cwd` | 任一准入成员 | 查询当前工作目录 + 项目根目录 |
| `/cwd <路径>` | 私聊：管理员；群聊：群主或管理员群成员 | 绑定目录（持久化），会话重置；**相对路径按项目根目录（`workspace.root`）解析**；目录不存在时发确认卡片（✅ 创建 / ❌ 取消，或自定义回答直接输入新路径）；**群聊绑定成功后机器人自动把群名改为目录最后一段**（`/a/b/c` → 群名 `c`） |
| `/cwd clear` | 同上 | 清除绑定，恢复默认 |
| `/ls [子目录]` | 任一准入成员 | 列出项目根目录（或子目录）内容；相对路径按根目录解析 |

群聊修改需**群创建者**（插件注册表记录）、**群主**（`access.groupOwnerCanManage`，默认开，通过 `getGroupInfo` 校验，机器人须在群里）或**管理员**。

## 访问权限

- **准入**（谁能触发机器人）：`whiteList`——启用时**机器人 owner 自动放行**（`includeOwner`，默认开）、静态 `allowedUsers`/`allowedGroups`、动态 `/allow` 名单任一命中即放行；未启用时全员可用。`access.privateOwnerOnly=true` 时私聊只允许 owner/管理员（不影响已注册 DSH 群成员）。
- **管理**（谁能执行命令）：`access.adminUsers` / `adminGroups` + 群创建者；未配置管理员且没有 owner 时，任一准入用户可执行（兼容旧部署）。
- **审批**（谁能点同意）：默认任务发起人；`interaction.approvalOwnerOnly=true` 时群内敏感操作由机器人 owner 审批，发起人不能自己放行。`/stop` 仅任务发起人、群创建者、owner/管理员可执行。
- **审计**：准入拒绝、管理命令、权限变更、审批请求/结果/超时写入 `<dshHome>/wildfire-audit.jsonl`（0600，2MB 轮转），桌面端在「设置 → 权限」展示。
- **遗留群处理**：插件只处理**注册表记录**的 DSH 群（防伪造）。重装 dsh / 更换机器后注册表丢失，IM 服务端会残留插件此前创建的群（机器人是群主、AI 线路）——这类"僵尸群"的消息原本会被静默忽略。插件现在对注册表未命中的群做特殊处置（判定条件：消息到达在 **AI 线路（`aiLine`，默认 2）** 且 `getGroupInfo` 确认**机器人是群主**）：
  - **普通消息** → 仅返回一条提示（说明这是遗留 DSH 群、机器人不处理、销毁/重建方式），**绝不自动销毁**；同一群 5 分钟内只提示一次；
  - **群内发送 `/destroy`**（明确销毁任务）→ 解散群 + 保留工作区目录（避免误删用户文件）+ 提示；
  - **普通用户群**（机器人非群主）→ 判定失败，完全静默。

白名单动态命令（私聊=管理员，群聊=群创建者/群主/管理员）：

| 命令 | 行为 |
|------|------|
| `/allow <userId>` | 加入白名单（持久化） |
| `/disallow <userId>` | 移出白名单 |
| `/allowlist` | 查看白名单状态 |
| `/create-group [工作区]` | 创建 DSH 工作区群（仅私聊，owner/admin；工作区三级选择：auto/目录目录/路径） |
| `/destroy-group <groupId>` | 销毁工作区群（解散群+保留目录+清注册表，仅私聊，owner/admin） |
| `/new <groupId>` | 重置指定群的会话（上下文清空，工作区保留；仅私聊，owner/admin） |
| `/workspaces` | 列出所有 DSH 工作区群（仅私聊） |
| `/jobs` | 汇总所有存活会话的后台任务（仅私聊，owner/admin） |
| `/goal <groupId> [目标]` | 查看/创建群目标（DSH_Goal 卡片） |
| `/goal <groupId> pause` / `resume` | 暂停/恢复群目标（goal 循环暂停≠停止当前任务，停止用 `/stop`） |
| `/plan [on\|off]` | 查看/开关当前会话的计划模式（私聊 admin / 群内创建者或管理员；退出计划时 plan-review 走提问卡片） |
| `/compact` | 手动压缩当前会话上下文（权限同上；回复折叠的节点/token 数） |
| `/sandbox [模式]` | 查看/切换当前会话的沙箱权限模式（与权限预设同名时 sandbox+审批一起对齐；下一次工具调用生效，随会话持久化；权限同上） |
| `/approval [ask\|never]` | 查看/设置当前会话的审批策略（`never` = 不弹审批、越权直接拒绝；权限同上） |
| `/session` | 查看当前 IM 会话对应的 dsh 会话信息：sessionId / epoch / 工作目录 / 激活状态 / 模型与推理等级（含来源）/ 沙箱与审批 / 计划模式 / 累计 token 与上下文 / 事件数 / 会话日志路径（**不创建会话**）。会话未激活（如刚重启 dsh）时仍按持久化的 `/cwd` 绑定算出真实 sessionId，并从磁盘会话日志读出模型/沙箱/审批/计划，不会显示预览 id 与部署默认值（权限同上） |

桌面客户端的「新会话」页通过 207 `op=create` 携带初始配置（`model` / `effort` /
`sandbox` / `preset`）：插件建群后、首条消息前写入会话级覆盖（模型/等级/preset
按 key 持久化，权限写会话日志），并挂一个初始化闸门——该群的首条消息会等配置
写完再 dispatch，所以第一轮就按用户的选择执行。只有 profile 启用了 preset 模式
（注入 `agent-preset-registry`）时 `preset` 才生效，否则忽略并使用 base 工具集；
桌面客户端内置的 profile 已用 `scripts/enable-presets.mjs` 生成的补丁启用
（standard / ptc / minimal / cordis）。

通用命令（私聊+群聊，准入成员可用）：

| 命令 | 行为 |
|------|------|
| `/stop` | 停止当前会话正在运行的任务（中断当前 turn，pending 卡片过期） |
| `/help` | 查看可用命令（按权限过滤）；未识别的 `/xxx` 命令会提示 `/help` |

管理命令均**按权限**执行；`/model`、`/effort`、`/reset` 仅私聊。

## 大模型与推理等级

模型选择按以下优先级解析（会话级覆盖，**下一条消息生效、上下文保留**）：

```
/model、/effort 运行时覆盖  >  会话持久记录  >  model.map  >  model.default 预设  >  DSH 当前选择
```

**模型/推理等级是「工作现场属性」**：`/model`、`/effort` 除了立即生效，还会把选择写成会话日志里的 `model/selection` 事件；resume 一个已存在的会话（重启 dsh、`/cwd` 切走再切回）时按「最后一条 `model/selection` → 最后一次请求的 `request/header`」恢复，而不是回落到配置默认。由于 dsh 的 GUI 模型选择器读同一份记录，IM 与 GUI 两侧保持一致；`model.map` / `model.default` 只决定**新会话**的初始选择。注意会话按「会话 key × 工作目录」派生，所以每个目录各自记住自己最后用的模型；`/reset` 会换新会话 id，回到配置默认。

模型与推理等级**分开设置**：`/model` 只切模型（保留当前推理等级），`/effort` 只调推理等级。可选模型来自 **DSH 运行时目录**（`ctx.llm.listProviders()` + `listModels()`，与 web UI 模型选择器同源），`model.allowed` 预设仅作可选快捷方式，`model.default` 与 `model.map` 设定新会话的默认与按会话固定。

`allowModelCommand: true` 时，私聊命令：

| 命令 | 行为 |
|------|------|
| `/model` | 查看当前模型 + 运行时模型目录（按 provider 分组），附预设快捷列表 |
| `/model deepseek/deepseek-chat` | 切换到目录中的模型（保留当前推理等级） |
| `/model fast` | 目录匹配不到时按预设 `fast` 切换（向后兼容） |
| `/effort` | 查看当前推理等级 |
| `/effort high` | 在当前模型上设置推理等级 |
| `/reset` | 清空会话上下文 |

## 使用

- **私聊**：直接发送消息，AI 立即回复（流式打字效果）
- **群聊**：@机器人、或以问号结尾、或包含关键词时触发
- **斜杠命令优先**：任何 `/` 开头的消息视为命令，**跳过群触发策略**（无需@/问号/关键词）且不消费为 pending 卡片的文本应答；`/stop` 可随时中断运行中的 turn；功能开关未启用的命令（`/cwd`、`/model`、`/effort`）与未知 `/xxx` 均给出明确提示
- 每个用户/群组独立会话，多轮对话上下文连续

## 特性

- **双向桥接**：野火IM ↔ DSH Agent
- **流式回复**：`assistant/chunk`（≤0.1.2）或 `agent/assistant-stream`（≥0.1.3）→ 野火流式消息（generating → completed）
- **会话隔离**：私聊/群聊各自独立 DSH 会话
- **群聊过滤**：@提及、问号、关键词触发
- **白名单**：用户/群组两级控制
- **媒体收发**：图片（模型可看图）、文件、语音（ASR 转文字）；Agent 产出文件经 `[image:path]` 标记回传
- **ask_user 提问**：Agent 提问 → DSH_Question 卡片（选项按钮/自定义输入，支持 plan 审阅样式）→ 用户应答即答案
- **工具审批**：Agent 工具请求 → DSH_Approval 卡片 → 用户同意/拒绝放行或拦截
- **状态可见**：Agent 生命周期（运行中/思考/工具/等待输入/空闲）经 scope=31 会话级用户设置实时推送，客户端渲染状态徽标
- **任务控制**：`/stop` 中断当前任务；`/goal` 长任务创建/暂停/恢复；`/jobs` 后台任务汇总
- **多群工作区**：每群独立工作目录，`/cwd` 动态绑定并持久化
- **模型/推理等级**：`/model`、`/effort` 按会话（工作现场）切换并写入会话日志，重启/切目录后 resume 自动恢复
- **失败可见**：回合以错误收尾（**402 余额不足**、401/403 鉴权、429 限流、网络超时）时，插件把分类后的可读原因直接回复给用户，不再静默取消气泡（旧行为是发消息「没有反应」）
- **长任务**：DSH goal 机制承载长时任务

## 目录结构

```
src/
├── index.ts      # 插件入口与生命周期
├── config.ts     # 配置类型与校验
├── clients.ts    # 野火机器人客户端管理
├── agent.ts      # DSH Agent 会话管理（cwd/模型注入、session/event 桥接）
├── inbound.ts    # 入站消息处理、管理命令、流式回复
├── access.ts     # 访问权限（管理员门控管理命令）
├── model.ts      # 模型/推理等级选择
├── workspace.ts  # 工作目录解析（含持久化）
├── interactive.ts# 交互缝隙：ask_user 提问 + 工具审批（经 IM）
├── media.ts      # 媒体收发（附件/下载/上传）
├── whitelist.ts  # 白名单过滤
└── utils.ts      # 群聊过滤、mention 检测、payload 解析
```

## 安全

安全设计详见 [DSH_INTEGRATION.md 安全章节](../DSH_INTEGRATION.md)。要点：

- **DSH 沙箱是文件安全的唯一硬围栏**：请在 profile patch 中配置 `sandbox-policy`（`workspace-write` 或 `read-only`，默认 `read-only`），不要使用 `danger-full-access`
- 出站媒体仅允许会话工作目录 + `workspace.allowedRoots` 内的文件（realpath 校验，防 `[image:/etc/passwd]` 外传）
- 审批/提问回复仅 **turn 发起者**可答（旁观者不能替放行）
- 公开机器人建议：`whiteList` + `security.maxMessagesPerMinute` + `access.adminUsers`

## 调试

```bash
# DSH 日志（插件日志前缀 [wildfire]）
dsh web 2>&1 | grep wildfire
```

## 多实例 / 多机器人（一台机器跑多个）

**推荐：一个实例一个 `DSH_HOME`。** dsh 的 home 里放着 profiles / sessions / storages /
settings / credentials，插件自建的状态文件也**按 `$DSH_HOME` 解析**（`utils.ts` 的
`dshHome()`；未设则回退 `~/.dsh`），因此不同 home 天然完全隔离：

```bash
# 实例 A
DSH_HOME=$HOME/.dsh-botA dsh --profile wildfire        # web 再加 --port 3081

# 实例 B
DSH_HOME=$HOME/.dsh-botB dsh --profile wildfire        # web 再加 --port 3082
```

各自 profile 的 patch 里写**不同的 robotId / robotSecret**；插件状态文件
（`wildfire-sessions.json` / `wildfire-workspaces.json` / `wildfire-allowlist.json` /
`wildfire-groups.json` / `wildfire-convmodes.json` / 诊断日志）落在各自的 `$DSH_HOME` 下。

部署（装插件）也要带同一个 `DSH_HOME`：

```bash
cd dsh-plugin.js
DSH_HOME=$HOME/.dsh-botA SKIP_RESTART=1 ./build-deploy.sh wildfire
DSH_HOME=$HOME/.dsh-botA nohup node "$(command -v dsh)" --profile wildfire >> $HOME/.dsh-botA/dsh-wildfire.log 2>&1 &
```

**冲突与注意点：**

| 项 | 说明 |
|---|---|
| robotId | robot-gateway 对同一机器人只允许**一条**有效连接；两个实例同机器人会互相挤掉（表现为 "Already authenticated" 僵尸），必须用不同机器人 |
| 会话 key | key 来自 IM 侧（`wildfire:user/<群>:<id>`，不含机器人）。两个机器人在**同一个群**时 sessionId 相同——不同 `DSH_HOME` 下各自的会话日志互不影响 ✅ |
| 不同 dsh 版本 | **不要共用一个 `DSH_HOME`**：`profiles/node_modules` 的 module fallback 由 dsh 托管，每次启动会重指到当前 CLI 安装 |
| 共用 `DSH_HOME` 的多 profile | 可以但不推荐：sessions / storages / 插件状态文件共享，同一会话还有 `session.lock` 互斥 |
| 资源 | 单实例实测约 **300MB RSS**（Node + 全量插件树），N 个实例约 N 倍，另加各 agent 的消耗 |
| 凭据 | 不同 home 需各自 `.credentials.yaml`（或走环境变量） |

## License

MIT

## 多机器人路由（v4）

当群 `extra` 中有 `wfds.robots` 且包含多个机器人时，插件启用多机器人路由：

- 有 `@`：只有被 `@` 的机器人处理；`@` 别人的消息直接忽略。
- 无 `@`：只有 owner 机器人裁决。
  - owner 按 `tags` 命中选择目标；命中则发送可见 `@目标机器人 ...` 指派消息；
  - 否则 owner 自己回复；
  - guest 机器人静默。
- 机器人消息默认忽略；owner 的 assign（`payload.extra.wfds.op=assign` 且 `targetRobotId` 是自己）例外。
- assign 消息带原始 `messageUid` 与 `note`；目标机器人优先用原始消息内容 + note 作为输入。
- 不回复时静默，不发空消息。

群 `extra` 结构：

```json
{
  "wfds": {
    "v": 2,
    "broker": {"type":"robot","id":"robot_owner"},
    "rev": 7,
    "robots": {
      "robot_owner": {"workspaceId":"ws_A","workspaceName":"项目A","sessionId":"...","hostId":"host_a","role":"owner","tags":["coding"]},
      "robot_b": {"workspaceId":"ws_B","workspaceName":"项目B","sessionId":"...","hostId":"host_b","role":"guest","tags":["ops"]}
    }
  }
}
```

- `/create`、`/bind-workspace` 会写入本机器人的 section（owner 直接写；guest 通过 210 透明消息上报给 owner）。
- 210 `AGENT_METADATA` 只用于群元数据 set/ack；不显示、不进入 Agent 上下文。
- tags 可通过环境变量 `WF_DSH_TAGS=coding,ops` 注入；owner 路由 v1 是规则匹配，后续可替换为模型 router。
