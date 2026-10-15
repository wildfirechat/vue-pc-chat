<template>
    <div class="location-message-container"
         :class="{out: message.direction === 0}"
         @click="openLocation">
        <div class="location-thumb">
            <img v-if="thumbnailSrc && !thumbnailError"
                 :src="thumbnailSrc"
                 alt=""
                 @error="thumbnailError = true">
            <div v-else class="location-thumb-placeholder">
                <i class="icon-ion-ios-location"></i>
            </div>
        </div>
        <div class="location-title single-line">{{ locationTitle }}</div>
    </div>
</template>

<script>
import Message from "../../../../../wfc/messages/message";
import {locationThumbnailSrc, openLocationInMap} from "../../../../util/location";

export default {
    name: "LocationMessageContentView",
    props: {
        message: {
            type: Message,
            required: true,
        }
    },
    data() {
        return {
            thumbnailError: false,
        }
    },
    computed: {
        // 位置缩略图在消息体里是不带头部信息的 base64，按 Flutter 的 LocationThumbnail 编码成 JPEG
        thumbnailSrc() {
            return locationThumbnailSrc(this.message.messageContent.thumbnail);
        },
        locationTitle() {
            return this.message.messageContent.title || '位置';
        }
    },
    methods: {
        openLocation() {
            let content = this.message.messageContent;
            openLocationInMap(content.lat, content.long, content.title || '');
        }
    }
}
</script>

<style lang="css" scoped>
.location-message-container {
    width: 232px;
    margin: 0 8px;
    /* 气泡箭头(.leftarrow/.rightarrow:before)以卡片为定位基准，否则会定位到整行，发出的消息箭头超出右边缘，会话列表出现横向滚动条 */
    position: relative;
    background-color: var(--background-primary);
    border-radius: var(--radius-md);
    overflow: hidden;
    cursor: pointer;
    user-select: none;
}

.location-thumb {
    width: 232px;
    height: 140px;
    background-color: var(--background-secondary);
    display: flex;
    align-items: center;
    justify-content: center;
}

.location-thumb img {
    width: 232px;
    height: 140px;
    object-fit: cover;
    display: block;
}

.location-thumb-placeholder {
    color: var(--text-secondary);
    font-size: 42px;
    line-height: 1;
}

.location-title {
    padding: 6px 8px;
    background-color: rgba(0, 0, 0, 0.45);
    color: #fff;
    font-size: var(--font-size-xs);
    line-height: 18px;
    max-height: 42px;
    white-space: normal;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    overflow: hidden;
}
</style>
