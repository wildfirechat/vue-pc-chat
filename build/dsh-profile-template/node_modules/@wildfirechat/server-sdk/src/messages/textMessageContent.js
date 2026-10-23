/*
 * Copyright (c) 2020 WildFireChat. All rights reserved.
 */

import MessageContent from './messageContent.js';
import MessageContentType from './messageContentType.js';
import QuoteInfo from '../model/quoteInfo.js';
import PersistFlag from './persistFlag.js';

export default class TextMessageContent extends MessageContent {
    persistFlag = PersistFlag.Persist_And_Count;
    content;
    quoteInfo;

    constructor(content, mentionedType = 0, mentionedTargets = []) {
        super(MessageContentType.Text, mentionedType, mentionedTargets);
        this.content = content;
    }

    digest() {
        return this.content;
    }

    encode() {
        let payload = super.encode();
        payload.searchableContent = this.content;
        if (this.quoteInfo) {
            let obj = {
                "quote": this.quoteInfo.encode()
            }
            // JSON.parse 和 JSON.stringify 不能处理java long
            let orgStr = JSON.stringify(obj);
            let str = orgStr.replace(/"u":"([0-9]+)"/, "\"u\":$1");

            payload.binaryContent = Buffer.from(str).toString('base64');
        }
        return payload;
    }

    decode(payload) {
        super.decode(payload);
        this.content = payload.searchableContent;
        if (payload.binaryContent && payload.binaryContent.length > 0) {
            // JSON.parse 和 JSON.stringify 不能处理java long
            let quoteInfoStr = Buffer.from(payload.binaryContent, 'base64').toString();
            // FIXME node 环境，decodeURIComponent 方法，有时候会在最后添加上@字符，目前尚未找到原因，先规避
            quoteInfoStr = quoteInfoStr.substring(0, quoteInfoStr.lastIndexOf('}') + 1)
            quoteInfoStr = quoteInfoStr.replace(/"u":([0-9]+),/, '"u":"$1",')
            let obj = JSON.parse(quoteInfoStr).quote
            if(obj){
                this.quoteInfo = new QuoteInfo();
                this.quoteInfo.decode(obj);
            }
        }
    }

    setQuoteInfo(quoteInfo) {
        this.quoteInfo = quoteInfo;
    }

}