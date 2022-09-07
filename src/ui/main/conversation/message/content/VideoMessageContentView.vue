<template>
    <div class="video-content-container">
        <!--        <video @click.prevent="preview(message)" preload="metadata"-->
        <!--               controls-->
        <!--               draggable="true"-->
        <!--               @dragstart="dragVideo($event)"-->
        <!--               controlsList="nodownload"-->
        <!--               disablePictureInPicture-->
        <!--               :poster="'data:video/jpeg;base64,' + message.messageContent.thumbnail"-->
        <!--               :src="message.messageContent.remotePath +'#t=0.1'"/>-->
        <img v-if="message.messageContent.thumbnail" :src="'data:video/jpeg;base64,' + message.messageContent.thumbnail" alt="" @click="downloadVideo">
        <p class="video-alt" @click="downloadVideo">[视频消息]，点击下载播放</p>
    </div>
</template>

<script>
import Message from "@/wfc/messages/message";
import store from "@/store";
import {downloadFile} from "../../../../../platformHelper";

export default {
    name: "VideoMessageContentView",
    props: {
        message: {
            type: Message,
            required: true,
        },
        isInCompositeView: {
            default: false,
            type: Boolean,
            required: false,
        }
    },
    methods: {
        preview(message) {
            if (this.isInCompositeView) {
                this.$parent.previewCompositeMessage(message.messageUid);
            } else {
                console.log('preview', message);
                store.previewMessage(message, true);
            }
        },

        dragVideo(event) {
            let video = this.message.messageContent;
            event.dataTransfer.setData('URL', video.remotePath)
        },

        downloadVideo() {
            this.$notify({
                text: '系统不支持在线播放视频，请下载后播放',
                type: 'warn'
            });
            if (!store.isDownloadingMessage(this.message.messageId)) {
                downloadFile(this.message)
                store.addDownloadingMessage(this.message.messageId)
            } else {
                this.$notify({
                    title: '下载中',
                    text: '视频下载中，请稍后',
                    type: 'warn'
                });
            }
        }
    }
}
</script>

<style lang="css" scoped>
.video-content-container {
    margin: 0 10px;
    position: relative;
    border: 1px solid #efefef;
    border-radius: 5px;
}

.video-content-container video {
    max-height: 400px;
    max-width: 400px;
    border-radius: 5px;
    overflow: hidden;
}

.right-arrow:before {
    border-left-color: white;
}

.left-arrow:before {
    border-left-color: white;
}

.video-alt {
    background: white;
    border-radius: 5px;
    padding: 10px;
}

</style>
