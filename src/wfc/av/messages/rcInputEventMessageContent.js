/*
 * Copyright (c) 2020 WildFireChat. All rights reserved.
 */

import MessageContent from '../../messages/messageContent';
import MessageContentType from '../../messages/messageContentType';
import wfc from "../../client/wfc"

export default class RCInputEventMessageContent extends MessageContent {
    callId;
    data

    constructor(callId, args) {
        super(MessageContentType.VOIP_REMOTE_CONTROL_INPUT_EVENT, 0, []);
        this.callId = callId;
        this.data = args;
    }

    digest() {
        if (this.audioOnly) {
            return '[语音通话]';
        } else {
            return '[视频通话]';
        }
    }

    encode() {
        let payload = super.encode();
        // payload.content = this.callId;
        payload.binaryContent = wfc.utf8_to_b64(JSON.stringify(this.data));
        return payload;
    }

    decode(payload) {
        super.decode(payload);
        // this.callId = payload.content;
        let json = wfc.b64_to_utf8(payload.binaryContent);
        this.data = JSON.parse(json);
    }
}
