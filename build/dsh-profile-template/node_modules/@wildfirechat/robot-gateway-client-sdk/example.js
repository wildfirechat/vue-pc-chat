/**
 * 机器人网关客户端 SDK 使用示例
 * 
 * 运行前请确保：
 * 1. 网关服务已启动 (ws://localhost:8884)
 * 2. 已创建机器人并配置回调地址
 * 3. 依赖已安装: npm install
 */

import { 
    RobotServiceClient, 
    Conversation, 
    ConversationType,
    MessageContentType,
    init 
} from './src/index.js';
import fs from 'fs';
import path from 'path';

// ==================== 配置 ====================
const GATEWAY_URL = 'ws://localhost:8884/robot/gateway';
const ROBOT_ID = 'FireRobot';
const ROBOT_SECRET = '123456';

// 初始化 server-sdk（用于创建模型对象，实际请求走网关）
// 这里只需要初始化模型，不需要真实的 admin-secret
init('http://localhost:18080', 'dummy');

// ==================== 消息处理器 ====================
const messageHandler = {
    onMessage: (pushMessage) => {
        console.log('\n📩 收到消息:');
        console.log('  类型:', pushMessage.type);
        console.log('  数据:', JSON.stringify(pushMessage.data, null, 2));
        
        // 自动回复示例
        handleIncomingMessage(pushMessage.data);
    },
    
    onConnectionChanged: (connected) => {
        console.log(connected ? '\n✅ 已连接到网关' : '\n❌ 与网关断开连接');
    },
    
    onError: (error) => {
        console.error('\n💥 错误:', error);
    }
};

// ==================== 创建客户端 ====================
const client = new RobotServiceClient(
    GATEWAY_URL,
    messageHandler,
    {
        timeout: 30,
        reconnectInterval: 5000,
        heartbeatInterval: 270000
    }
);

// ==================== 消息处理逻辑 ====================
async function handleIncomingMessage(data) {
    const { sender, conv, payload } = data;
    
    // 只处理文本消息
    if (payload.type === MessageContentType.Text) {
        const content = payload.searchableContent || payload.content;
        console.log(`  内容: ${content}`);
        
        // 简单回复
        const replyPayload = {
            type: MessageContentType.Text,
            searchableContent: `收到你的消息: "${content}"`
        };
        
        try {
            const result = await client.sendMessage(conv, replyPayload);
            if (result.isSuccess()) {
                console.log('  ✅ 自动回复成功');
            } else {
                console.log('  ❌ 自动回复失败:', result.getMsg());
            }
        } catch (error) {
            console.error('  ❌ 自动回复错误:', error.message);
        }
    }
}

