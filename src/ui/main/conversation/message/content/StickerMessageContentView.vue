<template>
    <div class="sticker-content-container">
        <StickerView :src="message.messageContent.remotePath" :width="size.width" :height="size.height"/>
    </div>
</template>

<script>
import Message from "../../../../../wfc/messages/message";
import {scaleDown} from "../../../../util/imageUtil";
import StickerView from "../../sticker/StickerView.vue";

// 贴纸显示区域边长上限
const MAX_SIDE = 200;

export default {
    name: "StickerMessageContentView",
    props: {
        message: {
            type: Message,
            required: true,
        }
    },
    computed: {
        // 宽高已知时先占好位，加载完成前后列表不跳动
        size() {
            let iw = this.message.messageContent.width;
            let ih = this.message.messageContent.height;
            if (iw > 0 && ih > 0) {
                return scaleDown(iw, ih, MAX_SIDE, MAX_SIDE);
            }
            return {width: MAX_SIDE, height: MAX_SIDE};
        },
    },
    components: {
        StickerView,
    },
}
</script>

<style lang="css" scoped>
.sticker-content-container {
    margin: 0 8px;
    position: relative;
    border-radius: var(--radius-md);
}
</style>
