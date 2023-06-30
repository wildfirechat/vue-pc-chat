<template>
    <div class="image-content-container">
        <img ref="thumbnail" v-show="imageLoaded === false" @click="preview(message)"
             v-bind:src="'data:video/jpeg;base64,' + message.messageContent.thumbnail">
        <img ref="img" v-show="imageLoaded" @click="preview(message)" @load="onImageLoaded"
             draggable="true"
             v-bind:src="message.messageContent.remotePath">
    </div>
</template>

<script>
import Message from "@/wfc/messages/message";
import store from "@/store";
import IpcEventType from "../../../../../ipcEventType";
import {ipcRenderer, isElectron, screen} from "../../../../../platform";

export default {
    name: "ImageMessageContentView",
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
    data() {
        return {
            imageLoaded: false,
        }
    },
    mounted() {
        let iw = this.message.messageContent.imageWidth;
        let ih = this.message.messageContent.imageHeight;
        if (iw && ih) {
            let size = this.scaleDown(iw, ih, 300, 300);
            if (size) {
                this.$refs.img.style.height = size.height + 'px';
                this.$refs.img.style.width = size.width + 'px';
                this.$refs.thumbnail.style.height = size.height + 'px';
                this.$refs.thumbnail.style.width = size.width + 'px';
            }
        }
    },
    methods: {
        scaleDown(width, height, maxWidth, maxHeight) {
            if (width < maxWidth && height < maxHeight) {
                return {width, height}
            }

            const widthRatio = maxWidth / width;
            const heightRatio = maxHeight / height;

            // 计算比例最小的缩放倍数
            const scale = Math.min(widthRatio, heightRatio);

            // 缩放后的宽度和高度
            const scaledWidth = width * scale;
            const scaledHeight = height * scale;

            return {width: Math.ceil(scaledWidth), height: Math.ceil(scaledHeight)};
        },
        preview(message) {
            if (this.isInCompositeView) {
                this.$parent.previewCompositeMessage(message.messageUid);
            } else {
                console.log('preview', message);
                if (isElectron()) {
                    let hash = window.location.hash;
                    let url = window.location.origin;
                    if (hash) {
                        url = window.location.href.replace(hash, '#/mmpreview');
                    } else {
                        url += "/mmpreview"
                    }

                    url += `?messageUid=${stringValue(message.messageUid)}`

                    let display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
                    let imgMsg = this.message.messageContent;
                    let size;
                    if (imgMsg.imageWidth && imgMsg.imageHeight) {
                        let workAreaWith = display.workAreaSize.width;
                        let workAreaHeight = display.workAreaSize.height;
                        size = this.scaleDown(imgMsg.imageWidth, imgMsg.imageHeight, workAreaWith, workAreaHeight);
                    }
                    console.log('size xxx', size)
                    ipcRenderer.send(IpcEventType.SHOW_MULTIMEDIA_PREVIEW_WINDOW, {
                        url: url,
                        messageUid: message.messageUid,
                        size,
                    });
                    console.log('show-multimedia-preview-window', url)
                } else {
                    store.previewMessage(message, true);
                }
            }
        },
        onImageLoaded() {
            this.imageLoaded = true
        }
    }
}
</script>

<style lang="css" scoped>
.image-content-container {
    margin: 0 10px;
    position: relative;
    border: 1px solid #efefef;
    border-radius: 5px;
}

.image-content-container img {
    max-height: 300px;
    max-width: 300px;
    border-radius: 5px;
    overflow: hidden;
    object-fit: scale-down;
}

.right-arrow:before {
    border-left-color: white;
}

.left-arrow:before {
    border-left-color: white;
}

</style>
