/**
 * Wildfire Chat Server SDK 使用示例
 * 
 * 运行前请确保：
 * 1. 已安装依赖: npm install
 * 2. 已启动野火IM服务器
 * 3. 修改下面的配置参数
 */

import fs from 'fs';
import path from 'path';
import {
    init,
    getConfig,
    UserAdmin,
    MessageAdmin,
    GroupAdmin,
    RelationAdmin,
    ChatroomAdmin,
    ChannelAdmin,
    GeneralAdmin,
    ConferenceAdmin,
    SensitiveAdmin,
    RobotService,
    Conversation,
    ConversationType,
    MessageContentType,
    GroupType,
    GroupMemberType,
    // 消息内容类 - 用于 testMessageContent
    TextMessageContent,
    SoundMessageContent,
    ImageMessageContent,
    VideoMessageContent,
    LocationMessageContent,
    FileMessageContent,
    StickerMessageContent,
    LinkMessageContent,
    CardMessageContent,
    TipNotificationMessageContent,
    RichNotificationMessageContent,
    StreamingTextGeneratingMessageContent,
    StreamingTextGeneratedMessageContent,
    ErrorCode,
    // 媒体类型 - 用于 getPresignedUploadUrl
    MessageContentMediaType
} from './src/index.js';

// ========== 配置 ==========
const ADMIN_URL = 'http://localhost:18080';  // IM服务器地址
const ADMIN_SECRET = '123456';                // 管理密钥
const ROBOT_ID = 'robot1';                    // 机器人ID（用于RobotService示例）
const ROBOT_SECRET = 'robot-secret';          // 机器人密钥

// ========== 初始化 ==========
console.log('正在初始化SDK...');
init(ADMIN_URL, ADMIN_SECRET);
console.log('SDK配置:', getConfig());

// ========== 辅助函数 ==========

/**
 * 检查发送消息结果
 * @param {IMResult} result 
 */
function checkSendMessageResult(result) {
    if (result && result.isSuccess()) {
        console.log('send message success, messageUid:', result.getResult()?.messageUid);
    } else {
        console.log('send message failure:', result?.getMsg());
        throw new Error('Send message failed');
    }
}


// ========== 示例函数 ==========

/**
 * 示例1: 用户管理
 */
async function userAdminExample() {
    console.log('\n========== 用户管理示例 ==========');
    
    try {
        // 创建用户
        console.log('\n1. 创建用户...');
        const newUser = {
            userId: 'test-user-' + Date.now(),
            name: 'testuser',
            displayName: 'Test User',
            password: '123456',
            portrait: 'https://example.com/avatar.png',
            gender: 0,
            mobile: '13800138000',
            email: 'test@example.com'
        };
        const createResult = await UserAdmin.createUser(newUser);
        console.log('创建用户结果:', createResult.isSuccess() ? '成功' : '失败', 
                    createResult.isSuccess() ? createResult.getResult() : createResult.getMsg());
        
        // 获取用户信息
        console.log('\n2. 获取用户信息...');
        const userResult = await UserAdmin.getUserByUserId(newUser.userId);
        console.log('获取用户结果:', userResult.isSuccess() ? '成功' : '失败');
        if (userResult.isSuccess()) {
            console.log('用户信息:', JSON.stringify(userResult.getResult(), null, 2));
        }
        
        // 获取在线用户数量
        console.log('\n3. 获取在线用户数量...');
        const onlineCountResult = await UserAdmin.getOnlineUserCount();
        console.log('在线用户数量:', onlineCountResult.isSuccess() ? onlineCountResult.getResult() : onlineCountResult.getMsg());
        
    } catch (error) {
        console.error('用户管理示例出错:', error.message);
    }
}

/**
 * 示例2: 消息管理
 */
