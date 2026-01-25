<template>
    <div class="home-container" ref="home-container">
        <ElectronWindowsControlButtonView style="position: absolute; top: 0; right: 0"
                                          v-if="sharedMiscState.isElectronWindowsOrLinux"/>
        <div class="home">
            <section class="menu-container">
                <div>
                    <tippy
                        to="#infoTrigger"
                        interactive
                        :animate-fill="false"
                        distant="7"
                        theme="light"
                        animation="fade"
                        trigger="click"
                        :arrow="true"
                    >
                        <template #content>
                            <UserCardView v-if="sharedContactState.selfUserInfo" v-on:close="closeUserCard"
                                          :enable-update-portrait="true"
                                          :user-info="sharedContactState.selfUserInfo"/>
                        </template>
                    </tippy>

                    <img
                        v-if="sharedContactState.selfUserInfo"
                        ref="userCardTippy"
                        id="infoTrigger"
                        class="avatar"
                        draggable="false"
                        @click.prevent="onClickPortrait"
                        :src="sharedContactState.selfUserInfo.portrait"
                        alt=""
                    />
                </div>
                <nav class="menu">
                    <ul>
                        <li>
                            <div class="menu-item">
                                <i class="icon-ion-ios-chatboxes"
                                   v-bind:class="{active : this.$router.currentRoute.value.path === '/home'}"
                                   @click="go2Conversation"></i>
                                <em v-show="unread > 0" class="badge">{{ unread > 99 ? '···' : unread }}</em>
                            </div>
                        </li>
                        <li>
                            <div class="menu-item">
                                <i class="icon-ion-android-contact"
                                   v-bind:class="{active : this.$router.currentRoute.value.path === '/home/contact'}"
                                   @click="go2Contact"></i>
                                <em v-show="sharedContactState.unreadFriendRequestCount > 0" class="badge">{{ sharedContactState.unreadFriendRequestCount > 99 ? '99' : sharedContactState.unreadFriendRequestCount }}</em>
                            </div>
                        </li>
                        <li>
                            <i class="icon-ion-android-favorite"
                               v-bind:class="{active : this.$router.currentRoute.value.path === '/home/fav'}"
                               @click="go2Fav"></i>
                        </li>
                        <li v-if="sharedMiscState.isElectron && sharedMiscState.isCommercialServer">
                            <i class="icon-ion-ios-folder"
                               v-bind:class="{active : this.$router.currentRoute.value.path === '/home/files'}"
                               @click="go2Files"></i>
                        </li>
                        <li v-if="sharedMiscState.isElectron && sharedMiscState.enableOpenWorkSpace">
                            <i class="icon-ion-code-working"
                               v-bind:class="{active : this.$router.currentRoute.value.path === '/home/h-wp'}"
                               @click="go2Workspace"></i>
                        </li>
                        <li v-if="supportConference">
                            <i class="icon-ion-speakerphone"
                               v-bind:class="{active : this.$router.currentRoute.value.path === '/home/conference'}"
                               @click="go2Conference"></i>
                        </li>
                        <li v-if="aiPortalUrl">
                            <i class="icon-ion-android-sunny"
                               v-bind:class="{ active: this.$router.currentRoute.value.path === '/home/ai'}"
                               @click="go2AI"></i>
                        </li>
                        <li>
                            <i v-show="this.$router.currentRoute.value.path !== '/home/ai'"
                               class="icon-ion-android-settings"
                               v-bind:class="{active : this.$router.currentRoute.value.path === '/home/setting'}"
                               @click="go2Setting"></i>
                        </li>
                    </ul>
                </nav>
            </section>
            <router-view v-slot="{ Component, route }">
                <keep-alive v-show="route.path !== '/home/ai'">
                    <component :is="Component" :key="route.path"/>
                </keep-alive>
                <AI v-show="route.path === '/home/ai'"/>
            </router-view>
            <div v-if="sharedMiscState.connectionStatus === -1" class="unconnected">网络连接断开</div>
            <div class="drag-area" :style="dragAreaLeft"></div>

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
                            <span class="value file-name">{{ backupProgress.currentFileName || '准备中...' }}</span>
                        </div>
                        <div class="backup-progress-item">
                            <span class="label">保存位置:</span>
                            <span class="value">{{ backupProgress.backupPath }}</span>
                        </div>
                    </div>
                    <div class="backup-progress-spinner">
                        <div class="spinner"></div>
                    </div>
                    <p class="backup-progress-hint">请保持窗口开启，正在接收备份数据...</p>
                </div>
            </div>
            <UseDraggable v-if="!sharedMiscState.isElectron && sharedMiscState.isVoipOngoing"
                          class="voip-div-container"
                          :initial-value="{x:'50%', y:'50%'}"
                          :prevent-default="true"
                          v-bind:class="{single:voipProxy.type === 'single', multi:voipProxy.type === 'multi', conference: voipProxy.type === 'conference'}"
            >
                <Single v-if="voipProxy.type === 'single'" ref="handle-id"/>
                <Multi v-if="voipProxy.type === 'multi'" ref="handle-id"/>
                <Conference v-if="voipProxy.type === 'conference'" ref="handle-id"/>
            </UseDraggable>
        </div>
    </div>
