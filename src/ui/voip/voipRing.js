import wfc from "../../wfc/client/wfc";
import UserSettingScope from "../../wfc/client/userSettingScope";

/**
 * 来电是否响铃：用户设置 VoipSilent（多端同步）为空或 '0' 时响，关了「接收语音或视频来电通知」就不响；
 * 呼出的回铃音不受影响（对齐 wf-enterprise-chat CallRingtone.play）。
 */
export function isVoipRingEnabled() {
    try {
        const value = wfc.getUserSetting(UserSettingScope.VoipSilent, '');
        return !value || value === '0';
    } catch (e) {
        return true;
    }
}
