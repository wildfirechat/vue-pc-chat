import FeedEntry from './feedEntry'
import Comment from './comment'

export default class Feed {
    feedId
    sender
    type
    text
    medias
    mentionedUser
    toUsers
    excludeUsers
    serverTime
    comments
    extra

    toJsonObject () {
        let obj = {
            'type': this.type,
            'feedId': this.feedId,
            'sender': this.sender,
            'text': this.text,
            'extra': this.extra,
            'timestamp': this.serverTime,
            'to': this.toUsers,
            'ex': this.excludeUsers,
        }
        if (this.medias && this.medias.length > 0) {
            obj.medias = []
            this.medias.forEach(e => {
                obj.medias.push({
                    'm': e.mediaUrl,
                    'w': e.mediaWidth,
                    'h': e.mediaHeight,
                })
            })
        }

        if (this.comments && this.comments.length > 0) {
            let comments = []
            this.comments.forEach(comment => {
                comments.push(comment.toJsonObject())
            })
            obj.comments = comments.reverse()
        }
        return obj
    }

    fromJsonObject (obj) {
        this.type = obj.type
        this.feedId = obj.feedId
        this.sender = obj.sender
        this.text = obj.text
        this.extra = obj.extra
        this.serverTime = obj.timestamp
        this.toUsers = obj.to
        this.excludeUsers = obj.ex
        if (obj.medias && obj.medias.length > 0) {
            this.medias = []
            obj.medias.forEach(e => {
                let feedEntry = new FeedEntry()
                feedEntry.mediaUrl = e.m
                feedEntry.mediaWidth = e.w
                feedEntry.mediaHeight = e.h
                this.medias.push(feedEntry)
            })
        }

        if (obj.comments && obj.comments.length > 0) {
            this.comments = []
            obj.comments.forEach((c) => {
                let comment = new Comment()
                comment.fromJsonObject(c)
                this.comments.push(comment)
            })
        }
    }
}