async function messageAdminExample() {
    console.log('\n========== 消息管理示例 ==========');
    
    try {
        const senderId = 'admin';
        const targetId = 'user1';
        
        // 发送单聊消息
        console.log('\n1. 发送文本消息...');
        const conversation = new Conversation(ConversationType.Single, targetId, 0);
        const payload = {
            type: MessageContentType.Text,
            searchableContent: 'Hello from Server SDK! 👋',
            pushContent: 'You have a new message'
        };
        const sendResult = await MessageAdmin.sendMessage(senderId, conversation, payload);
        console.log('发送消息结果:', sendResult.isSuccess() ? '成功' : '失败');
        if (sendResult.isSuccess()) {
            console.log('消息UID:', sendResult.getResult());
        }
        
        // 群发消息
        console.log('\n2. 群发消息...');
        const receivers = ['user1', 'user2', 'user3'];
        const multicastPayload = {
            type: MessageContentType.Text,
            searchableContent: '这是一条群发消息!'
        };
        const multicastResult = await MessageAdmin.multicastMessage(senderId, receivers, 0, multicastPayload);
        console.log('群发消息结果:', multicastResult.isSuccess() ? '成功' : '失败');
        
        // 获取消息投递状态
        console.log('\n3. 获取消息投递状态...');
        const deliveryResult = await MessageAdmin.getMessageDelivery(targetId);
        console.log('消息投递状态:', deliveryResult.isSuccess() ? deliveryResult.getResult() : deliveryResult.getMsg());
        
    } catch (error) {
        console.error('消息管理示例出错:', error.message);
    }
}


/**
 * 示例3: 消息内容编码测试 - 与 Java SDK testMessageContent 对齐
 */
