<template>
    <div class="mm-preview" :class="{'is-mac': isMac}">
        <!--工具栏，同时作为窗口标题栏（可拖动）-->
        <header class="toolbar" :class="{'with-window-controls': showWindowControls}">
            <button class="tool" :disabled="!hasMoreOldMediaMessage" :title="$t('mmpreview.prev')" @click="previewNextMessage(true)">
                <svg viewBox="0 0 20 20"><path d="M12.5 4.5 7 10l5.5 5.5"/></svg>
            </button>
            <button class="tool" :disabled="!hasMoreNewMediaMessage" :title="$t('mmpreview.next')" @click="previewNextMessage(false)">
                <svg viewBox="0 0 20 20"><path d="M7.5 4.5 13 10l-5.5 5.5"/></svg>
            </button>
            <span class="divider"></span>
            <button class="tool" :disabled="!zoomable" :title="$t('mmpreview.zoom_out')" @click="zoomBy(1 / ZOOM_STEP)">
                <svg viewBox="0 0 20 20"><circle cx="9" cy="9" r="5.5"/><path d="M13 13l3.5 3.5M6.5 9h5"/></svg>
            </button>
            <button class="tool" :disabled="!zoomable" :title="$t('mmpreview.zoom_in')" @click="zoomBy(ZOOM_STEP)">
                <svg viewBox="0 0 20 20"><circle cx="9" cy="9" r="5.5"/><path d="M13 13l3.5 3.5M6.5 9h5M9 6.5v5"/></svg>
            </button>
            <button class="tool" :disabled="!zoomable || (isActualSize && fitScale >= 1)"
                    :title="isActualSize ? $t('mmpreview.fit_window') : $t('mmpreview.actual_size')"
                    @click="toggleActualSize()">
                <svg v-if="isActualSize" viewBox="0 0 20 20"><path d="M3.5 7.5v-4h4M12.5 3.5h4v4M16.5 12.5v4h-4M7.5 16.5h-4v-4"/></svg>
                <svg v-else viewBox="0 0 20 20"><rect x="2.5" y="4.5" width="15" height="11" rx="1.5"/><path d="M6.5 8v4M13.5 8v4M10 8.5v.01M10 11.5v.01"/></svg>
            </button>
            <span class="divider"></span>
            <button class="tool" :disabled="!zoomable" :title="$t('mmpreview.rotate')" @click="rotate">
                <svg viewBox="0 0 20 20"><rect x="3.5" y="8.5" width="10" height="8" rx="1.5"/><path d="M8.5 4.5h4a3 3 0 0 1 3 3v3"/><path d="M13.5 8.5l2 2 2-2"/></svg>
            </button>
            <span class="divider"></span>
            <button class="tool" :disabled="!currentMedia.url" :title="$t('common.save')" @click="download">
                <svg viewBox="0 0 20 20"><path d="M10 3.5v9M6.5 9l3.5 3.5L13.5 9M3.5 13.5v2a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-2"/></svg>
            </button>
            <button v-if="!favMode" class="tool" :disabled="!message" :title="$t('common.forward')" @click="forward">
                <svg viewBox="0 0 20 20"><path d="M11 4.5l5.5 5-5.5 5v-3c-3.5 0-6 1-7.5 4 .5-4.5 2.5-7.5 7.5-8v-3z"/></svg>
            </button>
            <div class="spacer"></div>
            <button class="tool" :class="{active: pinned}" :title="pinned ? $t('mmpreview.unpin') : $t('mmpreview.pin')" @click="togglePin">
                <svg viewBox="0 0 20 20"><path d="M7 3.5h6M8.5 3.5v4.5L6 11.5h8L11.5 8V3.5M10 11.5v5"/></svg>
            </button>
            <template v-if="showWindowControls">
                <button class="window-button maximize" :title="maximized ? $t('mmpreview.restore') : $t('mmpreview.maximize')" @click="toggleMaximize">
                    <svg v-if="maximized" viewBox="0 0 10 10"><path d="M2.5 2.5V.5h7v7h-2M.5 2.5h7v7h-7z"/></svg>
                    <svg v-else viewBox="0 0 10 10"><path d="M.5.5h9v9h-9z"/></svg>
                </button>
                <button class="window-button close" :title="$t('mmpreview.close')" @click="close">
                    <svg viewBox="0 0 10 10"><path d="M.5.5l9 9M9.5.5l-9 9"/></svg>
                </button>
            </template>
        </header>

        <main ref="stage" class="stage"
              :class="{video: isVideo, pannable: canPan, panning: panning}"
              @wheel="onWheel"
              @pointerdown="onPointerDown"
              @pointermove="onPointerMove"
              @pointerup="onPointerUp"
              @pointercancel="onPointerUp"
              @dblclick="onDoubleClick"
              @contextmenu.prevent="showContextMenu">
            <template v-if="currentMedia.url">
                <template v-if="isImage">
                    <img v-if="!mediaLoaded && !mediaError && currentMedia.thumbnailSrc"
                         class="placeholder"
                         :style="placeholderStyle"
                         :src="currentMedia.thumbnailSrc"
                         draggable="false"
                         alt="">
                    <img :key="mediaKey"
                         ref="img"
                         class="media"
                         :class="{hidden: !mediaLoaded, smooth: smooth}"
                         :style="imageStyle"
                         :src="currentMedia.url"
                         draggable="false"
                         alt=""
                         @load="onImageLoaded"
                         @error="onMediaError">
                </template>
                <video v-else
                       :key="mediaKey"
                       ref="video"
                       class="media-video"
                       :src="currentMedia.url"
                       :poster="currentMedia.thumbnailSrc"
                       controls
                       autoplay
                       @loadedmetadata="onVideoMetaDataLoaded"
                       @error="onMediaError"/>
            </template>
            <div v-if="!mediaLoaded && !mediaError" class="spinner"></div>
            <div v-if="mediaError" class="error-tip">{{ $t('mmpreview.load_failed') }}</div>

            <div v-if="hasMoreOldMediaMessage" class="side-nav left"
                 @click.stop="previewNextMessage(true)" @pointerdown.stop @dblclick.stop>
                <span class="side-nav-button"><svg viewBox="0 0 24 24"><path d="M14.5 6 8.5 12l6 6"/></svg></span>
            </div>
            <div v-if="hasMoreNewMediaMessage" class="side-nav right"
                 @click.stop="previewNextMessage(false)" @pointerdown.stop @dblclick.stop>
                <span class="side-nav-button"><svg viewBox="0 0 24 24"><path d="M9.5 6l6 6-6 6"/></svg></span>
            </div>

            <transition name="fade">
                <div v-if="zoomTipVisible" class="zoom-tip">{{ zoomPercent }}</div>
            </transition>
        </main>

        <vue-context ref="menu" v-on:close="()=>{}">
            <li>
                <a @click.prevent="download">{{ $t('common.save') }}</a>
            </li>
            <li v-if="!favMode">
                <a @click.prevent="forward">{{ $t('misc.share_to_friend') }}</a>
            </li>
        </vue-context>
    </div>
