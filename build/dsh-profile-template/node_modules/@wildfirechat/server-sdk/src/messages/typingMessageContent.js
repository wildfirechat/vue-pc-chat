/*
 * Copyright (c) 2020 WildFireChat. All rights reserved.
 */

import MessageContent from './messageContent.js';
import MessageContentType from './messageContentType.js';
import PersistFlag from './persistFlag.js';

export default class TypingMessageContent extends MessageContent {
    persistFlag = PersistFlag.Transparent;

    static TYPING_TEXT = 0;
    static TYPING_VOICE = 1;
    static TYPING_CAMERA = 2;
    static TYPING_LOCATION = 3;
    static TYPING_FILE = 4;

    typingType = TypingMessageContent.TYPING_TEXT;

    constructor(type) {
        super(MessageContentType.Typing);
        this.typingType = type;
    }

    digest() {
        return this.content;
    }

    encode() {
        let payload = super.encode();
        payload.content = this.typingType + '';
        return payload;
    }

    decode(payload) {
        super.decode(payload);
        this.typingType = parseInt(payload.content);
    }
}