async function testMessageContent() {
    console.log('\n========== 消息内容编码测试 (testMessageContent) ==========');
    
    try {
        const sender = 'userId2';
        const targetId = 'user1';
        const conversation = new Conversation(ConversationType.Single, targetId, 0);
        
        let payload;
        let resultSendMessage;

        // 1. 测试发送文本消息
        console.log('\n1. 测试发送文本消息...');
        const textMessageContent = new TextMessageContent('测试文本消息');
        payload = textMessageContent.encode();
        resultSendMessage = await MessageAdmin.sendMessage(sender, conversation, payload);
        checkSendMessageResult(resultSendMessage);

        // 2. 测试发送语音消息
        console.log('\n2. 测试发送语音消息...');
        const soundMessageContent = new SoundMessageContent();
        soundMessageContent.duration = 7;
        soundMessageContent.remoteMediaUrl = 'https://media.wfcoss.cn/firechat/voice_message_sample.amr';
        payload = soundMessageContent.encode();
        resultSendMessage = await MessageAdmin.sendMessage(sender, conversation, payload);
        checkSendMessageResult(resultSendMessage);

        // 3. 测试发送图片消息
        console.log('\n3. 测试发送图片消息...');
        const imageMessageContent = new ImageMessageContent();
        // 缩略图使用简化的 base64 数据
        const thumbnailBase64edData = '/9j/4AAQSkZJRgABAQEASABIAAD';
        imageMessageContent.thumbnail = thumbnailBase64edData;
        imageMessageContent.remoteMediaUrl = 'https://media.wfcoss.cn/firechat/image_message_sample.jpg';
        imageMessageContent.imageWidth = 800;
        imageMessageContent.imageHeight = 600;
        payload = imageMessageContent.encode();
        resultSendMessage = await MessageAdmin.sendMessage(sender, conversation, payload);
        checkSendMessageResult(resultSendMessage);

        // 4. 测试发送视频消息
        console.log('\n4. 测试发送视频消息...');
        const videoMessageContent = new VideoMessageContent();
        videoMessageContent.thumbnail = thumbnailBase64edData;
        videoMessageContent.duration = 3;
        videoMessageContent.remoteMediaUrl = 'https://media.wfcoss.cn/firechat/video_message_sample.mov';
        payload = videoMessageContent.encode();
        resultSendMessage = await MessageAdmin.sendMessage(sender, conversation, payload);
        checkSendMessageResult(resultSendMessage);

        // 5. 测试发送位置消息
        console.log('\n5. 测试发送位置消息...');
        const locationMessageContent = new LocationMessageContent();
        locationMessageContent.thumbnail = thumbnailBase64edData;
        locationMessageContent.title = '中国北京市海淀区阜成路北二街131号';
        locationMessageContent.latitude = 39.926537312885166;
        locationMessageContent.longitude = 116.32154022158235;
        payload = locationMessageContent.encode();
        resultSendMessage = await MessageAdmin.sendMessage(sender, conversation, payload);
        checkSendMessageResult(resultSendMessage);

        // 6. 测试发送文件消息
        console.log('\n6. 测试发送文件消息...');
        const fileMessageContent = new FileMessageContent();
        fileMessageContent.name = '野火产品简介.pptx';
        fileMessageContent.size = 38394;
        fileMessageContent.remoteMediaUrl = 'https://media.wfcoss.cn/firechat/file_message_sample.pptx';
        payload = fileMessageContent.encode();
        resultSendMessage = await MessageAdmin.sendMessage(sender, conversation, payload);
        checkSendMessageResult(resultSendMessage);

        // 7. 测试动态表情消息
        console.log('\n7. 测试动态表情消息...');
        const stickerMessageContent = new StickerMessageContent();
        stickerMessageContent.width = 753;
        stickerMessageContent.height = 960;
        stickerMessageContent.remoteMediaUrl = 'https://media.wfcoss.cn/firechat/sticker_message_sample.jpg';
        payload = stickerMessageContent.encode();
        resultSendMessage = await MessageAdmin.sendMessage(sender, conversation, payload);
        checkSendMessageResult(resultSendMessage);

        // 8. 测试链接消息
        console.log('\n8. 测试链接消息...');
        const linkMessageContent = new LinkMessageContent();
        linkMessageContent.title = '野火IM开发手册';
        linkMessageContent.url = 'https://docs.wildfirechat.cn';
        linkMessageContent.thumbnailUrl = 'https://docs.wildfirechat.cn/favicon.ico';
        linkMessageContent.contentDigest = '野火IM开发手册，关于野火的所有知识都在这里！';
        payload = linkMessageContent.encode();
        resultSendMessage = await MessageAdmin.sendMessage(sender, conversation, payload);
        checkSendMessageResult(resultSendMessage);

        // 9. 测试名片消息
        console.log('\n9. 测试名片消息...');
        const cardMessageContent = new CardMessageContent();
        cardMessageContent.type = 0; // 0: 用户, 1: 群组, 2: 聊天室, 3: 频道
        cardMessageContent.target = 'FireRobot';
        cardMessageContent.name = 'FireRobot';
        cardMessageContent.portrait = 'https://cdn2.wildfirechat.net/robot.png';
        cardMessageContent.displayName = '小火';
        cardMessageContent.from = sender;
        payload = cardMessageContent.encode();
        resultSendMessage = await MessageAdmin.sendMessage(sender, conversation, payload);
        checkSendMessageResult(resultSendMessage);

        // 10. 测试提醒消息
        console.log('\n10. 测试提醒消息...');
        const tipNotificationMessageContent = new TipNotificationMessageContent();
        tipNotificationMessageContent.tip = '这是一个提醒小灰条消息';
        payload = tipNotificationMessageContent.encode();
        resultSendMessage = await MessageAdmin.sendMessage(sender, conversation, payload);
        checkSendMessageResult(resultSendMessage);

        // 11. 测试富通知消息
        console.log('\n11. 测试富通知消息...');
        const richNotificationMessageContent = new RichNotificationMessageContent(
            '产品审核通知',
            '您好，您的SSL证书以审核通过并成功办理，请关注',
            'https://www.wildfirechat.cn'
        );
        richNotificationMessageContent.remark = '谢谢惠顾';
        richNotificationMessageContent.exName = '证书小助手';
        richNotificationMessageContent.appId = '1234567890';
        richNotificationMessageContent.addItem('登陆账户', '野火IM', '#173177');
        richNotificationMessageContent.addItem('产品名称', '域名wildifrechat.cn申请的免费SSL证书', '#173177');
        richNotificationMessageContent.addItem('审核通过', '通过', '#173177');
        richNotificationMessageContent.addItem('说明', '请登陆账户查看处理', '#173177');
        payload = richNotificationMessageContent.encode();
        resultSendMessage = await MessageAdmin.sendMessage(sender, conversation, payload);
        checkSendMessageResult(resultSendMessage);

        // 12. 测试流式文本消息
        console.log('\n12. 测试流式文本消息...');
        await testStreamingText(sender, conversation);
        
    } catch (error) {
        console.error('testMessageContent 出错:', error.message);
    }
}

