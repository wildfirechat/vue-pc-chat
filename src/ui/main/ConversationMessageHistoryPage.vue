<template>
    <section class="conversation-message-history-page">
        <div class="title-bar">
            <p class="single-line">{{ title }}</p>
        </div>
        <template v-if="conversationInfo">
            <div class="search-input-container" :class="{focused: inputFocused, 'has-filter': filterLabel}"
                 @mousedown.self.prevent="$refs.input.focus()">
                <i v-if="!filterLabel" class="icon-ion-ios-search search-icon" @mousedown.prevent="$refs.input.focus()"></i>
                <span v-else ref="filterChip" class="filter-chip" :class="{clickable: filterPicker}"
                      @click="filterPicker && togglePicker(filterPicker, $refs.filterChip)">
                    <img v-if="member" class="chip-avatar" :src="member.portrait" draggable="false" alt="">
                    <i v-else class="chip-icon" :class="filterIcon"></i>
                    <span class="single-line">{{ filterLabel }}</span>
                    <i class="icon-ion-ios-close-empty chip-close" @click.stop="clearFilter"></i>
                </span>
                <input ref="input"
                       autocomplete="off"
                       v-model.trim="query"
                       @focus="inputFocused = true"
                       @blur="inputFocused = false"
                       @keydown.delete="onDeleteKeyDown"
                       type="text" :placeholder="$t('common.search')"/>
                <!-- 清除按钮始终占位，避免输入时输入框宽度跳变 -->
                <i class="icon-ion-close-circled clear-icon" :class="{visible: query}" @click="query = ''"></i>
            </div>
            <div class="category-container">
                <a v-for="c in categories" :key="c" @click="setCategory(c)">{{ $t('message_history.' + c) }}</a>
                <a ref="dateTab" @click="togglePicker('date', $refs.dateTab)">{{ $t('message_history.date') }}</a>
                <a v-if="isGroup" ref="memberTab" @click="togglePicker('member', $refs.memberTab)">{{ $t('message_history.member') }}</a>
            </div>
            <div v-if="context" class="context-action-bar">
                <a @click="closeContext"><i class="icon-ion-ios-arrow-back"></i>{{ $t('message_history.back') }}</a>
            </div>
            <div ref="scroller" class="message-list-container" :class="{media: isMediaGrid}" @scroll="checkLoad">
                <template v-if="isMediaGrid">
                    <div v-for="group in mediaGroups" :key="group.key" class="media-group">
                        <p class="media-group-title">{{ group.title }}</p>
                        <ul class="media-grid">
                            <li v-for="message in group.messages" :key="message.messageId"
                                :style="{backgroundImage: message.messageContent.thumbnail ? `url(data:image/jpeg;base64,${message.messageContent.thumbnail})` : ''}"
                                @click="previewMedia(message)">
                                <img v-if="message.messageContent.type === MessageContentType.Image && message.messageContent.remotePath"
                                     :src="message.messageContent.remotePath" loading="lazy" draggable="false" alt=""
                                     @error="$event.target.style.display = 'none'">
                                <i v-if="message.messageContent.type === MessageContentType.Video" class="icon-ion-ios-play video-icon"></i>
                            </li>
                        </ul>
                    </div>
                </template>
                <ul v-else-if="currentList">
                    <li v-for="message in currentList.items"
                        :key="message.messageId"
                        :class="{anchor: message.messageId === currentList.anchorId}">
                        <div class="portrait-container">
                            <img :src="message._from.portrait" draggable="false" alt="">
                        </div>
                        <div class="name-time-content-container">
                            <div class="name-time-container">
                                <p class="name single-line">{{ message._from._displayName }}</p>
                                <p class="time">{{ formatTime(message) }}</p>
                            </div>
                            <div class="content-container">
                                <MessageContentContainerView class="content" :message="message"/>
                                <a v-if="canViewContext" class="action single-line"
                                   @click="openContext(message)">{{ $t('message_history.view_context') }}</a>
                            </div>
                        </div>
                    </li>
                </ul>
                <p v-if="emptyTip" class="tip">{{ emptyTip }}</p>
                <p v-else-if="currentList && currentList.loading && currentList.items.length === 0" class="tip">{{ $t('common.loading') }}</p>
                <p v-else-if="currentList && currentList.bottomDone && !isTimeline" class="tip">
                    {{ $t('conversation.no_more_message') }}</p>
            </div>
            <MessageHistoryDatePicker v-if="picker === 'date'"
                                      ref="picker"
                                      class="picker"
                                      :style="pickerStyle"
                                      :conversation="conversationInfo.conversation"
                                      :selected="date || 0"
                                      @select="onSelectDate"/>
            <MessageHistoryMemberPicker v-else-if="picker === 'member'"
                                        ref="picker"
                                        class="picker"
                                        :style="pickerStyle"
                                        :group-id="conversationInfo.conversation.target"
                                        :selected-uid="member ? member.uid : ''"
                                        @select="onSelectMember"/>
        </template>
    </section>
