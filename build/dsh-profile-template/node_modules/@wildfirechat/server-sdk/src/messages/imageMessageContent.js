/*
 * Copyright (c) 2020 WildFireChat. All rights reserved.
 */

import MediaMessageContent from './mediaMessageContent.js';
import MessageContentMediaType from './messageContentMediaType.js';
import MessageContentType from './messageContentType.js';
import PersistFlag from './persistFlag.js';

export default class ImageMessageContent extends MediaMessageContent {
    persistFlag = PersistFlag.Persist_And_Count;
    // base64 encoded, 不包含头部:data:image/png;base64,
    thumbnail;
    imageWidth;
    imageHeight;


    constructor(fileOrLocalPath, remotePath, thumbnail) {
        super(MessageContentType.Image, MessageContentMediaType.Image, fileOrLocalPath, remotePath);
        this.thumbnail = thumbnail;
    }

    digest() {
        return '[图片]';
    }

    encode() {
        let payload = super.encode();
        payload.mediaType = MessageContentMediaType.Image;
        payload.binaryContent = this.thumbnail;
        if (this.imageWidth) {
            let obj = {
                w: this.imageWidth,
                h: this.imageHeight
            }
            payload.content = JSON.stringify(obj)
        }
        return payload;
    }

    decode(payload) {
        super.decode(payload);
        this.thumbnail = payload.binaryContent;
        if (payload.content) {
            let obj = JSON.parse(payload.content)
            this.imageWidth = obj['w'];
            this.imageHeight = obj['h'];
        }
    }
}