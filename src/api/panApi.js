import Config from "../config";
import wfc from "../wfc/client/wfc";
import AppServerError from "./appServerError";
import {getWithAuthToken, postWithAuthToken} from "./appServiceAuth";

/**
 * 网盘 / 在线文档客户端接口。
 *
 * 网盘已并入合并服务 wf-app-server（app-pan 模块）：接口在 `{应用服务}/api/pan/**` 下，
 * 在线文档 H5 页面在应用服务根地址的 `/doc/` 下。
 * 鉴权与接龙 / 投票 / 组织通讯录一致：整个应用服务共用一个 authToken（见 appServiceAuth），响应体取 result。
 * 文档页自己通过桥取 authCode，再调 /doc/session 换 authToken。
 *
 * 关闭网盘（Config.ENABLE_PAN = false）时，所有入口都不应展示（见 Config.isPanEnabled）。
 */
export class PanApi {

    // ---------------------------------------------------------------- 基础

    get enabled() {
        return Config.isPanEnabled();
    }

    get baseUrl() {
        const base = Config.getPanServer();
        if (!base) {
            throw new AppServerError(-1, '网盘服务未配置');
        }
        return base.endsWith('/') ? base.substring(0, base.length - 1) : base;
    }

    /** 在线文档 H5 页面根地址（服务端自带，挂在应用服务根地址下，不在 /api/pan 前缀下），带 /doc/ 尾斜杠 */
    get docBase() {
        return `${Config.getAppServiceAddress()}/doc/`;
    }

    /** 打开网盘文件（编辑/只读由服务端按权限与平台决定） */
    docOpenUrl(fileId) {
        return `${this.docBase}open?fileId=${fileId}`;
    }

    /** 按链接只读打开在线文档：文件不在网盘里（聊天文件消息、外部地址） */
    docViewUrl(url, name) {
        const query = [`url=${encodeURIComponent(url)}`];
        if (name) {
            query.push(`name=${encodeURIComponent(name)}`);
        }
        return `${this.docBase}open?${query.join('&')}`;
    }

    docLicensesUrl() {
        return `${this.docBase}licenses.html`;
    }

    /**
     * 是不是在线文档页面地址：这类页面靠客户端桥取 authCode，必须用内置网页打开。
     * 只认应用服务（主备两个地址）下的 /doc/：打开时会给它带上 authCode，不能放过别的站点。
     */
    isDocUrl(url) {
        if (!url || !this.enabled) {
            return false;
        }
        return [Config.APP_SERVICE_ADDRESS, Config.APP_SERVICE_BACKUP_ADDRESS].some(base => {
            if (!base) {
                return false;
            }
            const b = base.endsWith('/') ? base.substring(0, base.length - 1) : base;
            return url.startsWith(`${b}/doc/`);
        });
    }

    /** 在线文档能打开的格式，与服务端 DocsService 的 WORD/CELL/SLIDE/PDF 四组一致 */
    static ONLINE_DOC_EXTENSIONS = new Set([
        'doc', 'docx', 'docm', 'dot', 'dotx', 'dotm', 'odt', 'ott', 'rtf', 'txt',
        'wps', 'wpt', 'fodt', 'mht', 'mhtml', 'htm', 'html', 'epub', 'fb2',
        'xls', 'xlsx', 'xlsm', 'xlt', 'xltx', 'xltm', 'xlsb', 'ods', 'ots', 'csv',
        'et', 'ett', 'fods',
        'ppt', 'pptx', 'pptm', 'pot', 'potx', 'potm', 'pps', 'ppsx', 'ppsm',
        'odp', 'otp', 'dps', 'dpt', 'fodp',
        'pdf', 'djvu', 'xps', 'oxps',
    ]);

    /** 文件名是不是「在线文档」格式（聊天里的文件消息没有 fileId，只能按扩展名判断） */
    isOnlineDocName(name) {
        if (!name) {
            return false;
        }
        const idx = name.lastIndexOf('.');
        if (idx <= 0 || idx === name.length - 1) {
            return false;
        }
        return PanApi.ONLINE_DOC_EXTENSIONS.has(name.substring(idx + 1).toLowerCase());
    }

