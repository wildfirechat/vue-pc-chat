<template>
    <div class="backup-list-container">
        <h2>备份列表</h2>
        <div v-if="loading" class="loading">
            加载中...
        </div>
        <div v-else-if="backups.length === 0" class="empty">
            <p>暂无备份</p>
            <p class="hint">当手机端完成备份后，备份会显示在这里</p>
        </div>
        <div v-else class="backup-list">
            <div v-for="(backup, index) in backups" :key="index" class="backup-item">
                <div class="backup-info">
                    <div class="backup-name">{{ backup.name }}</div>
                    <div class="backup-detail">
                        <span>{{ backup.date }}</span>
                        <span v-if="backup.deviceName">设备: {{ backup.deviceName }}</span>
                        <span>{{ backup.messageCount }} 条消息</span>
                        <span>{{ backup.mediaCount }} 个媒体文件</span>
                    </div>
                    <div class="backup-size">{{ backup.size }}</div>
                </div>
                <div class="backup-actions">
                    <button v-if="mode === 'restore'" @click="restoreBackup(index)" class="restore-btn">恢复</button>
                    <button v-if="mode === 'view'" @click="deleteBackup(index)" class="delete-btn">删除</button>
                </div>
            </div>
        </div>
        <div class="footer">
            <button @click="close" class="close-btn">关闭</button>
        </div>

        <!-- 删除确认对话框 -->
        <div v-if="showDeleteDialog" class="dialog-overlay" @click="closeDeleteDialog">
            <div class="dialog-box" @click.stop>
                <h3>确认删除</h3>
                <p class="dialog-text">{{ deleteDialogText }}</p>
                <div class="dialog-buttons">
                    <button class="cancel-button" @click="closeDeleteDialog">取消</button>
                    <button class="confirm-button" @click="confirmDelete">删除</button>
                </div>
            </div>
        </div>

        <!-- 提示对话框 -->
        <div v-if="showHintDialog" class="dialog-overlay" @click="closeHintDialog">
            <div class="dialog-box" @click.stop>
                <h3>{{ hintTitle }}</h3>
                <p class="dialog-text">{{ hintText }}</p>
                <button class="dialog-button" @click="closeHintDialog">我知道了</button>
            </div>
        </div>
    </div>
</template>

<script>
const fs = require('fs');
const path = require('path');
const {app} = require('../platform');

