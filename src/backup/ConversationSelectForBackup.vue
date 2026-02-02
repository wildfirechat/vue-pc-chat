<template>
    <div class="conversation-select-container">
        <!-- 会话选择界面 -->
        <div v-if="!showProgress" class="select-view">
            <h2>选择要备份的会话</h2>
            <div class="actions">
                <button @click="selectAll" class="action-btn">{{ allSelected ? '取消全选' : '全选' }}</button>
                <span class="selected-count">已选择 {{ selectedConversations.size }} 个会话</span>
            </div>
            <div v-if="conversations.length === 0" class="empty">
                <p>暂无会话</p>
            </div>
            <!--            TODO virtual-list  !-->
            <div v-else class="conversation-list">
                <ConversationBackupItemView
                    v-for="convInfo in conversations"
                    :key="getConversationKey(convInfo)"
                    :source="convInfo"
                    :selected="isSelected(convInfo)"
                    @click="toggleSelection(convInfo)"/>
            </div>
            <div class="footer">
                <button @click="cancel" class="cancel-btn">取消</button>
                <button @click="startBackup" class="confirm-btn" :disabled="selectedConversations.size === 0">
                    开始备份
                </button>
            </div>
        </div>

        <!-- 进度界面 -->
        <div v-else class="progress-view">
            <h2>{{ progressTitle }}</h2>

            <!-- 进度信息 -->
            <div class="progress-info">
                <div class="status-text">{{ progressStatus }}</div>
                <div class="detail-text">{{ progressDetail }}</div>
            </div>

            <!-- 进度条 -->
            <div v-if="showProgressBar" class="progress-bar-container">
                <div class="progress-bar">
                    <div class="progress-fill" :style="{width: progressPercent + '%'}"></div>
                </div>
                <div class="progress-text">{{ Math.round(progressPercent) }}%</div>
            </div>

            <!-- 统计信息 -->
            <div v-if="backupCompleted" class="statistics">
                <div class="stat-item">
                    <div class="stat-label">会话数</div>
                    <div class="stat-value">{{ statistics.totalConversations }}</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">消息数</div>
                    <div class="stat-value">{{ statistics.totalMessages }}</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">媒体文件</div>
                    <div class="stat-value">{{ statistics.mediaFileCount }}</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">总大小</div>
                    <div class="stat-value">{{ formatFileSize(statistics.mediaTotalSize) }}</div>
                </div>
            </div>

            <!-- 关闭按钮 -->
            <div class="footer">
                <button v-if="backupCompleted" @click="closeProgress" class="close-btn">完成</button>
                <button v-else @click="cancelBackupAction" class="cancel-btn">取消</button>
            </div>
        </div>
    </div>
</template>

<script>
import wfc from "../wfc/client/wfc";
import {app} from "../platform";
import ConversationBackupItemView from "./ConversationBackupItemView.vue";
import store from "../store";
import {stringValue} from "../wfc/util/longUtil";

