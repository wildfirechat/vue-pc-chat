/*
 * Copyright (c) 2020 WildFireChat. All rights reserved.
 */

import MessageContentType from './messageContentType.js';
import TextMessageContent from './textMessageContent.js';
import PersistFlag from './persistFlag.js';


export default class PTextMessageContent extends TextMessageContent {
    persistFlag = PersistFlag.Persist;

    constructor(content, mentionedType = 0, mentionedTargets = []) {
        super(content, mentionedType, mentionedTargets);
        this.type = MessageContentType.P_Text;
    }

}