export default {
    name: "BackupListView",
    props: {
        mode: {
            type: String,
            default: 'view', // 'view' 或 'restore'
            validator: (value) => ['view', 'restore'].includes(value)
        }
    },
    data() {
        return {
            loading: false,
            backups: [],
            backupBasePath: '', // 备份基础路径
            showDeleteDialog: false,
            deleteDialogText: '',
            deleteBackupIndex: -1,
            showHintDialog: false,
            hintTitle: '',
            hintText: ''
        }
    },
    methods: {
        async loadBackups() {
            this.loading = true;
            try {
                // 使用与HomePage相同的方式获取备份目录
                const userData = app.getPath('userData');
                const backupDir = path.join(userData, 'Backups');
                this.backupBasePath = path.join(backupDir, 'received');

                this.loadBackupsFromDirectory();
            } catch (error) {
                console.error('加载备份列表失败:', error);
                this.showHint('错误', '加载备份列表失败: ' + error.message);
                this.loading = false;
            }
        },

        loadBackupsFromDirectory() {
            try {
                // 确保备份目录存在
                if (!fs.existsSync(this.backupBasePath)) {
                    console.log('备份目录不存在:', this.backupBasePath);
                    this.backups = [];
                    this.loading = false;
                    return;
                }

                // 读取备份目录中的所有子目录，过滤出backup_开头的目录
                const files = fs.readdirSync(this.backupBasePath);
                console.log('读取到的文件/目录:', files);

                const backupItems = files.filter(fileName => {
                    // 只处理backup_开头的目录
                    if (!fileName.startsWith('backup_')) {
                        return false;
                    }
                    const filePath = path.join(this.backupBasePath, fileName);
                    const stat = fs.statSync(filePath);
                    return stat.isDirectory();
                }).map(fileName => {
                    const filePath = path.join(this.backupBasePath, fileName);

                    try {
                        // 检查是否为目录
                        const stats = fs.statSync(filePath);
                        if (!stats.isDirectory()) {
                            return null;
                        }

                        // 检查是否存在 metadata.json
                        const metadataPath = path.join(filePath, 'metadata.json');
                        if (!fs.existsSync(metadataPath)) {
                            console.log('跳过没有metadata.json的目录:', fileName);
                            return null;
                        }

                        // 读取并解析 metadata.json
                        const metadataContent = fs.readFileSync(metadataPath, 'utf-8');
                        const metadata = JSON.parse(metadataContent);

                        // 提取备份信息
                        const statistics = metadata.statistics || {};
                        const backupTime = metadata.backupTime || new Date().toISOString();
                        const date = new Date(backupTime);

                        // 格式化日期
                        const dateStr = this.formatDate(date);

                        // 格式化大小
                        const mediaTotalSize = statistics.mediaTotalSize || 0;
                        const sizeStr = this.formatFileSize(mediaTotalSize);

                        return {
                            name: fileName,
                            date: dateStr,
                            messageCount: statistics.totalMessages || 0,
                            mediaCount: statistics.mediaFileCount || 0,
                            size: sizeStr,
                            path: filePath,
                            totalConversations: statistics.totalConversations || 0,
                            deviceName: metadata.deviceName || 'Unknown Device'
                        };
                    } catch (error) {
                        console.error('读取备份失败:', fileName, error);
                        return null;
                    }
                });

                console.log('处理后的备份数量:', backupItems.filter(item => item !== null).length);

                // 过滤掉null值并按日期排序（最新的在前）
                this.backups = backupItems
                    .filter(item => item !== null)
                    .sort((a, b) => new Date(b.date) - new Date(a.date));

            } catch (error) {
                console.error('加载备份列表失败:', error);
                this.showHint('错误', '加载备份列表失败: ' + error.message);
            } finally {
                this.loading = false;
            }
        },

        formatDate(date) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            const seconds = String(date.getSeconds()).padStart(2, '0');
            return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
        },

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

        deleteBackup(index) {
            const backup = this.backups[index];
            this.deleteDialogText = `确定要删除备份 "${backup.name}" 吗？此操作不可恢复。`;
            this.deleteBackupIndex = index;
            this.showDeleteDialog = true;
        },

        restoreBackup(index) {
            const backup = this.backups[index];
            console.log('准备恢复备份:', backup);
            // 关闭备份列表，通知父组件打开恢复界面
            this.$emit('restore', backup);
            this.close();
        },

        async confirmDelete() {
            const backup = this.backups[this.deleteBackupIndex];

            try {
                console.log('准备删除备份目录:', backup.path);

                // 检查目录是否存在
                if (fs.existsSync(backup.path)) {
                    // 直接在渲染进程中删除备份目录（包含所有文件和子目录）
                    fs.rmSync(backup.path, { recursive: true, force: true });
                    console.log('备份目录已删除:', backup.path);
                } else {
                    console.warn('备份目录不存在:', backup.path);
                }

                // 从列表中移除
                this.backups.splice(this.deleteBackupIndex, 1);
                this.closeDeleteDialog();
                this.showHint('删除成功');
            } catch (error) {
                console.error('删除备份失败:', error);
                this.closeDeleteDialog();
                this.showHint('错误', '删除备份失败: ' + error.message);
            }
        },

        closeDeleteDialog() {
            this.showDeleteDialog = false;
            this.deleteDialogText = '';
            this.deleteBackupIndex = -1;
        },

        showHint(title, text) {
            this.hintTitle = title;
            this.hintText = text || ''; // text 可以为空
            this.showHintDialog = true;
        },

        closeHintDialog() {
            this.showHintDialog = false;
        },

        close() {
            this.$modal.hide('backup-list-modal');
        }
    },
    mounted() {
        this.loadBackups();
    }
}
</script>

