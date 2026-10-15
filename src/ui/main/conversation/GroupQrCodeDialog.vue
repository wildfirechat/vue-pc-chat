<template>
    <QrCodeCardDialog :portrait="portrait"
                      :fallback-portrait="defaultPortrait"
                      :title="title"
                      :link="link"
                      hint="扫一扫上面的二维码，加入群聊"
                      :file-name="fileName"/>
</template>

<script>
import wfc from "../../../wfc/client/wfc";
import EventType from "../../../wfc/client/wfcEvent";
import WfcScheme from "../../../wfcScheme";
import Config from "../../../config";
import QrCodeCardDialog from "../../common/QrCodeCardDialog.vue";

/**
 * 群二维码（参考微信）：群头像、群名、二维码，下面转发给朋友 / 复制图片 / 保存图片。
 * 卡片本身见 QrCodeCardDialog，这里只管群信息
 */
export default {
    name: "GroupQrCodeDialog",
    components: {QrCodeCardDialog},
    props: {
        groupId: {
            type: String,
            required: true,
        },
    },
    data() {
        return {
            groupInfo: null,
            defaultPortrait: Config.DEFAULT_GROUP_PORTRAIT_URL,
            link: WfcScheme.buildGroupLink(this.groupId, wfc.getUserId()),
        }
    },
    computed: {
        groupName() {
            return (this.groupInfo && this.groupInfo.name) || '';
        },
        title() {
            return this.groupName ? `群聊：${this.groupName}` : '群聊';
        },
        portrait() {
            return (this.groupInfo && this.groupInfo.portrait) || '';
        },
        fileName() {
            return `群二维码_${this.groupName || this.groupId}.png`;
        },
    },
    created() {
        this.groupInfo = wfc.getGroupInfo(this.groupId, true);
        wfc.eventEmitter.on(EventType.GroupInfosUpdate, this.onGroupInfosUpdate);
    },
    unmounted() {
        wfc.eventEmitter.off(EventType.GroupInfosUpdate, this.onGroupInfosUpdate);
    },
    methods: {
        onGroupInfosUpdate(groupInfos = []) {
            // 群没设头像时用成员头像拼的，成员信息到齐才有；群名也可能刚改
            if (groupInfos.some(g => g.target === this.groupId)) {
                this.groupInfo = wfc.getGroupInfo(this.groupId, false);
            }
        },
    },
}
</script>