export default {
    name: "ConversationSelectForBackup",
    components: {
        ConversationBackupItemView
    },
    data() {
        return {
            conversations: store.state.conversation.conversationInfoList,
            selectedConversations: new Set(),
            allSelected: false,
            // 进度相关
            showProgress: false,
            progressTitle: '备份中...',
            progressStatus: '',
            progressDetail: '',
            showProgressBar: false,
            progressPercent: 0,
            backupCompleted: false,
            statistics: {
                totalConversations: 0,
                totalMessages: 0,
                mediaFileCount: 0,
                mediaTotalSize: 0
            },
            isCancelled: false
        }
    },
    mounted() {
    },
    methods: {

        getConversationKey(convInfo) {
            let conv = convInfo.conversation;
            return `${conv.type}-${conv.target}-${conv.line}`;
        },

        // 获取会话标题
        getConversationTitle(convInfo) {
            let conv = convInfo.conversation;
            if (conv._target) {
                return conv._target._displayName || conv._target.displayName || '未知会话';
            }
            return '';
        },

        // 关闭进度界面
        closeProgress() {
            this.close();
        },

        // 取消备份操作
        cancelBackupAction() {
            this.isCancelled = true;
        },

        // 格式化文件大小
        formatFileSize(bytes) {
            if (bytes < 1024) {
                return `${bytes} B`;
            } else if (bytes < 1024 * 1024) {
                return `${(bytes / 1024).toFixed(1)} KB`;
            } else if (bytes < 1024 * 1024 * 1024) {
                return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
            } else {
                return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
            }
        },

        isSelected(convInfo) {
            return this.selectedConversations.has(this.getConversationKey(convInfo));
        },

        toggleSelection(convInfo) {
            const key = this.getConversationKey(convInfo);
            if (this.selectedConversations.has(key)) {
                this.selectedConversations.delete(key);
            } else {
                this.selectedConversations.add(key);
            }
            // 强制更新视图
            this.$forceUpdate();
            this.updateAllSelectedState();
        },

        selectAll() {
            if (this.allSelected) {
                this.selectedConversations.clear();
            } else {
                this.conversations.forEach(convInfo => {
                    this.selectedConversations.add(this.getConversationKey(convInfo));
                });
            }
            this.allSelected = !this.allSelected;
            this.$forceUpdate();
        },

        updateAllSelectedState() {
            this.allSelected = this.selectedConversations.size === this.conversations.length;
        },

        async startBackup() {
            if (this.selectedConversations.size === 0) {
                return;
            }

            // 显示进度界面
            this.showProgress = true;
            this.progressTitle = '备份中...';
            this.progressStatus = '正在准备备份...';
            this.progressDetail = '';
            this.showProgressBar = true;
            this.progressPercent = 0;
            this.backupCompleted = false;
            this.isCancelled = false;

            // 等待Vue渲染进度界面后再执行备份
            await this.$nextTick();
            await new Promise(resolve => setTimeout(resolve, 100));

            try {
                const fs = require('fs');
                const path = require('path');
                const crypto = require('crypto');

                // 获取选中的会话对象（ConversationInfo）
                const selectedConvInfoList = this.conversations.filter(convInfo =>
                    this.selectedConversations.has(this.getConversationKey(convInfo))
                );

                // 获取当前用户ID作为密码
                const currentUserId = wfc.getUserId();
                const password = currentUserId || '';

                console.log('备份开始，当前用户ID:', currentUserId, '是否启用加密:', !!password);

                // 创建备份目录
                const userData = app.getPath('userData');
                const backupDir = path.join(userData, 'Backups', 'received');
                if (!fs.existsSync(backupDir)) {
                    fs.mkdirSync(backupDir, {recursive: true});
                }

                // 创建带时间戳的备份子目录
                const date = new Date();
                const timestamp = date.toISOString().replace(/[:.]/g, '-').slice(0, -5);
                const backupSubDir = path.join(backupDir, `backup_${timestamp}`);
                fs.mkdirSync(backupSubDir, {recursive: true});

                // 创建 conversations 子目录
                const conversationsDir = path.join(backupSubDir, 'conversations');
                fs.mkdirSync(conversationsDir, {recursive: true});

                // 统计信息
                let totalMessages = 0;
                let totalMediaFiles = 0;
                let totalMediaSize = 0;
                let firstMessageTime = Date.now();
                let lastMessageTime = 0;

                const conversationMetadata = [];

                // 遍历每个会话
                for (let i = 0; i < selectedConvInfoList.length; i++) {
                    if (this.isCancelled) {
                        throw new Error('用户取消备份');
                    }

                    const convInfo = selectedConvInfoList[i];
                    const conv = convInfo.conversation;

                    // 更新进度
                    const progress = ((i + 1) / selectedConvInfoList.length) * 100;
                    this.progressStatus = '正在备份会话';
                    this.progressDetail = `${i + 1}/${selectedConvInfoList.length}`;
                    this.progressPercent = progress;

                    // 让UI有机会更新
                    await this.$nextTick();

                    // 获取会话名称
                    const convName = this.getConversationTitle(convInfo);

                    const convDirName = this.getConversationDirectoryName(conv);
                    const convDir = path.join(conversationsDir, convDirName);

                    // 创建会话目录
                    fs.mkdirSync(convDir, {recursive: true});

                    // 创建 media 子目录
                    const mediaDir = path.join(convDir, 'media');
                    fs.mkdirSync(mediaDir, {recursive: true});

                    // 获取该会话的所有消息
                    const messagesArray = [];
                    let fromIndex = 0;
                    let convMessageCount = 0;
                    let convMediaCount = 0;
                    let convMediaSize = 0;

                    // 分批获取消息
                    while (true) {
                        if (this.isCancelled) {
                            throw new Error('用户取消备份');
                        }

                        const messages = wfc.getMessages(conv, fromIndex, false, 100, '');
                        if (messages.length === 0) break;

                        for (const msg of messages) {
                            // 编码消息
                            const msgDict = this.encodeMessage(msg, mediaDir, convMediaSize);
                            messagesArray.push(msgDict);
                            convMessageCount++;

                            // 统计媒体文件
                            if (msgDict.payload.localMediaInfo) {
                                convMediaCount++;
                                convMediaSize = msgDict.mediaFileSize || 0;
                                totalMediaSize += convMediaSize;
                            }

                            // 统计时间范围
                            const msgTime = msg.timestamp || msg.serverTime || Date.now();
                            if (msgTime < firstMessageTime) firstMessageTime = msgTime;
                            if (msgTime > lastMessageTime) lastMessageTime = msgTime;
                        }

                        fromIndex = messages[messages.length - 1].messageId;

                        // 更新进度详情
                        this.progressDetail = `${i + 1}/${selectedConvInfoList.length} - 已处理 ${convMessageCount} 条消息`;

                        // 每处理100条消息让UI有机会更新
                        if (convMessageCount % 100 === 0) {
                            await this.$nextTick();
                        }
                    }

                    // 保存 messages.json
                    const messagesData = {
                        version: '1',
                        conversation: this.encodeConversationInfo(convInfo),
                        settings: {
                            isTop: convInfo.isTop || false,
                            isSilent: convInfo.isSilent || false,
                            draft: convInfo.draft || ''
                        },
                        messages: messagesArray
                    };

                    const messagesJsonPath = path.join(convDir, 'messages.json');

                    let messageDataStr = JSON.stringify(messagesData);
                    messageDataStr = messageDataStr.replace(/"messageUid":"([0-9]+)"/g, '"messageUid":$1');

                    fs.writeFileSync(messagesJsonPath, messageDataStr, "utf-8");
                    // 如果提供了密码，加密 messages.json
                    if (password) {
                        console.log('正在加密 messages.json:', convDirName);
                        this.encryptMessagesFile(messagesJsonPath, password);
                        console.log('加密完成:', convDirName);
                    } else {
                        console.warn('警告：密码为空，messages.json 未加密:', convDirName);
                    }

                    // 收集会话元数据（与 iOS 保持一致）
                    totalMessages += convMessageCount;
                    totalMediaFiles += convMediaCount;

                    conversationMetadata.push({
                        conversationId: convDirName,
                        type: conv.type,
                        target: conv.target,
                        line: conv.line,
                        messageCount: convMessageCount,
                        mediaCount: convMediaCount,
                        directory: convDirName
                    });
                }

                // 创建 metadata.json（与 iOS 保持一致）
                const os = require('os');
                const metadata = {
                    version: '1',
                    format: 'directory',
                    backupTime: date.toISOString(),
                    userId: currentUserId,
                    appType: 'pc-chat',
                    backupMode: 'message_with_media',
                    deviceName: os.hostname() || 'PC', // 添加设备名称
                    encryption: {
                        enabled: !!password
                    }
                };

                // 如果启用了加密，添加加密算法信息（与 iOS 保持一致）
                if (password) {
                    metadata.encryption.algorithm = 'AES-256-CBC';
                    metadata.encryption.keyDerivation = 'PBKDF2-SHA256';
                    metadata.encryption.passwordHint = password;
                }

                metadata.statistics = {
                    totalConversations: selectedConvInfoList.length,
                    totalMessages: totalMessages,
                    mediaFileCount: totalMediaFiles,
                    mediaTotalSize: totalMediaSize,
                    timeRange: {
                        firstMessageTime: firstMessageTime,
                        lastMessageTime: lastMessageTime
                    }
                };
                metadata.conversations = conversationMetadata;

                const metadataPath = path.join(backupSubDir, 'metadata.json');
                fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');

                // 备份完成，显示统计信息
                this.backupCompleted = true;
                this.showProgressBar = false;
                this.progressTitle = '备份完成';
                this.progressStatus = '已成功完成备份';
                this.progressDetail = `已成功备份 ${selectedConvInfoList.length} 个会话，共 ${totalMessages} 条消息`;
                this.statistics = {
                    totalConversations: selectedConvInfoList.length,
                    totalMessages: totalMessages,
                    mediaFileCount: totalMediaFiles,
                    mediaTotalSize: totalMediaSize
                };

                // 3秒后自动关闭
                setTimeout(() => {
                    this.close();
                }, 3000);

            } catch (error) {
                console.error('本地备份失败:', error);

                if (error.message === '用户取消备份') {
                    this.$notify({
                        title: '已取消',
                        text: '备份已被取消',
                        type: 'info',
                        duration: 3000
                    });
                    this.close();
                } else {
                    this.$notify({
                        title: '备份失败',
                        text: error.message || '创建备份失败',
                        type: 'error',
                        duration: 5000
                    });
                    this.close();
                }
            }
        },

        // 获取会话目录名（与 iOS 保持一致）
        getConversationDirectoryName(conv) {
            // 对 target 进行 URL 编码以避免特殊字符问题
            const encodedTarget = encodeURIComponent(conv.target || 'unknown');
            // 格式：conv_{type}_{target}_line{line}
            return `conv_type${conv.type}_${encodedTarget}_line${conv.line}`;
        },

        // 编码会话信息
        encodeConversationInfo(convInfo) {
            const conv = convInfo.conversation;
            return {
                type: conv.type,
                target: conv.target,
                line: conv.line,
                timestamp: convInfo.timestamp
            };
        },

        // 编码消息
        encodeMessage(message, mediaDir, currentMediaSize) {
            const fs = require('fs');
            const path = require('path');

            const msgDict = {
                messageUid: stringValue(message.messageUid),
                fromUser: message.from || '',
                toUsers: message.toUsers || [],
                direction: message.direction || 0,
                status: message.status || 0,
                timestamp: message.timestamp || message.serverTime || Date.now(),
                localExtra: message.localExtra || ''
            };

            // 编码 payload
            const content = message.messageContent;
            const payload = content.encode ? content.encode() : content;

            const payloadDict = {
                contentType: payload.type || 0,
                searchableContent: payload.searchableContent || '',
                binaryContent: payload.binaryContent || '',
                pushContent: payload.pushContent || '',
                pushData: payload.pushData || '',
                content: payload.content || '',
                mentionedType: payload.mentionedType || 0,
                mentionedTargets: payload.mentionedTargets || [],
                extra: payload.extra || '',
                notLoaded: payload.notLoaded || false
            };

            // 处理 localContent
            if (payload.localContent) {
                payloadDict.localContent = payload.localContent;
            }

            msgDict.payload = payloadDict;

            // 处理媒体消息
            if (content instanceof Object && content.constructor.name) {
                const contentType = content.contentType || payload.type;

                // 检查是否为媒体消息类型
                if (contentType >= 3 && contentType <= 6) { // 3:Image, 4:Sound, 5:Video, 6:File
                    // 添加 mediaType 字段（与 iOS 保持一致）
                    if (content.mediaType !== undefined) {
                        payloadDict.mediaType = content.mediaType;
                    }
                    if (content.remoteMediaUrl) {
                        payloadDict.remoteMediaUrl = content.remoteMediaUrl;
                    }

                    // 处理本地媒体文件
                    if (content.localMediaPath) {
                        const localMediaPath = content.localMediaPath;
                        if (fs.existsSync(localMediaPath)) {
                            try {
                                // 计算 MD5
                                const md5 = this.calculateMD5(localMediaPath);
                                const fileId = md5.substring(0, 16);
                                const extension = path.extname(localMediaPath);
                                const fileName = `media_${fileId}${extension}`;
                                const targetPath = path.join(mediaDir, fileName);

                                // 复制文件
                                fs.copyFileSync(localMediaPath, targetPath);

                                // 获取文件大小
                                const stats = fs.statSync(targetPath);
                                const fileSize = stats.size;

                                // 添加媒体信息到 payload（与 iOS 保持一致）
                                payloadDict.localMediaInfo = {
                                    relativePath: fileName,
                                    fileId: fileId,
                                    fileSize: fileSize,
                                    md5: md5
                                };

                                msgDict.mediaFileSize = fileSize;
                            } catch (err) {
                                console.error('复制媒体文件失败:', err);
                            }
                        }
                    }
                }
            }

            return msgDict;
        },

        // 计算 MD5
        calculateMD5(filePath) {
            const crypto = require('crypto');
            const fs = require('fs');
            const content = fs.readFileSync(filePath);
            return crypto.createHash('md5').update(content).digest('hex');
        },

        // 加密 messages.json 文件（与 iOS 保持一致）
        encryptMessagesFile(filePath, password) {
            const crypto = require('crypto');
            const fs = require('fs');

            try {
                // 读取原始文件
                const plainText = fs.readFileSync(filePath, 'utf-8');
                const plainData = Buffer.from(plainText, 'utf-8');

                // 生成随机盐和IV（与 iOS 保持一致：16 字节）
                const salt = crypto.randomBytes(16);
                const iv = crypto.randomBytes(16);
                const keyLength = 32; // AES-256
                const iterations = 5000; // 与 iOS 保持一致：5000 次迭代

                // 使用 PBKDF2 派生密钥（与 iOS 保持一致）
                const key = crypto.pbkdf2Sync(password, salt, iterations, keyLength, 'sha256');

                // 创建加密器
                const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

                // 加密（使用 Buffer，与 iOS 保持一致）
                const encrypted = Buffer.concat([cipher.update(plainData), cipher.final()]);

                // 保存加密后的数据（与 iOS 格式完全一致：Base64 编码）
                const encryptedData = {
                    salt: salt.toString('base64'),    // Base64 编码
                    iv: iv.toString('base64'),        // Base64 编码
                    data: encrypted.toString('base64'), // Base64 编码
                    iterations: iterations
                };

                fs.writeFileSync(filePath, JSON.stringify(encryptedData), 'utf-8');
                console.log('加密成功，迭代次数:', iterations);
            } catch (error) {
                console.error('加密文件失败:', error);
                throw error;
            }
        },

        cancel() {
            this.close();
        },

        close() {
            this.$modal.hide('conversation-select-backup-modal');
        }
    }
}
</script>