<style lang="css" scoped>
.backup-list-container {
    padding: 30px;
    min-width: 600px;
    max-height: 500px; /* 减小最大高度 */
    display: flex;
    flex-direction: column;
    overflow: hidden; /* 防止容器本身滚动 */
}

.backup-list-container h2 {
    font-weight: normal;
    font-size: 20px;
    margin-bottom: 15px; /* 减小margin */
    text-align: center;
    color: #333;
    flex-shrink: 0; /* 标题不缩小 */
}

.loading, .empty {
    text-align: center;
    padding: 50px 20px;
    color: #999;
    flex: 1; /* 加载和空状态占据剩余空间 */
    overflow-y: auto;
}

.empty .hint {
    font-size: 14px;
    margin-top: 10px;
    color: #bbb;
}

.backup-list {
    flex: 1; /* 占据剩余空间 */
    overflow-y: auto;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    padding: 10px;
    min-height: 0; /* 允许flex子元素缩小 */
    max-height: 350px; /* 限制列表最大高度 */
}

.backup-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 15px; /* 减小padding */
    border-bottom: 1px solid #f0f0f0;
    transition: background 0.2s;
    flex-shrink: 0; /* 防止item被压缩 */
}

.backup-item:last-child {
    border-bottom: none;
}

.backup-item:hover {
    background: #f9f9f9;
}

.backup-info {
    flex: 1;
    min-width: 0; /* 允许文本截断 */
}

.backup-name {
    font-size: 16px;
    font-weight: 500;
    color: #333;
    margin-bottom: 5px; /* 减小margin */
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.backup-detail {
    font-size: 13px;
    color: #666;
    margin-bottom: 3px;
}

.backup-detail span {
    margin-right: 15px;
}

.backup-size {
    font-size: 14px;
    color: #999;
}

.backup-actions {
    margin-left: 20px;
    display: flex;
    gap: 8px;
}

.restore-btn {
    padding: 6px 16px;
    background: #2196F3;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    transition: background 0.3s;
}

.restore-btn:hover {
    background: #1976D2;
}

.delete-btn {
    padding: 6px 16px;
    background: #ff4d4f;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    transition: background 0.3s;
}

.delete-btn:hover {
    background: #ff7875;
}

.footer {
    margin-top: 15px; /* 减小margin */
    padding-top: 15px; /* 增加顶部padding */
    text-align: center;
    flex-shrink: 0; /* 确保footer不被压缩 */
    border-top: 1px solid #e0e0e0; /* 添加分隔线 */
}

.close-btn {
    padding: 10px 40px;
    background: #2196F3;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 16px;
    transition: background 0.3s;
}

.close-btn:hover {
    background: #1976D2;
}

/* 对话框样式 */
.dialog-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
}

.dialog-box {
    background: white;
    border-radius: 8px;
    padding: 30px;
    min-width: 400px;
    max-width: 500px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.dialog-box h3 {
    margin: 0 0 20px 0;
    font-size: 18px;
    font-weight: 500;
    color: #333;
}

.dialog-text {
    margin: 0 0 25px 0;
    font-size: 14px;
    line-height: 1.6;
    color: #666;
    white-space: pre-line;
}

.dialog-buttons {
    display: flex;
    gap: 10px;
}

.dialog-buttons button {
    flex: 1;
    padding: 10px;
    border: none;
    border-radius: 4px;
    font-size: 16px;
    cursor: pointer;
    transition: background 0.3s;
}

.cancel-button {
    background: #e0e0e0;
    color: #666;
}

.cancel-button:hover {
    background: #d0d0d0;
}

.confirm-button {
    background: #ff4d4f;
    color: white;
}

.confirm-button:hover {
    background: #ff7875;
}

.dialog-button {
    width: 100%;
    padding: 10px;
    background: #2196F3;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 16px;
    cursor: pointer;
    transition: background 0.3s;
}

.dialog-button:hover {
    background: #1976D2;
}
</style>
