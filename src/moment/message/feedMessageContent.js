import MessageContent from '../../wfc/messages/messageContent'
import wfc from '../../wfc/client/wfc'
import FeedEntry from '../model/feedEntry'
import MessageContentType from './messageContentType'

export default class FeedMessageContent extends MessageContent {
    feedId
    feedType
    text
    medias
    sender
    toUsers
    excludeUsers
    extra

    constructor () {
        super(MessageContentType.MESSAGE_CONTENT_TYPE_FEED)
    }

    digest () {
        return null
    }

    encode () {
        let payload = super.encode()
        payload.searchableContent = this.text
        let obj = {
            't': this.feedType,
            'c': this.text,
            'to': this.toUsers,
            'ex': this.excludeUsers,
            'e': this.extra,
        }
        if (this.medias && this.medias.length > 0) {
            obj.ms = []
            this.medias.forEach(e => {
                obj.ms.push({
                    'm': e.mediaUrl,
                    'w': e.mediaWidth,
                    'h': e.mediaHeight,
                })
            })
        }
        payload.binaryContent = wfc.utf8_to_b64(obj.toString())
        return payload
    }

    decode (payload) {
        super.decode(payload)
        this.text = payload.searchableContent
        let obj = JSON.parse(wfc.b64_to_utf8(payload.binaryContent))
        this.feedType = obj.t
        this.toUsers = obj.to
        this.excludeUsers = obj.ex
        this.extra = obj.e
        if (obj.ms && obj.ms.length > 0) {
            this.medias = []
            obj.ms.forEach(e => {
                let entry = new FeedEntry()
                entry.mediaUrl = e.m
                entry.mediaWidth = e.w
                entry.mediaHeight = e.h
                this.medias.push(entry)
            })
        }
    }
}
