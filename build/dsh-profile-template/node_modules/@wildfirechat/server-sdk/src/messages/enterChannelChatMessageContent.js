import MessageContent from "./messageContent.js";
import MessageContentType from "./messageContentType.js";
import PersistFlag from './persistFlag.js';

export default class EnterChannelChatMessageContent extends MessageContent {
    persistFlag = PersistFlag.Transparent;
    constructor() {
        super(MessageContentType.Enter_Channel_Chat);
    }

}