<template>
    <!-- 卡片自带白底和描边，不套气泡色、不带气泡箭头（同 wf-enterprise-chat LinkCellBuilder） -->
    <div class="link-card" @click="clickLink">
        <img v-if="thumbnail && !thumbnailError" class="link-card-cover" :src="thumbnail" alt="" draggable="false"
             @error="thumbnailError = true">
        <div class="link-card-body">
            <div class="link-card-text">
                <p v-if="content.title" class="link-card-title">{{ content.title }}</p>
                <p v-if="digest" class="link-card-digest">{{ digest }}</p>
                <div v-if="content.url" class="link-card-url" :title="content.url">
                    <i class="icon-ion-link"></i>
                    <span>{{ content.url }}</span>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import Message from "../../../../../wfc/messages/message";
import {isElectron, shell} from "../../../../../platform";
import Config from "../../../../../config";

export default {
    name: "LinkMessageContentView",
    props: {
        message: {
            type: Message,
            required: true,
        }
    },

    data() {
        return {
            thumbnailError: false,
        };
    },

    methods: {
        clickLink() {
            let url = this.message.messageContent.url;
            if (Config.OPEN_LINK_POLICY === 2) {
                this.$notify({
                    title: '提示',
                    text: '禁止打开外部链接',
                    type: 'warn'
                });
                return;
            }
            if (Config.OPEN_LINK_POLICY === 1) {
                this.$alert({
                    showIcon: false,
                    content: '谨防钓鱼网站或者带毒网站，只有确认已知安全的链接才可以打开。请确实该链接是否是已知安全的？',
                    confirmText: '确认安全',
                    cancelText: '关闭',
                    confirmCallback: () => {
                        this._doOpenExternal(url);
                    },
                    cancelCallback: () => {
                        // do nothing
                    }
                });
                return;
            }
            this._doOpenExternal(url);
        },
        _doOpenExternal(url) {
            if (isElectron()) {
                shell.openExternal(url);
            } else {
                window.open(url);
            }
        }
    },

    computed: {
        content() {
            return this.message.messageContent;
        },
        thumbnail() {
            // 封面地址同媒体消息，按发出时所在的网络生成，换成当前网络的地址
            return Config.urlRedirect(this.content.thumbnail);
        },
        digest() {
            const digest = this.content.contentDigest ? this.content.contentDigest.trim() : '';
            // 不少来源摘要就是标题，重复显示一遍没意义
            return digest && digest !== (this.content.title || '').trim() ? digest : '';
        },
    },

    watch: {
        thumbnail() {
            this.thumbnailError = false;
        },
    },
}
</script>

<style lang="css" scoped>
.link-card {
    margin: 0 8px;
    width: 300px;
    box-sizing: border-box;
    border-radius: var(--radius-md);
    border: 1px solid var(--border-secondary);
    background-color: var(--background-primary);
    color: var(--text-primary);
    cursor: pointer;
    overflow: hidden;
}

.link-card-cover {
    display: block;
    width: 100%;
    height: 120px;
    object-fit: cover;
    background-color: var(--background-secondary);
}

.link-card-body {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px;
}

.link-card-text {
    flex: 1;
    min-width: 0;
}

.link-card-title {
    font-size: var(--font-size-base);
    font-weight: 600;
    line-height: 1.4;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    word-break: break-all;
}

.link-card-digest {
    margin-top: 4px;
    font-size: var(--font-size-xs);
    line-height: 1.5;
    color: var(--text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    word-break: break-all;
}

.link-card-url {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-top: 8px;
    font-size: var(--font-size-xs);
    line-height: 1.4;
    color: var(--text-tertiary);
}

/* 只有地址时不留上边距 */
.link-card-url:first-child {
    margin-top: 0;
}

.link-card-url i {
    flex-shrink: 0;
    font-size: 12px;
}

.link-card-url span {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
}
</style>
