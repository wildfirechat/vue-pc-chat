import MessageContentType from "./messageContentType.js";
import MessageContent from './messageContent.js'
import CollectionEntry from "../model/collectionEntry.js";
import PersistFlag from './persistFlag.js';

export default class CollectionMessageContent extends MessageContent {
    persistFlag = PersistFlag.Persist_And_Count;
    collectionId;
    groupId;
    creatorId;
    title;
    desc;
    template;
    expireType;
    expireAt;
    maxParticipants;
    status;
    entries;
    createdAt;
    updatedAt;

    constructor() {
        super(MessageContentType.Collection);
        this.entries = [];
    }

    digest() {
        if (this.title && this.title.length > 0) {
            return "[接龙] " + this.title;
        }
        return "[接龙]";
    }

    encode() {
        let payload = super.encode();
        payload.searchableContent = this.title;

        let obj = {
            collectionId: this.collectionId,
            groupId: this.groupId,
            creatorId: this.creatorId,
            desc: this.desc,
            template: this.template,
            expireType: this.expireType,
            expireAt: this.expireAt,
            maxParticipants: this.maxParticipants,
            status: this.status,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            entries: this.entries
        };
        payload.binaryContent = Buffer.from(JSON.stringify(obj)).toString('base64');
        return payload;
    }

    decode(payload) {
        super.decode(payload);
        this.title = payload.searchableContent;
        if (payload.binaryContent) {
            try {
                let str = Buffer.from(payload.binaryContent, 'base64').toString();
                let obj = JSON.parse(str);
                this.collectionId = obj.collectionId;
                this.groupId = obj.groupId;
                this.creatorId = obj.creatorId;
                this.desc = obj.desc;
                this.template = obj.template;
                this.expireType = obj.expireType;
                this.expireAt = obj.expireAt;
                this.maxParticipants = obj.maxParticipants;
                this.status = obj.status;
                this.createdAt = obj.createdAt;
                this.updatedAt = obj.updatedAt;

                this.entries = [];
                if (obj.entries && Array.isArray(obj.entries)) {
                    obj.entries.forEach(e => {
                        let entry = new CollectionEntry();
                        Object.assign(entry, e);
                        this.entries.push(entry);
                    });
                }
            } catch (e) {
                console.error("Decode collection message error", e);
            }
        }
    }
}