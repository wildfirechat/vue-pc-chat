<template>
    <div class="text-message-container"
         v-bind:class="{out:message.direction === 0}">
        <p class="text" v-html="this.$xss(this.textContent)" @click="handleLinkClick" @dblclick.stop="viewLargeText" @mouseup="mouseUp" @contextmenu="preventContextMenuTextSelection"></p>
        <!-- 双击文本消息进入大字号查看页（对齐 wf-enterprise-chat ef62e540）。
             挂到 body 上，免得消息列表里带 transform 的祖先把 fixed 定位限制在列表内 -->
        <Teleport to="body">
            <div v-if="showLargeText" class="large-text-overlay" @click="closeLargeText">
                <div class="large-text-content" v-html="this.$xss(this.textContent)" @click.stop="handleLinkClick"></div>
                <p class="large-text-hint">点击空白处或按 Esc 关闭</p>
            </div>
        </Teleport>
    </div>
</template>

<script>
import Message from "../../../../../wfc/messages/message";
import {parser as emojiParse} from "../../../../util/emoji";
import helper from "../../../../util/helper";
import Config from "../../../../../config";
import {isElectron, shell} from "../../../../../platform";
//import {marked} from "marked";

export default {
    name: "TextMessageContentView",
    props: {
        message: {
            type: Message,
            required: true,
        }
    },
    data() {
        return {
            textSelected: false,
            showLargeText: false,
        }
    },
    mounted() {
    },
    beforeUnmount() {
        window.removeEventListener('keydown', this.onLargeTextKeydown);
    },

    methods: {
        /**
         * 双击进大字号查看页。正文可选中，双击这一下浏览器同时会选中一个词，
         * 这里先把选区清掉再打开（对齐 wf-enterprise-chat ef62e540 的 clearTextSelection）。
         */
        viewLargeText() {
            let selection = window.getSelection && window.getSelection();
            if (selection) {
                selection.removeAllRanges();
            }
            this.textSelected = false;
            this.showLargeText = true;
            window.addEventListener('keydown', this.onLargeTextKeydown);
        },
        closeLargeText() {
            this.showLargeText = false;
            window.removeEventListener('keydown', this.onLargeTextKeydown);
        },
        onLargeTextKeydown(e) {
            if (e.key === 'Escape') {
                this.closeLargeText();
            }
        },
        mouseUp(event) {
            let selection = window.getSelection().toString();
            this.textSelected = !!selection;

        },
        preventContextMenuTextSelection(event) {
            if (!this.textSelected) {
                if (window.getSelection) {
                    if (window.getSelection().empty) {  // Chrome
                        window.getSelection().empty();
                    } else if (window.getSelection().removeAllRanges) {  // Firefox
                        window.getSelection().removeAllRanges();
                    }
                } else if (document.selection) {  // IE?
                    document.selection.empty();
                }
            }
        },
        handleLinkClick(event) {
            let target = event.target;
            while (target && target !== event.currentTarget) {
                if (target.tagName === 'A') {
                    event.preventDefault();
                    let url = target.getAttribute('href');
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
                                this._openExternal(url);
                            },
                            cancelCallback: () => {
                                // do nothing
                            }
                        });
                        return;
                    }
                    this._openExternal(url);
                    return;
                }
                target = target.parentElement;
            }
        },
        _openExternal(url) {
            if (isElectron()) {
                shell.openExternal(url);
            } else {
                window.open(url);
            }
        }
    },

    computed: {
        textContent() {
            let content = this.message.messageContent.digest(this.message).trim();
            let lines = content.replace(/\r\n/g, '\n').split('\n');
            if (lines.length > 1) {
                content = lines.map(line => `<span>${helper.escapeHtml(line)}</span>\n`).reduce((total, cv, ci, arr) => total + cv, '');
            } else {
                content = helper.escapeHtml(content)
            }

            content = helper.linkify(content);
            content = emojiParse(content);
            // tmp = marked.parse(tmp);
            if (content.indexOf('<img') >= 0) {
                content = content.replace(/<img/g, '<img style="max-width:400px;"')
                return content;
            }
            return content;
        }
    }
}
</script>

<style lang="css" scoped>
.text-message-container {
    margin: 0 8px;
    padding: 8px 12px;
    background-color: var(--background-primary);
    position: relative;
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
}

.text-message-container >>> p {
    user-select: text;
    white-space: pre-line;
}

.text-message-container >>> code {
    background: var(--background-tertiary);
    display: inline-block;
    border-radius: var(--radius-sm);
    padding: 0 4px;
    user-select: text;
}

.text-message-container.out {
    background-color: var(--background-message-out);
}

.text-message-container .text {
    color: var(--text-primary);
    font-size: var(--font-size-sm);
    line-height: 1.5;
    /*max-height: 1000px;*/
    max-width: 400px;
    word-spacing: normal;
    word-break: break-word;
    overflow: hidden;
    display: inline-block;
    text-overflow: ellipsis;
    user-select: text;
}

/*style for v-html */
.text-message-container .text >>> img {
    max-width: 400px !important;
    display: inline-block;
}

.text-message-container .text >>> a {
    white-space: normal;
}

.text-message-container .text >>> .emoji {
    vertical-align: middle;
}

/* 双击文本消息的大字号查看页（对齐 wf-enterprise-chat ef62e540） */
.large-text-overlay {
    position: fixed;
    left: 0;
    top: 0;
    right: 0;
    bottom: 0;
    z-index: 3000;
    background-color: rgba(0, 0, 0, 0.55);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px;
    cursor: zoom-out;
}

.large-text-content {
    max-width: 760px;
    max-height: 80vh;
    overflow-y: auto;
    padding: 28px 32px;
    background-color: var(--background-primary);
    color: var(--text-primary);
    border-radius: var(--radius-md);
    font-size: 20px;
    line-height: 1.8;
    word-break: break-word;
    user-select: text;
    cursor: auto;
}

.large-text-content >>> a {
    white-space: normal;
}

.large-text-content >>> img {
    max-width: 100% !important;
}

.large-text-hint {
    margin-top: 14px;
    color: rgba(255, 255, 255, 0.75);
    font-size: var(--font-size-xs);
}

</style>
