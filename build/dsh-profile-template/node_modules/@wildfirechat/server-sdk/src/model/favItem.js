import ConversationType from "./conversationType.js";
import MessageContentType from "../messages/messageContentType.js";
import Message from "../messages/message.js";
import TextMessageContent from "../messages/textMessageContent.js";
import ImageMessageContent from "../messages/imageMessageContent.js";
import VideoMessageContent from "../messages/videoMessageContent.js";
import FileMessageContent from "../messages/fileMessageContent.js";
import CompositeMessageContent from "../messages/compositeMessageContent.js";
import MessagePayload from "../messages/messagePayload.js";
import SoundMessageContent from "../messages/soundMessageContent.js";
import Long from "long";
import UnknownMessageContent from "../messages/unknownMessageContent.js";

export default class FavItem {
    id;
    messageUid;
    // 和消息类型对应
    favType;
    timestamp;
    conversation;
    origin;
    sender;
    title;
    url;
    thumbUrl;
    data;

    static fromMessage(message) {
        let favItem = new FavItem();
        favItem.messageUid = message.messageUid;
        favItem.conversation = message.conversation;
        favItem.favType = message.messageContent.type;
        favItem.sender = message.from;
        // 服务端无法获取用户/群组/频道信息，origin 为空
        switch (message.conversation.type) {
            case ConversationType.Group:
                favItem.origin = message.conversation.target;
                break;
            case ConversationType.Single:
                favItem.origin = message.from;
                break;
            case ConversationType.Channel:
                favItem.origin = message.conversation.target;
                break;
            case ConversationType.ChatRoom:
                break;
            default:
                break;
        }

        let data;
        switch (message.messageContent.type) {
            case MessageContentType.Text:
                let textMessageContent = message.messageContent;
                favItem.title = textMessageContent.content;
                break;
            case MessageContentType.Image:
                let imageContent = message.messageContent;
                favItem.url = imageContent.remotePath;
                if (imageContent.thumbnail) {
                    let data = {
                        "thumb": imageContent.thumbnail,
                    }
                    favItem.data = JSON.stringify(data);
                }
                break;
            case MessageContentType.Video:
                let videoContent = message.messageContent;
                favItem.url = videoContent.remotePath;
                data = {
                    duration: videoContent.duration,
                }
                if (videoContent.thumbnail) {
                    data['thumb'] = videoContent.thumbnail;
                }
                favItem.data = JSON.stringify(data);
                break;
            case MessageContentType.File:
                let fileContent = message.messageContent;
                favItem.url = fileContent.remotePath;
                favItem.title = fileContent.name;
                data = {
                    size: fileContent.size,
                }
                favItem.data = JSON.stringify(data);
                break;
            case MessageContentType.Composite_Message:
                let compositeContent = message.messageContent;
                favItem.title = compositeContent.title;
                let payload = compositeContent.encode();

                if (payload.remoteMediaUrl) {
                    // 服务端不使用 wfc 编码方法
                    let str = JSON.stringify({
                        'remote_url': payload.remoteMediaUrl,
                        binaryContent: payload.binaryContent ? Buffer.from(payload.binaryContent, 'base64').toString() : ''
                    });
                    payload.binaryContent = Buffer.from(str).toString('base64');
                }

                favItem.data = payload.binaryContent;
                break;
            case MessageContentType.Voice:
                let voiceContent = message.messageContent;
                favItem.url = voiceContent.remotePath;
                data = {
                    duration: voiceContent.duration,
                }
                favItem.data = JSON.stringify(data);
                break;
            default:
                favItem.title = message.messageContent.digest(message)
                break;
        }
        return favItem;
    }

    toMessage() {
        // 服务端无法通过 messageUid 获取消息，直接创建新消息
        let content;
        try {
            let type = this.favType ? this.favType : this.type;
            switch (type) {
                case MessageContentType.Text:
                    content = new TextMessageContent(this.title);
                    break;
                case MessageContentType.Image:
                    content = new ImageMessageContent(null, this.url, '');
                    if (this.data) {
                        content.thumbnail = this.data.thumb;
                    }
                    break;
                case MessageContentType.Video:
                    content = new VideoMessageContent(null, this.url, '');
                    if (this.data) {
                        content.thumbnail = this.data.thumb;
                    }
                    break;
                case MessageContentType.File:
                    content = new FileMessageContent(null, this.url, this.title);
                    if (this.data) {
                        content.size = this.data.size;
                    }
                    break;
                case MessageContentType.Composite_Message:
                    content = new CompositeMessageContent();
                    content.title = this.title;
                    let payload = new MessagePayload();
                    payload.type = this.favType;
                    payload.content = this.title;
                    if (this.data) {
                        payload.binaryContent = this.data;
                        try {
                            let obj = JSON.parse(Buffer.from(this.data, 'base64').toString());
                            payload.remoteMediaUrl = obj['remote_url'];
                            payload.binaryContent = null;
                        } catch (e) {
                        }
                    }
                    content.decode(payload)
                    break;
                case MessageContentType.Voice:
                    content = new SoundMessageContent(null, this.url)
                    if (this.data) {
                        content.duration = this.data.duration;
                    }
                    break;
                default:
                    break;
            }
        } catch (e) {
            console.log('toMessage Error', e)
            content = new UnknownMessageContent();
        }
        let msg = new Message(this.conversation, content);
        if (this.messageUid) {
            msg.messageUid = Long.fromValue(this.messageUid);
        }

        return msg;
    }
}