/**
 * 测试流式文本消息
 */
async function testStreamingText(sender, conversation) {
    console.log('\n测试流式文本消息...');
    
    // 发送流式文本生成中消息
    const generatingContent = new StreamingTextGeneratingMessageContent();
    generatingContent.text = '正在生成中...';
    generatingContent.streamId = 'stream_' + Date.now();
    let payload = generatingContent.encode();
    let result = await MessageAdmin.sendMessage(sender, conversation, payload);
    checkSendMessageResult(result);
    
    // 发送流式文本生成完成消息
    const generatedContent = new StreamingTextGeneratedMessageContent();
    generatedContent.text = '这是生成的完整文本内容';
    generatedContent.streamId = generatingContent.streamId;
    payload = generatedContent.encode();
    result = await MessageAdmin.sendMessage(sender, conversation, payload);
    checkSendMessageResult(result);
}


/**
 * 示例4: 群组管理
 */
async function groupAdminExample() {
    console.log('\n========== 群组管理示例 ==========');
    
    try {
        const operatorId = 'admin';
        const groupInfo = {
            target_id: '',
            name: 'Test Group ' + Date.now(),
            portrait: 'https://example.com/group.png',
            owner: operatorId,
            type: GroupType.Normal,
            extra: '{}'
        };
        const members = [
            { member_id: 'user1', alias: '', type: GroupMemberType.Normal, extra: '' },
            { member_id: 'user2', alias: '', type: GroupMemberType.Normal, extra: '' }
        ];
        
        const createResult = await GroupAdmin.createGroup(operatorId, groupInfo, members, null, null, null);
        console.log('创建群组结果:', createResult.isSuccess() ? '成功' : '失败');
        
        let groupId = null;
        if (createResult.isSuccess()) {
            groupId = createResult.getResult().group_id;
            console.log('群组ID:', groupId);
        }
        
        if (groupId) {
            const groupInfoResult = await GroupAdmin.getGroupInfo(groupId);
            console.log('群组信息:', groupInfoResult.isSuccess() ? groupInfoResult.getResult() : groupInfoResult.getMsg());
            
            const membersResult = await GroupAdmin.getGroupMembers(groupId);
            console.log('群组成员:', membersResult.isSuccess() ? membersResult.getResult() : membersResult.getMsg());
            
            const modifyResult = await GroupAdmin.modifyGroupInfo(operatorId, groupId, 0, 'New Group Name', null, null);
            console.log('修改群组结果:', modifyResult.isSuccess() ? '成功' : modifyResult.getMsg());
        }
        
    } catch (error) {
        console.error('群组管理示例出错:', error.message);
    }
}

/**
 * 示例5: 好友关系管理
 */
async function relationAdminExample() {
    console.log('\n========== 好友关系管理示例 ==========');
    
    try {
        const userId = 'user1';
        const targetId = 'user2';
        
        const requestResult = await RelationAdmin.sendFriendRequest(userId, targetId, 'Hello, can we be friends?', false);
        console.log('发送好友请求结果:', requestResult.isSuccess() ? '成功' : requestResult.getMsg());
        
        const friendResult = await RelationAdmin.setUserFriend(userId, targetId, true, '');
        console.log('设置好友关系结果:', friendResult.isSuccess() ? '成功' : friendResult.getMsg());
        
        const friendListResult = await RelationAdmin.getFriendList(userId);
        console.log('好友列表:', friendListResult.isSuccess() ? friendListResult.getResult() : friendListResult.getMsg());
        
        const relationResult = await RelationAdmin.getRelation(userId, targetId);
        console.log('用户关系:', relationResult.isSuccess() ? relationResult.getResult() : relationResult.getMsg());
        
    } catch (error) {
        console.error('好友关系管理示例出错:', error.message);
    }
}

/**
 * 示例6: 聊天室管理
 */
