/**
 * 剩余时间：已结束 / 已过期 / 还剩 N 天 / 还剩 N 小时 / 还剩 N 分钟；没设截止时间返回空串。
 * @param vm 用它的 $t
 * @param {{status: number, endTime: number}} poll 投票，或投票消息的内容
 */
export function pollRemainingText(vm, {status, endTime}) {
    if (status === 1) {
        return vm.$t('poll.poll_ended');
    }
    if (!endTime || endTime <= 0) {
        return '';
    }
    let remaining = endTime - Date.now();
    if (remaining <= 0) {
        return vm.$t('poll.poll_expired');
    }
    let minutes = Math.floor(remaining / 60000);
    let hours = Math.floor(minutes / 60);
    let days = Math.floor(hours / 24);
    if (days > 0) {
        return vm.$t('poll.days_left', {days});
    }
    if (hours > 0) {
        return vm.$t('poll.hours_left', {hours});
    }
    return vm.$t('poll.minutes_left', {minutes: Math.max(minutes, 1)});
}
