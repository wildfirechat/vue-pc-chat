/**
 * 贴纸加载：识别格式、下载、解压 Telegram 动态贴纸，并做内存缓存。
 *
 * Telegram 贴纸有三种格式：
 * - .tgs：gzip 压缩的 Lottie JSON，用 lottie-web 渲染；
 * - .webp/.png/.jpg/.gif：静态贴纸、动图，直接用 <img> 显示；
 * - .webm：视频贴纸，不直接支持，导入贴纸包时转成动态 WebP。
 *
 * 远端贴纸的扩展名不可靠（各端上传后的地址不一定保留扩展名），所以按文件头判断：
 * gzip → TGS，JSON 对象 → Lottie，其余当图片。
 */

export const StickerFormat = {
    IMAGE: 'image',
    LOTTIE: 'lottie',
};

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];

/**
 * 按扩展名判断格式，判断不了返回 null。只适合内置贴纸包，远端地址用 {@link sniffStickerFormat}。
 */
export function stickerFormatFromPath(path) {
    let pathname = path.split(/[?#]/)[0];
    let dot = pathname.lastIndexOf('.');
    if (dot < 0 || dot < pathname.lastIndexOf('/')) {
        return null;
    }
    let ext = pathname.substring(dot).toLowerCase();
    if (ext === '.tgs') {
        return StickerFormat.LOTTIE;
    }
    return IMAGE_EXTENSIONS.indexOf(ext) >= 0 ? StickerFormat.IMAGE : null;
}

/**
 * 按文件头判断：gzip → TGS，JSON 对象 → Lottie，其余交给图片解码器。
 * @param {Uint8Array} head 文件开头的若干字节
 */
export function sniffStickerFormat(head) {
    if (head.length >= 2 && head[0] === 0x1f && head[1] === 0x8b) {
        return StickerFormat.LOTTIE;
    }
    let i = 0;
    // 跳过 UTF-8 BOM 与前导空白
    if (head.length >= 3 && head[0] === 0xef && head[1] === 0xbb && head[2] === 0xbf) {
        i = 3;
    }
    while (i < head.length && [0x20, 0x09, 0x0a, 0x0d].indexOf(head[i]) >= 0) {
        i++;
    }
    return i < head.length && head[i] === 0x7b /* { */ ? StickerFormat.LOTTIE : StickerFormat.IMAGE;
}

/**
 * 读取贴纸原始字节。内置贴纸是相对地址（./stickers/...），远端贴纸是 http(s) 地址。
 * @returns {Promise<Uint8Array>}
 */
export async function fetchStickerBytes(url) {
    let response = await fetch(url);
    if (!response.ok) {
        throw new Error(`fetch sticker failed: ${response.status} ${url}`);
    }
    return new Uint8Array(await response.arrayBuffer());
}

async function gunzip(bytes) {
    let stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function decodeLottieText(bytes) {
    let jsonBytes = sniffIsGzip(bytes) ? await gunzip(bytes) : bytes;
    return new TextDecoder().decode(jsonBytes);
}

function sniffIsGzip(bytes) {
    return bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
}

// 缓存条数上限。一个 Lottie 解压后的 JSON 文本约几十到几百 KB
const CAPACITY = 100;

// url -> {format, url} 或 {format, url, json}，json 为 Lottie JSON 文本
const cache = new Map();
const pending = new Map();

/**
 * 已缓存的结果，没有返回 null。命中时刷新 LRU 顺序。
 */
export function peekSticker(url) {
    let hit = cache.get(url);
    if (hit) {
        cache.delete(url);
        cache.set(url, hit);
    }
    return hit || null;
}

/**
 * 加载贴纸，结果按 url 缓存；失败不缓存，下次重试。
 *
 * 图片贴纸不下载，只返回 {format: 'image'}，由 <img> 自己加载；
 * 格式未知的远端贴纸先按图片显示，图片解码失败时调用方再用 {@link loadStickerAsLottie} 重试。
 *
 * @returns {Promise<{format: string, url: string, json?: string}>}
 */
export function loadSticker(url) {
    let hit = peekSticker(url);
    if (hit) {
        return Promise.resolve(hit);
    }
    if (stickerFormatFromPath(url) === StickerFormat.LOTTIE) {
        return loadStickerAsLottie(url);
    }
    return Promise.resolve({format: StickerFormat.IMAGE, url});
}

/**
 * 下载贴纸并按文件头判断格式，是 Lottie 时解压、缓存 JSON 文本。
 * 不是 Lottie 时抛异常，说明文件确实坏了。
 */
export function loadStickerAsLottie(url) {
    let hit = peekSticker(url);
    if (hit && hit.format === StickerFormat.LOTTIE) {
        return Promise.resolve(hit);
    }
    let p = pending.get(url);
    if (p) {
        return p;
    }
    p = (async () => {
        let bytes = await fetchStickerBytes(url);
        if (sniffStickerFormat(bytes.subarray(0, 8)) !== StickerFormat.LOTTIE) {
            throw new Error('not a lottie sticker: ' + url);
        }
        return {format: StickerFormat.LOTTIE, url, json: await decodeLottieText(bytes)};
    })();
    pending.set(url, p);
    p.then(loaded => {
        pending.delete(url);
        cache.set(url, loaded);
        if (cache.size > CAPACITY) {
            cache.delete(cache.keys().next().value);
        }
    }, () => {
        pending.delete(url);
    });
    return p;
}

/**
 * 解析 Lottie 的画布尺寸
 * @returns {{width: number, height: number}}
 */
export function lottieSize(json) {
    let data = typeof json === 'string' ? JSON.parse(json) : json;
    return {width: Math.round(data.w) || 512, height: Math.round(data.h) || 512};
}
