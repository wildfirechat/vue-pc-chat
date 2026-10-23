import MessageContent from './messageContent.js';
import MessageContentType from './messageContentType.js';
import PersistFlag from './persistFlag.js';

export default class LinkMessageContent extends MessageContent {
    persistFlag = PersistFlag.Persist_And_Count;
    title;
    contentDigest;
    url;
    thumbnail;


    constructor() {
        super(MessageContentType.Link);
    }

    encode() {
        let payload = super.encode();
        let obj = {
            d: this.contentDigest,
            u: this.url,
            t: this.thumbnail
        }

        payload.searchableContent = this.title;
        payload.binaryContent = Buffer.from(JSON.stringify(obj)).toString('base64');

        return payload;
    }

    decode(payload) {
        super.decode(payload);
        this.title = payload.searchableContent;
        let obj = JSON.parse(Buffer.from(payload.binaryContent, 'base64').toString());
        this.contentDigest = obj.d;
        this.url = obj.u;
        this.thumbnail = obj.t;
    }

    digest(message) {
        let tmp = this.title ? this.title.trim() : this.contentDigest ? this.contentDigest.trim() : null;
        return tmp ? tmp : this.url;
    }
}