# PC 端 DSH 卡片联调说明

本目录（`vue-pc-chat`）已实现野火 IM × DeepSeek Harness 结构化交互的客户端侧（消息类型 200-206，见 `INTERACTION_DESIGN.md` §2）。

## 改动清单

| 文件 | 内容 |
|------|------|
| `src/wfc/messages/messageContentType.js` | 系统消息类型：DSH_QUESTION(200) ~ DSH_GOAL(206) 常量（200-209 官方预留 AI 交互段） |
| `src/wfc/messages/dshMessageContents.js` | 系统消息目录下的 5 个 DSH Content 类（encode/decode/digest） |
| `src/wfc/client/messageConfig.js` | 系统消息注册表：注册 5 个 DSH 内容类（均 Persist） |
| `src/ui/main/conversation/message/content/DshQuestionContentView.vue` | 提问卡片：选项按钮（单选即答/多选提交/自定义输入）；`intent.kind === 'plan-review'` 时计划全文折叠展示 + 批准主按钮 |
| `src/ui/main/conversation/message/content/DshApprovalContentView.vue` | 审批卡片：同意/拒绝按钮 |
| `src/ui/main/conversation/message/content/DshGoalContentView.vue` | 目标卡片（phase 彩色徽标 + 已执行轮数） |
| `src/ui/main/conversation/message/MessageContentContainerView.vue` | 200-206 分支接线 |
| `src/ui/util/dshState.js` | scope=31 会话状态读取 + `dshConversationKind` 门控（单聊机器人 `userInfo.type===1` / 群 extra `{"dsh":true}`） |
| `src/ui/main/conversation/ConversationView.vue` | 标题栏 DSH 状态徽标（含 phase·工具名）+ **停止按钮**（发 `/stop` 中断 Agent）；仅 DSH 会话显示 |
| `src/ui/main/conversationList/ConversationItemView.vue` | 会话列表状态圆点 + 群 DSH 标识徽标（仅 DSH 会话显示） |
| `src/ui/main/conversation/MessageInputView.vue` | 输入框占位随 DSH 状态变化（`waiting_user`/`running`）；**输入 `/` 弹出命令菜单**（Tribute 第二实例，与 `@` 提及共存；选中命令填入输入框、不直接发送；单聊/群聊命令集不同：单聊 `/help /create-group /workspaces /goal /jobs /model /effort /plan /compact /cwd /ls /sandbox /stop`，群聊 `/help /cwd /ls /model /effort /plan /compact /sandbox /reset /stop`） |
| `src/wfc/client/userSettingScope.js` | 新增 Conversation_User_Setting(31)，DSH 会话状态通道 |
| `src/assets/lang/{zh-CN,zh-TW,en}.json` | dsh.* i18n |

## 状态通道

- 运行进度/会话状态走 **scope=31 会话级用户设置**：key 为 `<convType>-<line>-<target>_1`，值为 `{state, phase, toolName, model, ...}` JSON（见 `src/ui/util/dshState.js`）
- 客户端监听 `settingUpdate` 事件刷新标题栏徽标、列表圆点和输入框占位（**事件驱动，无轮询**；另监听 `UserInfosUpdate`/`GroupInfosUpdate`，因用户/群信息异步拉取后才可判定 DSH 会话）
- 仅 DSH 会话（单聊机器人或群 extra 带 `{"dsh":true}`）查询/展示状态

## DSH 会话判定与已知限制

- **单聊**：对方 `userInfo.type === 1`（机器人）即判定为 DSH 会话 → **任意机器人单聊都会显示命令快捷条**（非 DSH 机器人无 scope=31 状态，徽标/圆点不显示，命令会被对方忽略）。如需严格限定本机器人，可在客户端配置机器人 ID 过滤
- **群聊**：群 `extra` 带 `{"dsh":true}` 标记（创建时由机器人写入）→ 显示 DSH 群标识 + 命令条
- 判定依赖本地缓存：首次进入会话若用户/群信息未拉取到，返回 `null`，待 `UserInfosUpdate`/`GroupInfosUpdate` 事件后自动刷新

## 构建验证

```bash
npx vue-cli-service build          # 已通过（唯一 warning 为 vendor/pinyin 可选依赖，与 DSH 无关）
npm run dev                        # 开发运行（electron）
```

## 联调步骤

1. 启动 PC 端（`npm run dev`），登录野火 IM 账号
2. 私聊机器人 `robot_cgc8c8VV_594168` 发 `/create-group auto`（或在输入框输入 `/`，弹出命令菜单选择）→ 收到群 ID + 工作区路径
3. 进入该群，发消息让 Agent 用 ask_user 提问（如"问我一个问题"）→ 应看到 **DSH_Question 卡片**（选项按钮）
4. 点选项按钮 → 发送 DSH_Answer(201) → Agent 继续并回复
5. 让 Agent 执行需审批操作（或配置 sandbox 触发）→ 应看到 **DSH_Approval 卡片**（同意/拒绝）
6. 处理任务时观察标题栏/会话列表的 **DSH 状态**（思考中/执行工具/等待确认），`waiting_user` 时输入框占位提示直接文字回答；标题栏**停止按钮**可随时中断 Agent（等同发送 `/stop`）
7. 群内创建者可用 `/sandbox workspace-write` 切换工作区写权限（下一次工具调用生效）；用 `/model` 查看/切换运行时模型目录

## 卡片状态更新说明

- 卡片 `content.state`（pending/answered/approved/rejected/expired）由机器人侧 `updateMessage` 更新
- **客户端本地点击后立即置灰**（`locallyAnswered`/`locallyDecided`），不依赖服务端推送实时性
- 服务端更新用于多端同步与历史一致性（重新进入会话/刷新时显示最终状态）
