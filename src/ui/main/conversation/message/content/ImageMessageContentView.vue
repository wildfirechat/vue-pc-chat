<template>
    <div class="image-content-container">
        <img v-show="imageLoaded === false" @click="preview(message)"
             v-bind:src="'data:video/jpeg;base64,' + message.messageContent.thumbnail">
        <img v-show="imageLoaded" @click="preview(message)" @load="onImageLoaded"
             draggable="true"
             v-bind:src="message.messageContent.remotePath">
    </div>
</template>

<script>
import Message from "@/wfc/messages/message";
import store from "@/store";
import IpcEventType from "../../../../../ipcEventType";
import {ipcRenderer, isElectron} from "../../../../../platform";

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
    methods: {
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
                    ipcRenderer.send(IpcEventType.SHOW_MULTIMEDIA_PREVIEW_WINDOW, {
                        url: url,
                        messageUid: message.messageUid,
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
