import wfc from "../../../../wfc/client/wfc";
import Config from "../../../../config";
import StickerMessageContent from "../../../../wfc/messages/stickerMessageContent";
import MessageContentMediaType from "../../../../wfc/messages/messageContentMediaType";
import {getItem, setItem} from "../../../util/storageHelper";
import {isElectron} from "../../../../platform";
import {fetchStickerBytes, lottieSize, peekSticker, sniffStickerFormat, StickerFormat} from "./stickerLoader";

/**
 * 把贴纸做成贴纸消息发出去。
 *
 * 贴纸消息只带远端地址。内置贴纸（./stickers/ 下）首次发送时先上传，上传完成记下远端地址，
 * 之后再发同一个贴纸直接带远端地址，不重复上传。远端地址按文件内容哈希缓存，
 * 贴纸包更新（内容变了）后不会误发旧文件；按服务地址分开存，切换服务后不会误发别的服务上的地址。
 */

const UPLOADS_KEY = 'wfc_sticker_uploads';

// 内容哈希 -> 上传中的 Promise，防止连点同一个贴纸重复上传
const uploading = new Map();

/**
 * @param conversation 会话
 * @param sticker 贴纸，{url, builtin}，builtin 为 false 时 url 已是远端地址，直接发送
 * @returns {Promise<void>} 上传失败时 reject
 */
export async function sendSticker(conversation, sticker) {
    if (!sticker.builtin) {
        let content = new StickerMessageContent('', sticker.url, 200, 200);
        wfc.sendConversationMessage(conversation, content);
        return;
    }
    let bytes = await fetchStickerBytes(sticker.url);
    let hash = contentHash(bytes);
    let {width, height} = await stickerSize(sticker.url, bytes);

    let uploads = loadUploads();
    let remoteUrl = uploads[hash];
    if (!remoteUrl) {
        remoteUrl = await upload(hash, fileExtension(sticker.url), bytes);
    }
    let content = new StickerMessageContent('', remoteUrl, width, height);
    wfc.sendConversationMessage(conversation, content);
}

function upload(hash, ext, bytes) {
    let p = uploading.get(hash);
    if (p) {
        return p;
    }
    // PC 协议栈要不带头部的 base64；网页版协议栈把字符串都当 data URI 解析，传 Blob
    let data = isElectron() ? bytesToBase64(bytes) : new Blob([bytes]);
    p = new Promise((resolve, reject) => {
        wfc.uploadMedia(hash + ext, data, MessageContentMediaType.Sticker, remoteUrl => {
            let uploads = loadUploads();
            uploads[hash] = remoteUrl;
            saveUploads(uploads);
            resolve(remoteUrl);
        }, errorCode => {
            reject(new Error('upload sticker failed: ' + errorCode));
        });
    });
    uploading.set(hash, p);
    p.then(() => uploading.delete(hash), () => uploading.delete(hash));
    return p;
}

async function stickerSize(url, bytes) {
    if (sniffStickerFormat(bytes.subarray(0, 8)) === StickerFormat.LOTTIE) {
        let loaded = peekSticker(url);
        if (loaded && loaded.json) {
            return lottieSize(loaded.json);
        }
        let stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
        return lottieSize(await new Response(stream).text());
    }
    return new Promise(resolve => {
        let img = new Image();
        img.onload = () => resolve({width: img.naturalWidth, height: img.naturalHeight});
        img.onerror = () => resolve({width: 200, height: 200});
        img.src = url;
    });
}

function fileExtension(url) {
    let name = url.split(/[?#]/)[0];
    let dot = name.lastIndexOf('.');
    return dot > name.lastIndexOf('/') ? name.substring(dot).toLowerCase() : '';
}

/**
 * 内容哈希，只用来识别"同一个文件"，两个 32 位哈希拼起来再带上长度，足够区分贴纸包里的文件
 */
function contentHash(bytes) {
    let fnv = 0x811c9dc5;
    let djb = 5381;
    for (let i = 0; i < bytes.length; i++) {
        fnv = Math.imul(fnv ^ bytes[i], 0x01000193);
        djb = (Math.imul(djb, 33) + bytes[i]) | 0;
    }
    let hex = n => (n >>> 0).toString(16).padStart(8, '0');
    return hex(fnv) + hex(djb) + bytes.length.toString(16);
}

function bytesToBase64(bytes) {
    let binary = '';
    let chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
}

function loadUploads() {
    try {
        let all = JSON.parse(getItem(UPLOADS_KEY) || '{}');
        return all[Config.APP_SERVER] || {};
    } catch (e) {
        return {};
    }
}

function saveUploads(uploads) {
    try {
        let all = JSON.parse(getItem(UPLOADS_KEY) || '{}');
        all[Config.APP_SERVER] = uploads;
        setItem(UPLOADS_KEY, JSON.stringify(all));
    } catch (e) {
        console.error('save sticker uploads failed', e);
    }
}
