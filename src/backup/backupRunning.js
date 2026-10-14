// 正在进行的本地备份 / 恢复。PC 设置是独立窗口，备份跑在设置窗口里，关窗就中断了，关之前要先看这里
const running = new Map();

/**
 * @param owner 发起的组件实例
 * @param {'backup'|'restore'|null} kind 为空表示已结束
 */
export function setBackupRunning(owner, kind) {
    if (kind) {
        running.set(owner, kind);
    } else {
        running.delete(owner);
    }
}

/** 正在恢复返回 'restore'，正在备份返回 'backup'，都没有返回 null */
export function runningBackupKind() {
    let kinds = [...running.values()];
    if (kinds.includes('restore')) {
        return 'restore';
    }
    return kinds.length > 0 ? 'backup' : null;
}
