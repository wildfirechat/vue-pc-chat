import Config from "../../config";
import panApi from "../../api/panApi";
import wfc from "../../wfc/client/wfc";
import FileMessageContent from "../../wfc/messages/fileMessageContent";
import {normalizeSpace, normalizeFile, panFailMessage, panMimeType, panFileExtension} from "./panUtil";

/**
 * 消息里的文件与网盘/在线文档的交互（文件消息右键菜单用）。
 * 与 Flutter 参考 chat/lib/pan/pan_save.dart 一致：
 * 「在线预览」按链接只读打开；「存到网盘」把消息文件拷进「我的私有空间」根目录（服务端 copy=true）。
 */

export function isFileMessage(message) {
    return !!message && message.messageContent instanceof FileMessageContent;
}

function remoteUrl(message) {
    const content = message.messageContent;
    return (content && (content.remotePath || content.remoteUrl)) || '';
}

export function canPreviewFileMessageOnline(message) {
    return Config.isPanEnabled() && isFileMessage(message) && panApi.isOnlineDocName(message.messageContent.name);
}

export function canSaveFileMessageToPan(message) {
    return Config.isPanEnabled() && isFileMessage(message) && !!remoteUrl(message);
}

/** 在线预览：只读打开聊天文件（文件不在网盘里） */
export function previewFileMessageOnline(message) {
    const content = message.messageContent;
    const url = panApi.docViewUrl(remoteUrl(message), content.name);
    return {url, title: content.name};
}

function uniqueName(name, existingNames) {
    if (!existingNames.has(name)) {
        return name;
    }
    const ext = panFileExtension(name);
    const base = ext ? name.substring(0, name.length - ext.length - 1) : name;
    for (let i = 1; i < 1000; i++) {
        const candidate = ext ? `${base}(${i}).${ext}` : `${base}(${i})`;
        if (!existingNames.has(candidate)) {
            return candidate;
        }
    }
    return `${base}-${Date.now()}`;
}

async function pickMySpace() {
    const selfUserId = wfc.getUserId();
    const list = await panApi.getMySpaces();
    const spaces = (list || []).map(s => normalizeSpace(s, selfUserId));
    return spaces.find(s => s.spaceType === 'USER_PRIVATE') || spaces[0] || null;
}

/**
 * 保存文件消息到「我的网盘」。
 * @param message
 * @param {{openAfter?: boolean}} options openAfter=true 时保存后打开（在线文档走文档窗口，其余取签名地址）
 * @returns {Promise<object>} 新建的网盘文件
 */
export async function saveFileMessageToMyPan(message, {openAfter = false} = {}) {
    const content = message.messageContent;
    const space = await pickMySpace();
    if (!space) {
        throw new Error('没有可用的网盘空间');
    }
    let name = content.name || 'file';
    try {
        const rootFiles = await panApi.getSpaceFiles(space.spaceId, 0);
        const names = new Set((rootFiles || []).map(f => normalizeFile(f).name));
        name = uniqueName(name, names);
    } catch (e) {
        // 去重失败不阻塞保存
        console.warn('pan unique name check failed', e);
    }
    const file = await panApi.createFile({
        spaceId: space.spaceId,
        parentId: null,
        name,
        size: content.size || 0,
        mimeType: panMimeType(name),
        storageUrl: remoteUrl(message),
        copy: true,
    });
    const normalized = normalizeFile(file);
    return normalized;
}

export {panFailMessage};
