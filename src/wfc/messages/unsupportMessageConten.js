/*
 * Copyright (c) 2021 Panda DB Chat. All rights reserved.
 */

import MessageContent from "./messageContent";

export default class UnsupportMessageContent extends MessageContent {

    digest() {
        return '尚不支持该类型消息, 请手机查看 : ' + this.type;
    }
}