</template>

<script>
import MessageContentContainerView from "./conversation/message/MessageContentContainerView";
import MessageHistoryDatePicker from "./MessageHistoryDatePicker";
import MessageHistoryMemberPicker from "./MessageHistoryMemberPicker";
import Conversation from "../../wfc/model/conversation";
import ConversationType from "../../wfc/model/conversationType";
import store from "../../store";
import MessageContentType from "../../wfc/messages/messageContentType";
import NotificationMessageContent from "../../wfc/messages/notification/notificationMessageContent";
import {numberValue} from "../../wfc/util/longUtil";
import {reactive} from "vue";
import {previewMM} from "../../platformHelper";

const FILTER_ICONS = {
    file: 'icon-ion-document',
    media: 'icon-ion-ios-photos-outline',
    link: 'icon-ion-link',
    date: 'icon-ion-ios-calendar-outline',
};

const CATEGORY_CONTENT_TYPES = {
    file: [MessageContentType.File],
    media: [MessageContentType.Image, MessageContentType.Video],
    link: [MessageContentType.Link],
};

// 距离顶部/底部多少像素时开始加载下一页
const LOAD_THRESHOLD = 100;

// 通知类消息（入群、撤回提示等）在聊天记录里不展示
function isDisplayable(message) {
    return !(message.messageContent instanceof NotificationMessageContent)
        && message.messageContent.type !== MessageContentType.Streaming_Text_Cancelled;
}

function nextDay(dayStart) {
    let date = new Date(dayStart);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime();
}

// 聊天记录列表：items 按显示顺序排列；fetchTop / fetchBottom 返回要加到列表顶部 / 底部的消息（同样按显示顺序），
// 返回空数组表示那个方向没有更多消息
function createList(fetchTop, fetchBottom, items = []) {
    return reactive({
        items,
        fetchTop,
        fetchBottom,
        topDone: !fetchTop,
        bottomDone: !fetchBottom,
        loading: false,
        anchorId: 0,
    });
}

