<template>
    <section class="forward-message-container">
        <div class="forward-message">
            <div v-if="forwardType === 0">
                <img v-if="[3, 6].indexOf(messages[0].messageContent.type) >= 0 || (messages[0].messageContent.type === 4 && firstMediaThumbnailSrc)"
                     :src="firstMediaThumbnailSrc" alt="">
                <p v-else>
                    {{ this.forwardMessageStr }}
                </p>
            </div>
            <div v-else>
                <p>
                    {{ this.forwardMessageStr }}
                </p>
            </div>
        </div>
        <label>
            <input type="text" :placeholder="$t('conversation.forward_extra')" v-model="extraMessageText">
        </label>
    </section>
</template>

<script>
import MessageContentType from "../../../../../wfc/messages/messageContentType";
import ForwardType from "./ForwardType";
import ConversationType from "../../../../../wfc/model/conversationType";
import {imageThumbnailSrc} from "../../../../util/imageThumbUtil";

export default {
    name: "ForwardMessageView",
    props: {
        forwardType: {
            // 可参考ForwardType
            type: Number,
            required: false,
        },
        messages: {
            type: Array,
            required: true,
        },
    },
    data() {
        return {
            extraMessageText: '',
        }
    },
    methods: {},
    computed: {
        firstMediaThumbnailSrc() {
            let firstMsg = this.messages[0];
            let content = firstMsg.messageContent;
            if (content.type === MessageContentType.Image) {
                return imageThumbnailSrc(firstMsg) || content.remotePath;
            }
            if (content.type === MessageContentType.Location) {
                // 位置消息的缩略图是不带头部的 base64，与气泡里 LocationMessageContentView 保持一致
                return content.thumbnail ? 'data:image/jpeg;base64,' + content.thumbnail : '';
            }
            return 'data:video/jpeg;base64,' + content.thumbnail;
        },
        forwardMessageStr() {
            let str;
            let firstMsg = this.messages[0];
            switch (this.forwardType) {
                case ForwardType.NORMAL:
                    str = !firstMsg._from ? '' : firstMsg._from._displayName + ':';
                    if ([MessageContentType.Image, MessageContentType.Video].indexOf(firstMsg.messageContent.type) < 0) {
                        str += firstMsg.messageContent.digest(firstMsg);
                    }
                    break;
                case ForwardType.ONE_BY_ONE:
                    str = '[' + this.$t('conversation.forward_one_by_one') + ']'
                    if (firstMsg.conversation.type === ConversationType.Single) {
                        str += this.$t('conversation.user_message_records', [firstMsg._from._displayName]);
                    } else {
                        str += this.$t('conversation.group_message_records');
                    }
                    break;
                case ForwardType.COMPOSITE:
                    str = '[' + this.$t('conversation.forward_composite') + ']'
                    if (firstMsg.conversation.type === ConversationType.Single) {
                        str += this.$t('conversation.user_message_records', [firstMsg._from._displayName]);
                    } else {
                        str += this.$t('conversation.group_message_records');
                    }
                    break;
                default:
                    break;
            }
            return str;
        }
    },
}
</script>

<style lang="css" scoped>
.forward-message-container {
    width: 100%;
    padding: 0 30px;
}

.forward-message {
    display: flex;
    max-width: 100%;
    border-radius: var(--radius-md);
    justify-content: center;
    max-height: 100px;
    overflow: hidden;
}

.forward-message p {
    padding: 4px 8px;
    border-radius: var(--radius-md);
    word-wrap: break-word;
    word-break: break-all;
    color: var(--text-tertiary);
    font-size: var(--font-size-sm);
    overflow: hidden;
    background-color: var(--background-item-placeholder);
    text-overflow: ellipsis;
}

.forward-message img {
    max-width: 200px;
    max-height: 200px;
    border-radius: var(--radius-sm);
}

.forward-message-container label input {
    width: 100%;
    margin: 20px 0;
    outline: none;
    border-top: 0;
    border-right: 0;
    border-left: 0;
    border-bottom: 1px solid var(--border-primary);
    background: transparent;
    color: var(--text-primary);
    font-size: var(--font-size-sm);
    transition: border-color var(--duration-fast);
}

.forward-message-container label input::placeholder {
    color: var(--text-hint);
}

.forward-message-container label input:focus {
    border-bottom-color: var(--accent-color);
}

</style>
