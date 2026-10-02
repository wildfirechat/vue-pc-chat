<template>
    <div v-if="visible" class="pan-doc-panel" :class="{'window-mode': windowMode}">
        <div class="pan-doc-frame">
            <div class="pan-doc-titlebar">
                <div class="pan-doc-tabs" v-if="!windowMode">
                    <div v-for="tab in tabs" :key="tab.id"
                         class="pan-doc-tab"
                         :class="{active: tab.id === activeId}"
                         @click="selectTab(tab.id)"
                         :title="tab.title || tab.url">
                        <span class="pan-doc-tab-title">{{ tab.title || '在线文档' }}</span>
                        <i class="icon-ion-ios-close pan-doc-tab-close" @click.stop="closeTab(tab.id)"></i>
                    </div>
                </div>
                <div class="pan-doc-header">
                    <!-- 独立窗口里没有标签页，标题要单独显示，免得只看到一条工具条 -->
                    <span v-if="windowMode && activeTab" class="pan-doc-title">{{ activeTab.title || '在线文档' }}</span>
                    <span v-if="activeTab && activeTab.loading" class="pan-doc-loading-text">正在加载…</span>
                    <span v-else-if="activeTab && activeTab.loadError" class="pan-doc-loading-text">{{ activeTab.loadError }}</span>
                    <span v-if="activeTab && activeTab.subtitle" class="pan-doc-subtitle">{{ activeTab.subtitle }}</span>
                    <button v-for="action in (activeTab ? activeTab.actions : [])" :key="action.id"
                            class="pan-doc-action"
                            :class="{primary: action.primary}"
                            @click="onHeaderAction(activeTab, action)">
                        {{ action.text }}
                    </button>
                    <i class="icon-ion-android-refresh pan-doc-tool" title="刷新" @click="reloadActive"></i>
                    <i v-if="windowMode && isElectron" class="icon-ion-android-open-in-browser pan-doc-tool"
                       title="用浏览器打开" @click="openInBrowser"></i>
                    <i class="icon-ion-ios-close pan-doc-tool" title="关闭" @click="close"></i>
                </div>
            </div>
            <div class="pan-doc-body">
                <template v-for="tab in tabs" :key="tab.id">
                    <webview v-if="useWebview"
                             v-show="tab.id === activeId"
                             :ref="'webview-' + tab.id"
                             :src="tab.src"
                             :preload="webviewPreload"
                             :allowpopups="true"
                             :nodeintegration="true"
                             webpreferences="nodeIntegration=true, contextIsolation=false"
                             class="pan-doc-webview"
                             @ipc-message="onIpcMessage($event, tab)"
                             @dom-ready="onWebviewReady(tab)"
                             @console-message="onWebviewConsole($event, tab)"
                             @did-fail-load="onWebviewFail($event, tab)"
                             @page-title-updated="onPageTitleUpdated($event, tab)">
                    </webview>
                    <iframe v-else-if="tab.src"
                            v-show="tab.id === activeId"
                            :ref="'iframe-' + tab.id"
                            :src="tab.src"
                            class="pan-doc-webview"
                            allow="clipboard-read; clipboard-write"
                            @load="onWebviewReady(tab)">
                    </iframe>
                    <!-- 只有主框架真的加载失败才用遮罩；慢（编辑器初始化要十几秒）不挡内容 -->
                    <div v-if="tab.id === activeId && tab.fatalError" class="pan-doc-hint error">
                        <i class="icon-ion-alert-circled"></i>
                        <span>{{ tab.loadError }}</span>
                        <button class="pan-doc-retry" @click="retryTab(tab)">重试</button>
                    </div>
                </template>
            </div>
        </div>

        <!-- 选群（dsbridge chooseGroup / 网页 chooseGroup 共用） -->
        <div v-if="groupPickerVisible" class="pan-pick-mask" @click.self="cancelGroupPicker">
            <div class="pan-pick-panel">
                <div class="pan-pick-title">选择群聊</div>
                <div class="pan-pick-list">
                    <label v-for="g in groups" :key="g.target" class="pan-pick-item">
                        <input type="checkbox" :value="g.target" v-model="checkedGroups">
                        <span>{{ g.name || g.target }}</span>
                    </label>
                    <div v-if="groups.length === 0" class="pan-pick-empty">没有可选的群聊</div>
                </div>
                <div class="pan-pick-footer">
                    <button @click="cancelGroupPicker">取消</button>
                    <button class="primary" @click="confirmGroupPicker">确定</button>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import {reactive} from "vue";
