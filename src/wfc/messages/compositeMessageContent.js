import MessageContentType from "../messages/messageContentType";
import wfc from "../client/wfc";
import MediaMessageContent from "../messages/mediaMessageContent";
import {stringValue} from "../util/longUtil";
import Message from "../messages/message";
import Conversation from "../model/conversation";
import Long from "long";
import {compare} from "../util/longUtil";
import MessagePayload from "../messages/messagePayload";
import {isElectron} from "../../platform";
import ArticlesMessageContent from "./articlesMessageContent";
import MessageContentMediaType from "./messageContentMediaType";

/** 消息体里的内联预览只用来显示摘要，去掉图片/视频/位置的缩略图（完整内容文件里有） */
const THUMBNAIL_ONLY_TYPES = new Set([
    MessageContentType.Image,
    MessageContentType.Video,
    MessageContentType.Location,
]);

/** 消息体内联上限：与原生 SDK、wf-enterprise-chat 一致，按 UTF-8 字节计 */
const MAX_INLINE_SIZE = 20 * 1024;
/** 可搜索内容上限（字符数，中文按 3 字节算约 6K） */
const MAX_SEARCHABLE_LENGTH = 2000;

function utf8Length(str) {
    if (typeof TextEncoder !== 'undefined') {
        return new TextEncoder().encode(str).length;
    }
    return unescape(encodeURIComponent(str)).length;
}

/** 消息体里能放下的前几条（累计不超过 MAX_INLINE_SIZE 字节）；第一条就超了返回 0 */
function inlineCountOf(arr) {
    let size = 0;
    for (let i = 0; i < arr.length; i++) {
        size += utf8Length(JSON.stringify(arr[i]));
        if (size > MAX_INLINE_SIZE) {
            return i;
        }
    }
    return arr.length;
}

export default class CompositeMessageContent extends MediaMessageContent {
    title = '';
    messages = [];
    // web 端有效，仅仅是用来标识 mediaCompositeMessage 是否已加载
    loaded = false;

    constructor() {
        super(MessageContentType.Composite_Message, MessageContentMediaType.File, '')
    }

    setMessages(msgs) {
        this.messages = [];
        msgs.forEach(m => {
            if (m.messageContent instanceof ArticlesMessageContent) {
                let linkMessageContents = m.messageContent.toLinkMessageContent();
                linkMessageContents.forEach(lm => {
                    let msg = Object.assign(new Message(), m);
                    msg.messageContent = lm;
                    this.messages.push(msg);
                })
            } else {
                this.messages.push(m)
            }
        })
        this.messages = this.messages.sort((m1, m2) => {
            return compare(m1.messageUid, m2.messageUid);
        })
    }

    digest(message) {
        return '[聊天记录]' + this.title;
    }

