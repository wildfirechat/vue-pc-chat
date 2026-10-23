import MessageContent from "./messageContent.js";
import MessageContentType from "./messageContentType.js";
import PersistFlag from './persistFlag.js';

export default class LeaveChannelChatMessageContent extends MessageContent {
    persistFlag = PersistFlag.Transparent;
    constructor() {
        super(MessageContentType.Leave_Channel_Chat);
    }

}