async function chatroomAdminExample() {
    console.log('\n========== 聊天室管理示例 ==========');
    
    try {
        const chatroomResult = await ChatroomAdmin.createChatroom(
            '',
            'Test Chatroom ' + Date.now(),
            'This is a test chatroom',
            'https://example.com/chatroom.png',
            '{}',
            0
        );
        console.log('创建聊天室结果:', chatroomResult.isSuccess() ? '成功' : '失败');
        
        let chatroomId = null;
        if (chatroomResult.isSuccess()) {
            chatroomId = chatroomResult.getResult().chatroomId;
            console.log('聊天室ID:', chatroomId);
        }
        
        if (chatroomId) {
            const infoResult = await ChatroomAdmin.getChatroomInfo(chatroomId);
            console.log('聊天室信息:', infoResult.isSuccess() ? infoResult.getResult() : infoResult.getMsg());
            
            const muteResult = await ChatroomAdmin.setChatroomMute(chatroomId, true);
            console.log('设置禁言结果:', muteResult.isSuccess() ? '成功' : muteResult.getMsg());
        }
        
    } catch (error) {
        console.error('聊天室管理示例出错:', error.message);
    }
}

/**
 * 示例7: 系统健康检查
 */
async function healthCheckExample() {
    console.log('\n========== 系统健康检查示例 ==========');
    
    try {
        const healthResult = await GeneralAdmin.healthCheck();
        console.log('健康检查结果:', healthResult.isSuccess() ? '正常' : '异常');
        if (healthResult.isSuccess()) {
            console.log('服务器信息:', healthResult.getResult());
        }
    } catch (error) {
        console.error('健康检查出错:', error.message);
    }
}

/**
 * 示例: 获取预签名上传地址 (GeneralAdmin)
 */
async function generalAdminGetPresignedUploadUrlExample() {
    console.log('\n========== GeneralAdmin 获取预签名上传地址示例 ==========');
    
    try {
        // 示例1: 获取图片上传地址
        console.log('\n1. 获取图片预签名上传地址...');
        const imageResult = await GeneralAdmin.getPresignedUploadUrl(
            'test_image.jpg',
            MessageContentMediaType.Image,
            'image/jpeg'
        );
        console.log('获取结果:', imageResult.isSuccess() ? '成功' : '失败');
        if (imageResult.isSuccess()) {
            console.log('上传地址信息:', JSON.stringify(imageResult.getResult(), null, 2));
        } else {
            console.log('错误信息:', imageResult.getMsg());
        }
        
        // 示例2: 获取文件上传地址（自动识别 Content-Type）
        console.log('\n2. 获取文件预签名上传地址...');
        const fileResult = await GeneralAdmin.getPresignedUploadUrl(
            'document.pdf',
            MessageContentMediaType.File,
            'application/pdf'
        );
        console.log('获取结果:', fileResult.isSuccess() ? '成功' : '失败');
        if (fileResult.isSuccess()) {
            console.log('上传地址信息:', JSON.stringify(fileResult.getResult(), null, 2));
        } else {
            console.log('错误信息:', fileResult.getMsg());
        }
        
        // 示例3: 获取视频上传地址
        console.log('\n3. 获取视频预签名上传地址...');
        const videoResult = await GeneralAdmin.getPresignedUploadUrl(
            'video_sample.mp4',
            MessageContentMediaType.Video,
            'video/mp4'
        );
        console.log('获取结果:', videoResult.isSuccess() ? '成功' : '失败');
        if (videoResult.isSuccess()) {
            console.log('上传地址信息:', JSON.stringify(videoResult.getResult(), null, 2));
        } else {
            console.log('错误信息:', videoResult.getMsg());
        }
        
    } catch (error) {
        console.error('获取预签名上传地址示例出错:', error.message);
    }
}

/**
 * 示例: 实际上传文件测试 (GeneralAdmin)
 */
