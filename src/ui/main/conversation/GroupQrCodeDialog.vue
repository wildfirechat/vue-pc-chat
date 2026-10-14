<template>
    <section class="group-qrcode-dialog">
        <main class="card">
            <img class="portrait" :src="portrait" @error="onPortraitError" alt="">
            <h1 class="name">{{ title }}</h1>
            <div class="qrcode">
                <img v-if="qrCodeDataUri" :src="qrCodeDataUri" alt="">
            </div>
            <p class="hint">{{ hint }}</p>
        </main>
        <footer class="actions">
            <button @click="forward">转发给朋友</button>
            <span class="divider"></span>
            <button @click="copyImage">复制图片</button>
            <span class="divider"></span>
            <button @click="saveImage">保存图片</button>
        </footer>
    </section>
</template>

<script>
import jrQRCode from 'jr-qrcode';
import wfc from "../../../wfc/client/wfc";
import EventType from "../../../wfc/client/wfcEvent";
import WfcScheme from "../../../wfcScheme";
import Config from "../../../config";
import {downloadFile2} from "../../../platformHelper";
import {dataURItoBlob} from "../../util/imageUtil";
import {imageMessageFromDataUri} from "../../util/imageMessage";
import ForwardType from "./message/forward/ForwardType";
import appLogo from "../../../assets/images/icon.png";

// 二维码按 2 倍画，显示时缩一半，高分屏上也清楚
const QR_SIZE = 240;
const SCALE = 2;
// 中间的应用图标占二维码宽度的比例；二维码用最高容错（H），遮住这么多仍能扫
const LOGO_RATIO = 0.2;

