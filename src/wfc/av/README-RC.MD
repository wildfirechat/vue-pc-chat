# 远程协助/控制说明
1. 仅高级版音视频 SDK 支持远程控制功能。音视频 SDK 切换，请参考[README](./internal/README.MD)
2. 仅单人视频通话，支持远程协助/控制功能

## 远程协助
被控方主动邀请主控方控制自己的桌面

### 远程协助流程
1. 双方发起视频通话
2. 需要远程协助的被控方，开启屏幕共享，调用`callSession#inviteRemoteControl`发起远程协助邀请
3. 主控方会收到`callSessionCallback#onReceiveRemoteControlInvite`回调通知
4. 主控方收到通知后，可以调用`callSession#acceptRemoteControlInvite`接受远程协助邀请；或调用`callSession#rejectRemoteControlInvite`拒绝远程协助邀请
5. 被控方，会收到`callSessionCallack#didAcceptRemoteControlInvite`或`callSessionCallack#didRemoteControlEnd`回调

## 远程控制
主控方请求控制被控方的桌面
1. 主动方调用`avenginekitProxy#requestRemoteControl`请求远程控制
2. 被控方，会显示接听页面`SingleRemoteControl.vue`
3. 被控方，可以调用`callSession#acceptRemoteControlRequest`接受被控请求，或调用`callSession.hangup`拒绝被控请求
4. 被控方，接受被控请求后，被控方等待连接成功，开启屏幕共享