export default {
    name: "ConversationMessageHistoryPage",

    data() {
        return {
            conversationInfo: null,
            query: '',
            categories: ['file', 'media', 'link'],
            // 分类、日期、群成员三种筛选条件互斥
            // '' | 'file' | 'media' | 'link'
            category: '',
            // 按日期查找时，选中日期当天 0 点的时间戳
            date: null,
            // 按群成员查找时，选中的群成员 {uid, _displayName, portrait}
            member: null,
            inputFocused: false,
            // 当前打开的选择弹窗：'' | 'date' | 'member'
            picker: '',
            pickerAnchor: null,
            pickerStyle: {},
            // 主列表：浏览、搜索结果或者按日期查找
            list: null,
            // 查看上下文
            context: null,
            MessageContentType,
        }
    },

    mounted() {
        let params = new URLSearchParams(window.location.hash.split('?')[1]);
        let type = Number(params.get('type'));
        let target = params.get('target');
        let line = Number(params.get('line'));
        this.conversationInfo = store.getConversationInfo(new Conversation(type, target, line));
        if (!this.conversationInfo) {
            return;
        }
        document.title = this.title;
        document.addEventListener('mousedown', this.onDocumentMouseDown);
        document.addEventListener('keydown', this.onDocumentKeyDown);
        this.resetList();
    },

    beforeUnmount() {
        document.removeEventListener('mousedown', this.onDocumentMouseDown);
        document.removeEventListener('keydown', this.onDocumentKeyDown);
    },

    methods: {
        resetList() {
            this.context = null;
            let conversation = this.conversationInfo.conversation;
            let contentTypes = CATEGORY_CONTENT_TYPES[this.category] || [];
            let userId = this.member ? this.member.uid : '';
            if (this.query) {
                this.list = this.searchList(conversation, contentTypes, this.query, this.date, userId);
            } else if (this.date) {
                this.list = this.timelineList(conversation, this.date);
            } else {
                this.list = this.browseList(conversation, contentTypes, userId);
            }
            this.$nextTick(() => {
                this.$refs.scroller.scrollTop = 0;
                this.checkLoad();
            });
        },

        // 最新的在最上面，往下翻加载更早的消息；指定 userId 时只看该群成员发的消息
        browseList(conversation, contentTypes, userId) {
            let oldest = null;
            return createList(null, () => new Promise(resolve => {
                let callback = msgs => {
                    if (msgs.length > 0) {
                        oldest = msgs[0];
                    }
                    resolve(msgs.reverse());
                };
                if (userId) {
                    store.getUserMessages(conversation, userId, oldest ? oldest.messageId : 0, true, callback);
                } else if (contentTypes.length === 0) {
                    store.getMessages(conversation, oldest ? oldest.messageId : 0, true, '', callback);
                } else {
                    store.getMessageInTypes(conversation, contentTypes, oldest ? oldest.timestamp : 0, true, '', callback);
                }
            }));
        },

        // 关键字搜索，选了日期时只搜当天的消息，选了群成员时只搜该成员发的消息
        searchList(conversation, contentTypes, query, date, userId) {
            let offset = 0;
            return createList(null, async () => {
                // 搜索接口的 withUser 只对频道有效，按群成员查找时只能在搜索结果里过滤，
                // 一直往后搜，直到找到该成员的消息或者搜完
                for (; ;) {
                    let msgs = date
                        ? store.searchMessageInTypesAndTimes(conversation, contentTypes, query, date, nextDay(date) - 1, offset)
                        : store.searchMessageInTypes(conversation, contentTypes, query, offset);
                    offset += msgs.length;
                    if (!userId || msgs.length === 0) {
                        return msgs;
                    }
                    msgs = msgs.filter(m => m.from === userId);
                    if (msgs.length > 0) {
                        return msgs;
                    }
                }
            });
        },

        // 按时间正序，从某条消息或者某个时间点开始，往上加载更早的消息，往下加载更新的消息
        timelineList(conversation, anchor) {
            let anchorMessage = typeof anchor === 'number' ? null : anchor;
            let first = anchorMessage;
            let last = anchorMessage;
            let list = createList(
                () => new Promise(resolve => {
                    store.getMessages(conversation, first.messageId, true, '', msgs => {
                        if (msgs.length > 0) {
                            first = msgs[0];
                        }
                        resolve(msgs);
                    });
                }),
                () => new Promise(resolve => {
                    let callback = msgs => {
                        if (msgs.length > 0) {
                            if (!first) {
                                first = msgs[0];
                                let firstDisplayable = msgs.find(isDisplayable);
                                list.anchorId = firstDisplayable ? firstDisplayable.messageId : 0;
                            }
                            last = msgs[msgs.length - 1];
                        }
                        resolve(msgs);
                    };
                    if (last) {
                        store.getMessages(conversation, last.messageId, false, '', callback);
                    } else {
                        store.getMessageInTypes(conversation, [], anchor - 1, false, '', callback);
                    }
                }),
                anchorMessage ? [anchorMessage] : []);
            if (anchorMessage) {
                list.anchorId = anchorMessage.messageId;
            }
            return list;
        },

        checkLoad() {
            let list = this.currentList;
            let el = this.$refs.scroller;
            if (!list || !el) {
                return;
            }
            // 按日期查找时，先加载选中日期的第一页，再往上加载更早的消息
            if (!list.topDone && list.items.length > 0 && el.scrollTop < LOAD_THRESHOLD) {
                this.load(list, 'top');
            } else if (!list.bottomDone && el.scrollHeight - el.scrollTop - el.clientHeight < LOAD_THRESHOLD) {
                this.load(list, 'bottom');
            }
        },

        async load(list, where) {
            if (list.loading) {
                return;
            }
            list.loading = true;
            let msgs = [];
            try {
                msgs = await (where === 'top' ? list.fetchTop() : list.fetchBottom());
            } catch (e) {
                console.error('load message history error', e);
            }
            list.loading = false;
            // 列表已经被替换（换了关键字/分类/日期），丢弃结果
            if (list !== this.list && list !== this.context) {
                return;
            }
            let el = this.$refs.scroller;
            let visible = list === this.currentList;
            if (msgs.length === 0) {
                list[where + 'Done'] = true;
            } else if (where === 'top') {
                msgs = this.newDisplayableMessages(list, msgs);
                let prevScrollHeight = el.scrollHeight;
                list.items.unshift(...msgs);
                await this.$nextTick();
                // 往顶部插入消息后保持当前看到的位置不动
                if (visible) {
                    el.scrollTop += el.scrollHeight - prevScrollHeight;
                }
            } else {
                list.items.push(...this.newDisplayableMessages(list, msgs));
                await this.$nextTick();
            }
            if (visible) {
                this.checkLoad();
            }
        },

        newDisplayableMessages(list, msgs) {
            let ids = new Set(list.items.map(m => m.messageId));
            return msgs.filter(m => !ids.has(m.messageId) && isDisplayable(m));
        },

        setCategory(category) {
            this.category = category;
            this.date = null;
            this.member = null;
            this.$refs.input.focus();
        },

        clearFilter() {
            this.category = '';
            this.date = null;
            this.member = null;
            this.picker = '';
        },

        togglePicker(picker, anchorEl) {
            if (this.picker === picker) {
                this.picker = '';
                return;
            }
            // 两种弹窗宽度都是 300
            let rect = anchorEl.getBoundingClientRect();
            let width = 300;
            let left = Math.max(16, Math.min(rect.left, window.innerWidth - width - 16));
            this.pickerStyle = {left: left + 'px', top: rect.bottom + 8 + 'px'};
            this.pickerAnchor = anchorEl;
            this.picker = picker;
        },

        onSelectDate(timestamp) {
            this.picker = '';
            this.category = '';
            this.member = null;
            this.date = timestamp;
        },

        onSelectMember(user) {
            this.picker = '';
            this.category = '';
            this.date = null;
            this.member = {uid: user.uid, _displayName: user._displayName, portrait: user.portrait};
            this.$refs.input.focus();
        },

        openContext(message) {
            this.listScrollTop = this.$refs.scroller.scrollTop;
            this.context = this.timelineList(this.conversationInfo.conversation, message);
            this.$nextTick(() => {
                this.$refs.scroller.scrollTop = 0;
                this.checkLoad();
            });
        },

        closeContext() {
            this.context = null;
            this.$nextTick(() => {
                this.$refs.scroller.scrollTop = this.listScrollTop;
                this.checkLoad();
            });
        },

        onDeleteKeyDown(e) {
            // 输入框已经为空时，删除键移除筛选条件
            if (!e.isComposing && e.target.value === '' && this.filterLabel) {
                this.clearFilter();
            }
        },

        onDocumentMouseDown(e) {
            if (!this.picker) {
                return;
            }
            let picker = this.$refs.picker && this.$refs.picker.$el;
            if ((picker && picker.contains(e.target)) || (this.pickerAnchor && this.pickerAnchor.contains(e.target))) {
                return;
            }
            this.picker = '';
        },

        onDocumentKeyDown(e) {
            if (e.key !== 'Escape' || e.isComposing) {
                return;
            }
            if (this.picker) {
                this.picker = '';
            } else if (this.context) {
                this.closeContext();
            } else if (this.query) {
                this.query = '';
            } else if (this.filterLabel) {
                this.clearFilter();
            }
        },

        previewMedia(message) {
            previewMM(message);
        },

        formatDate(timestamp) {
            return new Date(timestamp).toLocaleDateString(this.$i18n.locale, {year: 'numeric', month: 'long', day: 'numeric'});
        },

        formatTime(message) {
            let timestamp = numberValue(message.timestamp);
            let time = new Date(timestamp).toLocaleTimeString(this.$i18n.locale, {hour: '2-digit', minute: '2-digit', hour12: false});
            return this.formatDate(timestamp) + ' ' + time;
        },
    },

    computed: {
        title() {
            if (!this.conversationInfo) {
                return '';
            }
            let conversation = this.conversationInfo.conversation;
            let name = conversation._target._displayName;
            return conversation.type === ConversationType.Single
                ? this.$t('message_history.title_single', [name])
                : this.$t('message_history.title_group', [name]);
        },

        isGroup() {
            return this.conversationInfo.conversation.type === ConversationType.Group;
        },

        filterLabel() {
            if (this.date) {
                return this.formatDate(this.date);
            }
            if (this.member) {
                return this.member._displayName;
            }
            return this.category ? this.$t('message_history.' + this.category) : '';
        },

        filterIcon() {
            return FILTER_ICONS[this.date ? 'date' : this.category];
        },

        // 点击筛选标签可以重新选择日期或群成员
        filterPicker() {
            return this.date ? 'date' : (this.member ? 'member' : '');
        },

        // 图片与视频按宫格展示
        isMediaGrid() {
            return this.category === 'media' && !this.context;
        },

        // 按月分组，当月显示“本月”
        mediaGroups() {
            let groups = [];
            let now = new Date();
            let currentMonth = now.getFullYear() * 12 + now.getMonth();
            for (let message of (this.list ? this.list.items : [])) {
                let date = new Date(numberValue(message.timestamp));
                let key = date.getFullYear() * 12 + date.getMonth();
                let group = groups[groups.length - 1];
                if (!group || group.key !== key) {
                    group = {
                        key,
                        title: key === currentMonth
                            ? this.$t('message_history.this_month')
                            : date.toLocaleDateString(this.$i18n.locale, {year: 'numeric', month: 'long'}),
                        messages: [],
                    };
                    groups.push(group);
                }
                group.messages.push(message);
            }
            return groups;
        },

        filterKey() {
            return [this.query, this.category, this.date, this.member ? this.member.uid : ''].join('|');
        },

        currentList() {
            return this.context || this.list;
        },

        // 按日期查找（没有关键字）时，按时间正序展示
        isTimeline() {
            return !!this.context || (!!this.date && !this.query);
        },

        canViewContext() {
            return !this.isTimeline;
        },

        emptyTip() {
            let list = this.currentList;
            if (!list || list.items.length > 0 || list.loading || !list.bottomDone) {
                return '';
            }
            return this.query ? this.$t('search.result_empty') : this.$t('message_history.empty');
        },
    },

    watch: {
        filterKey() {
            this.resetList();
        },
    },

    components: {
        MessageContentContainerView,
        MessageHistoryDatePicker,
        MessageHistoryMemberPicker,
    }
}
</script>

