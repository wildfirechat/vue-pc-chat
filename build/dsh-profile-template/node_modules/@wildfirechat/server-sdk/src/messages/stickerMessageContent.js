/*
 * Copyright (c) 2020 WildFireChat. All rights reserved.
 */

import MessageContentMediaType from './messageContentMediaType.js';
import MediaMessageContent from './mediaMessageContent.js';
import MessageContentType from './messageContentType.js';
import PersistFlag from './persistFlag.js';

export default class StickerMessageContent extends MediaMessageContent {
    persistFlag = PersistFlag.Persist_And_Count;
    width = 200;
    height = 200;

    constructor(filerOrLocalPath, remotePath, width, height) {
        super(MessageContentType.Sticker, MessageContentMediaType.Sticker, filerOrLocalPath, remotePath);
        this.width = width;
        this.height = height;
    }

    digest() {
        return '[表情]';
    }

    encode() {
        let payload = super.encode();
        payload.mediaType = MessageContentMediaType.File;
        let obj = {
            x: this.width,
            y: this.height,
        };
        payload.binaryContent = Buffer.from(JSON.stringify(obj)).toString('base64');
        return payload;
    }

    decode(payload) {
        super.decode(payload);
        let obj = JSON.parse(Buffer.from(payload.binaryContent, 'base64').toString());
        this.width = obj.x;
        this.height = obj.y;
    }
}