<style lang="css" scoped>
.conversation-select-container {
    padding: 30px;
    min-width: 600px;
    max-height: 600px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.select-view {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden; /* 防止溢出 */
}

.select-view > h2 {
    flex-shrink: 0; /* 标题不缩小 */
}

.progress-view {
    display: flex;
    flex-direction: column;
    height: 100%;
}

.progress-view h2 {
    font-weight: normal;
    font-size: 20px;
    margin-bottom: 30px;
    text-align: center;
    color: #333;
    flex-shrink: 0;
}

.progress-info {
    text-align: center;
    margin-bottom: 30px;
}

.status-text {
    font-size: 18px;
    font-weight: 500;
    color: #333;
    margin-bottom: 10px;
}

.detail-text {
    font-size: 14px;
    color: #666;
}

.progress-bar-container {
    margin-bottom: 30px;
}

.progress-bar {
    width: 100%;
    height: 8px;
    background: #e0e0e0;
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 10px;
}

.progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #2196F3, #1976D2);
    transition: width 0.3s ease;
    border-radius: 4px;
}

.progress-text {
    text-align: center;
    font-size: 14px;
    color: #666;
}

.statistics {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 20px;
    margin-bottom: 30px;
    padding: 20px;
    background: #f5f5f5;
    border-radius: 8px;
}