<style scoped lang="css">
/* 尺寸参考微信聊天记录窗口（570 x 720） */
.conversation-message-history-page {
    --history-font-size: calc(15px * var(--font-scale));
    --history-padding-left: 24px;
    --history-padding-right: 28px;
    width: 100vw;
    height: 100vh;
    background: var(--background-tertiary);
    display: flex;
    flex-direction: column;
    /* 根节点会继承 App.vue 里 router-view 的 main-content-container（居中对齐），这里要覆盖掉，
       否则搜索框等子元素会按内容收缩，不能撑满窗口宽度 */
    align-items: stretch;
    justify-content: flex-start;
    overflow: hidden;
}

.title-bar {
    height: 42px;
    min-height: 42px;
    padding: 0 80px;
    display: flex;
    align-items: center;
    justify-content: center;
    -webkit-app-region: drag;
}

.title-bar p {
    font-size: var(--history-font-size);
    font-weight: 500;
    color: var(--text-primary);
}

.search-input-container {
    height: calc(42px * var(--layout-scale-cap));
    min-height: calc(42px * var(--layout-scale-cap));
    margin: 7px 25px 0;
    padding: 0 12px 0 11px;
    display: flex;
    align-items: center;
    border: 1px solid var(--border-primary);
    border-radius: var(--radius-md);
    background-color: var(--background-primary);
    cursor: text;
}

