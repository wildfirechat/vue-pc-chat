import {stickerFormatFromPath} from "./stickerLoader";
import Config from "../../../../config";

/**
 * 内置贴纸包，放在 public/stickers/ 下，随安装包分发，不依赖网络。
 *
 * public/stickers/index.json 列出所有贴纸包目录（Web 端无法列目录，新增贴纸包要在这里登记）：
 * ```json
 * {"packs": ["office_phrases", "noto_emoji"]}
 * ```
 * 每个目录里放 pack.json 描述这套贴纸：
 * ```json
 * {
 *   "title": {"zh": "职场用语", "en": "Office Phrases"},
 *   "order": 10,
 *   "cover": "收到.tgs",
 *   "stickers": ["收到.tgs", "好的.tgs"],
 *   "keywords": {"收到.tgs": ["收到"], "好的.tgs": ["好的", "OK"]}
 * }
 * ```
 * order 越小越靠前；stickers 决定面板顺序，不在列表里的文件不显示。
 * keywords 是输入联想关键词，没列出的贴纸不参与联想。
 */
const ROOT = './stickers/';

// 没写 order 的包排在内置包后面
const DEFAULT_ORDER = 1000;

let loaded = [];
let loading = null;

/**
 * 已加载的贴纸包，{@link loadStickerPacks} 完成前为空数组。
 *
 * 贴纸包：{id, titles, order, cover, stickers}，
 * 贴纸：{url, keywords, builtin}，builtin 为 true 表示内置贴纸，发送时需要先上传。
 */
export function loadedStickerPacks() {
    return loaded;
}

export function loadStickerPacks() {
    // 其他端暂不支持 tgs 贴纸，关闭时不加载，表情面板和输入联想里都没有贴纸包
    if (!Config.ENABLE_TGS_STICKER) {
        return Promise.resolve(loaded);
    }
    if (!loading) {
        loading = doLoad().then(packs => {
            loaded = packs;
            return packs;
        }, error => {
            console.error('load sticker packs failed', error);
            loading = null;
            return loaded;
        });
    }
    return loading;
}

async function doLoad() {
    let index = await fetchJson(ROOT + 'index.json');
    let packs = [];
    for (let id of index.packs || []) {
        try {
            let pack = await loadPack(id);
            if (pack) {
                packs.push(pack);
            }
        } catch (e) {
            console.error('skip sticker pack', id, e);
        }
    }
    packs.sort((a, b) => a.order !== b.order ? a.order - b.order : a.id.localeCompare(b.id));
    return packs;
}

async function loadPack(id) {
    let manifest = await fetchJson(`${ROOT}${id}/pack.json`);
    let keywordsByName = manifest.keywords || {};
    let urlOf = name => `${ROOT}${id}/${encodeURIComponent(name)}`;
    let stickers = (manifest.stickers || [])
        .filter(name => {
            if (stickerFormatFromPath(name)) {
                return true;
            }
            console.warn('sticker pack', id, 'unsupported', name);
            return false;
        })
        .map(name => ({
            url: urlOf(name),
            keywords: keywordsByName[name] || [],
            builtin: true,
        }));
    if (!stickers.length) {
        return null;
    }
    let cover = manifest.cover && manifest.stickers.indexOf(manifest.cover) >= 0 ? urlOf(manifest.cover) : stickers[0].url;
    return {
        id,
        titles: manifest.title || {},
        order: typeof manifest.order === 'number' ? manifest.order : DEFAULT_ORDER,
        cover,
        stickers,
    };
}

async function fetchJson(url) {
    let response = await fetch(url);
    if (!response.ok) {
        throw new Error(`fetch ${url} failed: ${response.status}`);
    }
    return response.json();
}

/**
 * @param pack 贴纸包
 * @param {string} locale 界面语言，如 zh-CN、en
 */
export function stickerPackTitle(pack, locale) {
    let lang = (locale || 'zh').split('-')[0];
    return pack.titles[lang] || pack.titles['zh'] || pack.id;
}

// 联想条放不下太多，再多也翻不到
const MAX_SUGGESTIONS = 16;

/**
 * 输入联想贴纸（微信"表情联想"）：按关键词给输入框里的文字找贴纸。
 *
 * 只拿整段输入去比，不在句子里挑词：联想出的贴纸选中后会替换掉整段输入发出去，
 * 句子里带个"好的"就弹贴纸只会打扰。命中规则按优先级：
 *   1. 与关键词相同；
 *   2. 是关键词的开头，如"早上" → 早上好；
 *   3. 是关键词的一部分，如"查收" → 请查收。
 * 2、3 要求输入至少两个字符，单字太容易误中。同一档内按面板顺序（包顺序、包内顺序）。
 *
 * 比较前去掉首尾空白、统一小写，并去掉 emoji 变体选择符 U+FE0F：
 * 输入法打出的 ❤️ 带它，表情面板里的不带，两边要算同一个。
 *
 * @param {string} text 输入框里的文字
 * @param {Array} stickers 参与联想的贴纸，{url, keywords, builtin}
 * @returns {Array} 命中的贴纸，按优先级排好
 */
export function matchStickers(text, stickers) {
    let query = normalize(text);
    if (!query) {
        return [];
    }
    let allowPartial = Array.from(query).length >= 2;
    let exact = [];
    let prefix = [];
    let partial = [];
    for (let sticker of stickers) {
        let keywords = sticker.keywords.map(normalize);
        if (keywords.indexOf(query) >= 0) {
            exact.push(sticker);
        } else if (!allowPartial) {
            // 单字只认完全相同
        } else if (keywords.some(k => k.startsWith(query))) {
            prefix.push(sticker);
        } else if (keywords.some(k => k.indexOf(query) >= 0)) {
            partial.push(sticker);
        }
    }
    return [...exact, ...prefix, ...partial].slice(0, MAX_SUGGESTIONS);
}

function normalize(text) {
    return text.trim().replace(/️/g, '').toLowerCase();
}