.stat-item {
    text-align: center;
}

.stat-label {
    font-size: 14px;
    color: #666;
    margin-bottom: 8px;
}

.stat-value {
    font-size: 24px;
    font-weight: bold;
    color: #2196F3;
}

.conversation-select-container h2 {
    font-weight: normal;
    font-size: 20px;
    margin-bottom: 15px;
    text-align: center;
    color: #333;
    flex-shrink: 0;
}

.actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 15px;
    padding: 10px;
    background: #f5f5f5;
    border-radius: 6px;
    flex-shrink: 0; /* 确保不缩小 */
}

.action-btn {
    padding: 6px 16px;
    background: #2196F3;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    transition: background 0.3s;
}

.action-btn:hover {
    background: #1976D2;
}

.selected-count {
    font-size: 14px;
    color: #666;
}

.empty {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #999;
}

.conversation-list {
    flex: 1;
    overflow-y: auto;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    padding: 10px;
    min-height: 0;
    max-height: 400px; /* 限制列表最大高度，确保footer可见 */
}

.conversation-item {
    display: flex;
    align-items: center;
    padding: 12px;
    border-bottom: 1px solid #f0f0f0;
    cursor: pointer;
    border-radius: 6px;
    transition: background 0.2s;
}

.conversation-item:last-child {
    border-bottom: none;
}

