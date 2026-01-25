<template>
    <div class="backup-progress-container">
        <h2>{{ title }}</h2>

        <!-- 进度信息 -->
        <div class="progress-info">
            <div class="status-text">{{ statusText }}</div>
            <div class="detail-text">{{ detailText }}</div>
        </div>

        <!-- 进度条 -->
        <div v-if="showProgress" class="progress-bar-container">
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
                <div class="stat-value">{{ statistics.mediaFileCount }}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">总大小</div>
                <div class="stat-value">{{ formatFileSize(statistics.mediaTotalSize) }}</div>
            </div>
        </div>

        <!-- 关闭按钮 -->
        <div class="footer">
            <button v-if="completed" @click="close" class="close-btn">完成</button>
            <button v-else @click="cancel" class="cancel-btn">取消</button>
        </div>
    </div>
</template>

<script>
export default {
    name: "BackupProgressView",
    emits: ['close', 'cancel'],
    props: {
        title: {
            type: String,
            default: '备份中...'
        }
    },
    data() {
        return {
            statusText: '',
            detailText: '',
            progress: 0,
            showProgress: false,
            completed: false,
            statistics: {
                totalConversations: 0,
                totalMessages: 0,
                mediaFileCount: 0,
                mediaTotalSize: 0
            }
        }
    },
    methods: {
        updateStatus(status, detail) {
            this.statusText = status;
            this.detailText = detail;
        },

        updateProgress(current, total, progressDetail) {
            this.showProgress = true;
            this.progress = (current / total) * 100;
            if (progressDetail) {
                this.detailText = progressDetail;
            }
        },

        complete(stats) {
            this.completed = true;
            this.showProgress = false;
            this.progress = 100;
            this.statistics = stats;
            this.statusText = '备份完成';
            this.detailText = `已成功备份 ${stats.totalConversations} 个会话，共 ${stats.totalMessages} 条消息`;
        },

        reset() {
            this.statusText = '';
            this.detailText = '';
            this.progress = 0;
            this.showProgress = false;
            this.completed = false;
            this.statistics = {
                totalConversations: 0,
                totalMessages: 0,
                mediaFileCount: 0,
                mediaTotalSize: 0
            };
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

        close() {
            this.$emit('close');
        },

        cancel() {
            this.$emit('cancel');
            this.$emit('close');
        }
    }
}
</script>

<style lang="css" scoped>
.backup-progress-container {
    padding: 30px;
    min-width: 500px;
    display: flex;
    flex-direction: column;
}

.backup-progress-container h2 {
    font-weight: normal;
    font-size: 20px;
    margin-bottom: 30px;
    text-align: center;
    color: #333;
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

.footer {
    text-align: center;
}

.close-btn, .cancel-btn {
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

.cancel-btn {
    background: #e0e0e0;
    color: #666;
}

.cancel-btn:hover {
    background: #d0d0d0;
}
</style>