</template>

<script>
import wfc from '../../wfc/client/wfc';
import store from '../../store';
import { currentWindow } from '../../platform';
import MessageContentType from '../../wfc/messages/messageContentType';
import { downloadFile, downloadFile2 } from '../../platformHelper';
import ForwardType from './conversation/message/forward/ForwardType';
import ImageMessageContent from '../../wfc/messages/imageMessageContent';
import Message from '../../wfc/messages/message';
import VideoMessageContent from '../../wfc/messages/videoMessageContent';
import { stringValue } from '../../wfc/util/longUtil';

const ZOOM_STEP = 1.25;
const MIN_SCALE = 0.1;
const MAX_SCALE = 10;
const MEDIA_MESSAGE_TYPES = [MessageContentType.Image, MessageContentType.Video, MessageContentType.MESSAGE_CONTENT_TYPE_MIX_MULTI_MEDIA_TEXT];

export default {
    name: 'MultimediaPreviewPage',
    data() {
        return {
            ZOOM_STEP,
            isMac: process.platform === 'darwin',
            showWindowControls: store.state.misc.isElectronWindowsOrLinux,
            message: null,
            favMediaItems: [],
            currentFavItemIndex: 0,
            continuous: false,
            currentMixMultiMediaItemIndex: 0,
            hasMoreOldMediaMessage: false,
            hasMoreNewMediaMessage: false,

            mediaLoaded: false,
            mediaError: false,
            naturalWidth: 0,
            naturalHeight: 0,
            stageWidth: 0,
            stageHeight: 0,
            // 图片显示倍率，1 表示原始尺寸
            scale: 1,
            rotation: 0,
            // 图片中心相对于显示区域中心的偏移
            offsetX: 0,
            offsetY: 0,
            // 为 true 时，窗口大小变化后图片自动适应窗口
            autoFit: true,
            smooth: false,
            panning: false,
            zoomTipVisible: false,

            pinned: false,
            maximized: false,
        }
    },

    created() {
        document.title = '野火IM消息预览';
        let hash = window.location.hash;

        let query = hash.substring(hash.indexOf('?'));
        if (query && query.length > 1) {
            let params = new URLSearchParams(query);

            let favMediaData = params.get('favMediaData');
            this.continuous = params.get('continuous') === 'true';
            if (favMediaData) {
                this.favMediaItems = JSON.parse(wfc.b64_to_utf8(wfc.unescape(favMediaData)));
                this.currentFavItemIndex = Number(params.get('favMediaIndex') || '0');
            } else {
                let messageUid = params.get('messageUid');
                let localMsg = wfc.getMessageByUid(messageUid);
                if (!localMsg) {
                    wfc.loadRemoteMessage(messageUid, msg => {
                        this.message = msg;
                        console.log(msg);
                    }, err => {
                        console.error('loadRemoteMessage error', err);
                    })
                } else {
                    this.message = localMsg;
                }
                let value = params.get('mmmIndex');
                if (value) {
                    this.currentMixMultiMediaItemIndex = Number(value)
                }
            }
        }

        this.pinned = currentWindow.isAlwaysOnTop();
        this.maximized = this.showWindowControls && currentWindow.isMaximized();
        window.addEventListener('keydown', this.handleKeyDown, true);
        window.addEventListener('resize', this.onWindowResize);
    },

    mounted() {
        this.stageResizeObserver = new ResizeObserver(this.onStageResize);
        this.stageResizeObserver.observe(this.$refs.stage);
        this.onStageResize();
        this.refreshNavState();
    },

    beforeUnmount() {
        window.removeEventListener('keydown', this.handleKeyDown, true);
        window.removeEventListener('resize', this.onWindowResize);
        this.stageResizeObserver && this.stageResizeObserver.disconnect();
        clearTimeout(this.zoomTipTimer);
        clearTimeout(this.windowResizeTimer);
    },

    methods: {
        onImageLoaded(event) {
            let img = event.target;
            this.naturalWidth = img.naturalWidth || 1;
            this.naturalHeight = img.naturalHeight || 1;
            this.scale = this.fitScale;
            this.mediaLoaded = true;
        },
        onVideoMetaDataLoaded() {
            this.mediaLoaded = true;
        },
        onMediaError() {
            this.mediaError = true;
        },

        resetView() {
            this.mediaLoaded = false;
            this.mediaError = false;
            this.naturalWidth = 0;
            this.naturalHeight = 0;
            this.scale = 1;
            this.rotation = 0;
            this.offsetX = 0;
            this.offsetY = 0;
            this.autoFit = true;
            this.smooth = false;
            this.panning = false;
            this.zoomTipVisible = false;
        },

        onStageResize() {
            let stage = this.$refs.stage;
            if (!stage) {
                return;
            }
            this.stageWidth = stage.clientWidth;
            this.stageHeight = stage.clientHeight;
            this.smooth = false;
            if (this.autoFit) {
                this.scale = this.fitScale;
                this.offsetX = 0;
                this.offsetY = 0;
            } else {
                this.clampOffset();
            }
        },
        onWindowResize() {
            if (!this.showWindowControls) {
                return;
            }
            clearTimeout(this.windowResizeTimer);
            this.windowResizeTimer = setTimeout(() => {
                this.maximized = currentWindow.isMaximized();
            }, 100);
        },

        // 相对于显示区域中心的坐标
        stagePoint(event) {
            let rect = this.$refs.stage.getBoundingClientRect();
            return {
                x: event.clientX - rect.left - rect.width / 2,
                y: event.clientY - rect.top - rect.height / 2,
            };
        },
        clampOffset() {
            let maxX = Math.max(0, (this.boxWidth - this.stageWidth) / 2);
            let maxY = Math.max(0, (this.boxHeight - this.stageHeight) / 2);
            this.offsetX = Math.max(-maxX, Math.min(maxX, this.offsetX));
            this.offsetY = Math.max(-maxY, Math.min(maxY, this.offsetY));
        },
        // 以 anchor 为中心缩放，anchor 下的图片内容保持不动
        zoomTo(scale, anchor = {x: 0, y: 0}, smooth = true) {
            if (!this.zoomable) {
                return;
            }
            scale = Math.max(Math.min(MIN_SCALE, this.fitScale), Math.min(MAX_SCALE, scale));
            let ratio = scale / this.scale;
            this.offsetX = anchor.x - (anchor.x - this.offsetX) * ratio;
            this.offsetY = anchor.y - (anchor.y - this.offsetY) * ratio;
            this.scale = scale;
            this.autoFit = Math.abs(scale - this.fitScale) < 0.001;
            this.smooth = smooth;
            this.clampOffset();
            this.showZoomTip();
        },
        zoomBy(factor) {
            this.zoomTo(this.scale * factor);
        },
        fitToWindow() {
            if (!this.zoomable) {
                return;
            }
            this.smooth = true;
            this.autoFit = true;
            this.scale = this.fitScale;
            this.offsetX = 0;
            this.offsetY = 0;
            this.showZoomTip();
        },
        toggleActualSize(anchor) {
            if (this.isActualSize && this.fitScale < 1) {
                this.fitToWindow();
            } else {
                this.zoomTo(1, anchor);
            }
        },
        rotate() {
            if (!this.zoomable) {
                return;
            }
            this.smooth = true;
            // 顺时针旋转，与工具栏旋转图标的箭头方向一致
            this.rotation += 90;
            if (this.autoFit) {
                this.scale = this.fitScale;
                this.offsetX = 0;
                this.offsetY = 0;
            } else {
                this.clampOffset();
            }
        },
        showZoomTip() {
            this.zoomTipVisible = true;
            clearTimeout(this.zoomTipTimer);
            this.zoomTipTimer = setTimeout(() => {
                this.zoomTipVisible = false;
            }, 800);
        },

        onWheel(event) {
            if (!this.zoomable) {
                return;
            }
            event.preventDefault();
            // 触控板双指捏合时 ctrlKey 为 true，deltaY 较小，需要更高的灵敏度
            let delta = event.deltaY * (event.deltaMode === 1 ? 40 : 1);
            let factor = Math.exp(-delta * (event.ctrlKey ? 0.01 : 0.002));
            this.zoomTo(this.scale * factor, this.stagePoint(event), false);
        },
        onDoubleClick(event) {
            if (this.zoomable && event.target === this.$refs.img) {
                this.toggleActualSize(this.stagePoint(event));
            }
        },
        onPointerDown(event) {
            if (event.button !== 0 || !this.canPan) {
                return;
            }
            this.panning = true;
            this.smooth = false;
            this.panStart = {x: event.clientX, y: event.clientY, offsetX: this.offsetX, offsetY: this.offsetY};
            event.currentTarget.setPointerCapture(event.pointerId);
        },
        onPointerMove(event) {
            if (!this.panning) {
                return;
            }
            this.offsetX = this.panStart.offsetX + event.clientX - this.panStart.x;
            this.offsetY = this.panStart.offsetY + event.clientY - this.panStart.y;
            this.clampOffset();
        },
        onPointerUp() {
            this.panning = false;
        },

        handleKeyDown(event) {
            let target = event.target;
            if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
                return;
            }
            // 转发等弹窗打开时，不处理快捷键
            if (document.querySelector('.vm--container')) {
                return;
            }
            switch (event.key) {
                case ' ':
                    event.preventDefault();
                    if (this.isVideo && this.$refs.video) {
                        if (this.$refs.video.paused) {
                            this.$refs.video.play();
                        } else {
                            this.$refs.video.pause();
                        }
                    } else {
                        this.close();
                    }
                    break;
                case 'Escape':
                    this.close();
                    break;
                case 'ArrowLeft':
                    event.preventDefault();
                    this.previewNextMessage(true);
                    break;
                case 'ArrowRight':
                    event.preventDefault();
                    this.previewNextMessage(false);
                    break;
                case '=':
                case '+':
                    this.zoomBy(ZOOM_STEP);
                    break;
                case '-':
                    this.zoomBy(1 / ZOOM_STEP);
                    break;
                case '0':
                    if (event.ctrlKey || event.metaKey) {
                        this.fitToWindow();
                    }
                    break;
                default:
                    break;
            }
        },

        setHasMore(before, hasMore) {
            if (before) {
                this.hasMoreOldMediaMessage = hasMore;
            } else {
                this.hasMoreNewMediaMessage = hasMore;
            }
        },
        // 查询前后是否还有可预览的图片/视频，用于控制上一张、下一张按钮
        refreshNavState() {
            if (this.favMode) {
                this.hasMoreOldMediaMessage = this.currentFavItemIndex > 0;
                this.hasMoreNewMediaMessage = this.currentFavItemIndex < this.favMediaItems.length - 1;
                return;
            }
            let message = this.message;
            if (!this.continuous || !message) {
                this.hasMoreOldMediaMessage = false;
                this.hasMoreNewMediaMessage = false;
                return;
            }
            [true, false].forEach(before => {
                let content = message.messageContent;
                if (content.type === MessageContentType.MESSAGE_CONTENT_TYPE_MIX_MULTI_MEDIA_TEXT) {
                    let index = this.currentMixMultiMediaItemIndex;
                    if (before ? index > 0 : index < content.multiMedias.length - 1) {
                        this.setHasMore(before, true);
                        return;
                    }
                }
                wfc.getMessagesByTimestampV2(message.conversation, MEDIA_MESSAGE_TYPES, message.timestamp, before, 1, '', msgs => {
                    if (this.message === message) {
                        this.setHasMore(before, msgs.length > 0);
                    }
                }, err => {
                    console.log('getMessagesByTimestampV2 error', err);
                });
            });
        },
        previewNextMessage(before) {
            this.$refs.menu && this.$refs.menu.close();

            if (this.favMode) {
                if (before && this.currentFavItemIndex > 0) {
                    this.currentFavItemIndex--;
                } else if (!before && this.currentFavItemIndex < this.favMediaItems.length - 1) {
                    this.currentFavItemIndex++;
                }
                return;
            }

            if (!this.continuous || !this.message) {
                return;
            }

            if (this.message.messageContent.type === MessageContentType.MESSAGE_CONTENT_TYPE_MIX_MULTI_MEDIA_TEXT) {
                if (before && this.currentMixMultiMediaItemIndex > 0) {
                    this.currentMixMultiMediaItemIndex--
                    return;
                } else if (!before && this.currentMixMultiMediaItemIndex < this.message.messageContent.multiMedias.length - 1) {
                    this.currentMixMultiMediaItemIndex++;
                    return
                }
            }

            wfc.getMessagesByTimestampV2(this.message.conversation, MEDIA_MESSAGE_TYPES, this.message.timestamp, before, 1, '', msgs => {
                if (msgs.length > 0) {
                    let msg = msgs[0];
                    this.message = msg;
                    if (msg.messageContent.type === MessageContentType.MESSAGE_CONTENT_TYPE_MIX_MULTI_MEDIA_TEXT) {
                        this.currentMixMultiMediaItemIndex = before ? msg.messageContent.multiMedias.length - 1 : 0
                    } else {
                        this.currentMixMultiMediaItemIndex = 0;
                    }
                } else {
                    this.setHasMore(before, false);
                }
            }, err => {
                console.log('getMessagesByTimestampV2 error', err);
            })

        },

        togglePin() {
            this.pinned = !this.pinned;
            currentWindow.setAlwaysOnTop(this.pinned);
        },
        toggleMaximize() {
            if (!this.showWindowControls) {
                return;
            }
            if (currentWindow.isMaximized()) {
                currentWindow.unmaximize();
            } else {
                currentWindow.maximize();
            }
        },
        close() {
            currentWindow.webContents.emit('unload')
            currentWindow.hide();
        },

        showContextMenu(event) {
            if (this.currentMedia.url) {
                this.$refs.menu.open(event)
            }
        },

        download() {
            if (this.favMode) {
                let item = this.favMediaItems[this.currentFavItemIndex];
                downloadFile2(item.url, item.title || 'media', item.messageUid);
                return;
            }
            downloadFile(this.message);
        },

        forward() {
            console.log('forward message', this.message);
            let message;
            if(this.favMode){
                message = new Message();
                const curFavItem = this.favMediaItems[this.currentFavItemIndex];
                if(curFavItem.type === 'video'){
                    message.messageContent = new ImageMessageContent('', curFavItem.url, curFavItem.thumbUrl.substring('data:image/png;base64,'.length));
                } else {
                    message.messageContent = new VideoMessageContent('', curFavItem.url, curFavItem.thumbUrl.substring('data:image/png;base64,'.length));
                }
            } else {
                message = this.message;
            }
            this.$forwardMessage({
                forwardType: ForwardType.NORMAL,
                messages: [message],
            });
        }
    },

    computed: {
        favMode() {
            return this.favMediaItems.length > 0;
        },
        currentMedia() {
            if (this.favMode) {
                let item = this.favMediaItems[this.currentFavItemIndex];
                return {
                    url: item.url,
                    thumbnailSrc: item.thumbUrl || '',
                    type: item.type === 3 ? 'image' : 'video',
                };
            }
            let cm = { url: '', thumbnailSrc: '', type: 'image' };
            if (!this.message) {
                return cm;
            }
            if (this.message.messageContent.type === MessageContentType.Image) {
                cm = {
                    url: this.message.messageContent.remotePath,
                    thumbnailSrc: 'data:video/jpeg;base64,' + this.message.messageContent.thumbnail,
                    type: 'image',
                    width: this.message.messageContent.imageWidth,
                    height: this.message.messageContent.imageHeight,
                }
            } else if (this.message.messageContent.type === MessageContentType.Video) {
                cm = {
                    url: this.message.messageContent.remotePath,
                    thumbnailSrc: 'data:video/jpeg;base64,' + this.message.messageContent.thumbnail,
                    type: 'video'
                }
            } else if (this.message.messageContent.type === MessageContentType.MESSAGE_CONTENT_TYPE_MIX_MULTI_MEDIA_TEXT) {
                let entries = this.message.messageContent.multiMedias;
                cm = {
                    url: entries[this.currentMixMultiMediaItemIndex].url,
                    thumbnailSrc: 'data:video/jpeg;base64,' + entries[this.currentMixMultiMediaItemIndex].thumbnail,
                    type: entries[this.currentMixMultiMediaItemIndex].type
                }
            }
            return cm;
        },
        // 切换预览内容时变化，用于重置缩放、旋转等状态
        mediaKey() {
            if (this.favMode) {
                return 'fav-' + this.currentFavItemIndex;
            }
            if (!this.message) {
                return '';
            }
            return this.message.messageId + '-' + stringValue(this.message.messageUid) + '-' + this.currentMixMultiMediaItemIndex;
        },
        isImage() {
            return this.currentMedia.type === 'image';
        },
        isVideo() {
            return this.currentMedia.type === 'video';
        },
        zoomable() {
            return this.isImage && this.mediaLoaded;
        },
        rotated() {
            return Math.abs(this.rotation / 90) % 2 === 1;
        },
        // 适应窗口的倍率，小图不放大
        fitScale() {
            if (!this.naturalWidth || !this.stageWidth || !this.stageHeight) {
                return 1;
            }
            let width = this.rotated ? this.naturalHeight : this.naturalWidth;
            let height = this.rotated ? this.naturalWidth : this.naturalHeight;
            return Math.min(1, this.stageWidth / width, this.stageHeight / height);
        },
        // 旋转后图片在屏幕上占据的宽高
        boxWidth() {
            return (this.rotated ? this.naturalHeight : this.naturalWidth) * this.scale;
        },
        boxHeight() {
            return (this.rotated ? this.naturalWidth : this.naturalHeight) * this.scale;
        },
        canPan() {
            return this.zoomable && (this.boxWidth > this.stageWidth + 0.5 || this.boxHeight > this.stageHeight + 0.5);
        },
        isActualSize() {
            return Math.abs(this.scale - 1) < 0.001;
        },
        zoomPercent() {
            return Math.round(this.scale * 100) + '%';
        },
        imageStyle() {
            if (!this.mediaLoaded) {
                return {};
            }
            return {
                width: this.naturalWidth * this.scale + 'px',
                height: this.naturalHeight * this.scale + 'px',
                transform: `translate(-50%, -50%) translate(${this.offsetX}px, ${this.offsetY}px) rotate(${this.rotation}deg)`,
            };
        },
        // 原图加载完成前，用缩略图按原图最终的显示尺寸占位
        placeholderStyle() {
            let {width, height} = this.currentMedia;
            if (!width || !height || !this.stageWidth || !this.stageHeight) {
                return {width: '100%', height: '100%'};
            }
            let scale = Math.min(1, this.stageWidth / width, this.stageHeight / height);
            return {width: width * scale + 'px', height: height * scale + 'px'};
        },
    },

    watch: {
        mediaKey() {
            this.resetView();
            this.refreshNavState();
        },
    },
}

