/*
 * Copyright (c) 2020 WildFireChat. All rights reserved.
 */

import MessageContent from '../../messages/messageContent';
import MessageContentType from '../../messages/messageContentType';
import wfc from "../../client/wfc"

export default class RcAcceptMessageContent extends MessageContent {
    callId;
    data

    constructor(callId, args) {
        super(MessageContentType.VOIP_REMOTE_CONTROL_ACCEPT, 0, []);
        this.callId = callId;
        this.data = args;
    }

    digest() {
        return ''
    }

    encode() {
        let payload = super.encode();
        payload.content = this.callId;
        payload.binaryContent = wfc.utf8_to_b64(JSON.stringify(this.data));
        return payload;
    }

    decode(payload) {
        super.decode(payload);
        this.callId = payload.content;
        let json = wfc.b64_to_utf8(payload.binaryContent);
        this.data = JSON.parse(json);
    }
}
