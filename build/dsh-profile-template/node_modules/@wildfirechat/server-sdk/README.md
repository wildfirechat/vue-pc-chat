# Wildfire Chat Server SDK for JavaScript/Node.js

野火IM服务端JavaScript SDK，功能与Java版Server SDK完全对齐。

## 安装

```bash
npm install @wildfirechat/server-sdk
```

## 快速开始

```javascript
import { init, UserAdmin, MessageAdmin, Conversation, MessageContentType } from '@wildfirechat/server-sdk';

// 初始化SDK
init('http://localhost:18080', 'your-admin-secret');

// 使用async/await调用API
async function example() {
    // 获取用户信息
    const userResult = await UserAdmin.getUserByUserId('userId');
    if (userResult.isSuccess()) {
        console.log('用户信息:', userResult.getResult());
    } else {
        console.error('获取失败:', userResult.getMsg());
    }

    // 发送消息
    const conversation = new Conversation(0, 'targetUserId', 0); // 单聊会话
    const payload = {
        type: MessageContentType.Text,
        searchableContent: 'Hello from Server SDK!'
    };
    const messageResult = await MessageAdmin.sendMessage('senderId', conversation, payload);
    console.log('消息发送结果:', messageResult.getResult());
}

example().catch(console.error);
```

## 功能模块

### 用户管理 (UserAdmin)

```javascript
import { UserAdmin } from '@wildfirechat/server-sdk';

// 获取用户信息
await UserAdmin.getUserByUserId(userId);
await UserAdmin.getUserByName(name);
await UserAdmin.getUserByMobile(mobile);

// 创建/更新用户
await UserAdmin.createUser(userInfo);
await UserAdmin.updateUserInfo(user, flag);

// 机器人管理
await UserAdmin.createRobot(robot);
await UserAdmin.getRobotInfo(robotId);

// 用户状态管理
await UserAdmin.updateUserBlockStatus(userId, block);
await UserAdmin.checkUserOnlineStatus(userId);
await UserAdmin.kickoffUserClient(userId, clientId);

// Token管理
await UserAdmin.getUserToken(userId, clientId, platform);

// 在线用户
await UserAdmin.getOnlineUserCount();
await UserAdmin.getOnlineUser(nodeId, offset, count);
```

### 消息管理 (MessageAdmin)

```javascript
import { MessageAdmin } from '@wildfirechat/server-sdk';

// 发送消息
await MessageAdmin.sendMessage(sender, conversation, payload);
await MessageAdmin.sendMessageToUsers(sender, conversation, payload, toUsers);

// 消息操作
await MessageAdmin.recallMessage(operator, messageUid);
await MessageAdmin.deleteMessage(messageUid);
await MessageAdmin.updateMessageContent(operator, messageUid, payload, distribute);

// 群发/广播
await MessageAdmin.multicastMessage(sender, receivers, line, payload);
await MessageAdmin.broadcastMessage(sender, line, payload);

// 获取消息状态
await MessageAdmin.getConversationReadTimestamp(userId, conversation);
await MessageAdmin.getMessageDelivery(userId);
```

### 群组管理 (GroupAdmin)

```javascript
import { GroupAdmin } from '@wildfirechat/server-sdk';

// 群组操作
await GroupAdmin.createGroup(operator, groupInfo, members, memberExtra, toLines, notifyMessage);
await GroupAdmin.getGroupInfo(groupId);
await GroupAdmin.dismissGroup(operator, groupId, toLines, notifyMessage);
await GroupAdmin.transferGroup(operator, groupId, newOwner, toLines, notifyMessage);

// 群组成员管理
await GroupAdmin.addGroupMembers(operator, groupId, members, memberExtra, toLines, notifyMessage);
await GroupAdmin.kickoffGroupMembers(operator, groupId, memberIds, toLines, notifyMessage);
await GroupAdmin.quitGroup(operator, groupId, toLines, notifyMessage);
await GroupAdmin.getGroupMembers(groupId);

// 群组设置
await GroupAdmin.modifyGroupInfo(operator, groupId, type, value, toLines, notifyMessage);
await GroupAdmin.setGroupManager(operator, groupId, memberIds, isManager, toLines, notifyMessage);
await GroupAdmin.muteGroupMember(operator, groupId, memberIds, isMute, toLines, notifyMessage);
await GroupAdmin.setGroupMemberAlias(operator, groupId, memberId, alias, toLines, notifyMessage);
```

### 好友关系管理 (RelationAdmin)