.search-input-container.focused {
    border-color: var(--border-active);
}

.search-input-container .search-icon {
    font-size: calc(18px * var(--layout-scale-cap));
    color: var(--text-tertiary);
    margin-right: 8px;
}

.search-input-container input {
    flex: 1;
    min-width: 0;
    height: 100%;
    border: none;
    outline: none;
    padding: 0;
    background: transparent;
    font-size: var(--history-font-size);
    color: var(--text-primary);
}

.search-input-container input::placeholder {
    color: var(--text-placeholder);
}

.search-input-container .clear-icon {
    visibility: hidden;
    font-size: calc(16px * var(--layout-scale-cap));
    color: var(--text-placeholder);
    cursor: pointer;
    margin-left: 8px;
}

.search-input-container .clear-icon.visible {
    visibility: visible;
}

.search-input-container .clear-icon:hover {
    color: var(--text-tertiary);
}

.search-input-container.has-filter {
    padding-left: 5px;
}

.filter-chip {
    max-width: 60%;
    height: calc(32px * var(--layout-scale-cap));
    margin-right: 8px;
    padding: 0 4px 0 8px;
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
    border-radius: var(--radius-sm);
    background: var(--background-input);
    color: var(--text-primary);
    font-size: var(--history-font-size);
    cursor: default;
}

