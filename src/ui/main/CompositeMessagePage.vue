<template>
    <section class="composite-page">
        <div v-if="!sharedMiscState.isElectron" class="close-button-container" @click="hideCompositeMessagePage">
            <i class="icon-ion-close"></i>
        </div>
        <!-- 嵌套的聊天记录在本窗口内压一页，可以返回上一层（对齐 wf-enterprise-chat e511f73a） -->
        <div v-if="parentStack.length > 0" class="nested-header" @click="backToParent">
            <i class="icon-ion-ios-arrow-back"></i>
            <span class="single-line">返回上一层</span>
        </div>
        <div v-if="!compositeMessage">
            {{ 'Null CompositeMessagePage' }}
        </div>
        <ul v-else>
            <li v-for="(message, index) in compositeMessage.messageContent.messages"
                :key="message.uid">
                <div class="message-container">
                    <div class="portrait-container">
                        <img
                            v-if="index === 0 || message.from !== compositeMessage.messageContent.messages[index -1].from"
                            alt="" :src="message._from.portrait">
                    </div>
                    <div class="name-time-content-container">
                        <div class="name-time-container">
                            <p class="name"> {{ message._from._displayName }}</p>
                            <p class="time"> {{ message._timeStr }}</p>
                            <!--                            <p class="time"> 1223</p>-->
                        </div>
                        <div class="content">
                            <!--message content-->
                            <TextMessageContentView :message="message"
                                                    v-if="message.messageContent.type === 1"
                                                    :style="{'--out-arrow-color':'var(--message-out-arrow)', '--in-arrow-color':'var(--message-in-arrow)'}"
                                                    v-bind:class="{leftarrow:message.direction === 1, rightarrow: message.direction === 0}"/>
                            <!--                            <AudioMessageContentView :message="message"-->
                            <!--                                                     v-else-if="message.messageContent.type === 2"/>-->
                            <ImageMessageContentView :message="message"
                                                     :is-in-composite-view="true"
                                                     v-else-if="message.messageContent.type === 3"/>
                            <!--                           v-bind:class="{leftarrow:message.direction === 1, rightarrow: message.direction === 0}"/>-->
                            <FileMessageContentView :message="message"
                                                    v-else-if="message.messageContent.type === 5"
                                                    v-bind:class="{leftarrow:message.direction === 1, rightarrow: message.direction === 0}"/>
                            <VideoMessageContentView :message="message"
                                                     :is-in-composite-view="true"
                                                     v-else-if="message.messageContent.type === 6"/>
                            <!--                           v-bind:class="{leftarrow:message.direction === 1, rightarrow: message.direction === 0}"/>-->
                            <StickerMessageContentView :message="message"
                                                       v-else-if="message.messageContent.type === 7"/>
                            <CompositeMessageContentView :message="message"
                                                         v-else-if="message.messageContent.type === 11"/>
                            <LocationMessageContentView :message="message"
                                                        v-else-if="message.messageContent.type === 4"/>
                            <!--                            <CallStartMessageContentView :message="message"-->
                            <!--                                                         v-else-if="message.messageContent.type === 400"/>-->
                            <!--                            <ConferenceInviteMessageContentView :message="message"-->
                            <!--                                                                v-else-if="message.messageContent.type === 408"/>-->
                            <UnsupportMessageContentView :message="message"
                                                         v-else-if="[2, 10, 400, 408].indexOf(message.messageContent.type) >= 0"/>
                            <UnknowntMessageContentView :message="message"
                                                        v-else
                                                        v-bind:class="{leftarrow:message.direction === 1, rightarrow: message.direction === 0}"/>
                        </div>
                    </div>
                </div>
            </li>
        </ul>
    </section>

</template>