</template>

<script>
import UserCardView from "./user/UserCardView.vue";
import store from "../../store";
import wfc from "../../wfc/client/wfc";
import EventType from "../../wfc/client/wfcEvent";
import ConnectionStatus from "../../wfc/client/connectionStatus";
import ElectronWindowsControlButtonView from "../common/ElectronWindowsControlButtonView.vue";
import {removeItem} from "../util/storageHelper";
import {ipcRenderer, app} from "../../platform";
import avenginekit from "../../wfc/av/internal/engine.min";
import avenginekitproxy from "../../wfc/av/engine/avenginekitproxy";
import IpcEventType from "../../ipcEventType";
import {isElectron} from "../../platform";
import Single from "../voip/Single.vue";
import Multi from "../voip/Multi.vue";
import Conference from "../voip/conference/Conference.vue";
import 'tippy.js/dist/tippy.css' // optional for styling
import {UseDraggable} from '@vueuse/components'
import AI from "./AI.vue";
import Config from "../../config";
import MessageContentType from "../../wfc/messages/messageContentType";
import BackupResponseNotificationContent from "../../wfc/messages/backup/backupResponseNotificationContent";

var avenginkitSetuped = false;
export default {
    data() {
        return {
            sharedContactState: store.state.contact,
            sharedMiscState: store.state.misc,
            shareConversationState: store.state.conversation,
            supportConference: avenginekit.startConference !== undefined,
            isSetting: false,
            fileWindow: null,
            voipProxy: avenginekitproxy,
            currentBackupRequest: null, // 当前正在处理的备份请求
            backupServer: null, // HTTP服务器实例
            backupProgress: {
                active: false,
                currentFile: 0,
                totalFiles: 0,
                percent: 0,
                currentFileName: '',
                backupPath: ''
            }, // 备份进度状态
            completionTimer: null, // 备份完成计时器
            expectedFileCount: 0, // 预期的文件总数
            isBackupCompleting: false, // 防止重复完成备份
            currentRestoreRequest: null, // 当前正在处理的恢复请求
            backupSaveDir: null // 当前备份保存目录（收到metadata.json时创建）
        };
    },

    methods: {
        onClickPortrait(event) {
            wfc.getUserInfo(this.sharedContactState.selfUserInfo.uid, true);
        },
        go2Conversation() {
            if (this.$router.currentRoute.value.path === '/home') {
                this.$eventBus.$emit('scrollToNextUnreadConversation');
                return
            }
            this.$router.replace("/home");
            this.isSetting = false;
        },
        go2Contact() {
            if (this.$router.currentRoute.path === '/home/contact') {
                return;
            }
            this.$router.replace("/home/contact");
            this.isSetting = false;
        },
        go2Fav() {
            if (this.$router.currentRoute.path === '/home/fav') {
                return;
            }
            this.$router.replace("/home/fav");
            this.isSetting = false;
        },
        go2Files() {
            let hash = window.location.hash;
            let url = window.location.origin;
            if (hash) {
                url = window.location.href.replace(hash, '#/files');
            } else {
                url += "/files"
            }
            ipcRenderer.send(IpcEventType.SHOW_FILE_WINDOW, {
                url: url,
                source: 'file',
            });
            console.log('show-file-window', url)
        },
        go2Workspace() {
            // /workspace 和 /home/workspace 同时存在时，router 无法正确处理
            if (this.$router.currentRoute.path === '/home/h-wp') {
                return;
            }
            this.$router.replace("/home/h-wp");
            this.isSetting = false;
        },
        go2Conference() {
            if (this.$router.currentRoute.path === '/home/conference') {
                return;
            }
            this.$router.replace({path: "/home/conference"});
            this.isSetting = false;
        },
        go2AI() {
            if (this.$router.currentRoute.value.path !== '/home/ai') {
                this.$router.replace({path: '/home/ai'});
            }
            this.isSetting = false;
        },
        go2Setting() {
            if (this.$router.currentRoute.path === '/home/setting') {
                return;
            }
            this.$router.replace({path: "/home/setting"});
            this.isSetting = true;
        },

        closeUserCard() {
            console.log('closeUserCard')
            this.$refs["userCardTippy"]._tippy.hide();
        },

        onConnectionStatusChange(status) {
            if (status === ConnectionStatus.ConnectionStatusRejected
                || status === ConnectionStatus.ConnectionStatusLogout
                || status === ConnectionStatus.ConnectionStatusSecretKeyMismatch
                || status === ConnectionStatus.ConnectionStatusTokenIncorrect
                || status === ConnectionStatus.ConnectionStatusKickedOff
                // TODO 断网时，显示网络断开状态
                // || status === ConnectionStatus.ConnectionStatusUnconnected
                || wfc.getUserId() === '') {

                if (this.$router.currentRoute.path !== '/') {
                    this.$router.replace({path: "/"});
                }
                if (status === ConnectionStatus.ConnectionStatusSecretKeyMismatch
                    || status === ConnectionStatus.ConnectionStatusLogout
                    || status === ConnectionStatus.ConnectionStatusTokenIncorrect
                    || status === ConnectionStatus.ConnectionStatusKickedOff
                    || status === ConnectionStatus.ConnectionStatusRejected) {
                    removeItem("userId");
                    removeItem('token')

                    avenginekitproxy.forceCloseVoipWindow();
                    console.error('连接失败', ConnectionStatus.desc(status));
                }
            }
        },

        onReceiveMessage(msg) {
            // 检查是否是备份请求消息
            if (msg.content && msg.content.type === MessageContentType.MESSAGE_CONTENT_TYPE_BACKUP_REQUEST) {
                this.showBackupConfirmDialog(msg);
            }
            // 检查是否是恢复请求消息
            else if (msg.content && msg.content.type === MessageContentType.MESSAGE_CONTENT_TYPE_RESTORE_REQUEST) {
                this.showRestoreConfirmDialog(msg);
            }
        },

        showBackupConfirmDialog(msg) {
            const content = msg.messageContent;
            let conversations = [];
            try {
                conversations = JSON.parse(content.conversationsJson || '[]');
            } catch (e) {
                console.error('解析会话列表失败', e);
                conversations = [];
            }

            const totalMessages = conversations.reduce((sum, conv) => sum + (conv.messageCount || 0), 0);
            const includeMediaText = content.includeMedia ? '包含' : '不包含';

            const message = `iOS端请求将备份保存到电脑端\n\n会话数量: ${conversations.length}\n消息总数: ${totalMessages}\n${includeMediaText}媒体文件\n\n是否开始备份？`;

            // 保存当前请求
            this.currentBackupRequest = msg;

            this.$alert({
                title: '备份请求',
                content: message,
                confirmText: '开始备份',
                cancelText: '拒绝',
                showIcon: true,
                confirmCallback: () => {
                    this.approveBackupRequest();
                },
                cancelCallback: () => {
                    this.rejectBackupRequest();
                }
            });
        },

        rejectBackupRequest() {
            if (!this.currentBackupRequest) {
                return;
            }

            // 发送拒绝消息
            const response = BackupResponseNotificationContent.createRejectedResponse();
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
                        title: '备份请求',
                        text: '已拒绝备份请求',
                        type: 'info'
                    });
                },
                (error) => {
                    // failCB
                    console.error('发送拒绝消息失败', error);
                }
            );

            this.currentBackupRequest = null;
        },

        // 恢复请求处理
        showRestoreConfirmDialog(msg) {
            // 保存当前请求
            this.currentRestoreRequest = msg;

            this.$alert({
                title: '恢复请求',
                content: 'iOS端请求从电脑端恢复备份，是否允许？',
                confirmText: '允许',
                cancelText: '拒绝',
                showIcon: true,
                confirmCallback: () => {
                    this.approveRestoreRequest();
                },
                cancelCallback: () => {
                    this.rejectRestoreRequest();
                }
            });
        },

        rejectRestoreRequest() {
            if (!this.currentRestoreRequest) {
                return;
            }

            // 发送拒绝消息
            const RestoreResponseNotificationContent = require('../../wfc/messages/backup/restoreResponseNotificationContent').default;
            const response = RestoreResponseNotificationContent.createRejectedResponse();
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
                        title: '恢复请求',
                        text: '已拒绝恢复请求',
                        type: 'info'
                    });
                },
                (error) => {
                    // failCB
                    console.error('发送拒绝消息失败', error);
                }
            );

            this.currentRestoreRequest = null;
        },

        approveRestoreRequest() {
            if (!this.currentRestoreRequest) {
                return;
            }

            // 启动HTTP服务器
            this.startRestoreServer().then((serverInfo) => {
                // 发送同意消息
                const RestoreResponseNotificationContent = require('../../wfc/messages/backup/restoreResponseNotificationContent').default;
                const response = RestoreResponseNotificationContent.createApprovedResponse(
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
                            title: '恢复请求',
                            text: '已允许iOS端从电脑端恢复备份',
                            type: 'success'
                        });
                    },
                    (error) => {
                        // failCB
                        console.error('发送同意消息失败', error);
                    }
                );
            }).catch((error) => {
                console.error('启动HTTP服务器失败', error);
                this.$notify({
                    title: '错误',
                    text: '启动恢复服务器失败: ' + error.message,
                    type: 'error'
                });
            });
        },

        approveBackupRequest() {
            if (!this.currentBackupRequest) {
                return;
            }

            // 启动HTTP服务器
            this.startBackupServer().then((serverInfo) => {
                // 发送同意消息
                const response = BackupResponseNotificationContent.createApprovedResponse(
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
                        console.error('发送同意消息失败', error);
                    }
                );
            }).catch((error) => {
                console.error('启动HTTP服务器失败', error);
                this.$notify({
                    title: '错误',
                    text: '启动备份服务器失败: ' + error.message,
                    type: 'error'
                });
            });
        },

        showBackupProgressWindow() {
            // 初始化进度状态
            this.backupProgress.active = true;
            this.backupProgress.currentFile = 0;
            this.backupProgress.totalFiles = 0; // iOS不发送总数，我们只统计已接收数量
            this.backupProgress.percent = 0;
            this.backupProgress.currentFileName = '准备接收...';
            this.backupProgress.backupPath = '';
            this.expectedFileCount = 0; // 重置预期的文件数量
            this.isBackupCompleting = false; // 重置完成标志
            this.backupSaveDir = null; // 重置保存目录，等待收到metadata.json时创建

            // 启动完成检测计时器（30秒无新文件则认为完成）
            this.resetCompletionTimer();
        },

        resetCompletionTimer() {
            // 清除之前的计时器
            if (this.completionTimer) {
                clearTimeout(this.completionTimer);
            }

            // 设置新的计时器（30秒无新文件）
            this.completionTimer = setTimeout(() => {
                this.onBackupComplete();
            }, 30000);
        },

        onBackupComplete() {
            // 防止重复调用
            if (this.isBackupCompleting) {
                console.log('备份已在完成中，跳过重复调用');
                return;
            }

            this.isBackupCompleting = true;

            // 备份完成
            this.backupProgress.active = false;

            this.$notify({
                title: '备份完成',
                text: `已成功接收 ${this.backupProgress.currentFile} 个文件\n保存位置: ${this.backupProgress.backupPath}`,
                type: 'success',
                duration: 5000
            });

            // 关闭HTTP服务器
            this.closeBackupServer();

            // 清理保存目录引用
            this.backupSaveDir = null;

            // 重置标志
            setTimeout(() => {
                this.isBackupCompleting = false;
            }, 1000);
        },

        startBackupServer() {
            return new Promise((resolve, reject) => {
                try {
                    // 如果已有服务器在运行，先关闭
                    if (this.backupServer) {
                        try {
                            this.backupServer.close();
                        } catch (e) {
                            console.error('关闭旧服务器失败:', e);
                        }
                        this.backupServer = null;
                    }

                    // 在渲染进程中直接创建HTTP服务器
                    const http = require('http');
                    const fs = require('fs');
                    const os = require('os');
                    const path = require('path');

                    // 获取本机IP地址
                    const getLocalIP = () => {
                        const interfaces = os.networkInterfaces();
                        for (const name of Object.keys(interfaces)) {
                            for (const iface of interfaces[name]) {
                                if (iface.family === 'IPv4' && !iface.internal) {
                                    return iface.address;
                                }
                            }
                        }
                        return '127.0.0.1';
                    };

                    const ip = getLocalIP();
                    const maxRetries = 10; // 最多重试10次
                    let retryCount = 0;

                    // 生成随机端口的函数
                    const getRandomPort = () => {
                        return Math.floor(Math.random() * (60000 - 10000 + 1)) + 10000;
                    };

                    // 尝试启动服务器
                    const tryStartServer = (port) => {
                        // 创建HTTP服务器
                        const server = http.createServer((req, res) => {
                            if (req.method === 'POST' && req.url === '/backup') {
                                const chunks = [];
                                let size = 0;

                                req.on('data', (chunk) => {
                                    chunks.push(chunk);
                                    size += chunk.length;
                                }).on('end', async () => {
                                    try {
                                        const buffer = Buffer.concat(chunks);
                                        // 解析单个文件并保存
                                        this.saveBackupFile(buffer);

                                        // 返回成功响应
                                        res.writeHead(200, {'Content-Type': 'text/plain'});
                                        res.end('OK');
                                    } catch (error) {
                                        console.error('保存备份文件失败:', error);
                                        res.writeHead(500, {'Content-Type': 'text/plain'});
                                        res.end('Error');
                                    }
                                });
                            } else if (req.method === 'POST' && req.url === '/backup_complete') {
                                // 备份完成请求
                                const chunks = [];

                                req.on('data', (chunk) => {
                                    chunks.push(chunk);
                                }).on('end', () => {
                                    try {
                                        const buffer = Buffer.concat(chunks);
                                        // 读取文件数量（4字节，小端序）
                                        const expectedFileCount = buffer.readInt32LE(0);
                                        const receivedFileCount = this.backupProgress.currentFile;

                                        // 保存预期的文件数量
                                        this.expectedFileCount = expectedFileCount;

                                        console.log(`收到备份完成通知，iOS端发送 ${expectedFileCount} 个文件，PC端已接收 ${receivedFileCount} 个文件`);

                                        // 先返回成功响应给iOS端
                                        res.writeHead(200, {'Content-Type': 'text/plain'});
                                        res.end('OK');

                                        // 检查文件数量是否匹配
                                        if (receivedFileCount >= expectedFileCount) {
                                            // 文件数量匹配，完成备份
                                            setTimeout(() => {
                                                this.onBackupComplete();
                                            }, 100);
                                        } else {
                                            // 文件数量不匹配，等待接收完成
                                            console.log(`等待接收剩余文件... (还差 ${expectedFileCount - receivedFileCount} 个)`);

                                            // 重置超时计时器，如果30秒内还没收到就强制完成
                                            this.resetCompletionTimer();
                                        }
                                    } catch (error) {
                                        console.error('处理备份完成请求失败:', error);
                                        res.writeHead(500, {'Content-Type': 'text/plain'});
                                        res.end('Error');
                                    }
                                });
                            } else {
                                res.writeHead(404);
                                res.end('Not Found');
                            }
                        });

                        server.listen(port, '0.0.0.0', () => {
                            console.log(`备份服务器已启动: ${ip}:${port}`);
                            this.backupServer = server; // 保存服务器引用
                            resolve({ ip, port });
                        });

                        server.on('error', (error) => {
                            console.error(`端口 ${port} 启动失败:`, error.code);
                            retryCount++;

                            if (retryCount < maxRetries) {
                                // 换个端口重试
                                const newPort = getRandomPort();
                                console.log(`尝试第 ${retryCount} 次，使用端口 ${newPort}`);
                                tryStartServer(newPort);
                            } else {
                                // 达到最大重试次数，放弃
                                console.error('已达到最大重试次数，启动服务器失败');
                                this.backupServer = null;
                                reject(new Error(`启动备份服务器失败，已尝试 ${maxRetries} 个端口，请重启应用后重试`));
                            }
                        });
                    };

                    // 开始尝试启动服务器
                    const initialPort = getRandomPort();
                    console.log(`初次尝试启动服务器，端口: ${initialPort}`);
                    tryStartServer(initialPort);

                } catch (error) {
                    console.error('启动服务器异常:', error);
                    this.backupServer = null;
                    reject(error);
                }
            });
        },

        closeBackupServer() {
            // 安全关闭服务器
            if (this.backupServer) {
                try {
                    // 使用 .bind() 确保 this 上下文正确
                    const close = this.backupServer.close.bind(this.backupServer);
                    close();
                    console.log('备份服务器已关闭');
                } catch (e) {
                    console.error('关闭服务器错误:', e);
                }
                this.backupServer = null;
            }
        },

        startRestoreServer() {
            return new Promise((resolve, reject) => {
                try {
                    const http = require('http');
                    const fs = require('fs');
                    const os = require('os');
                    const path = require('path');

                    // 获取本机IP地址
                    const getLocalIP = () => {
                        const interfaces = os.networkInterfaces();
                        for (const name of Object.keys(interfaces)) {
                            for (const iface of interfaces[name]) {
                                if (iface.family === 'IPv4' && !iface.internal) {
                                    return iface.address;
                                }
                            }
                        }
                        return '127.0.0.1';
                    };

                    const ip = getLocalIP();
                    const maxRetries = 10;
                    let retryCount = 0;

                    // 生成随机端口的函数
                    const getRandomPort = () => {
                        return Math.floor(Math.random() * (60000 - 10000 + 1)) + 10000;
                    };

                    // 获取备份列表的函数
                    const getBackupList = () => {
                        const backupDir = this.getBackupDirectory();
                        const receivedDir = path.join(backupDir, 'received');

                        if (!fs.existsSync(receivedDir)) {
                            return [];
                        }

                        const backups = [];
                        const subdirs = fs.readdirSync(receivedDir).filter(f => {
                            const stat = fs.statSync(path.join(receivedDir, f));
                            return stat.isDirectory() && f.startsWith('backup_');
                        });

                        for (const subdir of subdirs) {
                            const backupPath = path.join(receivedDir, subdir);
                            const metadataPath = path.join(backupPath, 'metadata.json');

                            // 如果没有metadata.json文件，跳过此备份
                            if (!fs.existsSync(metadataPath)) {
                                console.log('跳过没有metadata.json的备份:', subdir);
                                continue;
                            }

                            let backupInfo = {
                                name: subdir,
                                time: subdir.replace('backup_', '').replace(/-/g, ':'),
                                path: backupPath,
                                deviceName: '',
                                fileCount: 0,
                                conversationCount: 0,
                                messageCount: 0,
                                mediaFileCount: 0,
                                mediaSize: 0
                            };

                            // 读取metadata.json
                            try {
                                const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
                                if (metadata.statistics) {
                                    backupInfo.conversationCount = metadata.statistics.totalConversations || 0;
                                    backupInfo.messageCount = metadata.statistics.totalMessages || 0;
                                    backupInfo.mediaFileCount = metadata.statistics.mediaFileCount || 0;
                                    backupInfo.mediaSize = metadata.statistics.mediaTotalSize || 0;
                                }
                                // 如果metadata中有backupTime，使用它
                                if (metadata.backupTime) {
                                    backupInfo.time = metadata.backupTime;
                                }
                                // 添加设备名称
                                if (metadata.deviceName) {
                                    backupInfo.deviceName = metadata.deviceName;
                                }
                            } catch (e) {
                                console.error('读取metadata.json失败，跳过备份:', subdir, e);
                                continue;
                            }

                            // 统计文件数量（用于显示）
                            const countFiles = (dir) => {
                                let totalCount = 0;
                                const items = fs.readdirSync(dir);
                                for (const item of items) {
                                    const fullPath = path.join(dir, item);
                                    const stat = fs.statSync(fullPath);
                                    if (stat.isDirectory()) {
                                        totalCount += countFiles(fullPath);
                                    } else {
                                        totalCount++;
                                    }
                                }
                                return totalCount;
                            };

                            backupInfo.fileCount = countFiles(backupPath);
                            backups.push(backupInfo);
                        }

                        // 按时间排序（最新的在前）
                        backups.sort((a, b) => {
                            const timeA = new Date(a.time || 0).getTime();
                            const timeB = new Date(b.time || 0).getTime();
                            return timeB - timeA;
                        });

                        return backups;
                    };

                    // 尝试启动服务器
                    const tryStartServer = (port) => {
                        const server = http.createServer((req, res) => {
                            if (req.method === 'GET' && req.url === '/restore_list') {
                                // 返回备份列表
                                try {
                                    const backupList = getBackupList();
                                    res.writeHead(200, {'Content-Type': 'application/json'});
                                    res.end(JSON.stringify(backupList));
                                } catch (error) {
                                    console.error('获取备份列表失败:', error);
                                    res.writeHead(500, {'Content-Type': 'text/plain'});
                                    res.end('Error');
                                }
                            } else if (req.method === 'GET' && req.url.startsWith('/restore_metadata?')) {
                                // 返回metadata.json文件
                                const url = new URL(req.url, `http://${req.headers.host}`);
                                const backupPath = url.searchParams.get('path');

                                if (!backupPath) {
                                    res.writeHead(400, {'Content-Type': 'text/plain'});
                                    res.end('Missing backup path');
                                    return;
                                }

                                const metadataPath = path.join(backupPath, 'metadata.json');

                                if (!fs.existsSync(metadataPath)) {
                                    res.writeHead(404, {'Content-Type': 'text/plain'});
                                    res.end('Metadata file not found');
                                    return;
                                }

                                // 发送metadata.json
                                const stat = fs.statSync(metadataPath);
                                const readStream = fs.createReadStream(metadataPath);
                                res.writeHead(200, {
                                    'Content-Type': 'application/json',
                                    'Content-Length': stat.size
                                });
                                readStream.pipe(res);
                            } else if (req.method === 'GET' && req.url.startsWith('/restore_file?')) {
                                // 返回备份文件
                                const url = new URL(req.url, `http://${req.headers.host}`);
                                const filePath = url.searchParams.get('path');

                                if (!filePath) {
                                    res.writeHead(400, {'Content-Type': 'text/plain'});
                                    res.end('Missing file path');
                                    return;
                                }

                                if (!fs.existsSync(filePath)) {
                                    res.writeHead(404, {'Content-Type': 'text/plain'});
                                    res.end('File not found');
                                    return;
                                }

                                // 发送文件
                                const stat = fs.statSync(filePath);
                                const readStream = fs.createReadStream(filePath);
                                res.writeHead(200, {
                                    'Content-Type': 'application/octet-stream',
                                    'Content-Length': stat.size
                                });
                                readStream.pipe(res);
                            } else {
                                res.writeHead(404);
                                res.end('Not Found');
                            }
                        });

                        server.listen(port, '0.0.0.0', () => {
                            console.log(`恢复服务器已启动: ${ip}:${port}`);
                            this.backupServer = server;
                            resolve({ ip, port });
                        });

                        server.on('error', (error) => {
                            console.error(`端口 ${port} 启动失败:`, error.code);
                            retryCount++;

                            if (retryCount < maxRetries) {
                                const newPort = getRandomPort();
                                console.log(`尝试第 ${retryCount} 次，使用端口 ${newPort}`);
                                tryStartServer(newPort);
                            } else {
                                console.error('已达到最大重试次数，启动服务器失败');
                                this.backupServer = null;
                                reject(new Error(`启动恢复服务器失败，已尝试 ${maxRetries} 个端口，请重启应用后重试`));
                            }
                        });
                    };

                    const initialPort = getRandomPort();
                    console.log(`初次尝试启动恢复服务器，端口: ${initialPort}`);
                    tryStartServer(initialPort);

                } catch (error) {
                    console.error('启动恢复服务器异常:', error);
                    this.backupServer = null;
                    reject(error);
                }
            });
        },

        getBackupDirectory() {
            // 获取备份目录路径
            const path = require('path');

            // 使用从 platform 导入的 app 对象获取用户数据目录
            const userData = app.getPath('userData');
            const backupDir = path.join(userData, 'Backups');

            // 确保目录存在
            const fs = require('fs');
            if (!fs.existsSync(backupDir)) {
                fs.mkdirSync(backupDir, {recursive: true});
            }

            return backupDir;
        },

        saveBackupFile(buffer) {
            const fs = require('fs');
            const path = require('path');

            let offset = 0;

            // 读取相对路径长度 (4字节，小端序)
            const pathLength = buffer.readInt32LE(offset);
            offset += 4;

            // 读取相对路径
            const relativePath = buffer.slice(offset, offset + pathLength).toString('utf8');
            offset += pathLength;

            // 读取文件数据长度 (8字节，小端序)
            const dataLengthLow = buffer.readInt32LE(offset);
            offset += 4;
            const dataLengthHigh = buffer.readInt32LE(offset);
            offset += 4;

            // 组合成64位整数
            const dataLength = BigInt(dataLengthLow) + (BigInt(dataLengthHigh) << BigInt(32));

            // 读取文件数据
            const dataStart = offset;
            const dataEnd = Number(BigInt(dataStart) + dataLength);
            const fileData = buffer.slice(dataStart, dataEnd);

            // 检查是否是第一个文件（metadata.json）
            const fileName = path.basename(relativePath);
            if (fileName === 'metadata.json' && this.backupSaveDir === null) {
                // 第一个文件是metadata.json，创建保存目录
                const backupDir = path.join(this.getBackupDirectory(), 'received');
                const date = new Date();
                const timestamp = date.toISOString().replace(/[:.]/g, '-').slice(0, -5);
                this.backupSaveDir = path.join(backupDir, `backup_${timestamp}`);

                // 创建目录
                if (!fs.existsSync(this.backupSaveDir)) {
                    fs.mkdirSync(this.backupSaveDir, {recursive: true});
                }

                // 更新进度窗口中的备份路径
                this.backupProgress.backupPath = this.backupSaveDir;

                // 显示通知
                this.$notify({
                    title: '开始接收备份',
                    text: `正在接收移动端备份...`,
                    type: 'info',
                    duration: 3000
                });
            }

            // 如果还没有创建保存目录（不是以metadata.json开头），则创建一个
            if (this.backupSaveDir === null) {
                const backupDir = path.join(this.getBackupDirectory(), 'received');
                const date = new Date();
                const timestamp = date.toISOString().replace(/[:.]/g, '-').slice(0, -5);
                this.backupSaveDir = path.join(backupDir, `backup_${timestamp}`);

                // 创建目录
                if (!fs.existsSync(this.backupSaveDir)) {
                    fs.mkdirSync(this.backupSaveDir, {recursive: true});
                }

                // 更新进度窗口中的备份路径
                this.backupProgress.backupPath = this.backupSaveDir;
            }

            // 创建文件路径
            const filePath = path.join(this.backupSaveDir, relativePath);
            const fileDir = path.dirname(filePath);

            // 确保目录存在
            if (!fs.existsSync(fileDir)) {
                fs.mkdirSync(fileDir, {recursive: true});
            }

            // 写入文件
            fs.writeFileSync(filePath, fileData);

            console.log(`已保存: ${relativePath} (${dataLength} 字节)`);

            // 更新进度
            this.backupProgress.currentFile++;
            this.backupProgress.currentFileName = path.basename(relativePath);

            // 检查是否已接收完所有文件
            if (this.expectedFileCount > 0 && this.backupProgress.currentFile >= this.expectedFileCount) {
                // 已接收所有文件，延迟一下完成备份
                console.log(`已接收所有 ${this.backupProgress.currentFile} 个文件，准备完成备份`);
                setTimeout(() => {
                    this.onBackupComplete();
                }, 200);
            } else {
                // 重置完成计时器（每次收到文件都重置）
                this.resetCompletionTimer();
            }
        },
    },

    computed: {
        aiPortalUrl() {
            return Config.AI_PORTAL_URL
        },
        unread() {
            let count = 0;
            this.shareConversationState.conversationInfoList.forEach(info => {
                if (info.isSilent) {
                    return;
                }
                let unreadCount = info.unreadCount;
                count += unreadCount.unread;
            });
            return count;
        },
        dragAreaLeft() {
            // 60为左边菜单栏的宽度，261为会话列表的宽度
            if (this.isSetting) {
                return {
                    left: '60px'
                }
            } else {
                return {
                    left: 'calc(60px + 261px)'
                }
            }
        }
    },

    created() {
        wfc.eventEmitter.on(EventType.ConnectionStatusChanged, this.onConnectionStatusChange)
        wfc.eventEmitter.on(EventType.ReceiveMessage, this.onReceiveMessage)
        this.onConnectionStatusChange(wfc.getConnectionStatus())

        if (!isElectron() && !avenginkitSetuped) {
            avenginekit.setup();
            avenginkitSetuped = true;
        }
    },

    mounted() {
        avenginekitproxy.onVoipCallErrorCallback = (errorCode) => {
            if (errorCode === -1) {
                this.$notify({
                    title: '不能发起或接听新的音视频通话',
                    text: '目前有音视频通话正在进行中',
                    type: 'warn'
                });

            } else if (errorCode === -2) {
                if (isElectron()) {
                    console.error(`不支持音视频通话，原因可能是:
                        1. 可通过这个网页测试浏览器对音视频通话的支持情况，https://docs.wildfirechat.cn/webrtc/abilitytest/
                        2. 确保系统已授予当前应用 摄像头 和 麦克风 权限
                    `)
                } else {

                    console.error(`不支持音视频通话，原因可能是:
                        1. 浏览器上，只有通过 http://localhost 或 https://xxxx 访问的网页才支持音视频通话
                        2. 可通过这个网页测试浏览器对音视频通话的支持情况，https://docs.wildfirechat.cn/webrtc/abilitytest/
                        3. 确保浏览器已授予网页 摄像头 和 麦克风 权限
                        4. 确保系统已授予浏览器 摄像头 和麦克风 权限
                        5. 配置 https，请参考：https://docs.wildfirechat.cn/faq/web/https.html
                    `)
                }
                this.$notify({
                    title: '不支持音视频通话',
                    text: '请打开控制台查看具体原因',
                    type: 'warn'
                });
            }
        }
    },
    unmounted() {
        wfc.eventEmitter.removeListener(EventType.ConnectionStatusChanged, this.onConnectionStatusChange);
        wfc.eventEmitter.removeListener(EventType.ReceiveMessage, this.onReceiveMessage);

        // 关闭备份服务器
        this.closeBackupServer();

        // 清除完成计时器
        if (this.completionTimer) {
            clearTimeout(this.completionTimer);
            this.completionTimer = null;
        }

        console.log('home destroy')
    },

    components: {
        AI,
        Conference,
        Multi,
        Single,
        UserCardView,
        ElectronWindowsControlButtonView,
        UseDraggable
    },
    directives: {}
};
</script>

