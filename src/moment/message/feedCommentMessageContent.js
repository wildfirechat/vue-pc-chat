import MessageContent from '../../wfc/messages/messageContent'
import wfc from '../../wfc/client/wfc'
import MessageContentType from './messageContentType'

export default class FeedCommentMessageContent extends MessageContent {
    feedId
    commentId
    sender
    commentType
    text
    replyTo
    extra
    serverTime

    constructor () {
        super(MessageContentType.MESSAGE_CONTENT_TYPE_COMMENT)
    }

    digest () {
        return null
    }

    encode () {
        let payload = super.encode()
        payload.searchableContent = this.text
        let obj = {
            'feedId': this.feedId,
            'commentId': this.commentId,
            'sender': this.sender,
            'type': this.commentType,
            'text': this.text,
            'replyTo': this.replyTo,
            'extra': this.extra,
            'serverTime': this.serverTime,
        }
        payload.binaryContent = wfc.utf8_to_b64(obj.toString())
        return payload
    }

    decode (payload) {
        super.decode(payload)
        this.text = payload.searchableContent
        let obj = JSON.parse(wfc.b64_to_utf8(payload.binaryContent))
        this.feedId = obj.feedId
        this.commentId = obj.commentId
        this.sender = obj.sender
        this.commentType = obj.type
        this.text = obj.text
        this.replyTo = obj.replyTo
        this.extra = obj.extra
        this.serverTime = obj.serverTime
    }
}