</script>

<style lang="css" scoped>

.mm-preview {
    width: 100vw;
    height: 100vh;
    display: flex;
    flex-direction: column;
    /* 覆盖 App.vue 中 .main-content-container 的居中，否则工具栏和预览区域宽度会收缩为内容宽度（预览区域宽度为 0） */
    justify-content: flex-start;
    align-items: stretch;
    overflow: hidden;
    user-select: none;
    color: var(--text-primary);
    background: var(--background-secondary);
}

/* 工具栏 */
.toolbar {
    height: 44px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 0 8px;
    background: var(--background-tertiary);
    border-bottom: 1px solid var(--border-primary);
    -webkit-app-region: drag;
}

/* 给 macOS 红绿灯按钮留出位置 */
.mm-preview.is-mac .toolbar {
    padding-left: 84px;
}

.toolbar.with-window-controls {
    padding-right: 0;
}

.tool {
    width: 32px;
    height: 32px;
    padding: 0;
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: var(--radius-md, 6px);
    background: transparent;
    color: var(--text-primary);
    cursor: pointer;
    -webkit-app-region: no-drag;
}

.tool:focus {
    outline: none;
}

.tool:hover:not(:disabled) {
    background: var(--background-item-hover);
}

.tool:active:not(:disabled) {
    background: var(--background-item-active);
}