    encode() {
        let payload = super.encode();
        payload.content = this.title;
        let arr = [];
        this.messages.forEach(msg => {
            let msgPayload = msg.messageContent.encode();
            let o = {
                uid: stringValue(msg.messageUid),
                type: msg.conversation.type,
                target: msg.conversation.target,
                line: msg.conversation.line,
                from: msg.from,
                tos: msg.to,
                direction: msg.direction,
                status: msg.status,
                serverTime: stringValue(msg.timestamp),
                ctype: msgPayload.type,
                csc: msgPayload.searchableContent,
                cpc: msgPayload.pushContent,
                cpd: msgPayload.pushData,
                cc: msgPayload.content,
                cmt: msgPayload.mentionedType,
                cmts: msgPayload.mentionedTargets,
                ce: msgPayload.extra,
            };
            if (msgPayload.searchableContent) {
                payload.searchableContent = payload.searchableContent + msgPayload.searchableContent + ' ';
            }

            if (msgPayload.binaryContent) {
                o.cbc = msgPayload.binaryContent;
            }
            if (msg.messageContent instanceof MediaMessageContent) {
                o.mt = msg.messageContent.mediaType;
                o.mru = msg.messageContent.remotePath;
            }

            arr.push(o);
        });

        // 完整内容超过 20K 时写成文件随媒体上传，消息体里只内联前几条（对齐 wf-enterprise-chat ac442ff3）：
        // - 大小按 UTF-8 字节算（中文一个字 3 字节，按字符数算会低估到三分之一，照样超 64K 发不出去）；
        // - 内联的几条去掉图片/视频/位置缩略图后再计数（老图片缩略图 base64 后单张能到 80K，完整内容文件里有）；
        // - 第一条就超时一条都不放。
        const overflow = inlineCountOf(arr) < arr.length;
        let binArr = null;
        if (overflow || this.file || this.localPath || this.remotePath) {
            const stripped = arr.map(o => {
                if (THUMBNAIL_ONLY_TYPES.has(o.ctype) && o.cbc) {
                    let copy = Object.assign({}, o);
                    delete copy.cbc;
                    return copy;
                }
                return o;
            });
            binArr = stripped.slice(0, inlineCountOf(stripped));
        }

        // 可搜索内容是逐条拼起来的，消息一多同样能把消息体撑过 64K；只留开头一段用于搜索
        if (payload.searchableContent && payload.searchableContent.length > MAX_SEARCHABLE_LENGTH) {
            payload.searchableContent = payload.searchableContent.substring(0, MAX_SEARCHABLE_LENGTH);
        }

        let obj;
        if (overflow && !this.file) {
            obj = {
                ms: arr,
            }
            let str = JSON.stringify(obj);
            str = str.replace(/"uid":"([0-9]+)"/, "\"uid\":$1");
            str = str.replace(/"serverTime":"([0-9]+)"/, "\"serverTime\":$1");

            let blob = new Blob([str]);
            let fileName = 'wcf-' + new Date().getTime() + '.data';
            this.file = new File([blob], fileName);
            if (isElectron()) {
                let fs = require('fs');
                let sep = require('path').sep;
                let cmsDir = wfc.getAppPath() + sep + 'cms' + sep;
                if(!fs.existsSync(cmsDir)){
                    fs.mkdirSync(cmsDir);
                }
                this.localPath = cmsDir + fileName;
                fs.writeFileSync(this.localPath, str);
                payload.localMediaPath = this.localPath;
                payload.mediaType = MessageContentType.File;
            }
            obj = {
                ms: binArr,
            }
        } else {
            obj = {
                ms: binArr ? binArr : arr,
            }
        }

        let str = JSON.stringify(obj);
        str = str.replace(/"uid":"([0-9]+)"/, "\"uid\":$1");
        str = str.replace(/"serverTime":"([0-9]+)"/, "\"serverTime\":$1");

        payload.binaryContent = wfc.utf8_to_b64(str)
        return payload;
    }

    decode(payload) {
        super.decode(payload);

        this.title = payload.content;
        let str;
        if (this.file) {
            // web
            let fileReader = new FileReader();
            fileReader.onload(ev => {
                this._decodeMessages(ev.target.result);
            });
            fileReader.readAsBinaryString(this.file);

        } else if (this.localPath) {
            // electron
            if (isElectron()) {
                const fs = require("fs");
                if (fs.existsSync(this.localPath)) {
                    const buffer = fs.readFileSync(this.localPath);
                    str = buffer.toString();
                    this._decodeMessages(str);
                } else {
                    console.log('media composite message not downloaded', this.remotePath);
                }
            }
        }

        if (!str) {
            str = wfc.b64_to_utf8(payload.binaryContent);
            this._decodeMessages(str);
        }
    }

    _decodeMessages(str) {
        if (this.loaded) {
            return;
        }
        this.messages = [];
        // FIXME node 环境，decodeURIComponent 方法，有时候会在最后添加上@字符，目前尚未找到原因，先规避
        str = str.substring(0, str.lastIndexOf('}') + 1);
        str = str.replace(/"uid":([0-9]+)/g, "\"uid\":\"$1\"");
        str = str.replace(/"serverTime":([0-9]+)/g, "\"serverTime\":\"$1\"");
        let obj = JSON.parse(str);
        obj.ms.forEach(o => {
            let conv = new Conversation(o.type, o.target, o.line);
            let msg = new Message()
            msg.messageUid = Long.fromValue(o.uid);
            msg.conversation = conv;
            msg.from = o.from;
            msg.to = o.tos;
            msg.direction = o.direction;
            msg.status = o.status;
            msg.timestamp = Long.fromValue(o.serverTime);

            let payload = new MessagePayload();
            payload.type = o.ctype;
            payload.searchableContent = o.csc;
            payload.pushContent = o.cpc;
            payload.pushData = o.cpd;
            payload.content = o.cc;
            payload.mentionedType = o.cmt;
            payload.mentionedTargets = o.cmts;
            payload.extra = o.ce;

            payload.binaryContent = o.cbc;
            payload.mediaType = o.mt;
            payload.remoteMediaUrl = o.mru;

            msg.messageContent = Message.messageContentFromMessagePayload(payload, msg.from);
            this.messages.push(msg);
        });
        console.log('cp ms', this.messages)
    }

}
