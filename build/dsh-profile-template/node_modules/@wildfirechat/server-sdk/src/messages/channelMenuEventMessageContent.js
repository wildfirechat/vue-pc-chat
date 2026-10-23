import MessageContent from "./messageContent.js";
import MessageContentType from "./messageContentType.js";
import PersistFlag from './persistFlag.js';

export default class ChannelMenuEventMessageContent extends MessageContent {
    persistFlag = PersistFlag.Transparent;
    menu

    constructor(menu) {
        super(MessageContentType.Channel_Menu_Event);
        this.menu = menu;
    }

    encode() {
        let payload = super.encode();
        payload.content = JSON.stringify(this.menu);
        return payload;
    }
}