/*
 * Copyright (c) 2020 WildFireChat. All rights reserved.
 */

import MediaMessageContent from './mediaMessageContent.js';
import MessageContentMediaType from './messageContentMediaType.js';
import MessageContentType from './messageContentType.js';
import PersistFlag from './persistFlag.js';

export default class SoundMessageContent extends MediaMessageContent {
    persistFlag = PersistFlag.Persist_And_Count;
    duration;
    // 本地使用
    _speechToTextInProgress = false;
    _speechText = ''

    constructor(fileOrLocalPath, remotePath, duration) {
        super(MessageContentType.Voice, MessageContentMediaType.Voice, fileOrLocalPath, remotePath);
        this.duration = duration;
    }

    digest() {
        return '[语音]';
    }

    encode() {
        let payload = super.encode();
        payload.mediaType = MessageContentMediaType.Voice;
        let obj = {
            duration: this.duration,
        };
        payload.content = JSON.stringify(obj);
        return payload;
    }

    decode(payload) {
        super.decode(payload);
        let obj = JSON.parse(payload.content);
        this.duration = obj.duration;
    }
}