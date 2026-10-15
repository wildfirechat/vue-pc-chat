<template>
    <div class="file-message-container"
         @click="clickFile"
         v-bind:class="{out:message.direction === 0}">
        <img class="file-icon" :src="fileIcon" alt="">
        <div class="file-info" draggable="true" @dragstart="dragFile($event)">
            <p class="file-name">{{ this.message.messageContent.name }}</p>
            <p class="file-size single-line">{{ size }}</p>
        </div>
        <!-- 进度条放在和卡片同圆角、overflow:hidden 的轨道里，避免直角溢出圆角；卡片本身不能 overflow:hidden，会裁掉气泡箭头 -->
        <div v-if="downloadStats || sendStats" class="progress-track">
            <div v-if="downloadStats" class="progress"
                 v-bind:style="{width: downloadStats.progress / downloadStats.total * 100 + '%'}">
            </div>
            <div v-if="sendStats" class="progress"
                 v-bind:style="{width: sendStats.progress / sendStats.total * 100 + '%'}">
            </div>
        </div>
    </div>
</template>

<script>
import Message from "../../../../../wfc/messages/message";
import helper from "../../../../util/helper";
import {downloadFile} from "../../../../../platformHelper";
import {fs, isElectron, shell} from "../../../../../platform";
import store from "../../../../../store";
import Config from "../../../../../config";

export default {
    name: "FileMessageContentView",
    inject: {
        conversationActiveStore: {
            default: null,
        },
    },
    props: {
        message: {
            type: Message,
            required: true,
        }
    },
    data() {
        const activeStore = this.conversationActiveStore || store;
        return {
            activeStore: activeStore,
            sharedConversationState: activeStore.state.conversation,
        }
    },
    methods: {
        clickFile() {
            let fileName = this.message.messageContent.name || '';
            let ext = fileName.split('.').pop().toLowerCase();
            if (Config.DISABLED_RECEIVE_FILE_TYPES.includes(ext)) {
                this.$notify({
                    title: '提示',
                    text: '禁止打开此类型',
                    type: 'warn'
                });
                return;
            }
            if (isElectron()) {
                let localPath = this.message.messageContent.localPath;
                if (localPath && fs.existsSync(localPath)) {
                    shell.openPath(localPath);
                } else {
                    if (!this.isDownloading()) {
                        downloadFile(this.message)
                        this.activeStore.addDownloadingMessage(this.message.messageUid)
                    } else {
                        this.$notify({
                            title: '下载中',
                            text: '文件下载中，请稍后',
                            type: 'warn'
                        });
                    }
                }
            } else {
                downloadFile(this.message)
            }
        },

        dragFile(event) {
            let file = this.message.messageContent;
            let fileObj = {
                url: file.remotePath,
                name: file.name,
                size: file.size
            }
            event.dataTransfer.setData('text', JSON.stringify(fileObj))
        },
        isDownloading() {
            return this.activeStore.isDownloadingMessage(this.message.messageId);
        },
    },

    computed: {
        size() {
            let fileMsgContent = this.message.messageContent;
            return helper.humanSize(fileMsgContent.size)
        },
        fileIcon() {
            let fileName = this.message.messageContent.name;
            let icon = helper.getFiletypeIcon(fileName.substring(fileName.lastIndexOf('.') + 1))
            return require("@/assets/images/filetypes/" + icon);
        },

        downloadStats() {
            let dm = this.activeStore.getDownloadingMessageStatus(this.message.messageUid);
            return dm;
        },
        sendStats() {
            let sm = this.activeStore.getSendingStatus(this.message.messageId);
            return sm;
        }
    }
}
</script>

<style lang="css" scoped>
.file-message-container {
    margin: 0 8px;
    padding: 12px 14px;
    background-color: var(--background-primary);
    position: relative;
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 12px;
    width: max-content;
    min-width: 240px;
    max-width: 320px;
    cursor: pointer;
}

.file-message-container .file-icon {
    width: 40px;
    height: 40px;
    flex-shrink: 0;
}

.file-message-container .file-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
}

.file-message-container .file-name {
    font-size: var(--font-size-base);
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
}

.file-message-container .file-size {
    color: var(--text-hint);
    font-size: var(--font-size-xs);
    line-height: 1.4;
}

.file-message-container .progress-track {
    position: absolute;
    inset: 0;
    border-radius: inherit;
    overflow: hidden;
    pointer-events: none;
}

.file-message-container .progress {
    position: absolute;
    left: 0;
    bottom: 0;
    height: 3px;
    background: var(--accent-color);
}

.rightarrow:before {
    border-left-color: var(--text-on-accent);
}

</style>