.filter-chip.clickable {
    cursor: pointer;
}

.filter-chip .chip-icon {
    font-size: calc(18px * var(--layout-scale-cap));
}

.filter-chip .chip-avatar {
    width: calc(22px * var(--layout-scale-cap));
    height: calc(22px * var(--layout-scale-cap));
    border-radius: var(--radius-sm);
}

.filter-chip .chip-close {
    padding: 0 4px;
    font-size: calc(24px * var(--layout-scale-cap));
    color: var(--text-secondary);
    cursor: pointer;
}

.filter-chip .chip-close:hover {
    color: var(--text-primary);
}

.category-container {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 26px;
    padding: 15px 29px;
}

.category-container a {
    line-height: 20px;
    font-size: var(--history-font-size);
    color: var(--text-link);
    cursor: pointer;
}

.category-container a:hover {
    color: var(--text-link-hover);
}

.context-action-bar {
    padding: 15px 29px;
}

.context-action-bar a {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    line-height: 20px;
    font-size: var(--history-font-size);
    color: var(--text-link);
    cursor: pointer;
}

.message-list-container {
    flex: 1;
    padding: 10px var(--history-padding-right) 20px var(--history-padding-left);
    border-top: 1px solid var(--border-secondary);
    overflow-y: auto;
}

.message-list-container ul {
    list-style: none;
}

.message-list-container.media {
    padding-left: 39px;
    padding-right: 39px;
}

.media-group-title {
    padding: 6px 0 12px;
    line-height: 20px;
    font-size: var(--font-size-base);
    font-weight: 500;
    color: var(--text-primary);
}

.media-group + .media-group {
    margin-top: 16px;
}

.media-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
    gap: 4px;
}

.media-grid li {
    position: relative;
    aspect-ratio: 1;
    overflow: hidden;
    background-color: var(--background-item-placeholder);
    background-size: cover;
    background-position: center;
    cursor: pointer;
}

.media-grid li img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.media-grid .video-icon {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 36px;
    height: 36px;
    transform: translate(-50%, -50%);
    display: flex;
    align-items: center;
    justify-content: center;
    padding-left: 3px;
    border-radius: var(--radius-circle);
    background: var(--background-overlay);
    color: var(--text-on-accent);
    font-size: 20px;
}

.message-list-container > ul > li {
    display: flex;
    padding: 12px 0;
}

.message-list-container li.anchor {
    animation: anchor-highlight 2.4s ease-out;
}

@keyframes anchor-highlight {
    0%, 40% {
        background: var(--background-item-selected);
    }
    100% {
        background: transparent;
    }
}

.portrait-container {
    width: calc(42px * var(--layout-scale-cap));
    height: calc(42px * var(--layout-scale-cap));
    min-width: calc(42px * var(--layout-scale-cap));
    margin-right: 10px;
}

.portrait-container img {
    width: 100%;
    height: 100%;
    border-radius: var(--default-portrait-border-radius);
}

.name-time-content-container {
    flex: 1;
    min-width: 0;
}

.name-time-container {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    min-height: 20px;
    margin-bottom: 8px;
}

.name-time-container p {
    font-size: var(--history-font-size);
    color: var(--text-secondary);
}

.name-time-container .time {
    flex-shrink: 0;
}

.content-container {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
}

.content-container .content {
    min-width: 0;
    margin-left: -8px;
}

.content-container .action {
    flex-shrink: 0;
    margin-top: 2px;
    visibility: hidden;
    font-size: var(--font-size-base);
    color: var(--text-link);
    cursor: pointer;
}

.message-list-container li:hover .action {
    visibility: visible;
}

.tip {
    padding: 16px 0;
    text-align: center;
    font-size: var(--font-size-sm);
    color: var(--text-tertiary);
}

.picker {
    position: fixed;
    z-index: 10;
}

:deep(.text-message-container),
:deep(.text-message-container.out) {
    background-color: transparent !important;
    padding-top: 0 !important;
    padding-left: 0 !important;
}

:deep(.rightarrow::before) {
    display: none;
}

:deep(.leftarrow::before) {
    display: none;
}
</style>
