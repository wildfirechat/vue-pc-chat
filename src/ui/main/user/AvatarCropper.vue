<template>
    <div class="avatar-cropper">
        <h3 class="title">裁剪头像</h3>
        <div class="stage-wrap">
            <canvas ref="canvas"
                    class="stage"
                    :width="displaySize"
                    :height="displaySize"
                    @mousedown.prevent="onMouseDown"
                    @mousemove="onMouseMove"
                    @mouseup="onMouseUp"
                    @mouseleave="onMouseUp"></canvas>
        </div>
        <div class="tools">
            <i class="icon-ion-ios-minus tool" @click="zoomBy(-0.1)"></i>
            <input class="zoom" type="range" min="1" max="3" step="0.01" v-model.number="zoom">
            <i class="icon-ion-ios-plus tool" @click="zoomBy(0.1)"></i>
            <i class="icon-ion-ios-refresh tool rotate" title="旋转" @click="rotate"></i>
        </div>
        <div class="actions">
            <button class="cancel" @click="cancel">取消</button>
            <button class="confirm" @click="confirm">确定</button>
        </div>
    </div>
</template>

<script>
// 头像裁剪页：480×480、JPEG 质量 70（对齐 wf-enterprise-chat ac77e5b6、a64c8faf）
const OUTPUT_SIZE = 480;
const DISPLAY_SIZE = 300;
const JPEG_QUALITY = 0.7;

export default {
    name: "AvatarCropper",
    props: {
        src: {type: String, required: true},
        onConfirm: {type: Function, default: null},
        onCancel: {type: Function, default: null},
    },
    data() {
        return {
            displaySize: DISPLAY_SIZE,
            zoom: 1,
            rotation: 0,
            offsetX: 0,
            offsetY: 0,
            dragging: false,
            dragStartX: 0,
            dragStartY: 0,
            dragOriginX: 0,
            dragOriginY: 0,
            image: null,
            baseScale: 1,
        }
    },
    mounted() {
        const img = new Image();
        img.onload = () => {
            this.image = img;
            // 先按「填满裁剪框」定基准缩放
            this.baseScale = Math.max(DISPLAY_SIZE / img.width, DISPLAY_SIZE / img.height);
            this.draw();
        };
        img.src = this.src;
    },
    methods: {
        effectiveScale() {
            return this.baseScale * this.zoom;
        },
        drawTo(canvas, size) {
            const ctx = canvas.getContext('2d');
            const factor = size / DISPLAY_SIZE;
            ctx.clearRect(0, 0, size, size);
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, size, size);
            if (!this.image) {
                return;
            }
            ctx.save();
            ctx.translate(size / 2 + this.offsetX * factor, size / 2 + this.offsetY * factor);
            ctx.rotate(this.rotation * Math.PI / 180);
            ctx.scale(this.effectiveScale() * factor, this.effectiveScale() * factor);
            ctx.drawImage(this.image, -this.image.width / 2, -this.image.height / 2);
            ctx.restore();
        },
        draw() {
            const canvas = this.$refs.canvas;
            if (canvas) {
                this.drawTo(canvas, DISPLAY_SIZE);
            }
        },
        zoomBy(delta) {
            this.zoom = Math.min(3, Math.max(1, this.zoom + delta));
            this.draw();
        },
        rotate() {
            this.rotation = (this.rotation + 90) % 360;
            this.draw();
        },
        onMouseDown(e) {
            this.dragging = true;
            this.dragStartX = e.clientX;
            this.dragStartY = e.clientY;
            this.dragOriginX = this.offsetX;
            this.dragOriginY = this.offsetY;
        },
        onMouseMove(e) {
            if (!this.dragging) {
                return;
            }
            this.offsetX = this.dragOriginX + (e.clientX - this.dragStartX);
            this.offsetY = this.dragOriginY + (e.clientY - this.dragStartY);
            this.draw();
        },
        onMouseUp() {
            this.dragging = false;
        },
        confirm() {
            if (!this.image) {
                return;
            }
            const out = document.createElement('canvas');
            out.width = OUTPUT_SIZE;
            out.height = OUTPUT_SIZE;
            this.drawTo(out, OUTPUT_SIZE);
            out.toBlob((blob) => {
                if (blob && this.onConfirm) {
                    this.onConfirm(blob);
                }
            }, 'image/jpeg', JPEG_QUALITY);
        },
        cancel() {
            if (this.onCancel) {
                this.onCancel();
            }
        },
    },
}
</script>

<style lang="css" scoped>
.avatar-cropper {
    padding: 18px 20px 16px;
    display: flex;
    flex-direction: column;
    align-items: center;
    background-color: var(--background-primary);
    color: var(--text-primary);
}

.title {
    font-size: var(--font-size-lg);
    font-weight: 500;
    margin-bottom: 12px;
}

.stage-wrap {
    width: 300px;
    height: 300px;
    border-radius: var(--radius-md);
    overflow: hidden;
    background-color: #000;
}

.stage {
    display: block;
    cursor: move;
}

.tools {
    display: flex;
    align-items: center;
    width: 300px;
    margin-top: 12px;
    gap: 8px;
}

.tools .tool {
    font-size: 20px;
    cursor: pointer;
    color: var(--text-secondary);
}

.tools .tool:hover {
    color: var(--text-primary);
}

.tools .zoom {
    flex: 1;
}

.tools .rotate {
    margin-left: 6px;
}

.actions {
    display: flex;
    width: 300px;
    gap: 10px;
    margin-top: 14px;
}

.actions button {
    flex: 1;
    height: 34px;
    border-radius: var(--radius-sm);
    font-size: var(--font-size-sm);
    cursor: pointer;
}

.actions .cancel {
    border: 1px solid var(--border-primary);
    background-color: transparent;
    color: var(--text-primary);
}

.actions .confirm {
    border: none;
    background-color: var(--button-primary-bg);
    color: var(--button-primary-text);
}
</style>