function loadImage(src) {
    return new Promise((resolve, reject) => {
        let img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}

function roundRectPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

/** 按宽度折行（逐字量，中英文混排都能折），超过 maxLines 行的末行加省略号 */
function wrapText(ctx, text, maxWidth, maxLines) {
    let lines = [];
    let line = '';
    for (const ch of text) {
        if (ctx.measureText(line + ch).width > maxWidth && line) {
            lines.push(line);
            line = ch;
        } else {
            line += ch;
        }
    }
    if (line) {
        lines.push(line);
    }
    if (lines.length > maxLines) {
        lines = lines.slice(0, maxLines);
        let last = lines[maxLines - 1];
        while (last && ctx.measureText(last + '…').width > maxWidth) {
            last = last.slice(0, -1);
        }
        lines[maxLines - 1] = last + '…';
    }
    return lines;
}

/**
 * 群二维码（参考微信）：群头像、群名、二维码，下面转发给朋友 / 复制图片 / 保存图片。
 * 复制、保存、转发出去的是整张卡片（头像 + 群名 + 二维码 + 提示），不只是二维码
 */
export default {
    name: "GroupQrCodeDialog",
    props: {
        groupId: {
            type: String,
            required: true,
        },
    },
    data() {
        return {
            groupInfo: null,
            portraitFailed: false,
            qrCodeDataUri: '',
            hint: '扫一扫上面的二维码，加入群聊',
        }
    },
    computed: {
        groupName() {
            return (this.groupInfo && this.groupInfo.name) || '';
        },
        title() {
            return this.groupName ? `群聊：${this.groupName}` : '群聊';
        },
        portrait() {
            if (this.portraitFailed || !this.groupInfo || !this.groupInfo.portrait) {
                return Config.DEFAULT_GROUP_PORTRAIT_URL;
            }
            return this.groupInfo.portrait;
        },
    },
    created() {
        this.groupInfo = wfc.getGroupInfo(this.groupId, true);
        this.buildQrCode();
        wfc.eventEmitter.on(EventType.GroupInfosUpdate, this.onGroupInfosUpdate);
    },
    unmounted() {
        wfc.eventEmitter.off(EventType.GroupInfosUpdate, this.onGroupInfosUpdate);
    },
    methods: {
        onGroupInfosUpdate(groupInfos = []) {
            // 群没设头像时用成员头像拼的，成员信息到齐才有；群名也可能刚改
            if (groupInfos.some(g => g.target === this.groupId)) {
                this.groupInfo = wfc.getGroupInfo(this.groupId, false);
                this.portraitFailed = false;
            }
        },
        onPortraitError() {
            this.portraitFailed = true;
        },
        async buildQrCode() {
            let size = QR_SIZE * SCALE;
            let link = WfcScheme.buildGroupLink(this.groupId, wfc.getUserId());
            let qr = await loadImage(jrQRCode.getQrBase64(link, {width: size, height: size, padding: 0}));
            let canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            let ctx = canvas.getContext('2d');
            ctx.drawImage(qr, 0, 0, size, size);
            try {
                let logo = await loadImage(appLogo);
                let logoSize = Math.round(size * LOGO_RATIO);
                let border = Math.round(logoSize * 0.08);
                let x = (size - logoSize) / 2;
                ctx.fillStyle = '#ffffff';
                roundRectPath(ctx, x - border, x - border, logoSize + border * 2, logoSize + border * 2, logoSize * 0.24);
                ctx.fill();
                ctx.save();
                roundRectPath(ctx, x, x, logoSize, logoSize, logoSize * 0.2);
                ctx.clip();
                ctx.drawImage(logo, x, x, logoSize, logoSize);
                ctx.restore();
            } catch (e) {
                console.warn('draw qrcode logo failed', e);
            }
            this.qrCodeDataUri = canvas.toDataURL('image/png');
        },

        /** 把卡片画成图片：浅色底，不跟深色模式走，存下来、发出去都一样 */
        async renderCard() {
            let avatar;
            try {
                avatar = await loadImage(this.portrait);
            } catch (e) {
                avatar = await loadImage(Config.DEFAULT_GROUP_PORTRAIT_URL);
            }
            try {
                return await this.drawCard(avatar);
            } catch (e) {
                // 远程头像把画布污染了（导不出图），换成默认群头像再画
                console.warn('draw group qrcode card failed', e);
                return await this.drawCard(await loadImage(Config.DEFAULT_GROUP_PORTRAIT_URL));
            }
        },
        async drawCard(avatar) {
            const width = 360, padding = 32, avatarSize = 64, qrBoxPadding = 10;
            const nameFontSize = 20, nameLineHeight = 28, hintFontSize = 13, hintLineHeight = 20;
            let fontFamily = getComputedStyle(document.body).fontFamily;
            let measure = document.createElement('canvas').getContext('2d');
            measure.font = `600 ${nameFontSize}px ${fontFamily}`;
            let nameLines = wrapText(measure, this.title, width - padding * 2, 2);

            let qrBox = QR_SIZE + qrBoxPadding * 2;
            let height = 40 + avatarSize + 16 + nameLines.length * nameLineHeight + 20 + qrBox + 16 + hintLineHeight + 32;

            let canvas = document.createElement('canvas');
            canvas.width = width * SCALE;
            canvas.height = height * SCALE;
            let ctx = canvas.getContext('2d');
            ctx.scale(SCALE, SCALE);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, width, height);

            let y = 40;
            ctx.save();
            roundRectPath(ctx, (width - avatarSize) / 2, y, avatarSize, avatarSize, 8);
            ctx.clip();
            ctx.drawImage(avatar, (width - avatarSize) / 2, y, avatarSize, avatarSize);
            ctx.restore();
            y += avatarSize + 16;

            ctx.fillStyle = '#191919';
            ctx.font = `600 ${nameFontSize}px ${fontFamily}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            nameLines.forEach((line, i) => {
                ctx.fillText(line, width / 2, y + nameLineHeight * i + nameLineHeight / 2);
            });
            y += nameLines.length * nameLineHeight + 20;

            let qr = await loadImage(this.qrCodeDataUri);
            ctx.drawImage(qr, (width - QR_SIZE) / 2, y + qrBoxPadding, QR_SIZE, QR_SIZE);
            y += qrBox + 16;

            ctx.fillStyle = '#8c8c8c';
            ctx.font = `${hintFontSize}px ${fontFamily}`;
            ctx.fillText(this.hint, width / 2, y + hintLineHeight / 2);

            return canvas.toDataURL('image/png');
        },
        imageFileName() {
            return `群二维码_${this.groupName || this.groupId}.png`.replace(/[\\/:*?"<>|]/g, '_');
        },

        async forward() {
            // 选聊天界面叠在二维码上面，发完或取消回到二维码，和微信一样
            let message = await imageMessageFromDataUri(await this.renderCard(), this.imageFileName());
            this.$forwardMessage({
                forwardType: ForwardType.NORMAL,
                messages: [message],
            });
        },
        async copyImage() {
            try {
                let blob = dataURItoBlob(await this.renderCard());
                // eslint-disable-next-line no-undef
                await navigator.clipboard.write([new ClipboardItem({[blob.type]: blob})]);
                this.$notify({text: '已复制', type: 'success'});
            } catch (e) {
                console.error('copy group qrcode failed', e);
                this.$notify({text: '复制失败', type: 'error'});
            }
        },
        async saveImage() {
            // 走统一的下载：弹系统保存对话框。没有对应消息，messageUid 给 0
            downloadFile2(await this.renderCard(), this.imageFileName(), 0);
        },
    },
}
</script>

<style scoped>
.group-qrcode-dialog {
    display: flex;
    flex-direction: column;
    background: var(--background-primary);
    user-select: none;
}

.card {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 32px 32px 0;
}

.portrait {
    width: 64px;
    height: 64px;
    border-radius: 8px;
    object-fit: cover;
    flex-shrink: 0;
}

.name {
    margin-top: 16px;
    max-width: 100%;
    font-size: 20px;
    line-height: 28px;
    font-weight: 600;
    text-align: center;
    color: var(--text-primary);
    word-break: break-all;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    user-select: text;
}

/* 深色模式下也是白底黑码，否则扫不出来 */
.qrcode {
    margin-top: 20px;
    padding: 10px;
    background: #ffffff;
    border-radius: 4px;
    flex-shrink: 0;
}

.qrcode img {
    display: block;
    width: 240px;
    height: 240px;
}

.hint {
    margin-top: 16px;
    font-size: 13px;
    line-height: 20px;
    text-align: center;
    color: var(--text-secondary);
}

.actions {
    height: 64px;
    margin-top: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.actions button {
    height: 100%;
    padding: 0 20px;
    border: none;
    background: transparent;
    font-size: 15px;
    white-space: nowrap;
    color: var(--text-link);
    cursor: pointer;
}

.actions button:hover {
    opacity: 0.8;
}

.actions button:active {
    opacity: 0.6;
}

.actions button:focus {
    outline: none;
}

.actions .divider {
    width: 1px;
    height: 16px;
    flex-shrink: 0;
    background: var(--border-primary);
}
</style>
