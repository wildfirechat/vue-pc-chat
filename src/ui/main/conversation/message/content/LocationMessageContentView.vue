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
import {isElectron, shell} from "../../../../../platform";

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
            let thumbnail = this.message.messageContent.thumbnail;
            if (!thumbnail) {
                return '';
            }
            if (thumbnail.startsWith('data:image')) {
                return thumbnail;
            }
            return 'data:image/jpeg;base64,' + thumbnail;
        },
        locationTitle() {
            return this.message.messageContent.title || '位置';
        }
    },
    methods: {
        openLocation() {
            let content = this.message.messageContent;
            let lat = Number(content.lat);
            let lng = Number(content.long);
            if (!isFinite(lat) || !isFinite(lng)) {
                return;
            }
            let latStr = lat.toFixed(6);
            let lngStr = lng.toFixed(6);
            let title = content.title || '';
            let url;
            if (process.platform === 'darwin') {
                // macOS 系统地图用 Apple 地图，与 Flutter location_launcher 一致
                url = `https://maps.apple.com/?ll=${latStr},${lngStr}`;
                if (title) {
                    url += `&q=${encodeURIComponent(title)}`;
                }
            } else {
                // 桌面端没有系统地图应用，直接用网页地图（高德）。坐标是 GCJ-02。
                url = `https://uri.amap.com/marker?position=${lngStr},${latStr}&coordinate=gaode`;
                if (title) {
                    url += `&name=${encodeURIComponent(title)}`;
                }
            }
            if (isElectron()) {
                shell.openExternal(url);
            } else {
                window.open(url);
            }
        }
    }
}
</script>

<style lang="css" scoped>
.location-message-container {
    width: 232px;
    margin: 0 8px;
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
