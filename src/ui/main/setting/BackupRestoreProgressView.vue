<template>
    <div class="restore-progress-container">
        <h2>{{ showRestoreInfo ? '恢复备份' : '恢复数据中' }}</h2>

        <!-- 备份信息显示（恢复前） -->
        <div v-if="showRestoreInfo" class="backup-info">
            <div class="info-row">
                <span class="label">备份时间:</span>
                <span class="value">{{ backupInfo.backupTime }}</span>
            </div>
            <div class="info-row">
                <span class="label">备份设备:</span>
                <span class="value">{{ backupInfo.deviceName }}</span>
            </div>
            <div class="info-row">
                <span class="label">会话数量:</span>
                <span class="value">{{ backupInfo.conversationCount }}</span>
            </div>
            <div class="info-row">
                <span class="label">消息数量:</span>
                <span class="value">{{ backupInfo.messageCount }}</span>
            </div>
            <div class="info-row">
                <span class="label">媒体文件:</span>
                <span class="value">{{ backupInfo.mediaCount }} 个 ({{ backupInfo.mediaSize }})</span>
            </div>
        </div>

        <!-- 进度信息（恢复中） -->
        <div v-if="!showRestoreInfo" class="progress-info">
            <div class="status-text">{{ statusText }}</div>
            <div class="detail-text">{{ detailText }}</div>
            <div v-if="isRestoring" class="restore-statistics">
                已恢复 {{ currentStatistics.conversations }} 个会话，
                {{ currentStatistics.messages }} 条消息，
                {{ currentStatistics.media }} 个媒体文件
            </div>
        </div>

        <!-- 进度条 -->
        <div v-if="!showRestoreInfo && showProgress" class="progress-bar-container">
            <div class="progress-bar">
                <div class="progress-fill" :style="{width: progress + '%'}"></div>
            </div>
            <div class="progress-text">{{ Math.round(progress) }}%</div>
        </div>

        <!-- 统计信息 -->
        <div v-if="completed" class="statistics">
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
                <div class="stat-value">{{ statistics.totalMedia }}</div>
            </div>
        </div>

        <!-- 关闭按钮 -->
        <div class="footer">
            <button v-if="showRestoreInfo" @click="confirmRestore" class="confirm-btn">开始恢复</button>
            <button v-else-if="isRestoring" class="cancel-btn" disabled>恢复中...</button>
            <button v-else-if="completed" @click="close" class="close-btn">完成</button>
            <button v-else @click="cancel" class="cancel-btn">取消</button>
        </div>
    </div>
</template>

<script>
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
import wfc from "../../../wfc/client/wfc";
import {app} from "../../../platform";
import Message from "../../../wfc/messages/message";