import Config from "../../config";
import wfc from "../../wfc/client/wfc";
import panApi from "../../api/panApi";
import {ipcRenderer, isElectron, shell} from "../../platform";

const MAX_TABS = 8;

export default {
    name: "PanDocPanel",
    props: {
        // 独立窗口模式：占满整个窗口，不显示标签页，关闭按钮直接关窗口
        windowMode: {
            type: Boolean,
            default: false,
        },
    },
    data() {
        return {
            visible: false,
            tabs: [],
            activeId: null,
            seq: 0,
            isElectron: isElectron(),
            groupPickerVisible: false,
            groups: [],
            checkedGroups: [],
            pendingGroupBridge: null,
        };
    },
    computed: {
        activeTab() {
            return this.tabs.find(t => t.id === this.activeId) || null;
        },
        webviewPreload() {
            return this._preloadPath('panDocBridge.js');
        },
        /**
         * 是否用 Electron 的 <webview> 承载文档页。
         * 现在统一用 <iframe>：macOS 上新版系统 + Electron 22 的 <webview>（OOPIF）出现"页面加载正常、
         * 编辑器也渲染了（画布有内容），但窗口里始终一片白"的合成问题；改用 iframe + postMessage 桥
         * 后内容能正常显示（网页端本来就是这套）。留这个开关方便回退。
         */
        useWebview() {
            return false;
        },
    },
    methods: {
        _preloadPath(fileName) {
            const dir = typeof __dirname !== 'undefined' ? __dirname : '';
            if (process.env.NODE_ENV === 'development') {
                // 开发环境直接指向源码目录（与 WorkspacePage 的做法一致）
                const ups = (typeof process !== 'undefined' && process.platform === 'darwin')
                    ? '../../../../../../../../'
                    : '../../../../../../';
                return `file://${dir}/${ups}src/ui/pan/${fileName}`;
            }
            return `file://${dir}/${fileName}`;
        },

        // ------------------------------------------------------------ 打开/关闭
        open(payload) {
            const url = payload && payload.url;
            if (!url) {
                return;
            }
            const title = payload.title;
            const key = this._docKey(url);
            if (this.windowMode) {
                // 独立窗口：一个窗口只放一个文档
                this.tabs = [];
                this.activeId = null;
            }
            const existing = this.tabs.find(t => this._docKey(t.url) === key);
            if (existing) {
                if (title) {
                    existing.title = title;
                }
                this.activeId = existing.id;
                this.visible = true;
                return;
            }
            if (this.tabs.length >= MAX_TABS) {
                const victim = this.tabs.find(t => t.id !== this.activeId) || this.tabs[0];
                this.tabs = this.tabs.filter(t => t !== victim);
            }
            const authParts = this._stripAuthCode(url);
            // 注意：外层 tabs 是响应式数组，这里必须用 reactive 包装：
            // 直接改原始对象（tab.src = xxx）不会触发重新渲染，webview 就永远拿不到 src。
            const tab = reactive({
                id: 'pan-doc-' + (this.seq++),
                url: authParts.cleanUrl,
                src: null,
                title: title || '',
                subtitle: '',
                actions: [],
                headerStub: null,
                authed: false,
                loading: true,
                loadError: '',
                fatalError: false,
                loadTimer: null,
                // 主窗口打开独立窗口时会先把 authCode 拼在地址上带过来
                prefetchedAuthCode: authParts.authCode,
            });
            this.tabs.push(tab);
            this.activeId = tab.id;
            this.visible = true;
            // Electron 和网页版都先取 authCode：放进 URL 的 #panAuthCode= 片段里（页面读完即抹掉，不进服务端日志），
            // 这样文档页不依赖 webview 里的 dsbridge 桥也能登录。取不到时退回桥认证（src 直接用原地址）。
            this.loadAuthCodeInto(tab, url);
        },
        /** 拆出地址里的 #panAuthCode=（主窗口预取时拼上的），返回干净地址和认证码 */
        _stripAuthCode(url) {
            const marker = '#panAuthCode=';
            const index = (url || '').indexOf(marker);
            if (index < 0) {
                return {cleanUrl: url, authCode: null};
            }
            let code = url.substring(index + marker.length);
            try {
                code = decodeURIComponent(code);
            } catch (e) {
                // 保持原样
            }
            return {cleanUrl: url.substring(0, index), authCode: code};
        },
        /**
         * 加载文档地址：取认证码 → 拼在 fragment 上 → 交给 webview/iframe。
         * @param {Object} tab
         * @param {string} [preferredUrl] 主窗口带过来的带认证码的地址，优先直接用
         */
        loadAuthCodeInto(tab, preferredUrl, opts) {
            const url = tab.url;
            const options = opts || {};
            tab.authCode = null;
            tab.authed = false;
            tab.loadError = '';
            tab.fatalError = false;
            tab.loading = true;
            // 编辑器本身要十几秒才能画出来（sdkjs + 字体引擎在本地解析），所以超时给足 60 秒，
            // 而且超时只提示、不遮内容——避免"编辑器已经出来了却被错误提示盖住"。
            clearTimeout(tab.loadTimer);
            tab.loadTimer = setTimeout(() => {
                if (tab.loading) {
                    tab.loading = false;
                    tab.loadError = '编辑器初始化较慢，请稍候';
                    this.logDoc('load slow ' + (tab.url || ''));
                }
            }, 60000);
            // 先指到空白：换文档/刷新时地址可能只差 authCode 片段，直接设置不会真正重新加载
            tab.src = null;
            // 刷新时优先复用打开文档时主窗口带过来的 authCode，省掉一次异步取码
            if (options.preferPrefetched && tab.prefetchedAuthCode) {
                tab.authCode = tab.prefetchedAuthCode;
                tab.authed = true;
                this.$nextTick(() => {
                    tab.src = this._webDocSrc(url, tab.prefetchedAuthCode);
                });
                return Promise.resolve();
            }
            if (preferredUrl && preferredUrl.indexOf('#panAuthCode=') >= 0) {
                tab.authCode = tab.prefetchedAuthCode;
                tab.authed = true;
                this.$nextTick(() => {
                    tab.src = preferredUrl;
                });
                return Promise.resolve();
            }
            return panApi.getAuthCode().then(code => {
                tab.authCode = code;
                tab.authed = true;
                this.$nextTick(() => {
                    tab.src = this._webDocSrc(url, code);
                });
            }).catch(e => {
                console.error('pan doc getAuthCode failed', e);
                // 新窗口里桥不通时，退回主窗口预取的认证码
                const fallback = tab.prefetchedAuthCode;
                if (fallback) {
                    tab.authCode = fallback;
                    tab.authed = true;
                    this.$nextTick(() => {
                        tab.src = this._webDocSrc(url, fallback);
                    });
                    return;
                }
                this.$nextTick(() => {
                    tab.src = url;
                });
            });
        },
        /** 把网页里的日志/错误落到 pan-doc.log，出问题时可以直接看现场 */
        logDoc(line) {
            console.log('[pan-doc]', line);
            if (this.isElectron) {
                try {
                    ipcRenderer.send('pan-doc-log', line);
                } catch (e) {
                    // 记不上就算了，不影响使用
                }
            }
        },
        onWebviewConsole(event, tab) {
            const level = event && event.level;
            const message = (event && event.message) || '';
            if (!message) {
                return;
            }
            // 只记警告/错误和关键日志，避免刷屏
            if (level >= 2 || /error|fail|exception/i.test(message)) {
                this.logDoc('console[' + level + '] ' + message.slice(0, 400) + ' url=' + ((event && event.sourceId) || ''));
            }
        },
        /** webview 的文档结构就绪（编辑器随后还要加载资源，但至少页面出来了） */
        onWebviewReady(tab) {
            tab.loading = false;
            if (!tab.fatalError) {
                tab.loadError = '';
            }
            clearTimeout(tab.loadTimer);
            this.logDoc('dom-ready ' + (tab.url || ''));
        },
        /** 主框架加载失败：把错误码显示出来，别只留一个空白窗口 */
        onWebviewFail(event, tab) {
            const code = event && event.errorCode;
            // -3 是主动中断（换地址/关闭），不用报错
            if (code === -3) {
                return;
            }
            tab.loading = false;
            clearTimeout(tab.loadTimer);
            const desc = (event && event.errorDescription) || '未知错误';
            tab.loadError = '文档加载失败（' + code + ': ' + desc + '）';
            tab.fatalError = true;
            this.logDoc('did-fail-load ' + code + ' ' + desc + ' ' + ((event && event.validatedURL) || ''));
        },
        /** 兜底：按同样的地址用系统默认浏览器打开（网页里编辑器渲染正常） */
        openInBrowser() {
            const tab = this.activeTab;
            if (tab && tab.src) {
                shell.openExternal(tab.src);
            }
        },
        retryTab(tab) {
            tab.loadError = '';
            tab.fatalError = false;
            this.loadAuthCodeInto(tab, null, {preferPrefetched: true});
        },
        _webDocSrc(url, code) {
            return url + (url.indexOf('#') >= 0 ? '&' : '#') + 'panAuthCode=' + encodeURIComponent(code);
        },
        selectTab(id) {
            this.activeId = id;
        },
        closeTab(id) {
            const index = this.tabs.findIndex(t => t.id === id);
            if (index < 0) {
                return;
            }
            this.tabs.splice(index, 1);
            if (this.tabs.length === 0) {
                this.close();
                return;
            }
            if (this.activeId === id) {
                this.activeId = this.tabs[Math.max(0, index - 1)].id;
            }
        },
        close() {
            if (this.windowMode) {
                // 独立窗口：关掉整个窗口
                window.close();
                return;
            }
            this.visible = false;
            this.tabs = [];
            this.activeId = null;
        },
        reloadActive() {
            const tab = this.activeTab;
            if (!tab) {
                return;
            }
            if (this.isElectron) {
                // 直接让 webview reload 最可靠（改 src 时同地址不一定触发导航）；
                // 页面自己会用会话 Cookie，必要时再通过桥取新的 authCode。
                const el = this.$refs['webview-' + tab.id];
                const view = Array.isArray(el) ? el[0] : el;
                if (view && view.reload) {
                    tab.loading = true;
                    tab.loadError = '';
                    tab.fatalError = false;
                    clearTimeout(tab.loadTimer);
                    tab.loadTimer = setTimeout(() => {
                        if (tab.loading) {
                            tab.loading = false;
                            tab.loadError = '编辑器初始化较慢，请稍候';
                        }
                    }, 60000);
                    this.logDoc('reload ' + (tab.url || ''));
                    view.reload();
                    return;
                }
            }
            this.loadAuthCodeInto(tab, null, {preferPrefetched: true});
        },
        _docKey(url) {
            try {
                const u = new URL(url);
                return u.pathname + '?' + u.search;
            } catch (e) {
                return url;
            }
        },
        onPageTitleUpdated(e, tab) {
            if (!tab.title && e && e.title) {
                tab.title = e.title;
            }
        },
        onHeaderAction(tab, action) {
            if (this.isElectron) {
                const el = this.$refs['webview-' + tab.id];
                const view = Array.isArray(el) ? el[0] : el;
                if (view && view.send && tab.headerStub) {
                    view.send('pan-doc-bridge-host', {kind: 'notify', stub: tab.headerStub, data: action.id});
                }
            }
        },

        // ------------------------------------------------------------ dsbridge（Electron webview）
        onIpcMessage(event, tab) {
            if (event.channel !== 'pan-doc-bridge') {
                return;
            }
            const message = event.args && event.args[0];
            if (!message) {
                return;
            }
            this.handleBridgeCall(tab, message, (result) => {
                const el = this.$refs['webview-' + tab.id];
                const view = Array.isArray(el) ? el[0] : el;
                if (view && view.send) {
                    view.send('pan-doc-bridge-host', {kind: 'reply', id: message.id, result});
                }
            });
        },

        // ------------------------------------------------------------ postMessage（网页 iframe）
        onWindowMessage(event) {
            const message = event.data;
            if (!message || message.__panBridge !== true) {
                return;
            }
            const tab = this.tabs.find(t => this._iframeWindow(t) === event.source);
            if (!tab) {
                return;
            }
            if (message.type === 'reply' || message.type === 'notify') {
                return;
            }
            // type === 'call'
            this.handleBridgeCall(tab, message, (result) => {
                const win = this._iframeWindow(tab);
                if (win) {
                    win.postMessage({
                        __panBridge: true,
                        type: 'reply',
                        id: message.id,
                        code: result.code,
                        data: result.data,
                    }, '*');
                }
            });
        },
        _iframeWindow(tab) {
            const el = this.$refs['iframe-' + tab.id];
            const frame = Array.isArray(el) ? el[0] : el;
            return frame && frame.contentWindow;
        },

        // ------------------------------------------------------------ 桥方法实现
        handleBridgeCall(tab, message, reply) {
            const method = message.method;
            const data = message.data;
            switch (method) {
                case 'getAuthCode': {
                    const host = Config.getPanServer().replace(/^https?:\/\//, '').split('/')[0];
                    wfc.getAuthCode('admin', 2, host,
                        code => reply({code: 0, data: code}),
                        err => reply({code: err || -1}));
                    break;
                }
                case 'setPageHeader': {
                    tab.headerStub = message.stub || null;
                    if (data) {
                        if (data.title) {
                            tab.title = data.title;
                        }
                        tab.subtitle = data.subtitle || '';
                        tab.actions = data.actions || [];
                    }
                    break;
                }
                case 'openUrl': {
                    const url = typeof data === 'string' ? data : (data && data.url);
                    if (url) {
                        if (panApi.isDocUrl(url)) {
                            this.open({url, title: data && data.name});
                        } else {
                            shell.openExternal(url);
                        }
                    }
                    break;
                }
                case 'downloadFile': {
                    const url = typeof data === 'string' ? data : (data && data.url);
                    if (url) {
                        // 内置网页里打开下载地址只会白屏，交给系统（默认浏览器）
                        shell.openExternal(url);
                    }
                    break;
                }
                case 'chooseContacts': {
                    this.$pickContact({
                        title: '选择联系人',
                        successCB: (users) => {
                            const list = (users || []).map(u => ({
                                uid: u.uid,
                                name: u.name || u.displayName || u.uid,
                                displayName: u.displayName || u.name || u.uid,
                                portrait: u.portrait || '',
                            }));
                            reply({code: 0, data: JSON.stringify(list)});
                        },
                        failCB: () => reply({code: -1}),
                    });
                    break;
                }
                case 'chooseGroup': {
                    this.pickGroup((groups) => {
                        if (groups) {
                            reply({code: 0, data: JSON.stringify(groups)});
                        } else {
                            reply({code: -1});
                        }
                    });
                    break;
                }
                case 'toast': {
                    this.$notify({title: '提示', text: String(data || ''), type: 'info'});
                    break;
                }
                case 'docReady': {
                    // 编辑器把文档渲染出来了：收掉「正在加载」（data 里带页面侧的渲染自检结果，供排查）
                    tab.loading = false;
                    tab.loadError = '';
                    tab.fatalError = false;
                    clearTimeout(tab.loadTimer);
                    this.logDoc('document-ready ' + (tab.url || '') + ' render=' + JSON.stringify(data || {}));
                    break;
                }
                case 'close': {
                    this.closeTab(tab.id);
                    break;
                }
                default:
                    reply({code: -1});
            }
        },

        // ------------------------------------------------------------ 选群
        pickGroup(cb) {
            this.groups = (wfc.getFavGroupList && wfc.getFavGroupList()) || [];
            this.checkedGroups = [];
            this.pendingGroupBridge = cb;
            this.groupPickerVisible = true;
        },
        cancelGroupPicker() {
            this.groupPickerVisible = false;
            const cb = this.pendingGroupBridge;
            this.pendingGroupBridge = null;
            cb && cb(null);
        },
        confirmGroupPicker() {
            const selected = this.groups.filter(g => this.checkedGroups.includes(g.target));
            this.groupPickerVisible = false;
            const cb = this.pendingGroupBridge;
            this.pendingGroupBridge = null;
            cb && cb(selected.map(g => ({gid: g.target, name: g.name || g.target, portrait: g.portrait || ''})));
        },
    },
    mounted() {
        this.$eventBus.$on('pan-doc-open', this.open);
        window.addEventListener('message', this.onWindowMessage);
    },
    unmounted() {
        this.$eventBus.$off('pan-doc-open', this.open);
        window.removeEventListener('message', this.onWindowMessage);
    },
};
</script>

<style scoped>
.pan-doc-panel {
    position: absolute;
    left: 0;
    top: 0;
    right: 0;
    bottom: 0;
    z-index: 9997;
    background: var(--background-overlay);
    display: flex;
    align-items: center;
    justify-content: center;
}

.pan-doc-frame {
    width: 96%;
    height: 94%;
    background: var(--background-tertiary);
    border-radius: var(--radius-lg, 12px);
    box-shadow: 0 12px 48px var(--background-mask, rgba(0, 0, 0, 0.4));
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

/* 独立窗口模式：铺满整个窗口，去掉遮罩和圆角 */
.pan-doc-panel.window-mode {
    /* 父容器是 flex + align-items/justify-content: center，不给尺寸的话会被压成内容大小（webview 就没了） */
    position: static;
    width: 100%;
    height: 100%;
    background: var(--background-primary);
}

.pan-doc-panel.window-mode .pan-doc-frame {
    width: 100%;
    height: 100%;
    border-radius: 0;
    box-shadow: none;
}

.pan-doc-titlebar {
    display: flex;
    align-items: center;
    height: 40px;
    background: var(--background-secondary, var(--background-tertiary));
    border-bottom: 1px solid var(--divider-color, rgba(0, 0, 0, 0.08));
    padding: 0 4px;
    flex-shrink: 0;
}

.pan-doc-tabs {
    display: flex;
    flex: 1;
    overflow-x: auto;
    overflow-y: hidden;
    min-width: 0;
}

.pan-doc-tab {
    display: flex;
    align-items: center;
    max-width: 200px;
    height: 40px;
    padding: 0 8px 0 14px;
    cursor: pointer;
    border-right: 1px solid var(--divider-color, rgba(0, 0, 0, 0.06));
    color: var(--text-secondary);
    font-size: var(--font-size-sm, 13px);
    flex-shrink: 0;
}

.pan-doc-tab.active {
    color: var(--accent-color-active, var(--accent-color));
    background: var(--background-primary);
}

.pan-doc-tab-title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.pan-doc-tab-close {
    margin-left: 6px;
    font-size: 14px;
    opacity: 0.6;
}

.pan-doc-tab-close:hover {
    opacity: 1;
}

.pan-doc-loading-text {
    font-size: var(--font-size-xs);
    color: var(--text-hint);
    margin-right: 8px;
    flex-shrink: 0;
}

.pan-doc-title {
    flex: 1;
    min-width: 0;
    font-size: var(--font-size-base);
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.pan-doc-header {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
}

.pan-doc-subtitle {
    font-size: var(--font-size-xs, 12px);
    color: var(--text-hint);
    max-width: 240px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.pan-doc-action {
    height: 26px;
    padding: 0 12px;
    border-radius: 6px;
    border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
    background: transparent;
    color: var(--text-primary);
    cursor: pointer;
    font-size: var(--font-size-xs, 12px);
}

.pan-doc-action.primary {
    background: var(--accent-color);
    color: var(--text-on-accent);
    border-color: transparent;
}

.pan-doc-tool {
    font-size: 18px;
    color: var(--text-secondary);
    cursor: pointer;
    margin: 0 6px;
}

.pan-doc-tool:hover {
    color: var(--accent-color);
}

.pan-doc-body {
    flex: 1;
    position: relative;
    min-height: 0;
    background: #fff;
}

.pan-doc-webview {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    border: none;
}

.pan-doc-hint {
    position: absolute;
    left: 0;
    right: 0;
    top: 40px;
    bottom: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    background: var(--background-primary);
    color: var(--text-secondary);
    font-size: var(--font-size-base);
    z-index: 5;
}

.pan-doc-hint.error {
    color: var(--text-danger);
}

.pan-doc-retry {
    height: 30px;
    padding: 0 16px;
    border: 1px solid var(--border-primary);
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--text-primary);
    cursor: pointer;
}

.pan-pick-mask {
    position: absolute;
    left: 0;
    top: 0;
    right: 0;
    bottom: 0;
    background: var(--background-overlay);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
}

.pan-pick-panel {
    width: 360px;
    max-height: 70%;
    background: var(--background-tertiary);
    border-radius: 10px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.pan-pick-title {
    padding: 12px 16px;
    font-weight: 500;
    border-bottom: 1px solid var(--divider-color, rgba(0, 0, 0, 0.08));
}

.pan-pick-list {
    flex: 1;
    overflow-y: auto;
    padding: 4px 0;
}

.pan-pick-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    cursor: pointer;
    font-size: var(--font-size-sm, 13px);
}

.pan-pick-empty {
    padding: 24px;
    text-align: center;
    color: var(--text-hint);
}

.pan-pick-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 12px 16px;
    border-top: 1px solid var(--divider-color, rgba(0, 0, 0, 0.08));
}

.pan-pick-footer button {
    height: 30px;
    padding: 0 16px;
    border-radius: 6px;
    border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
    background: transparent;
    cursor: pointer;
    color: var(--text-primary);
}

.pan-pick-footer button.primary {
    background: var(--accent-color);
    color: var(--text-on-accent);
    border-color: transparent;
}
</style>