async function generalAdminUploadFileExample() {
    console.log('\n========== GeneralAdmin 实际上传文件测试 ==========');
    
    try {
        // 方式1: 最简单的用法 - 只传文件路径，SDK自动处理一切
        console.log('\n1. 上传图片文件（方式1: 只传文件路径）...');
        const imagePath = './test_image.png';
        if (fs.existsSync(imagePath)) {
            console.log(`   文件路径: ${imagePath}`);
            
            const uploadResult = await GeneralAdmin.uploadFile(imagePath);
            
            console.log('上传结果:', uploadResult.isSuccess() ? '成功' : '失败');
            if (uploadResult.isSuccess()) {
                console.log('图片下载地址:', uploadResult.getResult());
            } else {
                console.log('错误信息:', uploadResult.getMsg());
            }
        } else {
            console.log('   跳过: 未找到 test_image.png 文件');
        }
        
        // 方式2: 指定媒体类型
        console.log('\n2. 上传图片文件（方式2: 指定媒体类型）...');
        if (fs.existsSync(imagePath)) {
            console.log(`   文件路径: ${imagePath}`);
            
            const uploadResult = await GeneralAdmin.uploadFile(
                imagePath,
                MessageContentMediaType.Image  // 明确指定为图片类型
            );
            
            console.log('上传结果:', uploadResult.isSuccess() ? '成功' : '失败');
            if (uploadResult.isSuccess()) {
                console.log('图片下载地址:', uploadResult.getResult());
            } else {
                console.log('错误信息:', uploadResult.getMsg());
            }
        } else {
            console.log('   跳过: 未找到 test_image.png 文件');
        }
        
        // 方式3: 指定媒体类型和Content-Type
        console.log('\n3. 上传 PDF 文件（方式3: 指定媒体类型和Content-Type）...');
        const pdfPath = './test_doc.pdf';
        if (fs.existsSync(pdfPath)) {
            console.log(`   文件路径: ${pdfPath}`);
            
            const uploadResult = await GeneralAdmin.uploadFile(
                pdfPath,
                MessageContentMediaType.File,
                'application/pdf'
            );
            
            console.log('上传结果:', uploadResult.isSuccess() ? '成功' : '失败');
            if (uploadResult.isSuccess()) {
                console.log('PDF 下载地址:', uploadResult.getResult());
            } else {
                console.log('错误信息:', uploadResult.getMsg());
            }
        } else {
            console.log('   跳过: 未找到 test_doc.pdf 文件');
        }
        
        // 方式4: 使用 Buffer（适用于内存中生成的内容）
        console.log('\n4. 从内存上传文本内容（方式4: 使用 Buffer）...');
        const testContent = '这是一个测试文件内容\nHello Wildfire Chat!\n上传时间: ' + new Date().toISOString();
        const testFileBuffer = Buffer.from(testContent, 'utf8');
        
        console.log(`   文件大小: ${testFileBuffer.length} 字节`);
        
        const uploadResult = await GeneralAdmin.uploadFile(
            testFileBuffer,                 // Buffer
            MessageContentMediaType.File,   // 媒体类型
            'text/plain'                    // Content-Type
        );
        
        console.log('上传结果:', uploadResult.isSuccess() ? '成功' : '失败');
        if (uploadResult.isSuccess()) {
            console.log('文件下载地址:', uploadResult.getResult());
        } else {
            console.log('错误信息:', uploadResult.getMsg());
        }
        
    } catch (error) {
        console.error('实际上传文件测试出错:', error.message);
    }
}

/**
 * 示例: RobotService 实际上传文件测试
 */
