import panApi from "../../api/panApi";

/**
 * 网盘 / 在线文档的纯函数工具：VO 归一化、展示名、大小/时间格式化、文件类型。
 * 与 Flutter 参考实现（chat/lib/pan/pan_widgets.dart、pan_service.dart）保持一致。
 */

const SPACE_TYPE_GLOBAL = 'GLOBAL_PUBLIC';
const SPACE_TYPE_USER_PUBLIC = 'USER_PUBLIC';
const SPACE_TYPE_USER_PRIVATE = 'USER_PRIVATE';

function parseSpaceType(type) {
    if (typeof type === 'number') {
        return [SPACE_TYPE_GLOBAL, SPACE_TYPE_USER_PUBLIC, SPACE_TYPE_USER_PRIVATE][type] || SPACE_TYPE_USER_PRIVATE;
    }
    return type || SPACE_TYPE_USER_PRIVATE;
}

export function normalizeSpace(space, selfUserId) {
    if (!space) {
        return null;
    }
    const spaceType = parseSpaceType(space.spaceType);
    const ownerId = space.ownerId || '';
    const canManage = !!space.canManage;
    // 别人公共空间只读；其余（全局/自己的公共/私有）可写
    const isOthersPublic = spaceType === SPACE_TYPE_USER_PUBLIC && ownerId && ownerId !== selfUserId;
    return {
        ...space,
        spaceId: space.spaceId !== undefined ? space.spaceId : space.id,
        spaceType,
        ownerId,
        canManage,
        canWrite: !isOthersPublic,
    };
}

export function normalizeFile(file) {
    if (!file) {
        return null;
    }
    const type = file.type === 'FOLDER' || file.type === 1 ? 'FOLDER' : 'FILE';
    return {
        ...file,
        fileId: file.fileId !== undefined && file.fileId !== null ? file.fileId : file.id,
        type,
        isFolder: type === 'FOLDER',
        childCount: file.childCount || 0,
        size: file.size || 0,
    };
}

export function normalizeShare(share) {
    if (!share) {
        return null;
    }
    return {
        ...share,
        isGroup: share.targetType === 'GROUP',
        canEdit: share.permission === 'EDIT',
    };
}

export function normalizeRecentDoc(entry) {
    if (!entry) {
        return null;
    }
    return {
        ...entry,
        file: normalizeFile(entry.file),
        canEdit: entry.permission === 'EDIT',
    };
}

export function normalizeSharedFile(entry) {
    if (!entry) {
        return null;
    }
    return {
        ...entry,
        file: normalizeFile(entry.file),
        canEdit: entry.permission === 'EDIT',
    };
}

/** 空间展示名；服务端的 name 是固定中文串，这里按类型给出与 App 一致的名称 */
export function panSpaceDisplayName(space, selfUserId) {
    if (!space) {
        return '';
    }
    switch (space.spaceType) {
        case SPACE_TYPE_GLOBAL:
            return '全局公共空间';
        case SPACE_TYPE_USER_PUBLIC:
            return space.ownerId && space.ownerId !== selfUserId ? `${space.name || space.ownerId} 的公共空间` : '我的公共空间';
        case SPACE_TYPE_USER_PRIVATE:
            return '我的私有空间';
        default:
            return space.name || '';
    }
}

/** 空间排序：私有 → 公共 → 全局（与 Flutter getVisibleSpaces 一致） */
export function sortSpaces(spaces, selfUserId) {
    const weight = (s) => {
        if (s.spaceType === SPACE_TYPE_USER_PRIVATE) return 0;
        if (s.spaceType === SPACE_TYPE_USER_PUBLIC && s.ownerId === selfUserId) return 1;
        if (s.spaceType === SPACE_TYPE_USER_PUBLIC) return 2;
        return 3;
    };
    return spaces.slice().sort((a, b) => weight(a) - weight(b));
}

export function formatPanSize(bytes) {
    const n = Number(bytes) || 0;
    if (n >= 1024 * 1024 * 1024) {
        return (n / 1024 / 1024 / 1024).toFixed(1) + ' GB';
    }
    if (n >= 1024 * 1024) {
        return (n / 1024 / 1024).toFixed(1) + ' MB';
    }
    if (n >= 1024) {
        return (n / 1024).toFixed(1) + ' KB';
    }
    return n + ' B';
}