<style lang="css" scoped>

.home {
    display: flex;
    width: calc(100vw - var(--main-margin-left) - var(--main-margin-right));
    height: calc(100vh - var(--main-margin-top) - var(--main-margin-bottom));
    justify-content: center;
    align-items: center;
    background-color: white;
    border-radius: var(--main-border-radius);
    overflow: hidden;
}

.menu-container {
    width: 60px;
    min-width: 60px;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    /*background: linear-gradient(180deg, #292a2c 0%, #483a3a 100%);*/
    background: #E0E0DF;
    border-top-left-radius: var(--main-border-radius);
    border-bottom-left-radius: var(--main-border-radius);
    padding: var(--home-menu-padding-top) 0 20px 0;
    -webkit-app-region: drag;
}

.avatar {
    background-color: gray;
    width: 35px;
    height: 35px;
    display: block;
    margin: 10px auto;
    border-radius: 3px;
}

.menu {
    flex: 1;
}

.menu ul {
    height: 100%;
    display: flex;
    flex-direction: column;
    -webkit-app-region: drag
}

.menu ul li {
    margin: 10px;
    height: 40px;
    line-height: 50px;
}

.menu ul li:last-of-type {
    margin-top: auto;
    margin-bottom: 20px;
}

.menu .menu-item {
    position: relative;
}

