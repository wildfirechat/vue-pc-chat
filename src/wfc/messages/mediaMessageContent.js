/*
 * Copyright (c) 2020 WildFireChat. All rights reserved.
 */

import MessageContent from './messageContent'

export default class MediaMessageContent extends MessageContent {
    file;

    // 已废弃，请使用remoteMediaUrl
    remotePath = '';
    // 已废弃，请使用localMediaPath
    localPath = '';
    localMediaPath = '';
    remoteMediaUrl = '';
    mediaType = 0;

    /**
     *
     * @param {number} messageType 消息类型
     * @param {number} mediaType 媒体类型
     * @param {File | string} fileOrLocalPath File类型，或者dataUri或者本地路径，本地路径是必须是绝对路径
     * @param {string} remotePath 远端地址
     */
    constructor(messageType, mediaType = 0, fileOrLocalPath, remotePath) {
        super(messageType);
        this.mediaType = mediaType;
        if (!fileOrLocalPath) {
            this.localPath = '';
            this.remotePath = remotePath;
        } else if (typeof fileOrLocalPath === "string" && fileOrLocalPath.startsWith("/")) {
            this.localPath = fileOrLocalPath;
            this.remotePath = remotePath;
        } else {
            this.file = fileOrLocalPath;
            if (fileOrLocalPath && fileOrLocalPath.path !== undefined) {
                this.localPath = fileOrLocalPath.path;
                // attention: 粘贴的时候，path是空字符串，故采用了这个trick
                if (this.localPath.indexOf(fileOrLocalPath.name) < 0) {
                    this.localPath += fileOrLocalPath.name;
                }
            }
        }
        this.localMediaPath = this.localPath;
        this.remoteMediaUrl = this.remotePath;
    }

    encode() {
        let payload = super.encode();
        payload.localMediaPath = this.localMediaPath ? this.localMediaPath : this.localPath;
        payload.remoteMediaUrl = this.remoteMediaUrl ? this.remoteMediaUrl : this.remotePath;
        payload.mediaType = this.mediaType;
        return payload;
    }

    decode(payload) {
        super.decode(payload);
        this.localPath = payload.localMediaPath;
        this.remotePath = payload.remoteMediaUrl;
        this.localMediaPath = this.localPath;
        this.remoteMediaUrl = this.remotePath;
        this.mediaType = payload.mediaType;
    }
}