.tool:disabled {
    color: var(--text-tertiary);
    cursor: default;
}

.tool.active {
    color: var(--accent-color);
}

.tool svg {
    width: 20px;
    height: 20px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.5;
    stroke-linecap: round;
    stroke-linejoin: round;
}

.divider {
    width: 1px;
    height: 18px;
    margin: 0 6px;
    flex-shrink: 0;
    background: var(--border-strong);
}

.spacer {
    flex: 1;
}

/* windows / linux 窗口按钮 */
.window-button {
    width: 46px;
    height: 100%;
    padding: 0;
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: transparent;
    color: var(--text-primary);
    -webkit-app-region: no-drag;
}

.window-button:focus {
    outline: none;
}

.window-button.maximize {
    margin-left: 6px;
}

.window-button svg {
    width: 10px;
    height: 10px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1;
}

.window-button:hover {
    background: var(--background-trans-muted);
}

.window-button.close:hover {
    background: var(--status-error);
    color: var(--text-on-accent);
}

/* 预览区域 */
.stage {
    position: relative;
    flex: 1;
    min-height: 0;
    overflow: hidden;
}

.stage.video {
    background: #000;
}

.stage.pannable {
    cursor: grab;
}

.stage.panning {
    cursor: grabbing;
}

.media {
    position: absolute;
    left: 50%;
    top: 50%;
    max-width: none;
    max-height: none;
    transform: translate(-50%, -50%);
}

