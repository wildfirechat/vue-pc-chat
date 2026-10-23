import MessageContent from "./messageContent.js";
import MessageContentType from "./messageContentType.js";
import PersistFlag from './persistFlag.js';

export default class StreamingTextGeneratingMessageContent extends MessageContent {
    persistFlag = PersistFlag.Transparent;
    text = '';
    streamId = '';

    constructor() {
        super(MessageContentType.Streaming_Text_Generating);
    }

    digest(message) {
        return this.text;
    }

    encode() {
        let payload = super.encode();
        payload.searchableContent = this.text;
        payload.content = this.streamId;
        return payload;
    }

    decode(payload) {
        super.decode(payload);
        this.text = payload.searchableContent;
        this.streamId = payload.content;
    }
}