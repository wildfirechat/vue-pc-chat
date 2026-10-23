# 野火IM机器人网关客户端 SDK (Node.js/JavaScript版)

基于 WebSocket 的野火IM机器人网关客户端 SDK，与 Java 版客户端 SDK 功能对齐。

## 安装

```bash
npm install @wildfirechat/robot-gateway-client
```

## 依赖
1. node 18+
2. 本 SDK 依赖 `@wildfirechat/server-sdk` 提供模型类（Conversation, MessagePayload 等）。 
请确保 `server-sdk.js` 位于 `../server-sdk.js` 目录，或修改 package.json 中的依赖路径。

## 快速开始

```javascript
import { 
    RobotServiceClient, 
    MessageHandler, 
    Conversation, 
    ConversationType,
    MessageContentType,
    init 
} from '@wildfirechat/robot-gateway-client';

// 初始化 server-sdk（用于创建模型对象）
init('http://localhost:18080', 'admin-secret');

// 创建消息处理器
const messageHandler = {
    onMessage: (pushMessage) => {
        console.log('收到消息:', pushMessage.data);
    },
    onConnectionChanged: (connected) => {
        console.log('连接状态:', connected ? '已连接' : '已断开');
    },
    onError: (error) => {
        console.error('错误:', error);
    }
};

// 创建客户端
const client = new RobotServiceClient(
    'ws://localhost:8884/robot/gateway',
    messageHandler
);

// 连接并鉴权
async function main() {
    const connected = await client.connect('FireRobot', '123456');
    if (!connected) {
        console.error('连接失败');
        return;
    }

    console.log('连接成功！');

    // 获取机器人资料
    const profileResult = await client.getProfile();
    console.log('机器人资料:', profileResult.getResult());

    // 发送消息
    const conversation = new Conversation(ConversationType.Single, 'userId', 0);
    const payload = {
        type: MessageContentType.Text,
        searchableContent: 'Hello from Node.js!'
    };
    
    const result = await client.sendMessage('FireRobot', conversation, payload);
    if (result.isSuccess()) {
        console.log('发送成功，消息ID:', result.getResult().messageUid);
    } else {
        console.error('发送失败:', result.getMsg());
    }
}

main().catch(console.error);
```

## API 列表

### 连接管理

```javascript
// 连接并鉴权
await client.connect(robotId, robotSecret, timeoutSeconds);

// 断开连接
client.close();

// 检查连接状态
client.isConnected();
client.isAuthenticated();
```

### 消息相关

```javascript
// 发送消息
await client.sendMessage(fromUser, conversation, payload);

// 回复消息
await client.replyMessage(fromUser, message, payload);

// 撤回消息
await client.recallMessage(fromUser, messageId);

// 更新消息
await client.updateMessage(fromUser, messageId, payload);
```

### 用户相关

```javascript
// 获取用户信息
await client.getUserInfo(userId);

// 通过手机号获取用户
await client.getUserInfoByMobile(mobile, areaCode);

// 通过用户名获取用户
await client.getUserInfoByName(name);

// 应用获取用户信息
await client.applicationGetUserInfo(applicationId, userId);
```

### 群组相关

```javascript
// 创建群组
await client.createGroup(groupInfo, members, lines, notifyMessage);

// 获取群组信息
await client.getGroupInfo(groupId, updateDt);

// 解散群组
await client.dismissGroup(groupId);

// 转让群组
await client.transferGroup(groupId, newOwner);

// 修改群组信息
await client.modifyGroupInfo(groupId, modifyType, value);

// 获取群组成员
await client.getGroupMembers(groupId, updateDt);

// 添加群成员
await client.addGroupMembers(groupId, members, lines, notifyMessage);

// 踢出群成员
await client.kickoffGroupMembers(groupId, memberIds, lines, notifyMessage);

// 退出群组
await client.quitGroup(groupId, lines, notifyMessage);

// 设置群管理员
await client.setGroupManager(groupId, managers, type);

// 禁言群成员
await client.muteGroupMember(groupId, members, type, time);
```

### 机器人资料

```javascript
// 获取机器人资料
await client.getProfile();

// 更新机器人资料
await client.updateProfile(profile);

// 设置回调地址
await client.setCallback(url);

// 获取回调地址
await client.getCallback();
```

## 配置选项

创建客户端时可传入以下选项：

```javascript
const client = new RobotServiceClient(
    'ws://localhost:8884/robot/gateway',
    messageHandler,
    {
        timeout: 30,              // 请求超时时间（秒）
        reconnectInterval: 5000,  // 重连间隔（毫秒）
        heartbeatInterval: 270000 // 心跳间隔（毫秒，默认4.5分钟）
    }
);
```

## 消息处理器

消息处理器是一个包含以下方法的对象：

```javascript
const messageHandler = {
    // 收到消息时调用
    onMessage: (pushMessage) => {
        console.log('收到消息:', pushMessage.data);
        // pushMessage.data 包含:
        // - sender: 发送者ID
        // - conv: 会话信息 { type, target, line }
        // - payload: 消息内容
        // - timestamp: 时间戳
    },

    // 连接状态变化时调用
    onConnectionChanged: (connected) => {
        console.log('连接状态变化:', connected);
    },

    // 发生错误时调用
    onError: (error) => {
        console.error('错误:', error);
    }
};
```

## 并发请求示例

SDK 完全支持并发请求：

```javascript
// 并发获取多个用户信息
const userIds = ['user1', 'user2', 'user3', 'user4', 'user5'];
const promises = userIds.map(userId => client.getUserInfo(userId));
const results = await Promise.all(promises);

results.forEach((result, index) => {
    if (result.isSuccess()) {
        console.log(`用户 ${userIds[index]}:`, result.getResult());
    }
});
```

## 事件监听

也可以通过事件方式监听连接状态：

```javascript
const client = new RobotServiceClient(gatewayUrl, messageHandler);

// 获取底层连接管理器
const connManager = client.connectionManager;

connManager.onConnected = () => console.log('已连接');
connManager.onDisconnected = () => console.log('已断开');
connManager.onAuthenticated = () => console.log('鉴权成功');
connManager.onAuthFailed = (code, msg) => console.error('鉴权失败:', code, msg);
connManager.onError = (error) => console.error('错误:', error);

await client.connect('FireRobot', '123456');
```

## 项目结构

```
nodejs-client/
├── package.json
├── README.md
└── src/
    ├── index.js                    # 主入口，导出所有类
    ├── RobotServiceClient.js       # RobotService 客户端
    ├── ConnectionManager.js        # 连接管理器
    ├── RobotGatewayClient.js       # WebSocket 客户端
    ├── protocol/
    │   ├── RequestMessage.js       # 请求消息
    │   ├── ResponseMessage.js      # 响应消息
    │   ├── ConnectMessage.js       # 鉴权消息
    │   └── PushMessage.js          # 推送消息
    └── handler/
        ├── MessageHandler.js       # 消息处理器接口
        └── ResponseHandler.js      # 响应处理器
```

## 与 Java SDK 的差异

| 特性 | Java SDK | Node.js SDK |
|------|----------|-------------|
| 模型类 | 内嵌 | 来自 @wildfirechat/server-sdk |
| 回调方式 | 接口实现 | 对象方法 |
| 异步模型 | CompletableFuture | Promise/async-await |
| 线程安全 | ConcurrentHashMap | Map（单线程） |

## 许可证

MIT
