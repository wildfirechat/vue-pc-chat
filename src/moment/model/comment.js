export default class Comment {
    feedId
    commentId
    sender
    type
    text
    replyTo
    serverTime
    extra

    toJsonObject () {
        return {
            'feedId': this.feedId,
            'commentId': this.commentId,
            'sender': this.sender,
            'type': this.type,
            'text': this.text,
            'replyTo': this.replyTo,
            'serverTime': this.serverTime,
            'extra': this.extra,
        }
    }

    fromJsonObject (obj) {
        this.feedId = obj.feedId
        this.commentId = obj.commentId
        this.sender = obj.sender
        this.type = obj.type
        this.text = obj.text
        this.replyTo = obj.replyTo
        this.serverTime = obj.serverTime
        this.extra = obj.extra

    }
}