export default {
    name: "BackupRestoreProgressView",
    props: {
        backupPath: {
            type: String,
            required: true
        }
    },
    data() {
        return {
            showRestoreInfo: true, // 先显示备份信息
            isRestoring: false, // 正在恢复中
            backupInfo: {
                backupTime: '',
                deviceName: '',
                conversationCount: 0,
                messageCount: 0,
                mediaCount: 0,
                mediaSize: ''
            },
            statusText: '',
            detailText: '',
            progress: 0,
            showProgress: false,
            completed: false,
            isCancelled: false,
            currentStatistics: {
                conversations: 0,
                messages: 0,
                media: 0
            },
            statistics: {
                totalConversations: 0,
                totalMessages: 0,
                totalMedia: 0
            }
        }
    },
    mounted() {
        this.loadBackupInfo();
    },
    methods: {
        loadBackupInfo() {
            try {
                // 读取 metadata.json
                const metadataPath = path.join(this.backupPath, 'metadata.json');
                const metadataContent = fs.readFileSync(metadataPath, 'utf-8');
                const metadata = JSON.parse(metadataContent);

                // 格式化备份时间
                const backupTime = new Date(metadata.backupTime);
                const year = backupTime.getFullYear();
                const month = String(backupTime.getMonth() + 1).padStart(2, '0');
                const day = String(backupTime.getDate()).padStart(2, '0');
                const hours = String(backupTime.getHours()).padStart(2, '0');
                const minutes = String(backupTime.getMinutes()).padStart(2, '0');
                const dateStr = `${year}-${month}-${day} ${hours}:${minutes}`;

                // 填充备份信息
                this.backupInfo = {
                    backupTime: dateStr,
                    deviceName: metadata.deviceName || '未知设备',
                    conversationCount: metadata.statistics?.totalConversations || 0,
                    messageCount: metadata.statistics?.totalMessages || 0,
                    mediaCount: metadata.statistics?.mediaFileCount || 0,
                    mediaSize: this.formatFileSize(metadata.statistics?.mediaTotalSize || 0)
                };
            } catch (error) {
                console.error('读取备份信息失败:', error);
                this.statusText = '读取备份信息失败';
                this.detailText = error.message || '未知错误';
                this.showRestoreInfo = false;
            }
        },

        confirmRestore() {
            this.showRestoreInfo = false;
            this.isRestoring = true;

            // 使用 setTimeout 让 UI 线程有时间渲染"恢复中..."状态
            setTimeout(() => {
                this.startRestore();
            }, 100);
        },

        async startRestore() {
            try {
                console.log('开始恢复备份:', this.backupPath);

                // 读取 metadata.json
                const metadataPath = path.join(this.backupPath, 'metadata.json');
                const metadataContent = fs.readFileSync(metadataPath, 'utf-8');
                const metadata = JSON.parse(metadataContent);

                console.log('备份元数据:', metadata);

                // 检查是否加密
                const isEncrypted = metadata.encryption && metadata.encryption.enabled;
                let password = '';

                if (isEncrypted) {
                    // 使用当前用户ID作为密码
                    password = wfc.getUserId() || '';
                    if (!password) {
                        throw new Error('无法获取用户ID，无法解密备份');
                    }
                    console.log('备份已加密，使用用户ID解密');
                }

                // 获取会话列表
                const convList = metadata.conversations || [];
                const total = convList.length;

                console.log('准备恢复', total, '个会话');

                this.statusText = '正在恢复会话...';
                this.showProgress = true;

                let totalMessages = 0;
                let totalMedia = 0;

                for (let i = 0; i < convList.length; i++) {
                    if (this.isCancelled) {
                        throw new Error('用户取消恢复');
                    }

                    const convInfo = convList[i];
                    this.progress = (i / total) * 100;
                    this.detailText = `${i + 1}/${total} - ${convInfo.target}`;

                    // 让 UI 有机会更新进度显示
                    await this.delay(10);

                    // 会话目录路径
                    const convDir = path.join(this.backupPath, 'conversations', convInfo.directory);
                    const messagesPath = path.join(convDir, 'messages.json');

                    if (!fs.existsSync(messagesPath)) {
                        console.warn('messages.json 不存在:', messagesPath);
                        continue;
                    }

                    // 读取 messages.json
                    let messagesJsonData = fs.readFileSync(messagesPath, 'utf-8');

                    // 如果加密，先解密
                    if (isEncrypted) {
                        try {
                            const encryptedDict = JSON.parse(messagesJsonData);
                            messagesJsonData = this.decryptData(encryptedDict, password);
                        } catch (error) {
                            console.error('解密失败:', convInfo.directory, error);
                            continue;
                        }
                    }

                    // 解析消息数据
                    messagesJsonData = messagesJsonData.replace(/"messageUid":([0-9]+)/g, '"messageUid":"$1"');
                    const convData = JSON.parse(messagesJsonData);

                    // 恢复消息
                    const mediaDir = path.join(convDir, 'media');
                    const result = await this.restoreMessages(convData, mediaDir);

                    totalMessages += result.messageCount;
                    totalMedia += result.mediaCount;

                    // 更新实时统计
                    this.currentStatistics.conversations = i + 1;
                    this.currentStatistics.messages = totalMessages;
                    this.currentStatistics.media = totalMedia;
                }

                this.progress = 100;
                this.completed = true;
                this.showProgress = false;
                this.isRestoring = false;
                this.statusText = '恢复完成';
                this.detailText = `已成功恢复 ${total} 个会话，共 ${totalMessages} 条消息`;
                this.statistics = {
                    totalConversations: total,
                    totalMessages: totalMessages,
                    totalMedia: totalMedia
                };

            } catch (error) {
                console.error('恢复失败:', error);
                this.isRestoring = false;
                this.statusText = '恢复失败';
                this.detailText = error.message || '未知错误';
                this.showProgress = false;
            }
        },

        // 延迟辅助方法，让 UI 有机会更新
        delay(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
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

        // 解密数据
        decryptData(encryptedData, password) {
            const salt = Buffer.from(encryptedData.salt, 'base64');
            const iv = Buffer.from(encryptedData.iv, 'base64');
            const encrypted = Buffer.from(encryptedData.data, 'base64');
            const iterations = encryptedData.iterations || 5000;

            // 使用 PBKDF2 派生密钥
            const key = crypto.pbkdf2Sync(password, salt, iterations, 32, 'sha256');

            // 解密
            const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
            const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

            return decrypted.toString('utf-8');
        },

        // 恢复消息
        async restoreMessages(convData, mediaDir) {
            let messageCount = 0;
            let mediaCount = 0;

            const conversation = convData.conversation;
            const messages = convData.messages || [];

            // 创建会话对象
            const conv = {
                type: conversation.type,
                target: conversation.target,
                line: conversation.line
            };

            for (const msgDict of messages) {
                try {
                    // 解码消息
                    const {message, payload} = this.decodeMessage(msgDict, conv, mediaDir);

                    // 插入到数据库（使用 insertMessageEx）
                    const msgId = wfc.insertMessageEx(
                        msgDict.messageUid,
                        conv,
                        msgDict.fromUser,
                        message,
                        msgDict.status || 0,
                        msgDict.timestamp || msgDict.serverTime || Date.now(),
                        msgDict.localExtra || ''
                    );

                    if (msgId && msgId > 0) {
                        messageCount++;

                        // 统计媒体文件
                        if (payload && payload.localMediaInfo) {
                            mediaCount++;
                        }
                    }
                } catch (error) {
                    console.error('恢复消息失败:', error);
                }
            }

            return {messageCount, mediaCount};
        },

        // 解码消息
        decodeMessage(msgDict, conversation, mediaDir) {
            // 解码 payload
            const payloadDict = msgDict.payload;
            const payload = {
                type: payloadDict.contentType || 0,
                binaryContent: payloadDict.binaryContent || '',
                searchableContent: payloadDict.searchableContent || '',
                pushContent: payloadDict.pushContent || '',
                pushData: payloadDict.pushData || '',
                content: payloadDict.content || '',
                mentionedType: payloadDict.mentionedType || 0,
                mentionedTargets: payloadDict.mentionedTargets || [],
                extra: payloadDict.extra || '',
                notLoaded: payloadDict.notLoaded || false
            };

            // 处理 localContent
            if (payloadDict.localContent) {
                payload.localContent = payloadDict.localContent;
            }

            // 处理媒体消息
            if (payloadDict.localMediaInfo) {
                const mediaInfo = payloadDict.localMediaInfo;
                const relativePath = mediaInfo.relativePath;
                const fileId = mediaInfo.fileId;

                if (relativePath && fileId && mediaDir) {
                    const backupFilePath = path.join(mediaDir, relativePath);

                    if (fs.existsSync(backupFilePath)) {
                        // 生成新的媒体文件存储路径
                        const sendboxDir = path.join(app.getPath('userData'), 'sendbox');
                        if (!fs.existsSync(sendboxDir)) {
                            fs.mkdirSync(sendboxDir, {recursive: true});
                        }

                        const extension = path.extname(relativePath);
                        const newFileName = `${fileId}${extension}`;
                        const newFilePath = path.join(sendboxDir, newFileName);

                        // 复制文件
                        try {
                            fs.copyFileSync(backupFilePath, newFilePath);

                            // 设置 localMediaPath
                            payload.localMediaPath = newFilePath;
                            console.log('恢复媒体文件:', newFileName);
                        } catch (error) {
                            console.error('复制媒体文件失败:', error);
                        }
                    }
                }
            }

            // 添加 remoteMediaUrl 和 mediaType
            if (payloadDict.remoteMediaUrl) {
                payload.remoteMediaUrl = payloadDict.remoteMediaUrl;
            }
            if (payloadDict.mediaType !== undefined) {
                payload.mediaType = payloadDict.mediaType;
            }

            // 使用 Message.messageContentFromMessagePayload 创建消息内容
            const messageContent = Message.messageContentFromMessagePayload(payload, msgDict.fromUser);

            return {message: messageContent, payload: payload};
        },

        close() {
            this.$modal.hide('backup-restore-progress-modal');
        },

        cancel() {
            // 如果正在恢复，不允许取消
            if (this.isRestoring) {
                return;
            }
            this.isCancelled = true;
            this.$modal.hide('backup-restore-progress-modal');
        }
    }
}
</script>

<style lang="css" scoped>
.restore-progress-container {
    padding: 30px;
    min-width: 500px;
    display: flex;
    flex-direction: column;
}

.restore-progress-container h2 {
    font-weight: normal;
    font-size: 20px;
    margin-bottom: 30px;
    text-align: center;
    color: #333;
}

.backup-info {
    background: #f9f9f9;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 30px;
}

.info-row {
    display: flex;
    justify-content: space-between;
    padding: 8px 0;
    border-bottom: 1px solid #f0f0f0;
}

.info-row:last-child {
    border-bottom: none;
}

.info-row .label {
    font-size: 14px;
    color: #666;
    font-weight: 500;
}

.info-row .value {
    font-size: 14px;
    color: #333;
    font-weight: 600;
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

.restore-statistics {
    font-size: 13px;
    color: #2196F3;
    margin-top: 12px;
    font-weight: 500;
    background: #f0f7ff;
    padding: 8px 12px;
    border-radius: 4px;
    display: inline-block;
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
    grid-template-columns: repeat(3, 1fr);
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

.footer {
    text-align: center;
}

.close-btn, .cancel-btn, .confirm-btn {
    padding: 10px 40px;
    border: none;
    border-radius: 4px;
    font-size: 16px;
    cursor: pointer;
    transition: background 0.3s;
}

.close-btn {
    background: #2196F3;
    color: white;
}

.close-btn:hover {
    background: #1976D2;
}

.confirm-btn {
    background: #2196F3;
    color: white;
}

.confirm-btn:hover {
    background: #1976D2;
}

.cancel-btn {
    background: #e0e0e0;
    color: #666;
}

.cancel-btn:hover {
    background: #d0d0d0;
}

.cancel-btn:disabled {
    background: #e0e0e0;
    color: #999;
    cursor: not-allowed;
}

.cancel-btn:disabled:hover {
    background: #e0e0e0;
}
</style>
