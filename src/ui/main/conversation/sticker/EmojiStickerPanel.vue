<template>
    <div class="emoji-sticker-panel">
        <div class="panel-pages">
            <!-- 始终占位，面板高度由表情页决定，切到贴纸页时只是隐藏，保留滚动位置 -->
            <div class="emoji-page" :class="{hidden: currentPage !== 0}">
                <!-- 只有一个分类时，分类栏换成和贴纸页一样的标题；有多个分类（自定义了表情分类）时保留分类栏用来切换 -->
                <div v-if="!showEmojiCategories" class="panel-page-title">{{ $t('conversation.emoji_tab') }}</div>
                <VEmojiPicker
                    id="emoji"
                    labelSearch="Search"
                    lang="pt-BR"
                    :customEmojis="emojis"
                    :customCategories="emojiCategories"
                    :showCategories="showEmojiCategories"
                    :showSearch="false"
                    :emojisByRow="8"
                    @select="$emit('selectEmoji', $event)"
                />
            </div>
            <div v-if="currentPack" :key="currentPack.id" class="sticker-page" @scroll="onStickerPageScroll">
                <div class="panel-page-title">{{ packTitle(currentPack) }}</div>
                <div class="sticker-grid">
                    <div v-for="sticker in currentPack.stickers"
                         :key="sticker.url"
                         class="sticker-cell"
                         @click="$emit('selectSticker', sticker)">
                        <!-- 可见的贴纸都播放，滚动时暂停，停稳后继续 -->
                        <StickerView :src="sticker.url" :width="88" :height="88" :animate="!scrolling"/>
                    </div>
                </div>
            </div>
        </div>
        <div v-if="showStickers && packs.length" class="panel-tabs">
            <div class="panel-tab" :class="{active: currentPage === 0}" :title="$t('conversation.emoji_tab')" @click="selectPage(0)">
                <i class="icon-ion-happy-outline"/>
            </div>
            <div v-for="(pack, i) in packs"
                 :key="pack.id"
                 class="panel-tab"
                 :class="{active: currentPage === i + 1}"
                 :title="packTitle(pack)"
                 @click="selectPage(i + 1)">
                <StickerView :src="pack.cover" :width="26" :height="26" :animate="false"/>
            </div>
        </div>
    </div>
</template>

<script>
import {VEmojiPicker} from "@imndx/v-emoji-picker-vue3";
import StickerView from "./StickerView.vue";
import {loadedStickerPacks, loadStickerPacks, stickerPackTitle} from "./stickerPacks";

// 记住上次停留的页，下次打开面板直接回到那里。0 为 emoji，1+ 为贴纸包
let lastPage = 0;

/**
 * 表情面板：emoji 页（原来的 VEmojiPicker）加上各个贴纸包，底部标签栏切换。
 */
export default {
    name: "EmojiStickerPanel",
    props: {
        emojis: {
            type: Array,
            required: true,
        },
        emojiCategories: {
            type: Array,
            required: true,
        },
        // 密聊等场景不显示贴纸
        showStickers: {
            type: Boolean,
            default: true,
        },
    },
    emits: ['selectEmoji', 'selectSticker'],
    data() {
        let packs = this.showStickers ? loadedStickerPacks() : [];
        return {
            packs,
            currentPage: lastPage <= packs.length ? lastPage : 0,
            scrolling: false,
        }
    },
    created() {
        if (this.showStickers) {
            loadStickerPacks().then(packs => {
                this.packs = packs;
                if (this.currentPage === 0 && lastPage > 0 && lastPage <= packs.length) {
                    this.currentPage = lastPage;
                }
            });
        }
    },
    beforeUnmount() {
        clearTimeout(this.scrollEndTimer);
    },
    computed: {
        showEmojiCategories() {
            return this.emojiCategories.length > 1;
        },
        currentPack() {
            return this.currentPage > 0 ? this.packs[this.currentPage - 1] : null;
        },
    },
    methods: {
        selectPage(page) {
            this.currentPage = page;
            this.scrolling = false;
            lastPage = page;
        },
        onStickerPageScroll() {
            this.scrolling = true;
            clearTimeout(this.scrollEndTimer);
            this.scrollEndTimer = setTimeout(() => this.scrolling = false, 150);
        },
        packTitle(pack) {
            return stickerPackTitle(pack, this.$i18n.locale);
        },
    },
    components: {
        VEmojiPicker,
        StickerView,
    },
}
</script>

<style scoped>
.emoji-sticker-panel {
    width: 440px;
    display: flex;
    flex-direction: column;
    background-color: var(--background-tooltip);
    border: 1px solid var(--ep-color-border);
    border-radius: 4px;
    box-shadow: var(--shadow-tooltip);
    overflow: hidden;
}

/* 边框、阴影由外层面板统一画 */
.emoji-sticker-panel :deep(.emoji-picker) {
    width: 100%;
    border: none;
    border-radius: 0;
    box-shadow: none;
}

#emoji :deep(.container-emoji) {
    height: 320px;
}

.panel-pages {
    position: relative;
}

.emoji-page.hidden {
    visibility: hidden;
}

.sticker-page {
    position: absolute;
    inset: 0;
    overflow-y: auto;
}

.sticker-page::-webkit-scrollbar {
    width: 4px;
}

.sticker-page::-webkit-scrollbar-thumb {
    background-color: var(--scrollbar-thumb);
    border-radius: var(--radius-sm);
}

.panel-page-title {
    padding: 10px 12px 6px;
    font-size: 12px;
    color: var(--text-secondary);
}

.sticker-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 4px;
    padding: 0 8px 8px;
}

.sticker-cell {
    height: 100px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-md);
    cursor: pointer;
}

.sticker-cell:hover {
    background-color: var(--background-item-hover);
}

.panel-tabs {
    display: flex;
    align-items: center;
    gap: 2px;
    height: 40px;
    padding: 0 6px;
    border-top: 1px solid var(--ep-color-border);
    overflow-x: auto;
    overflow-y: hidden;
}

.panel-tabs::-webkit-scrollbar {
    height: 0;
}

.panel-tab {
    flex-shrink: 0;
    width: 36px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-md);
    cursor: pointer;
}

.panel-tab i {
    font-size: 20px;
    color: var(--text-secondary);
}

.panel-tab:hover {
    background-color: var(--background-item-hover);
}

.panel-tab.active {
    background-color: var(--background-item-active);
}
</style>