.menu .menu-item .badge {
    position: absolute;
    color: white;
    font-size: 10px;
    background-color: red;
    border-radius: 8px;
    min-width: 16px;
    height: 16px;
    padding: 0 5px;
    line-height: 16px;
    font-style: normal;
    text-align: center;
    right: -12px;
    top: 4px;
}

i {
    font-size: 26px;
    color: #868686;
    cursor: pointer;
}

i:hover {
    color: #1f64e4;
}

i.active {
    color: #3f64e4;
}

.drag-area {
    position: absolute;
    top: 0;
    height: 60px;
    right: 140px;
    z-index: -1;
    -webkit-app-region: drag;
}

.unconnected {
    position: absolute;
    top: 0;
    left: 60px;
    right: 0;
    color: red;
    padding: 15px 0;
    text-align: center;
    background: #f2f2f280;
    /*box-shadow: 0 0 1px #000;*/
}

.voip-div-container {
    background: #292929;
    position: fixed;
    margin: auto;
    border-radius: 5px;
    box-shadow: 0 4px 8px 0 rgba(0, 0, 0, 0.2), 0 6px 20px 0 rgba(0, 0, 0, 0.19);
    display: flex;
    flex-direction: column;
}

.voip-div-container.single {
    width: 360px;
    height: 640px;
}

.voip-div-container.multi {
    width: 960px;
    height: 600px;
}

.voip-div-container.conference {
    width: 960px;
    height: 600px;
}

.voip-div-container .title {
    text-align: center;
    padding: 5px 0;
    background: #b6b6b6;
    display: flex;
    justify-content: center;
    align-content: center;
}

.voip-div-container .title i {
    pointer-events: none;
}

.voip-div-container .title i:hover {
    color: #868686;
}

.voip-div-container .title i:active {
    color: #868686;
}

.voip-div-container .content {
    flex: 1;
    border: none;
}

/* 备份进度窗口样式 */
.backup-progress-modal {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
}

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
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}

.backup-progress-hint {
    text-align: center;
    color: #666;
    font-size: 13px;
    margin: 0;
}
</style>
