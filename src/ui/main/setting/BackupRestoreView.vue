<template>
    <div class="backup-restore-container">
        <h2>备份与恢复</h2>
        <div class="options">
            <button class="option-button" @click="showBackupFromMobile">
                <div class="icon">📥</div>
                <div class="text">备份手机数据</div>
            </button>
            <button class="option-button" @click="showRestoreToMobile">
                <div class="icon">📤</div>
                <div class="text">恢复到手机</div>
            </button>
            <button class="option-button" @click="showBackupLocalData">
                <div class="icon">💾</div>
                <div class="text">备份本地数据</div>
            </button>
            <button class="option-button" @click="showRestoreLocalData">
                <div class="icon">📥</div>
                <div class="text">恢复本地数据</div>
            </button>
            <button class="option-button" @click="showBackupList">
                <div class="icon">📋</div>
                <div class="text">查看备份</div>
            </button>
            <button class="option-button" @click="openBackupDirectory">
                <div class="icon">📁</div>
                <div class="text">打开备份目录</div>
            </button>
        </div>

        <!-- 提示对话框 -->
        <div v-if="showDialog" class="dialog-overlay" @click="closeDialog">
            <div class="dialog-box" @click.stop>
                <h3>{{ dialogTitle }}</h3>
                <p class="dialog-text">{{ dialogText }}</p>
                <button class="dialog-button" @click="closeDialog">我知道了</button>
            </div>
        </div>
    </div>
</template>

<script>
import BackupListView from "./BackupListView.vue";
import ConversationSelectForBackup from "./ConversationSelectForBackup.vue";
import BackupRestoreProgressView from "./BackupRestoreProgressView.vue";
import {shell} from "../../../platform";

export default {
    name: "BackupRestoreView",
    components: {
        BackupListView,
        ConversationSelectForBackup,
        BackupRestoreProgressView
    },
    data() {
        return {
            showDialog: false,
            dialogTitle: '',
            dialogText: ''
        }
    },
    methods: {
        showBackupFromMobile() {
            this.dialogTitle = '备份手机数据';
            this.dialogText = '请保持PC在线，然后在手机上执行：\n\n我的 → 设置 → 备份与恢复 → 创建备份 → 选择"备份到电脑端"';
            this.showDialog = true;
        },
        showRestoreToMobile() {
            this.dialogTitle = '恢复到手机';
            this.dialogText = '请保持PC在线，然后在手机上执行：\n\n我的 → 设置 → 备份与恢复 → 恢复备份 → 选择"从电脑端恢复"';
            this.showDialog = true;
        },
        showBackupLocalData() {
            // 显示会话选择modal
            this.$modal.show(
                ConversationSelectForBackup,
                {}, null, {
                    name: 'conversation-select-backup-modal',
                    width: 640,
                    height: 650,  // 增加高度确保按钮可见
                    clickToClose: true,
                }, {
                    'closed': () => {
                        console.log('Conversation select closed');
                    }
                }
            );
        },
        showRestoreLocalData() {
            // 显示备份列表，用户可以选择要恢复的备份
            this.$modal.show(
                BackupListView,
                {mode: 'restore'}, null, {
                    name: 'backup-list-modal',
                    width: 640,
                    height: 500,
                    clickToClose: true,
                }, {
                    'closed': () => {
                        console.log('Backup list closed');
                    },
                    'restore': (backup) => {
                        console.log('Restore event received:', backup);
                        this.startRestore(backup);
                    }
                }
            );
        },
        showBackupList() {
            // 直接显示备份列表modal，不关闭当前的modal
            // vue-js-modal支持同时显示多个modal
            this.$modal.show(
                BackupListView,
                {mode: 'view'}, null, {
                    name: 'backup-list-modal',
                    width: 640,
                    height: 500,
                    clickToClose: true,
                }, {
                    'closed': () => {
                        console.log('Backup list closed');
                    }
                }
            );
        },

        startRestore(backup) {
            // 显示恢复进度界面
            this.$modal.show(
                BackupRestoreProgressView,
                {backupPath: backup.path}, null, {
                    name: 'backup-restore-progress-modal',
                    width: 600,
                    height: 500,
                    clickToClose: true,  // 允许点击空白处关闭
                }, {
                    'closed': () => {
                        console.log('Restore progress closed');
                    }
                }
            );
        },
        openBackupDirectory() {
            try {
                const path = require('path');
                const {app} = require("../../../platform");

                // 获取备份目录
                const userData = app.getPath('userData');
                const backupDir = path.join(userData, 'Backups', 'received');

                // 使用系统接口打开目录
                shell.openPath(backupDir);
            } catch (error) {
                console.error('打开备份目录失败:', error);
                this.$notify({
                    title: '错误',
                    text: '打开备份目录失败: ' + error.message,
                    type: 'error'
                });
            }
        },
        closeDialog() {
            this.showDialog = false;
        }
    }
}
</script>

<style lang="css" scoped>
.backup-restore-container {
    padding: 20px;
    min-width: 500px;
}

.backup-restore-container h2 {
    font-weight: normal;
    font-size: 20px;
    margin-bottom: 20px;
    text-align: center;
    color: #333;
}

.options {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
}

.option-button {
    display: flex;
    align-items: center;
    padding: 15px 20px;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    background: white;
    cursor: pointer;
    transition: all 0.3s ease;
}

.option-button:hover {
    background: #f5f5f5;
    border-color: #2196F3;
    box-shadow: 0 2px 8px rgba(33, 150, 243, 0.2);
}

.option-button .icon {
    font-size: 28px;
    margin-right: 15px;
}

.option-button .text {
    font-size: 16px;
    color: #333;
    font-weight: 500;
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