    /** 文档页所在的主机（应用服务的 host[:port]），文档页的 authCode 按它取 */
    _host() {
        return new URL(Config.getAppServiceAddress()).host;
    }

    _authCode() {
        const host = this._host();
        return new Promise((resolve, reject) => {
            wfc.getAuthCode('admin', 2, host,
                (code) => resolve(code),
                (err) => reject(new AppServerError(err || -1, '获取 authCode 失败')));
        });
    }

    /** 供文档页宿主使用：拿某台主机的 authCode（网页版 iframe 走 URL fragment 传递） */
    getAuthCode() {
        return this._authCode();
    }

    _post(path, data = {}) {
        return postWithAuthToken(this.baseUrl + path, data);
    }

    _get(path) {
        return getWithAuthToken(this.baseUrl + path);
    }

    // ---------------------------------------------------------------- 空间

    getSpaces() {
        return this._post('/spaces/list');
    }

    getMySpaces() {
        return this._post('/spaces/my');
    }

    getUserPublicSpace(targetUserId) {
        return this._post('/spaces/user/public', {targetUserId});
    }

    getSpaceFiles(spaceId, parentId = 0) {
        return this._post('/spaces/files', {spaceId, parentId: parentId > 0 ? parentId : null});
    }

    checkSpaceWritePermission(spaceId) {
        return this._get('/permission/space/' + spaceId + '/write');
    }

    // ---------------------------------------------------------------- 文件

    createFolder(spaceId, name, parentId = 0) {
        return this._post('/files/folder', {
            spaceId,
            parentId: parentId > 0 ? parentId : null,
            name,
        });
    }

    createFile(params) {
        // params: {spaceId, parentId, name, size, mimeType, md5, storageUrl, copy}
        return this._post('/files', params);
    }

    deleteFile(fileId) {
        return this._post('/files/delete', {fileId});
    }

    renameFile(fileId, newName) {
        return this._post('/files/rename', {fileId, newName});
    }

    moveFile(fileId, targetSpaceId, targetParentId = 0) {
        return this._post('/files/move', {fileId, targetSpaceId, targetParentId});
    }

    copyFile(fileId, targetSpaceId, targetParentId = 0, copy = false) {
        return this._post('/files/copy', {fileId, targetSpaceId, targetParentId, copy});
    }

    getDownloadUrl(fileId, versionNo = null) {
        const params = {fileId};
        if (versionNo) {
            params.versionNo = versionNo;
        }
        return this._post('/files/url', params);
    }

    // ---------------------------------------------------------------- 分享

    listShares(fileId) {
        return this._post('/shares/list', {fileId});
    }

    addShare(fileId, targetType, targetId, permission = 'VIEW') {
        return this._post('/shares/add', {fileId, targetType, targetId, permission});
    }

    removeShare(shareId) {
        return this._post('/shares/remove', {shareId});
    }

    sharedWithMe() {
        return this._post('/shares/with-me');
    }

    // ---------------------------------------------------------------- 版本

    listVersions(fileId) {
        return this._post('/versions/list', {fileId});
    }

    restoreVersion(fileId, versionNo) {
        return this._post('/versions/restore', {fileId, versionNo});
    }

    // ---------------------------------------------------------------- 在线文档

    createDoc(type, name, spaceId = null, parentId = null) {
        const params = {type, name};
        if (spaceId) {
            params.spaceId = spaceId;
        }
        if (parentId) {
            params.parentId = parentId;
        }
        return this._post('/docs/create', params);
    }

    docsEditorConfig(fileId, platform = 'pc', view = false) {
        return this._post('/docs/editor-config', {fileId, platform, view});
    }

    docsViewUrl(url, name, platform = 'pc') {
        return this._post('/docs/view-url', {url, name, platform});
    }

    docsOptions() {
        return this._post('/docs/options');
    }

    recentDocs() {
        return this._post('/docs/recent');
    }

    removeRecentDoc(fileId) {
        return this._post('/docs/recent/remove', {fileId});
    }

    convertDoc(fileId) {
        return this._post('/docs/convert', {fileId});
    }
}

const panApi = new PanApi();
export default panApi;