async function robotServiceUploadFileExample() {
    console.log('\n========== RobotService 实际上传文件测试 ==========');
    
    try {
        const robotService = new RobotService(ADMIN_URL, ROBOT_ID, ROBOT_SECRET);
        
        // 方式1: 最简单的用法 - 只传文件路径
        console.log('\n1. 机器人上传图片文件（方式1: 只传文件路径）...');
        const imagePath = './test_image.png';
        if (fs.existsSync(imagePath)) {
            console.log(`   文件路径: ${imagePath}`);
            
            const uploadResult = await robotService.uploadFile(imagePath);
            
            console.log('上传结果:', uploadResult.isSuccess() ? '成功' : '失败');
            if (uploadResult.isSuccess()) {
                console.log('图片下载地址:', uploadResult.getResult());
            } else {
                console.log('错误信息:', uploadResult.getMsg());
            }
        } else {
            console.log('   跳过: 未找到 test_image.png 文件');
        }
        
        // 方式2: 指定媒体类型
        console.log('\n2. 机器人上传图片文件（方式2: 指定媒体类型）...');
        if (fs.existsSync(imagePath)) {
            console.log(`   文件路径: ${imagePath}`);
            
            const uploadResult = await robotService.uploadFile(
                imagePath,
                MessageContentMediaType.Image
            );
            
            console.log('上传结果:', uploadResult.isSuccess() ? '成功' : '失败');
            if (uploadResult.isSuccess()) {
                console.log('图片下载地址:', uploadResult.getResult());
            } else {
                console.log('错误信息:', uploadResult.getMsg());
            }
        } else {
            console.log('   跳过: 未找到 test_image.png 文件');
        }
        
        // 方式3: 使用 Buffer（适用于内存中生成的内容）
        console.log('\n3. 机器人从内存上传文本内容（方式3: 使用 Buffer）...');
        const testContent = '这是机器人上传的测试文件\nRobot Upload Test\n时间: ' + new Date().toISOString();
        const testFileBuffer = Buffer.from(testContent, 'utf8');
        
        console.log(`   文件大小: ${testFileBuffer.length} 字节`);
        
        const uploadResult = await robotService.uploadFile(
            testFileBuffer,                 // Buffer
            MessageContentMediaType.File,   // 媒体类型
            'text/plain'                    // Content-Type
        );
        
        console.log('上传结果:', uploadResult.isSuccess() ? '成功' : '失败');
        if (uploadResult.isSuccess()) {
            console.log('文件下载地址:', uploadResult.getResult());
        } else {
            console.log('错误信息:', uploadResult.getMsg());
        }
        
    } catch (error) {
        console.error('RobotService 上传文件测试出错:', error.message);
    }
}

/**
 * 示例8: 机器人服务
 */
async function robotServiceExample() {
    console.log('\n========== 机器人服务示例 ==========');
    
    try {
        const robotService = new RobotService(ADMIN_URL, ROBOT_ID, ROBOT_SECRET);
        
        const profileResult = await robotService.getProfile();
        console.log('机器人资料:', profileResult.isSuccess() ? profileResult.getResult() : profileResult.getMsg());
        
        const signature = robotService.getApplicationSignature();
        console.log('应用签名:', signature);
        
        const conversation = new Conversation(ConversationType.Single, 'user1', 0);
        const payload = {
            type: MessageContentType.Text,
            searchableContent: 'Hello from Robot! 🤖'
        };
        const sendResult = await robotService.sendMessage(ROBOT_ID, conversation, payload);
        console.log('机器人发送消息结果:', sendResult.isSuccess() ? '成功' : sendResult.getMsg());
        
        // 机器人获取预签名上传地址
        console.log('\n2. 机器人获取预签名上传地址...');
        const uploadUrlResult = await robotService.getPresignedUploadUrl(
            'robot_upload_file.txt',
            MessageContentMediaType.File,
            'text/plain'
        );
        console.log('获取结果:', uploadUrlResult.isSuccess() ? '成功' : '失败');
        if (uploadUrlResult.isSuccess()) {
            console.log('上传地址信息:', JSON.stringify(uploadUrlResult.getResult(), null, 2));
        } else {
            console.log('错误信息:', uploadUrlResult.getMsg());
        }
        
    } catch (error) {
        console.error('机器人服务示例出错:', error.message);
    }
}


/**
 * 主函数
 */
async function main() {
    console.log('========================================');
    console.log('Wildfire Chat Server SDK 使用示例');
    console.log('========================================');
    
    // 运行所有示例（根据需要注释掉不需要的示例）
    await healthCheckExample();      // 系统健康检查
    // await userAdminExample();        // 用户管理
    // await messageAdminExample();     // 消息管理
    //await testMessageContent();      // 消息内容编码测试（与Java对齐）
    // await groupAdminExample();       // 群组管理
    // await relationAdminExample();    // 好友关系管理
    // await chatroomAdminExample();    // 聊天室管理
    // await robotServiceExample();     // 机器人服务
    //await generalAdminGetPresignedUploadUrlExample(); // GeneralAdmin 获取预签名上传地址
    //await generalAdminUploadFileExample();             // GeneralAdmin 实际上传文件测试
    //await robotServiceUploadFileExample();             // RobotService 实际上传文件测试
    
    console.log('\n========================================');
    console.log('示例运行完成');
    console.log('========================================');
}

// 运行主函数
main().catch(error => {
    console.error('示例运行出错:', error);
    process.exit(1);
});
