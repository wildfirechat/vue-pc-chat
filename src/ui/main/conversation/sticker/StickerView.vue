<template>
    <div ref="root" class="sticker-view" :style="boxStyle">
        <div v-show="format === 'lottie'" ref="lottie" class="sticker-lottie"></div>
        <img v-if="format === 'image'" :src="src" draggable="false" alt="" @error="onImageError">
        <i v-else-if="failed" class="icon-ion-image sticker-broken"></i>
    </div>
</template>

<script>
import lottie from 'lottie-web/build/player/lottie_light';
import {loadSticker, loadStickerAsLottie, StickerFormat} from "./stickerLoader";

// 所有播放中的 Lottie 共用一个 rAF 循环，帧率上限 30fps。lottie-web 自带的 play() 按屏幕刷新率逐帧绘制，
// 表情面板里同时播放二十多个贴纸时会占满主线程；贴纸尺寸小，30fps 与 60fps 肉眼几乎无差
const MAX_FPS = 30;
const playingViews = new Set();
let rafId = 0;
let lastTick = 0;

function tick(now) {
    rafId = playingViews.size ? requestAnimationFrame(tick) : 0;
    if (now - lastTick < 1000 / MAX_FPS - 2) {
        return;
    }
    lastTick = now;
    playingViews.forEach(view => view.step(now));
}

/**
 * 显示一个贴纸：图片（含 GIF、动态 WebP）或 Lottie（Telegram .tgs）。
 *
 * 进入可视区域才加载；Lottie 在可视区域内循环播放，移出后暂停。
 * animate 为 false 时 Lottie 暂停在当前帧，从未播放过则停在第 0 帧（内置贴纸包的封面保证第 0 帧是完整画面）；
 * 动图由浏览器驱动，不受此开关影响。
 */
export default {
    name: "StickerView",
    props: {
        src: {
            type: String,
            required: true,
        },
        width: {
            type: Number,
            required: false,
        },
        height: {
            type: Number,
            required: false,
        },
        animate: {
            type: Boolean,
            default: true,
        },
    },
    data() {
        return {
            // null：未加载；image；lottie
            format: null,
            failed: false,
        }
    },
    created() {
        // 不放进 data，避免被 Vue 代理
        this.anim = null;
        this.observer = null;
        this.visible = false;
        this.loadingSrc = null;
        // 播放进度（帧，含小数）与上次推进的时间
        this.frame = 0;
        this.lastStep = 0;
    },
    mounted() {
        this.observer = new IntersectionObserver(entries => {
            this.visible = entries[entries.length - 1].isIntersecting;
            if (this.visible && !this.format && !this.failed && this.loadingSrc !== this.src) {
                this.load();
            }
            this.updatePlayback();
        });
        this.observer.observe(this.$refs.root);
    },
    beforeUnmount() {
        // observer 置空后，还在路上的加载结果不再应用
        this.observer && this.observer.disconnect();
        this.observer = null;
        this.destroyAnimation();
    },
    watch: {
        src() {
            this.destroyAnimation();
            this.format = null;
            this.failed = false;
            this.loadingSrc = null;
            if (this.visible) {
                this.load();
            }
        },
        animate() {
            this.updatePlayback();
        },
    },
    computed: {
        boxStyle() {
            let style = {};
            if (this.width) {
                style.width = this.width + 'px';
            }
            if (this.height) {
                style.height = this.height + 'px';
            }
            return style;
        },
    },
    methods: {
        load() {
            let src = this.src;
            this.loadingSrc = src;
            loadSticker(src).then(loaded => this.apply(src, loaded), error => this.fail(src, error));
        },

        // 远端贴纸格式未知时先按图片显示，解码失败可能是没带 .tgs 扩展名的 Telegram 贴纸，下载下来看文件头
        onImageError() {
            let src = this.src;
            loadStickerAsLottie(src).then(loaded => this.apply(src, loaded), error => this.fail(src, error));
        },

        apply(src, loaded) {
            if (src !== this.src || !this.observer) {
                return;
            }
            this.format = loaded.format;
            if (loaded.format === StickerFormat.LOTTIE) {
                this.createAnimation(loaded.json);
            }
        },

        fail(src, error) {
            if (src !== this.src || !this.observer) {
                return;
            }
            console.warn('load sticker failed', src, error);
            this.format = null;
            this.failed = true;
        },

        createAnimation(json) {
            this.destroyAnimation();
            // lottie-web 会改写传入的数据，每个实例单独解析一份
            this.anim = lottie.loadAnimation({
                container: this.$refs.lottie,
                renderer: 'svg',
                loop: true,
                autoplay: false,
                animationData: JSON.parse(json),
                rendererSettings: {
                    preserveAspectRatio: 'xMidYMid meet',
                },
            });
            this.frame = 0;
            this.updatePlayback();
        },

        destroyAnimation() {
            playingViews.delete(this);
            if (this.anim) {
                this.anim.destroy();
                this.anim = null;
            }
        },

        updatePlayback() {
            if (!this.anim) {
                return;
            }
            if (this.animate && this.visible) {
                if (!playingViews.has(this)) {
                    this.lastStep = performance.now();
                    playingViews.add(this);
                    if (!rafId) {
                        rafId = requestAnimationFrame(tick);
                    }
                }
            } else {
                playingViews.delete(this);
            }
        },

        // 由共享的 rAF 循环调用，按贴纸自身帧率推进
        step(now) {
            let anim = this.anim;
            if (!anim.totalFrames) {
                return;
            }
            this.frame =(this.frame + (now - this.lastStep) / 1000 * anim.frameRate) % anim.totalFrames;
            this.lastStep = now;
            anim.goToAndStop(Math.floor(this.frame), true);
        },
    },
}
</script>

<style scoped>
.sticker-view {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
}

.sticker-lottie {
    width: 100%;
    height: 100%;
}

.sticker-view img {
    width: 100%;
    height: 100%;
    object-fit: contain;
}

.sticker-broken {
    font-size: 32px;
    color: var(--text-tertiary);
}
</style>