export function formatPanTime(value) {
    if (!value) {
        return '';
    }
    let date;
    if (typeof value === 'number') {
        date = new Date(value < 1e12 ? value * 1000 : value);
    } else {
        // 服务端 LocalDateTime 序列化为 '2026-10-01T12:00:00'
        date = new Date(String(value).replace(' ', 'T'));
    }
    if (isNaN(date.getTime())) {
        return String(value);
    }
    const pad = (n) => (n < 10 ? '0' + n : '' + n);
    const now = new Date();
    const sameYear = date.getFullYear() === now.getFullYear();
    const base = `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    return sameYear ? base : `${date.getFullYear()}-${base}`;
}

const DOC_KINDS = {
    word: ['doc', 'docx', 'docm', 'dot', 'dotx', 'dotm', 'odt', 'ott', 'rtf', 'txt', 'wps', 'wpt', 'fodt', 'mht', 'mhtml', 'htm', 'html', 'epub', 'fb2'],
    cell: ['xls', 'xlsx', 'xlsm', 'xlt', 'xltx', 'xltm', 'xlsb', 'ods', 'ots', 'csv', 'et', 'ett', 'fods'],
    slide: ['ppt', 'pptx', 'pptm', 'pot', 'potx', 'potm', 'pps', 'ppsx', 'ppsm', 'odp', 'otp', 'dps', 'dpt', 'fodp'],
    pdf: ['pdf', 'djvu', 'xps', 'oxps'],
};

export function panFileExtension(name) {
    if (!name) {
        return '';
    }
    const idx = name.lastIndexOf('.');
    return idx > 0 && idx < name.length - 1 ? name.substring(idx + 1).toLowerCase() : '';
}

export function panFileKind(name) {
    const ext = panFileExtension(name);
    for (const kind of Object.keys(DOC_KINDS)) {
        if (DOC_KINDS[kind].includes(ext)) {
            return kind;
        }
    }
    return 'other';
}

/** 文件图标：用仓库已有的 iconfont 图标类 */
export function panFileIconClass(file) {
    if (!file) {
        return 'icon-ion-document';
    }
    if (file.isFolder) {
        return 'icon-ion-ios-folder';
    }
    const ext = panFileExtension(file.name);
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'].includes(ext)) return 'icon-ion-image';
    if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) return 'icon-ion-ios-videocam';
    if (['mp3', 'wav', 'aac', 'flac', 'amr', 'm4a'].includes(ext)) return 'icon-ion-musical-notes';
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'icon-ion-archive';
    if (['exe', 'msi', 'bat', 'apk'].includes(ext)) return 'icon-ion-cube';
    return 'icon-ion-document';
}

/** 能不能用在线文档打开 */
export function panFileCanOpenOnline(file) {
    return !!file && !file.isFolder && panApi.isOnlineDocName(file.name);
}

export function panMimeType(name) {
    const ext = panFileExtension(name);
    const map = {
        doc: 'application/msword',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        xls: 'application/vnd.ms-excel',
        xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ppt: 'application/vnd.ms-powerpoint',
        pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        pdf: 'application/pdf',
        txt: 'text/plain',
        csv: 'text/csv',
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        gif: 'image/gif',
        mp4: 'video/mp4',
        mp3: 'audio/mpeg',
        zip: 'application/zip',
    };
    return map[ext] || 'application/octet-stream';
}

/** 服务端返回的秒/毫秒时间戳统一转成毫秒 */
export function toMillis(value) {
    if (!value) {
        return 0;
    }
    if (typeof value === 'number') {
        return value < 1e12 ? value * 1000 : value;
    }
    const t = new Date(String(value).replace(' ', 'T')).getTime();
    return isNaN(t) ? 0 : t;
}

/** 错误提示：只有服务端明确返回的 code>0 才带上详情，本地错误只给基础文案 */
export function panFailMessage(base, error) {
    const code = error && error.errorCode;
    if (code && code > 0 && error.message) {
        return `${base}: ${error.message}`;
    }
    return base;
}

export {SPACE_TYPE_GLOBAL, SPACE_TYPE_USER_PUBLIC, SPACE_TYPE_USER_PRIVATE};