```javascript
import { RelationAdmin } from '@wildfirechat/server-sdk';

// 好友管理
await RelationAdmin.setUserFriend(userId, targetId, isFriend, extra);
await RelationAdmin.getFriendList(userId);
await RelationAdmin.sendFriendRequest(userId, targetId, reason, force);
await RelationAdmin.updateFriendAlias(operator, targetId, alias);

// 黑名单管理
await RelationAdmin.setUserBlacklist(userId, targetId, isBlacklist);
await RelationAdmin.getUserBlacklist(userId);

// 获取关系
await RelationAdmin.getRelation(userId, targetId);
```

### 聊天室管理 (ChatroomAdmin)

```javascript
import { ChatroomAdmin } from '@wildfirechat/server-sdk';

await ChatroomAdmin.createChatroom(chatroomId, title, desc, portrait, extra, state);
await ChatroomAdmin.destroyChatroom(chatroomId);
await ChatroomAdmin.getChatroomInfo(chatroomId);
await ChatroomAdmin.getChatroomMembers(chatroomId);
await ChatroomAdmin.setChatroomManager(chatroomId, userId, status);
await ChatroomAdmin.setChatroomMute(chatroomId, mute);
```

### 频道管理 (ChannelAdmin)

```javascript
import { ChannelAdmin } from '@wildfirechat/server-sdk';

await ChannelAdmin.createChannel(channelInfo);
await ChannelAdmin.destroyChannel(channelId);
await ChannelAdmin.getChannelInfo(channelId);
await ChannelAdmin.subscribeChannel(channelId, userId);
await ChannelAdmin.unsubscribeChannel(channelId, userId);
```

### 会议管理 (ConferenceAdmin)

```javascript
import { ConferenceAdmin } from '@wildfirechat/server-sdk';

await ConferenceAdmin.listConferences(count, offset);
await ConferenceAdmin.createRoom(roomId, description, pin, maxPublisher, advance, bitrate, recording, permanent);
await ConferenceAdmin.destroy(roomId, advance);
await ConferenceAdmin.listParticipants(roomId, advance);
await ConferenceAdmin.enableRecording(roomId, advance, recording);
```

### 机器人服务 (RobotService)

```javascript
import { RobotService } from '@wildfirechat/server-sdk';

// 创建机器人服务实例（与Admin不同，需要实例化）
const robotService = new RobotService('http://localhost:18080', 'robotId', 'robotSecret');

// 发送消息
await robotService.sendMessage(sender, conversation, payload);
await robotService.replyMessage(messageUid, payload, only2Sender);

// 获取用户信息
await robotService.getUserInfo(userId);

// 群组管理
await robotService.createGroup(groupInfo, members, memberExtra, toLines, notifyMessage);
await robotService.getGroupInfo(groupId);
await robotService.addGroupMembers(groupId, members, memberExtra, toLines, notifyMessage);

// 回调管理
await robotService.setCallback(url);
await robotService.getCallback();
```

## 模型类

SDK提供了与vue-pc-chat完全兼容的模型类：

```javascript
import {
    // 会话
    Conversation,
    ConversationType,
    
    // 用户和群组
    UserInfo,
    GroupInfo,
    GroupMember,
    GroupType,
    GroupMemberType,
    
    // 聊天室和频道
    ChatRoomInfo,
    ChannelInfo,
    
    // 消息内容
    MessagePayload,
    MessageContent,
    MessageContentType,
    TextMessageContent,
    ImageMessageContent,
    FileMessageContent,
    // ... 等等
} from '@wildfirechat/server-sdk';
```

## 错误处理

所有API调用都返回 `IMResult` 对象：

```javascript
const result = await UserAdmin.getUserByUserId('userId');

if (result.isSuccess()) {
    // 成功，获取返回数据
    const user = result.getResult();
} else {
    // 失败，获取错误信息
    console.error('错误码:', result.getCode());
    console.error('错误信息:', result.getMsg());
    console.error('错误码常量:', result.getErrorCode()); // 如: 'ERROR_CODE_USER_NOT_EXIST'
}
```

| 语言 | GitHub                                                           | Gitee(码云) |
|------|------------------------------------------------------------------|-------------|
| Java SDK | [GitHub](https://github.com/wildfirechat/server/tree/master/sdk) | [Gitee](https://gitee.com/wfchat/im-server/tree/wildfirechat/sdk) |
| Go SDK | [GitHub](https://github.com/wildfirechat/server-sdk-go)          | [Gitee](https://gitee.com/wfchat/server-sdk-go) |
| Node.js SDK | [GitHub](https://github.com/wildfirechat/server-sdk.js)          | [Gitee](https://gitee.com/wfchat/server-sdk.js) |
| Python SDK | [GitHub](https://github.com/wildfirechat/server-sdk-python)          | [Gitee](https://gitee.com/wfchat/server-sdk-python) |

## 许可证

MIT
