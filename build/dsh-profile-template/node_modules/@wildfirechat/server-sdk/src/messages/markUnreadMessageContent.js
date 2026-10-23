import MessageContent from "./messageContent.js";
import MessageContentType from "./messageContentType.js";
import {_patchToJavaLong, _reverseToJsLongString, longValue, stringValue} from "../util/longUtil";
import PersistFlag from './persistFlag.js';

export default class MarkUnreadMessageContent extends MessageContent {
    persistFlag = PersistFlag.No_Persist;
    messageUid;
    timestamp;

    constructor(messageUid) {
        super(MessageContentType.Mark_Unread_Sync);
        this.messageUid = messageUid;
    }

    encode() {
        let payload = super.encode();
        let obj = {
            u: stringValue(this.messageUid),
            t: stringValue(this.timestamp),
        }
        let str = JSON.stringify(obj)
        str = _patchToJavaLong(str, 'u');
        str = _patchToJavaLong(str, 't');

        payload.binaryContent = Buffer.from(str).toString('base64');

        return payload;
    }

    decode(payload) {
        super.decode(payload);

        let str = Buffer.from(payload.binaryContent, 'base64').toString();
        str = _reverseToJsLongString(str, 'u');
        str = _reverseToJsLongString(str, 't');
        let obj = JSON.parse(str);
        this.messageUid = obj.u ? longValue(obj.u) : undefined;
        this.timestamp = obj.t ? longValue(obj.t) : undefined;
    }

}