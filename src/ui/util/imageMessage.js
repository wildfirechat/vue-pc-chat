import Message from "../../wfc/messages/message";
import ImageMessageContent from "../../wfc/messages/imageMessageContent";
import {fileFromDataUri, imageThumbnail} from "./imageUtil";
import Config from "../../config";

/**
 * 把页面里画出来的图片（data URI，如二维码）包成一条待发送的图片消息，给转发 / 分享用。
 * data URI 直接当 localPath 传给 SDK 会被当成本地文件路径去读，上传失败、发不出去；
 * 和输入框粘贴图片一样转成 File，SDK 发送时先上传；缩略图按普通图片消息生成
 */
export async function imageMessageFromDataUri(dataUri, fileName) {
    let file = fileFromDataUri(dataUri, fileName);
    let result = await imageThumbnail(file);
    let thumbnail = result && result.thumbnail ? result.thumbnail : Config.DEFAULT_THUMBNAIL_URL;
    let message = new Message();
    message.messageContent = new ImageMessageContent(file, null, thumbnail.split(',')[1]);
    if (result) {
        message.messageContent.imageWidth = result.width;
        message.messageContent.imageHeight = result.height;
    }
    return message;
}
