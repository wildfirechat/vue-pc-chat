<template>
    <div class="image-content-container">
        <img ref="thumbnail" class="thumbnail" v-show="imageLoaded === false" @click="preview(message)"
             :class="{placeholder: !thumbnailSrc}"
             v-bind:src="thumbnailSrc || placeholderSrc"
             @error="thumbnailError = true">
        <img ref="img" v-show="imageLoaded" @click="preview(message)" @load="onImageLoaded"
             draggable="true"
             v-bind:src="message.messageContent.remotePath">
    </div>
</template>

<script>
import Message from "../../../../../wfc/messages/message";
import {previewMM} from "../../../../../platformHelper";
import {scaleDown} from "../../../../util/imageUtil";
import {imageThumbnailSrc} from "../../../../util/imageThumbUtil";

// 透明占位图，配合 .placeholder 背景色显示
const PLACEHOLDER_SRC = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

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
            // 缩略图加载失败（如服务端未生成 .thumb）时显示占位
            thumbnailError: false,
            placeholderSrc: PLACEHOLDER_SRC,
        }
    },
    computed: {
        thumbnailSrc() {
            return this.thumbnailError ? '' : imageThumbnailSrc(this.message);
        },
    },
    mounted() {
        let iw = this.message.messageContent.imageWidth;
        let ih = this.message.messageContent.imageHeight;
        if (iw && ih) {
            let size = scaleDown(iw, ih, 300, 300);
            if (size) {
                this.$refs.img.style.height = size.height + 'px';
                this.$refs.img.style.width = size.width + 'px';
                this.$refs.thumbnail.style.height = size.height + 'px';
                this.$refs.thumbnail.style.width = size.width + 'px';
            }
        }
    },
    methods: {
        preview(message) {
            if (this.isInCompositeView) {
                this.$parent.previewCompositeMessage(message.messageUid);
            } else {
                console.log('preview', message);
                previewMM(message)
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
    margin: 0 8px;
    position: relative;
    border: 1px solid var(--border-tertiary);
    border-radius: var(--radius-md);
}

.image-content-container img {
    max-height: 300px;
    max-width: 300px;
    border-radius: var(--radius-md);
    overflow: hidden;
    object-fit: scale-down;
}

/*
 * 缩略图分辨率低于显示区域，scale-down 不会放大，只占一小块。
 * 显示区域已按原图宽高设置，用 contain 放大铺满；宽高比与缩略图不一致时（如 EXIF 旋转）留边而不裁剪
 */
.image-content-container img.thumbnail {
    object-fit: contain;
}

/* 没有缩略图时的占位；已知图片尺寸时 mounted 里设置的行内宽高会覆盖这里 */
.image-content-container img.placeholder {
    width: 150px;
    height: 150px;
    background-color: var(--background-item-placeholder);
}

.right-arrow:before {
    border-left-color: var(--text-on-accent);
}

.left-arrow:before {
    border-left-color: var(--text-on-accent);
}

</style>
