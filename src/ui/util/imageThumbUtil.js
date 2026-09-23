import store from "../../store";
import ConversationType from "../../wfc/model/conversationType";

const MINIO_THUMB_PARA = '.thumb';

/**
 * 图片消息缩略图地址，依次为：
 * 1. 消息里的缩略图
 * 2. getImageThumbPara 为 .thumb 时，协议栈发送图片消息会丢弃缩略图，由 minio 上传图片时自动生成，地址为 remotePath + .thumb
 * 3. 都没有时返回空字符串，调用方显示占位
 *
 * @param {Message} message 图片消息
 * @return {string}
 */
export function imageThumbnailSrc(message) {
    let content = message.messageContent;
    if (content.thumbnail) {
        return 'data:image/jpeg;base64,' + content.thumbnail;
    }
    // 密聊图片是加密后上传的，服务端无法生成缩略图
    if (message.conversation && message.conversation.type === ConversationType.SecretChat) {
        return '';
    }
    if (content.remotePath && store.state.misc.imageThumbPara === MINIO_THUMB_PARA) {
        return content.remotePath + MINIO_THUMB_PARA;
    }
    return '';
}
