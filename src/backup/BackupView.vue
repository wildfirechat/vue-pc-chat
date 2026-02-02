<template>
    <!-- 备份进度窗口 -->
    <div v-if="backupProgress.active" class="backup-progress-modal">
        <div class="backup-progress-content">
            <h3>正在接收备份</h3>
            <div class="backup-progress-info">
                <div class="backup-progress-item">
                    <span class="label">已接收文件:</span>
                    <span class="value">{{ backupProgress.currentFile }}</span>
                </div>
                <div class="backup-progress-item">
                    <span class="label">当前文件:</span>
                    <span class="value file-name">{{
                        backupProgress.currentFileName || "准备中..."
                    }}</span>
                </div>
                <div class="backup-progress-item">
                    <span class="label">保存位置:</span>
                    <span class="value">{{ backupProgress.backupPath }}</span>
                </div>
            </div>
            <div class="backup-progress-spinner">
                <div class="spinner"></div>
            </div>
            <p class="backup-progress-hint">
                请保持窗口开启，正在接收备份数据...
            </p>
        </div>
    </div>
</template>

<script>
import store from "../store";
import { isElectron } from "../platform";
import MessageContentType from "../wfc/messages/messageContentType";
import BackupResponseNotificationContent from "../wfc/messages/backup/backupResponseNotificationContent";
import wfc from "../wfc/client/wfc";
import BackupHelper from "./backupHelper";
import EventType from "../wfc/client/wfcEvent";
import RestoreResponseNotificationContent from "../wfc/messages/backup/restoreResponseNotificationContent";