// ==================== 命令处理 ====================
async function processCommand(command, args) {
    switch (command) {
        case 'send': {
            // send <userId> <message>
            if (args.length < 2) {
                console.log('用法: send <userId> <message>');
                return;
            }
            const [userId, ...messageParts] = args;
            const message = messageParts.join(' ');
            
            const conversation = new Conversation(ConversationType.Single, userId, 0);
            const payload = {
                type: MessageContentType.Text,
                searchableContent: message
            };
            
            const result = await client.sendMessage(conversation, payload);
            if (result.isSuccess()) {
                console.log(`✅ 消息已发送给 ${userId}`);
            } else {
                console.log('❌ 发送失败:', result.getMsg());
            }
            break;
        }
        
        case 'info': {
            // info <userId>
            if (args.length < 1) {
                console.log('用法: info <userId>');
                return;
            }
            const userId = args[0];
            const result = await client.getUserInfo(userId);
            
            if (result.isSuccess()) {
                console.log('用户信息:', JSON.stringify(result.getResult(), null, 2));
            } else {
                console.log('获取失败:', result.getMsg());
            }
            break;
        }
        
        case 'profile': {
            const result = await client.getProfile();
            if (result.isSuccess()) {
                console.log('机器人资料:', JSON.stringify(result.getResult(), null, 2));
            } else {
                console.log('获取失败:', result.getMsg());
            }
            break;
        }
        
        case 'group': {
            // group <groupName> <member1> [member2] ...
            if (args.length < 2) {
                console.log('用法: group <groupName> <member1> [member2] ...');
                return;
            }
            const [groupName, ...members] = args;
            
            const groupInfo = {
                name: groupName,
                type: 2 // 普通群组
            };
            
            const memberList = members.map(userId => ({
                memberId: userId,
                alias: ''
            }));
            
            // 使用简化参数创建群组（to, lines, payload 可选）
            const result = await client.createGroup(groupInfo, memberList, null, [0], null);
            if (result.isSuccess()) {
                console.log('✅ 群组创建成功:', result.getResult());
            } else {
                console.log('❌ 创建失败:', result.getMsg());
            }
            break;
        }
        
        case 'friendlist': {
            const result = await client.getOwnerFriendList();
            if (result.isSuccess()) {
                const friends = result.getResult().friends || [];
                console.log(`好友数量: ${friends.length}`);
                if (friends.length > 0) {
                    console.log('好友列表:', friends.join(', '));
                }
            } else {
                console.log('获取失败:', result.getMsg());
            }
            break;
        }

        case 'search': {
            // search <keyword>
            if (args.length < 1) {
                console.log('用法: search <keyword>');
                return;
            }
            const keyword = args[0];
            const result = await client.searchUserByDisplayName(keyword);
            if (result.isSuccess()) {
                const userInfos = result.getResult().userInfos || [];
                console.log(`搜索到 ${userInfos.length} 个用户`);
                userInfos.forEach(u => console.log(`  ID: ${u.userId}, 昵称: ${u.displayName}`));
            } else {
                console.log('搜索失败:', result.getMsg());
            }
            break;
        }

        case 'robots': {
            // robots <userId>
            if (args.length < 1) {
                console.log('用法: robots <userId>');
                return;
            }
            const userId = args[0];
            const result = await client.getUserRobots(userId);
            if (result.isSuccess()) {
                const robots = result.getResult().robotInfoList || [];
                console.log(`找到 ${robots.length} 个机器人`);
                robots.forEach(r => console.log(`  ID: ${r.userId}, 昵称: ${r.displayName}`));
            } else {
                console.log('获取失败:', result.getMsg());
            }
            break;
        }

        case 'status': {
            console.log('连接状态:', client.isConnected() ? '已连接' : '未连接');
            console.log('鉴权状态:', client.isAuthenticated() ? '已鉴权' : '未鉴权');
            break;
        }
        
        case 'upload': {
            // upload <filePath> [userId]
            if (args.length < 1) {
                console.log('用法: upload <filePath> [userId]');
                console.log('示例: upload ./test.jpg');
                console.log('示例: upload ./test.jpg user1');
                return;
            }
            const filePath = args[0];
            const targetUserId = args[1]; // 可选，如果提供则发送图片消息
            
            try {
                // 检查文件是否存在
                if (!fs.existsSync(filePath)) {
                    console.log('❌ 文件不存在:', filePath);
                    return;
                }
                
                // 读取文件
                const fileData = fs.readFileSync(filePath);
                const fileName = path.basename(filePath);
                
                console.log(`📤 正在上传文件: ${fileName} (${fileData.length} 字节)`);
                
                // 上传文件
                const result = await client.uploadFile(fileData, fileName);
                
                if (result.isSuccess()) {
                    console.log('✅ 文件上传成功!');
                    console.log('📎 下载URL:', result.result);
                    
                    // 如果提供了目标用户，发送图片/文件消息
                    if (targetUserId) {
                        const fileExt = path.extname(fileName).toLowerCase();
                        const isImage = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'].includes(fileExt);
                        
                        const conversation = new Conversation(ConversationType.Single, targetUserId, 0);
                        const payload = {
                            type: isImage ? MessageContentType.Image : MessageContentType.File,
                            searchableContent: isImage ? '[图片]' : `[文件] ${fileName}`,
                            remoteMediaUrl: result.result
                        };
                        
                        const sendResult = await client.sendMessage(conversation, payload);
                        if (sendResult.isSuccess()) {
                            console.log(`✅ ${isImage ? '图片' : '文件'}消息已发送给 ${targetUserId}`);
                        } else {
                            console.log('❌ 发送消息失败:', sendResult.getMsg());
                        }
                    }
                } else {
                    console.log('❌ 上传失败:', result.msg);
                }
            } catch (error) {
                console.error('❌ 上传错误:', error.message);
            }
            break;
        }
        
        case 'upload-stream': {
            // upload-stream <filePath> [userId]
            if (args.length < 1) {
                console.log('用法: upload-stream <filePath> [userId]');
                console.log('示例: upload-stream ./large-video.mp4');
                return;
            }
            const filePath = args[0];
            const targetUserId = args[1];
            
            try {
                if (!fs.existsSync(filePath)) {
                    console.log('❌ 文件不存在:', filePath);
                    return;
                }
                
                const fileName = path.basename(filePath);
                const stats = fs.statSync(filePath);
                
                console.log(`📤 正在使用流式上传: ${fileName} (${stats.size} 字节)`);
                
                // 创建可读流
                const stream = fs.createReadStream(filePath);
                
                // 将流转换为 Buffer（实际生产环境可能需要分片上传大文件）
                const chunks = [];
                for await (const chunk of stream) {
                    chunks.push(chunk);
                }
                const fileData = Buffer.concat(chunks);
                
                const result = await client.uploadFile(fileData, fileName);
                
                if (result.isSuccess()) {
                    console.log('✅ 流式上传成功!');
                    console.log('📎 下载URL:', result.result);
                    
                    if (targetUserId) {
                        const fileExt = path.extname(fileName).toLowerCase();
                        const isVideo = ['.mp4', '.mov', '.avi'].includes(fileExt);
                        
                        const conversation = new Conversation(ConversationType.Single, targetUserId, 0);
                        const payload = {
                            type: isVideo ? MessageContentType.Video : MessageContentType.File,
                            searchableContent: isVideo ? '[视频]' : `[文件] ${fileName}`,
                            remoteMediaUrl: result.result
                        };
                        
                        const sendResult = await client.sendMessage(conversation, payload);
                        if (sendResult.isSuccess()) {
                            console.log(`✅ ${isVideo ? '视频' : '文件'}消息已发送给 ${targetUserId}`);
                        } else {
                            console.log('❌ 发送消息失败:', sendResult.getMsg());
                        }
                    }
                } else {
                    console.log('❌ 流式上传失败:', result.msg);
                }
            } catch (error) {
                console.error('❌ 流式上传错误:', error.message);
            }
            break;
        }
        
        case 'help': {
            console.log('\n可用命令:');
            console.log('  send <userId> <message>         - 发送消息');
            console.log('  info <userId>                   - 获取用户信息');
            console.log('  group <name> <members...>       - 创建群组');
            console.log('  profile                         - 获取机器人资料');
            console.log('  friendlist                      - 获取机器人owner好友列表');
            console.log('  search <keyword>                - 根据昵称搜索用户');
            console.log('  robots <userId>                 - 获取指定用户的机器人列表');
            console.log('  status                          - 查看连接状态');
            console.log('  upload <filePath> [userId]      - 上传文件(支持七牛/S3/OSS)');
            console.log('  upload-stream <filePath> [userId] - 流式上传大文件');
            console.log('  help                            - 显示帮助');
            console.log('  quit                            - 退出程序');
            break;
        }
        
        case 'quit':
        case 'exit': {
            console.log('正在退出...');
            client.close();
            process.exit(0);
        }
        
        default:
            console.log(`未知命令: ${command}，输入 help 查看帮助`);
    }
}

// ==================== 主程序 ====================
async function main() {
    console.log('🤖 野火IM机器人客户端示例');
    console.log('========================');
    console.log(`网关地址: ${GATEWAY_URL}`);
    console.log(`机器人ID: ${ROBOT_ID}`);
    console.log('');
    
    // 连接
    console.log('正在连接...');
    const connected = await client.connect(ROBOT_ID, ROBOT_SECRET);
    
    if (!connected) {
        console.error('❌ 连接失败，请检查配置');
        process.exit(1);
    }
    
    console.log('✅ 连接成功！');
    console.log('输入 help 查看可用命令\n');
    
    // 读取命令行输入
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', async (data) => {
        const line = data.trim();
        if (!line) return;
        
        const parts = line.split(' ');
        const command = parts[0];
        const args = parts.slice(1);
        
        try {
            await processCommand(command, args);
        } catch (error) {
            console.error('命令执行错误:', error.message);
        }
        
        process.stdout.write('> ');
    });
    
    process.stdout.write('> ');
}

// 处理退出
process.on('SIGINT', () => {
    console.log('\n正在关闭连接...');
    client.close();
    process.exit(0);
});

// 启动
main().catch(error => {
    console.error('程序错误:', error);
    process.exit(1);
});
