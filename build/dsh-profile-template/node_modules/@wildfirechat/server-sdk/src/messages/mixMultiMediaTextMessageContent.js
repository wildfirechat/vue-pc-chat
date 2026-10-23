// 图片、视频、文字混合消息

import MessageContent from "./messageContent.js";
import MessageContentType from "./messageContentType.js";
import PersistFlag from './persistFlag.js';

export default class MixMultiMediaTextMessageContent extends MessageContent {
    persistFlag = PersistFlag.Persist_And_Count;
    /**
     * 图片、视频 url 列表
     * @type {MultiMediaEntry[]}
     */
    multiMedias = []
    text = ''

    /**
     *
     * @param multiMedias :MultiMediaEntry[]
     * @param text :string
     */
    constructor(multiMedias, text = '') {
        super(MessageContentType.MESSAGE_CONTENT_TYPE_MIX_MULTI_MEDIA_TEXT);
        if (multiMedias && multiMedias.length > 10) {
            console.error('图文混排消息，一次最多支持 10 张图片')
            multiMedias = multiMedias.slice(0, 9);
        }
        this.multiMedias = multiMedias;
        this.text = text;
    }

    digest() {
        return '[图文混排] ' + this.text;
    }

    encode() {
        let payload = super.encode();
        payload.searchableContent = this.text;
        let obj = {
            "ms": this.multiMedias.map(mm => {
                let tmm = mm
                // base64 会增加 33% 的大小
                try {
                    tmm.thumbnail = Buffer.from(mm.thumbnail, 'base64').toString()
                } catch (e) {
                    // do nothing
                }
                return tmm
            })
        }
        let str = JSON.stringify(obj);
        payload.binaryContent = Buffer.from(str).toString('base64');
        return payload;
    }

    decode(payload) {
        super.decode(payload);
        this.text = payload.searchableContent;
        if (payload.binaryContent && payload.binaryContent.length > 0) {
            let muStr = Buffer.from(payload.binaryContent, 'base64').toString();
            this.multiMedias = JSON.parse(muStr).ms

            let mm = this.multiMedias[0];
            try {
                Buffer.from(mm.thumbnail, 'base64')
                // do nothing else
            } catch (e) {
                this.multiMedias.map(mme => {
                    // 重新编码为 base64
                    mme.thumbnail = Buffer.from(mme.thumbnail).toString('base64')
                    return mme
                })
            }
        }
    }
}

class MultiMediaEntry {
    url = ''
    type = 'image' // video
    // base64 encoded, 不包含头部:data:image/png;base64,
    thumbnail = '' // thumbnail
    w = 0
    h = 0
}