.media.hidden {
    visibility: hidden;
}

.media.smooth {
    transition: width 0.2s ease, height 0.2s ease, transform 0.2s ease;
}

.placeholder {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    object-fit: contain;
}

.media-video {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    object-fit: contain;
    outline: none;
}

.spinner {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 32px;
    height: 32px;
    margin: -16px 0 0 -16px;
    border: 3px solid rgba(128, 128, 128, 0.3);
    border-top-color: rgba(128, 128, 128, 0.9);
    border-radius: 50%;
    animation: mm-spin 0.8s linear infinite;
    pointer-events: none;
}

@keyframes mm-spin {
    to {
        transform: rotate(360deg);
    }
}

.error-tip {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    font-size: 14px;
    color: var(--text-secondary);
}

/* 左右切换 */
.side-nav {
    position: absolute;
    top: 20%;
    bottom: 20%;
    width: 96px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
}

.side-nav.left {
    left: 0;
}

.side-nav.right {
    right: 0;
}

.side-nav-button {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    background: rgba(0, 0, 0, 0.45);
    opacity: 0;
    transition: opacity 0.15s ease;
}

.side-nav:hover .side-nav-button {
    opacity: 1;
}

.side-nav-button svg {
    width: 24px;
    height: 24px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
}

/* 缩放比例提示 */
.zoom-tip {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    padding: 8px 16px;
    border-radius: 8px;
    font-size: 14px;
    color: #fff;
    background: rgba(0, 0, 0, 0.6);
    pointer-events: none;
}

.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}

</style>
