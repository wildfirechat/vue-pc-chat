<template>
    <div class="image-content-container">
        <div v-if="message.messageContent.type == ImageMessageContentType">
            <viewer  ref="viewer" v-viewer="{toolbar: false, zoomable: true, fullscreen: true, zoomOnWheel: true, transition: true}" class="images clearfix">
                <img :src="message.content.remoteMediaUrl" class="image">
            </viewer>
        </div>
        <div v-else>
            <img v-show="imageLoaded === false" @click="preview(message)"
                v-bind:src="'data:video/jpeg;base64,' + message.messageContent.thumbnail">
            <img v-show="imageLoaded" @click="preview(message)" @load="onImageLoaded"
                draggable="true" v-bind:src="message.messageContent.remotePath">
        </div>
        
    </div>
</template>

<script>
import Message from "@/wfc/messages/message";
import store from "@/store";
import MessageContentType from "@/wfc/messages/messageContentType";

import Vue from "vue";
import Viewer from "v-viewer";
import "viewerjs/dist/viewer.css";
Vue.use(Viewer);

export default {
    name: "ImageMessageContentView",
    props: {
        message: {
            type: Message,
            required: true,
        }
    },
    data() {
        return {
            imageLoaded: false,
            ImageMessageContentType: MessageContentType.Image
        }
    },
    methods: {
        preview(message) {
            console.log('preview', message);
            store.previewMessage(message, true);
        },
        onImageLoaded() {
            this.imageLoaded = true
        }
    },
    components: {
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

</style>
