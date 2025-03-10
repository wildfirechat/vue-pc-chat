export default class Profile {
    static VisibleScope_NoLimit = 0
    static VisibleScope_3Days = 1
    static VisibleScope_1Month = 2
    static VisibleScope_6Months = 3

    static UpdateUserProfileType_BackgroundUrl = 0
    static UpdateUserProfileType_StrangerVisibleCount = 1
    static UpdateUserProfileType_VisibleScope = 2

    backgroundUrl
    blackList
    blockList
    strangerVisibleCount
    visibleScope
    updateDt

    toJsonObject () {
        return {
            'bgUrl': this.backgroundUrl,
            'backList': this.blackList,
            'blockList': this.blockList,
            'svc': this.strangerVisibleCount,
            'visiableScope': this.visibleScope,
            'updateDt': this.updateDt,
        }
    }

    fromJsonObject (obj) {
        this.backgroundUrl = obj.bgUrl
        this.blackList = obj.backList
        this.blockList = obj.blockList
        this.strangerVisibleCount = obj.svc
        this.visibleScope = obj.visiableScope
        this.updateDt = obj.updateDt
    }
}