<script>
import TextMessageContentView from "./conversation/message/content/TextMessageContentView";
import UnsupportMessageContentView from "./conversation/message/content/UnsupportMessageContentView";
import store from "../../store";
import CompositeMessageContentView from "./conversation/message/content/CompositeMessageContentView";
import ImageMessageContentView from "./conversation/message/content/ImageMessageContentView";
import VideoMessageContentView from "./conversation/message/content/VideoMessageContentView";
import FileMessageContentView from "./conversation/message/content/FileMessageContentView";
import StickerMessageContentView from "./conversation/message/content/StickerMessageContentView";
import UnknowntMessageContentView from "./conversation/message/content/UnknownMessageContentView";
import Message from "../../wfc/messages/message";
import {stringValue} from "../../wfc/util/longUtil";
import wfc from "../../wfc/client/wfc";
import FavItem from "../../wfc/model/favItem";
import Conversation from "../../wfc/model/conversation";
import axios from "axios";
import {isElectron} from "../../platform";
import LocationMessageContentView from "./conversation/message/content/LocationMessageContentView";

export default {
    name: "CompositeMessagePage",
    props: {
        message: {
            required: false,
            type: Message,
            default: null,
        },
        favItem: {
            required: false,
            type: FavItem,
            default: null,
        },
    },
    data() {
        return {
            compositeMessage: null,
            // 进入嵌套聊天记录前的上一层，返回时出栈
            parentStack: [],
            sharedMiscState: store.state.misc,
        }
    },

    provide() {
        // 本页里点嵌套的聊天记录时，由 CompositeMessageContentView 交给这里在页内打开
        return {
            compositeNavigator: {
                push: (msg) => this.openNested(msg),
            },
        };
    },

    mounted() {
        if (this.message) {
            this.compositeMessage = this.message;
            this.loadMediaCompositeMessage(this.compositeMessage);
            return;
        }
        if (this.favItem) {
            this.compositeMessage = this.favItem.toMessage();
            if (this.compositeMessage) {
                store._patchMessage(this.compositeMessage, 0);
                if (isElectron()) {
                    document.title = this.compositeMessage.messageContent.title;
                }
                this.loadMediaCompositeMessage(this.compositeMessage);
            }
            return;
        }
        this.loadCompositeFromLocation();
    },

    watch: {
        // 独立窗口复用时会换 messageUid（只变 hash），组件不会重新挂载，这里跟着重载
        '$route'() {
            if (!this.message && !this.favItem) {
                this.parentStack = [];
                this.loadCompositeFromLocation();
            }
        },
    },

    methods: {
        /** 从当前地址栏 hash 解析并加载聊天记录（独立窗口用） */
        loadCompositeFromLocation() {
            let hash = window.location.hash;
            if (hash.indexOf('messageUid=') >= 0) {
                let messageUid = hash.substring(hash.indexOf('=') + 1);
                let msg = store.getMessageByUid(messageUid);
                if (!msg) {
                    wfc.loadRemoteMessage(messageUid, m => {
                        if (!m) {
                            return;
                        }
                        store._patchMessage(m, 0);
                        if (isElectron()) {
                            document.title = m.messageContent.title;
                        }
                        this.compositeMessage = m;
                        this.loadMediaCompositeMessage(m);
                    }, err => {
                        console.error('load remote message error', err);
                    });
                    return;
                }
                this.compositeMessage = msg;
            } else {
                let faveItemData = hash.substring(hash.indexOf('=') + 1);
                let favItemRaw = JSON.parse((wfc.b64_to_utf8(wfc.unescape(faveItemData))));
                let favItem = Object.assign(new FavItem(), favItemRaw);
                favItem.conversation = new Conversation(favItem.convType, favItem.convTarget, favItem.convLine);
                favItem.favType = favItem.type;
                this.compositeMessage = favItem.toMessage();
            }
            if (this.compositeMessage) {
                store._patchMessage(this.compositeMessage, 0);
                if (isElectron()) {
                    document.title = this.compositeMessage.messageContent.title;
                }
                this.loadMediaCompositeMessage(this.compositeMessage);
            }
        },
        /** 在本页打开嵌套的聊天记录（压一页），子消息不在本地库里，直接用解出来的消息对象 */
        openNested(msg) {
            if (!msg || !this.compositeMessage) {
                return;
            }
            this.parentStack.push(this.compositeMessage);
            store._patchMessage(msg, 0);
            this.compositeMessage = msg;
            this.updateTitle();
            this.loadMediaCompositeMessage(msg);
            this.scrollToTop();
        },
        backToParent() {
            if (this.parentStack.length === 0) {
                return;
            }
            this.compositeMessage = this.parentStack.pop();
            this.updateTitle();
            this.scrollToTop();
        },
        updateTitle() {
            if (isElectron() && this.compositeMessage && !this.message && !this.favItem) {
                document.title = this.compositeMessage.messageContent.title;
            }
        },
        scrollToTop() {
            this.$nextTick(() => {
                if (this.$el && this.$el.scrollTo) {
                    this.$el.scrollTo(0, 0);
                }
            });
        },
        hideCompositeMessagePage() {
            this.$modal.hide('show-composite-message-modal' + '-' + ( this.favItem ? this.favItem.id : stringValue(this.message.messageUid)))
        },
        loadMediaCompositeMessage(msg) {
            let content = msg.messageContent;
            if (content.remotePath) {
                if (isElectron()) {
                    if (content.localPath && require('fs').existsSync(content.localPath)) {
                        return;
                    }
                } else {
                    // web 每次加载
                    // do nothing
                }
                axios.get(content.remotePath, {responseType: 'arraybuffer'}).then(value => {
                    content._decodeMessages(new TextDecoder('utf-8').decode(value.data));
                    store._patchMessage(this.compositeMessage, 0);
                    content.loaded = true;
                })
            }

        },
        previewCompositeMessage(focusMessageUid) {
            store.previewCompositeMessage(this.compositeMessage, focusMessageUid)
        }
    },

    components: {
        UnknowntMessageContentView,
        // ConferenceInviteMessageContentView,
        CompositeMessageContentView,
        // AudioMessageContentView,
        // CallStartMessageContentView,
        UnsupportMessageContentView,
        TextMessageContentView,
        ImageMessageContentView,
        VideoMessageContentView,
        FileMessageContentView,
        StickerMessageContentView,
        LocationMessageContentView,
    }
}
</script>