.conversation-item:hover {
    background: #f9f9f9;
}

.conversation-item.selected {
    background: #e3f2fd;
}

.checkbox {
    width: 24px;
    height: 24px;
    margin-right: 12px;
    flex-shrink: 0;
}

.checkbox-unchecked {
    width: 20px;
    height: 20px;
    border: 2px solid #999;
    border-radius: 4px;
}

.checkbox-checked {
    width: 20px;
    height: 20px;
    background: #2196F3;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 14px;
    font-weight: bold;
}

.avatar {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f0f0f0;
    border-radius: 6px;
    margin-right: 12px;
    flex-shrink: 0;
    overflow: hidden;
}

.avatar img {
    width: 40px;
    height: 40px;
    object-fit: cover;
    border-radius: 6px;
}

.avatar-placeholder {
    font-size: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
}

.info {
    flex: 1;
    min-width: 0;
}

.name {
    font-size: 16px;
    font-weight: 500;
    color: #333;
    margin-bottom: 4px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.detail {
    font-size: 13px;
    color: #999;
}

.footer {
    margin-top: 15px;
    display: flex;
    gap: 10px;
    justify-content: center;
    flex-shrink: 0; /* 确保footer不被压缩 */
    padding-top: 15px;
    border-top: 1px solid #e0e0e0;
}

.cancel-btn {
    padding: 10px 30px;
    background: #e0e0e0;
    color: #666;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 16px;
    transition: background 0.3s;
}

.cancel-btn:hover {
    background: #d0d0d0;
}

.confirm-btn {
    padding: 10px 30px;
    background: #2196F3;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 16px;
    transition: background 0.3s;
}

.confirm-btn:hover:not(:disabled) {
    background: #1976D2;
}

.confirm-btn:disabled {
    background: #ccc;
    cursor: not-allowed;
    opacity: 0.6;
}
</style>
