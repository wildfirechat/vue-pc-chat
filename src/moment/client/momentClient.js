// import impl from '../internal/momentClientImpl'
import impl from '../impl/mcimpl.min'
import Feed from '../model/feed'
import FeedEntry from '../model/feedEntry'
import Long from 'long'
import Profile from '../model/profile'

export class MomentClient {

    /**
     * 初始化
     */
    init () {
        impl.init()
    }

    /**
     *
     * @param {string} fileName 可填''
     * @param {file | string} fileOrData 可是node的file类型，或者dataUri
     * @param {function (string)} successCB 成功回调
     * @param {function (number)} failCB 失败回调
     */
    uploadMedia (fileName, fileOrData, successCB, failCB) {
        impl.uploadMedia(fileName, fileOrData, successCB, failCB)
    }

    /**
     * 发feed(朋友圈)
     * @param {number} type 可选值参考{@link FeedContentType}
     * @param {string} text feed的文本内容
     * @param {[FeedEntry]} medias feed的图片信息
     * @param {[string]} toUsers 允许谁看
     * @param {[string]} excludeUsers 不给谁看
     * @param {[string]} mentionedUsers 提醒谁看
     * @param {string} extra
     * @param {function (Long, number)} successCB 成功回调
     * @param {function (number)} failCB 失败回调
     */
    postFeed (type, text, medias, toUsers, excludeUsers, mentionedUsers, extra, successCB, failCB) {
        impl.postFeed(type, text, medias, toUsers, excludeUsers, mentionedUsers, extra, successCB, failCB)
    }

    /**
     * 发feed(朋友圈)
     * @param {Feed} feed 参考{@link Feed}
     * @param {function (number, number)} successCB
     * @param {function (number)} failCB
     */
    postFeedEx (feed, successCB, failCB) {
        impl.postFeedEx(feed, successCB, failCB)
    }

    /**
     *
     * @param {long} feedId feedId
     * @param {function ()} successCB 成功回调
     * @param {function (number)} failCB  失败回调
     */
    deleteFeed (feedId, successCB, failCB) {
        impl.deleteFeed(feedId, successCB, failCB)
    }

    /**
     * 获取单条feed信息
     * @param {Long} feedId feedId
     * @param {function (Feed)} successCB 成功回调
     * @param {function (number)} failCB 失败回调
     */
    getFeed (feedId, successCB, failCB) {
        impl.getFeed(feedId, successCB, failCB)
    }

    /**
     * 批量获取用户的feed
     * @param {Long} fromIndex 开始的那条feed的feedId
     * @param {number} count 获取条数
     * @param {null | string} user null，获取所有用户；否则，获取对应用户
     * @param {function ([Feed])} successCB 成功回调
     * @param {function (number)} failCB 失败回调
     */
    getFeeds (fromIndex, count, user, successCB, failCB) {
        impl.getFeeds(fromIndex, count, user, successCB, failCB)
    }

    /**
     * 评论feed
     * @param {number} type 可选值参数{@link FeedCommentType}
     * @param {Long} feedId 被评论的feed的feedId
     * @param {string} text 评论内容
     * @param {string} replyTo 评论是回复谁
     * @param {string} extra 评论的额外信息
     * @param {function(Long, number)} successCB，回调评论的commentId和时间戳
     * @param {function (number)} failCB 失败回调
     */
    postComment (type, feedId, text, replyTo, extra, successCB, failCB) {
        impl.postComment(type, feedId, text, replyTo, extra, successCB, failCB)
    }

    /**
     * 评论feed
     * @param {Comment} comment
     * @param {function(Long, number)} successCB，回调评论的commentId和时间戳
     * @param {function(number)} failCB
     */
    postCommentEx (comment, successCB, failCB) {
        impl.postCommentEx(comment, successCB, failCB)
    }

    /**
     * 删除评论
     * @param {Long} commentId 被删除的评论的commentId
     * @param {Long} feedId 被删除评论所属feed的feedId
     * @param {function ()} successCB 成功回调
     * @param {function (number)} failCB 失败回调
     */
    deleteComment (commentId, feedId, successCB, failCB) {
        impl.deleteComment(commentId, feedId, successCB, failCB)
    }

    /**
     * 获取用户profile信息
     * @param {string} userId 用户id
     * @param {function (Profile)} successCB 成功回调
     * @param {function (number)} failCB 失败回调
     */
    getUserProfile (userId, successCB, failCB) {
        impl.getUserProfile(userId, successCB, failCB)
    }

    /**
     * 更新用户profile
     * @param {number} updateUserProfileType 可选值参考{@link Profile}
     * @param {string} strValue 字符串类型的值
     * @param {number} intValue int类型的值
     * @param {function ()} successCB
     * @param {function (number)} failCB
     */
    updateUserProfile (updateUserProfileType, strValue, intValue, successCB, failCB) {
        impl.updateUserProfile(updateUserProfileType, strValue, intValue, successCB, failCB)
    }

    /**
     * 更新黑名单、屏蔽列表，分别对应微信朋友圈的不给谁看、不看谁
     * @param {boolean} isBlock 是否是更新屏蔽列表
     * @param {[string]} addList 新增用户id列表
     * @param {[string]} removeList 移除用户id列表
     * @param {function ()} successCB 成功回调
     * @param {function (number)} failCB 失败回调
     */
    updateBlackOrBlockList (isBlock, addList, removeList, successCB, failCB) {
        impl.updateBlackOrBlockList(isBlock, addList, removeList, successCB, failCB)
    }

    /**
     * 获取feed消息 列表
     * @param {Long} fromIndex 本参数暂时无效! 从一条消息开始获取
     * @param {boolean} isNew 是否只获取未读消息
     */
    getFeedMessages (fromIndex, isNew) {
        return impl.getFeedMessages(fromIndex, isNew)
    }

    /**
     * 从远程获取feed消息列表
     * @param {Long} beforeUid
     * @param {number} count
     * @param {function([Message])} successCB
     * @param {function(number)} failCB
     */
    loadRemoteFeedMessages (beforeUid, count, successCB, failCB) {
        impl.loadRemoteFeedMessages(beforeUid, count, successCB, failCB)
    }

    clearUnreadStatus () {
        impl.clearUnreadStatus()
    }

}

const self = new MomentClient()
export default self