<style scoped>

.composite-page {
    width: var(--composite-message-page-width);
    height: var(--composite-message-page-height);
    background: var(--background-primary);
    overflow: scroll;
}

.nested-header {
    position: sticky;
    top: 0;
    z-index: 1;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 20px;
    background: var(--background-primary);
    border-bottom: 1px solid var(--border-tertiary);
    color: var(--text-link);
    cursor: pointer;
}

.close-button-container {
    position: absolute;
    padding: 4px 8px 8px 4px;
    top: 0;
    right: 0;
}

.close-button-container:active {
    background: lightgrey;
}

.composite-page ul {
    width: 100%;
    height: 100%;
    padding: 20px 30px;
    list-style-position: inside;
}

.composite-page ul li {
    position: relative;
    padding: 8px 0;
}

.composite-page ul li:not(:last-child)::after {
    content: "";
    width: calc(100% - 55px);
    position: absolute;
    margin-left: 55px;
    padding: 4px 0;
    border-bottom: 1px solid var(--border-tertiary);
}

.message-container {
    width: 100%;
    display: flex;
}

.name-time-content-container {
    width: 100%;
}

.name-time-container {
    width: 100%;
    padding: 4px 0;
    display: flex;
    justify-content: space-between;
}

.name-time-container p {
    font-size: var(--font-size-xs);
    color: var(--text-tertiary);
}

.name-time-content-container .content {
    display: inline-block;
    margin-left: -8px;
}

.portrait-container {
    width: 40px;
    height: 40px;
    overflow: hidden;
    margin: 8px;
}

.portrait-container img {
    width: 100%;
    height: 100%;
    border-radius: var(--default-portrait-border-radius);
}

>>> .text-message-container.out {
    background-color: var(--background-item-normal);
}

>>> .text-message-container {
    background-color: var(--background-item-normal);
    padding-left: 0;
}

>>> .rightarrow::before {
    display: none;
}

>>> .leftarrow::before {
    display: none;
}

</style>
