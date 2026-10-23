/*
 * Copyright (c) 2020 WildFireChat. All rights reserved.
 */

import MediaMessageContent from './mediaMessageContent.js';
import MessageContentMediaType from './messageContentMediaType.js';
import MessageContentType from './messageContentType.js';
import PersistFlag from './persistFlag.js';

export default class VideoMessageContent extends MediaMessageContent {
    persistFlag = PersistFlag.Persist_And_Count;
    // base64 encoded
    thumbnail;
    duration;

    constructor(fileOrLocalPath, remotePath, thumbnail, duration = 0) {
        super(MessageContentType.Video, MessageContentMediaType.Video, fileOrLocalPath, remotePath);
        this.thumbnail = thumbnail;
        this.duration = duration;
    }

    digest() {
        return '[视频]';
    }

    encode() {
        let payload = super.encode();
        payload.binaryContent = this.thumbnail;
        let obj = {
            d: this.duration,
            duration: this.duration
        }
        payload.content = JSON.stringify(obj);
        payload.mediaType = MessageContentMediaType.Video;
        return payload;
    }

    decode(payload) {
        super.decode(payload);
        this.thumbnail = payload.binaryContent;
        if (payload.content) {
            let obj = JSON.parse(payload.content)
            this.duration = obj.d;
            if (this.duration === undefined) {
                this.duration = obj.duration;
            }
        }
    }
}