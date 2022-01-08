/*
 * Copyright (c) 2021 Panda DB Chat. All rights reserved.
 */

import ChannelInfo from "./channelInfo";

export default class NullChannelInfo extends ChannelInfo {
    constructor(channelId) {
        super()
        this.channelId = channelId;
        this.name = `<${channelId}>`
    }
}
