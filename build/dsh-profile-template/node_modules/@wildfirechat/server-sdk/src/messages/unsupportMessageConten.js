/*
 * Copyright (c) 2020 WildFireChat. All rights reserved.
 */

import MessageContent from "./messageContent.js";
import PersistFlag from './persistFlag.js';

export default class UnsupportMessageContent extends MessageContent {
    persistFlag = PersistFlag.Persist;

    digest() {
        return '尚不支持该类型消息, 请手机查看 : ' + this.type;
    }
}