export default {
    name: "BackupView",
    data() {
        return {
            sharedMiscState: store.state.misc,
            backupProgress: {
                active: false,
                currentFile: 0,
                totalFiles: 0,
                percent: 0,
                currentFileName: "",
                backupPath: "",
            }, // 备份进度状态
            currentBackupRequest: null, // 当前正在处理的备份请求
            currentRestoreRequest: null, // 当前正在处理的恢复请求
        };
    },
    methods: {
        onReceiveMessage(msg) {
            console.log("xxxd", msg);
            if (isElectron()) {
                // 检查是否是备份请求消息
                if (
                    msg.content &&
                    msg.content.type ===
                        MessageContentType.MESSAGE_CONTENT_TYPE_BACKUP_REQUEST
                ) {
                    this.showBackupConfirmDialog(msg);
                }
                // 检查是否是恢复请求消息
                else if (
                    msg.content &&
                    msg.content.type ===
                        MessageContentType.MESSAGE_CONTENT_TYPE_RESTORE_REQUEST
                ) {
                    this.showRestoreConfirmDialog(msg);
                }
            }
        },

        showBackupConfirmDialog(msg) {
            const content = msg.messageContent;
            let conversations = [];
            try {
                conversations = JSON.parse(content.conversationsJson || "[]");
            } catch (e) {
                console.error("解析会话列表失败", e);
                conversations = [];
            }

            const totalMessages = conversations.reduce(
                (sum, conv) => sum + (conv.messageCount || 0),
                0
            );
            const includeMediaText = content.includeMedia ? "包含" : "不包含";

            const message = `iOS端请求将备份保存到电脑端\n\n会话数量: ${conversations.length}\n消息总数: ${totalMessages}\n${includeMediaText}媒体文件\n\n是否开始备份？`;

            // 保存当前请求
            this.currentBackupRequest = msg;

            this.$alert({
                title: "备份请求",
                content: message,
                confirmText: "开始备份",
                cancelText: "拒绝",
                showIcon: true,
                confirmCallback: () => {
                    this.approveBackupRequest();
                },
                cancelCallback: () => {
                    this.rejectBackupRequest();
                },
            });
        },

        rejectBackupRequest() {
            if (!this.currentBackupRequest) {
                return;
            }

            // 发送拒绝消息
            const response =
                BackupResponseNotificationContent.createRejectedResponse();
            const conversation = {
                type: this.currentBackupRequest.conversation.type,
                target: this.currentBackupRequest.conversation.target,
                line: this.currentBackupRequest.conversation.line,
            };

            wfc.sendConversationMessage(
                conversation,
                response,
                [], // toUsers
                null, // preparedCB
                null, // progressCB
                () => {
                    // successCB
                    this.$notify({
                        title: "备份请求",
                        text: "已拒绝备份请求",
                        type: "info",
                    });
                },
                (error) => {
                    // failCB
                    console.error("发送拒绝消息失败", error);
                }
            );

            this.currentBackupRequest = null;
        },

        // 恢复请求处理
        showRestoreConfirmDialog(msg) {
            // 保存当前请求
            this.currentRestoreRequest = msg;

            this.$alert({
                title: "恢复请求",
                content: "iOS端请求从电脑端恢复备份，是否允许？",
                confirmText: "允许",
                cancelText: "拒绝",
                showIcon: true,
                confirmCallback: () => {
                    this.approveRestoreRequest();
                },
                cancelCallback: () => {
                    this.rejectRestoreRequest();
                },
            });
        },

        rejectRestoreRequest() {
            if (!this.currentRestoreRequest) {
                return;
            }

            // 发送拒绝消息
            const response =
                RestoreResponseNotificationContent.createRejectedResponse();
            const conversation = {
                type: this.currentRestoreRequest.conversation.type,
                target: this.currentRestoreRequest.conversation.target,
                line: this.currentRestoreRequest.conversation.line,
            };

            wfc.sendConversationMessage(
                conversation,
                response,
                [], // toUsers
                null, // preparedCB
                null, // progressCB
                () => {
                    // successCB
                    this.$notify({
                        title: "恢复请求",
                        text: "已拒绝恢复请求",
                        type: "info",
                    });
                },
                (error) => {
                    // failCB
                    console.error("发送拒绝消息失败", error);
                }
            );

            this.currentRestoreRequest = null;
        },

        approveRestoreRequest() {
            if (!this.currentRestoreRequest) {
                return;
            }

            // 启动HTTP服务器
            BackupHelper.startRestoreServer()
                .then((serverInfo) => {
                    // 发送同意消息
                    const response =
                        RestoreResponseNotificationContent.createApprovedResponse(
                            serverInfo.ip,
                            serverInfo.port
                        );

                    const conversation = {
                        type: this.currentRestoreRequest.conversation.type,
                        target: this.currentRestoreRequest.conversation.target,
                        line: this.currentRestoreRequest.conversation.line,
                    };

                    wfc.sendConversationMessage(
                        conversation,
                        response,
                        [], // toUsers
                        null, // preparedCB
                        null, // progressCB
                        () => {
                            // successCB
                            this.currentRestoreRequest = null;

                            this.$notify({
                                title: "恢复请求",
                                text: "已允许iOS端从电脑端恢复备份",
                                type: "success",
                            });
                        },
                        (error) => {
                            // failCB
                            console.error("发送同意消息失败", error);
                        }
                    );
                })
                .catch((error) => {
                    console.error("启动HTTP服务器失败", error);
                    this.$notify({
                        title: "错误",
                        text: "启动恢复服务器失败: " + error.message,
                        type: "error",
                    });
                });
        },

        approveBackupRequest() {
            if (!this.currentBackupRequest) {
                return;
            }

            // 启动HTTP服务器
            BackupHelper.startBackupServer()
                .then((serverInfo) => {
                    // 发送同意消息
                    const response =
                        BackupResponseNotificationContent.createApprovedResponse(
                            serverInfo.ip,
                            serverInfo.port
                        );

                    const conversation = {
                        type: this.currentBackupRequest.conversation.type,
                        target: this.currentBackupRequest.conversation.target,
                        line: this.currentBackupRequest.conversation.line,
                    };

                    wfc.sendConversationMessage(
                        conversation,
                        response,
                        [], // toUsers
                        null, // preparedCB
                        null, // progressCB
                        () => {
                            // successCB
                            this.currentBackupRequest = null;

                            // 显示备份进度窗口
                            this.showBackupProgressWindow();
                        },
                        (error) => {
                            // failCB
                            console.error("发送同意消息失败", error);
                        }
                    );
                })
                .catch((error) => {
                    console.error("启动HTTP服务器失败", error);
                    this.$notify({
                        title: "错误",
                        text: "启动备份服务器失败: " + error.message,
                        type: "error",
                    });
                });
        },

        showBackupProgressWindow() {
            // 初始化进度状态
            this.backupProgress.active = true;
            this.backupProgress.currentFile = 0;
            this.backupProgress.totalFiles = 0; // iOS不发送总数，我们只统计已接收数量
            this.backupProgress.percent = 0;
            this.backupProgress.currentFileName = "准备接收...";
            this.backupProgress.backupPath = "";

            BackupHelper.removeAllListeners();

            BackupHelper.on("start", (data) => {
                this.backupProgress.backupPath = data.path;
                this.$notify({
                    title: "开始接收备份",
                    text: `正在接收移动端备份...`,
                    type: "info",
                    duration: 3000,
                });
            });

            BackupHelper.on("progress", (data) => {
                this.backupProgress.currentFile = data.currentFile;
                this.backupProgress.currentFileName = data.currentFileName;
                this.backupProgress.backupPath = data.backupPath;
            });

            BackupHelper.on("complete", (data) => {
                this.backupProgress.active = false;
                this.$notify({
                    title: "备份完成",
                    text: `已成功接收 ${data.count} 个文件\n保存位置: ${data.path}`,
                    type: "success",
                    duration: 5000,
                });
                BackupHelper.closeBackupServer();
            });
        },
    },

    created() {
        wfc.eventEmitter.on(EventType.ReceiveMessage, this.onReceiveMessage);
    },

    unmounted() {
        wfc.eventEmitter.removeListener(
            EventType.ReceiveMessage,
            this.onReceiveMessage
        );

        if (isElectron()) {
            BackupHelper.closeBackupServer();
        }

        console.log("home destroy");
    },
};
</script>

<style scoped lang="css">
.backup-progress-content {
    background: white;
    border-radius: 8px;
    padding: 30px;
    min-width: 400px;
    max-width: 500px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.backup-progress-content h3 {
    margin: 0 0 20px 0;
    font-size: 20px;
    color: #333;
    text-align: center;
}

.backup-progress-info {
    margin-bottom: 20px;
}

.backup-progress-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    font-size: 14px;
}

.backup-progress-item .label {
    color: #666;
    font-weight: 500;
}

.backup-progress-item .value {
    color: #333;
    font-weight: 600;
    text-align: right;
    max-width: 60%;
    word-break: break-all;
}

.backup-progress-item .value.file-name {
    color: #1f64e4;
}

.backup-progress-spinner {
    display: flex;
    justify-content: center;
    margin: 20px 0;
}

.spinner {
    width: 40px;
    height: 40px;
    border: 4px solid #f3f3f3;
    border-top: 4px solid #1f64e4;
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    0% {
        transform: rotate(0deg);
    }
    100% {
        transform: rotate(360deg);
    }
}

.backup-progress-hint {
    text-align: center;
    color: #666;
    font-size: 13px;
    margin: 0;
}
</style>
