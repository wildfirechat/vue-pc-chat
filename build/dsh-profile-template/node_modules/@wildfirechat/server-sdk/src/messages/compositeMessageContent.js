import MessageContentType from "./messageContentType.js";
import MessageContentMediaType from "./messageContentMediaType.js";
import MediaMessageContent from "./mediaMessageContent.js";
import Message from "./message.js";
import Conversation from "../model/conversation.js";
import Long from "long";
import MessagePayload from "./messagePayload.js";
import ArticlesMessageContent from "./articlesMessageContent.js";
import { stringValue, compare } from "../util/longUtil.js";
import PersistFlag from './persistFlag.js';

export default class CompositeMessageContent extends MediaMessageContent {
    persistFlag = PersistFlag.Persist_And_Count;
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
        let binArr;
        let size = 0;
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

            if (!binArr) {
                size += JSON.stringify(o).length;
                if (size > 20480 && arr.length > 0) {
                    binArr = arr.map((value) => value);
                }
            }

            arr.push(o);

        });

        let obj;
        if (binArr) {
            obj = {
                ms: binArr,
            }
        } else {
            obj = {
                ms: arr,
            }
        }

        let str = JSON.stringify(obj);
        str = str.replace(/"uid":"([0-9]+)"/, "\"uid\":$1");
        str = str.replace(/"serverTime":"([0-9]+)"/, "\"serverTime\":$1");

        payload.binaryContent = Buffer.from(str).toString('base64');
        return payload;
    }

    decode(payload) {
        super.decode(payload);

        this.title = payload.content;
        let str;

        if (!str) {
            str = Buffer.from(payload.binaryContent, 'base64').toString();
            this._decodeMessages(str);
        }
    }

    _decodeMessages(str) {
        if (this.loaded) {
            return;
        }
        this.messages = [];
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
    }

}