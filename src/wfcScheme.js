export default class WfcScheme {
    static QR_CODE_PREFIX_PC_SESSION = "wildfirechat://pcsession/";
    static QR_CODE_PREFIX_USER = "wildfirechat://user/";
    static QR_CODE_PREFIX_GROUP = "wildfirechat://group/";
    static QR_CODE_PREFIX_CHANNEL = "wildfirechat://channel/";
    static QR_CODE_PREFIX_CONFERENCE = "wildfirechat://conference/";

    /**
     * 群二维码内容：wildfirechat://group/<群ID>?from=<分享人>。
     * 扫码端会把 from 带进加群流程（与 wf-enterprise-chat WfcScheme.buildGroupScheme 一致）
     */
    static buildGroupLink(groupId, source) {
        let link = WfcScheme.QR_CODE_PREFIX_GROUP + groupId;
        if (source) {
            link += '?from=' + source;
        }
        return link;
    }

    static buildConferenceLink(conferenceId, password) {
        let link = WfcScheme.QR_CODE_PREFIX_CONFERENCE + conferenceId;
        if (password) {
            link += '?pwd=' + password
        }
        return link;
    }
}
