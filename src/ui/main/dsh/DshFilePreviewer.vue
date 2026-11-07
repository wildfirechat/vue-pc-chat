<template>
    <aside class="dsh-file-panel" :style="{ width: width + 'px', flexBasis: width + 'px' }">
        <div class="dsh-file-resizer" @mousedown.prevent="startResize"></div>
        <!-- Windows/Linux：右上角是自绘的最小化/最大化/关闭按钮，先让出一条空白（同时可拖拽窗口），
             否则紧贴窗口顶部的 tab 条会被按钮盖住，点击被按钮吃掉 -->
        <div v-if="reserveWindowControls" class="dsh-file-titlebar-gap"></div>

        <div class="dsh-file-tabbar">
            <div class="dsh-file-tabs-scroll">
                <div v-for="tab in tabs" :key="tab.id"
                     class="dsh-file-tab" :class="{ active: activeTab === tab.id }"
                     :title="tab.path || tab.title"
                     @click="activeTab = tab.id">
                    <span class="dsh-file-tab-title">{{ tab.title }}</span>
                    <button v-if="!tab.fixed" class="dsh-file-tab-close" title="关闭" @click.stop="closeTab(tab)">×</button>
                </div>
            </div>
            <button class="dsh-file-panel-close" title="收起" @click="$emit('close')">×</button>
        </div>

        <div class="dsh-file-body">
            <template v-if="activeTab === 'workspace'">
                <div class="dsh-file-browser-head">
                    <span class="dsh-file-path mono" :title="cwd">{{ cwd || '未绑定工作区' }}</span>
                    <div class="dsh-file-browser-actions">
                        <button class="dsh-file-icon-btn" title="刷新" @click="refreshTree">↻</button>
                        <button v-if="cwd" class="dsh-file-icon-btn" title="在系统中打开目录" @click="openPanelDir">↗</button>
                    </div>
                </div>

                <div v-if="!cwd" class="dsh-file-empty">当前会话未绑定工作区目录。</div>
                <div v-else-if="treeError" class="dsh-file-error">{{ treeError }}</div>
                <div v-else-if="root && root.loading" class="dsh-file-empty">加载中…</div>
                <div v-else class="dsh-file-tree">
                    <div v-for="item in flatTree" :key="item.node.path"
                         class="dsh-file-row"
                         :class="{ dir: item.node.isDir, active: item.node.isDir && item.node.expanded }"
                         :style="{ paddingLeft: (10 + item.depth * 14) + 'px' }"
                         @click="onTreeClick(item.node)">
                        <span class="dsh-file-caret">{{ item.node.isDir ? (item.node.expanded ? '▾' : '▸') : '' }}</span>
                        <i class="dsh-file-icon" :class="item.node.isDir ? 'icon-ion-folder' : 'icon-ion-document-text'"></i>
                        <span class="dsh-file-name">{{ item.node.name }}</span>
                        <span v-if="item.node.loading" class="dsh-file-size">…</span>
                        <span v-else-if="!item.node.isDir" class="dsh-file-size">{{ formatSize(item.node.size) }}</span>
                    </div>
                    <div v-if="root && !root.loading && root.children && root.children.length === 0" class="dsh-file-empty">目录为空</div>
                </div>
            </template>

            <template v-else-if="activeFile">
                <div class="dsh-file-view-head">
                    <span class="dsh-file-path mono" :title="activeFile.path">{{ activeFile.path }}</span>
                    <div class="dsh-file-browser-actions">
                        <button class="dsh-file-icon-btn" title="重新读取" @click="readFile(activeFile)">↻</button>
                        <button class="dsh-file-icon-btn" title="在系统中打开" @click="openInSystem(activeFile)">↗</button>
                    </div>
                </div>

                <div v-if="activeFile.loading" class="dsh-file-empty">加载中…</div>
                <div v-else-if="activeFile.error" class="dsh-file-error">{{ activeFile.error }}</div>
                <div v-else-if="activeFile.fileKind === 'image'" class="dsh-file-image-wrap">
                    <img :src="activeFile.dataUrl" :alt="activeFile.title">
                </div>
                <div v-else-if="activeFile.fileKind === 'binary'" class="dsh-file-empty">
                    二进制文件，无法预览。
                    <button class="dsh-file-link" @click="openInSystem(activeFile)">在系统中打开</button>
                </div>
                <div v-else class="dsh-file-code-wrap">
                    <div v-if="activeFile.truncated" class="dsh-file-note">文件较大，仅显示前 1 MB。</div>
                    <div class="dsh-file-code-scroll">
                        <div v-for="(line, i) in activeFileLines" :key="i" class="dsh-file-code-line">
                            <span class="dsh-file-code-no">{{ i + 1 }}</span>
                            <span class="dsh-file-code-text">{{ line || ' ' }}</span>
                        </div>
                    </div>
                </div>
            </template>

            <div v-else class="dsh-file-empty">文件已关闭。</div>
        </div>
    </aside>
</template>

<script>
import { getAgentPanelDataFor } from '../../util/agentState';
import { getDshDirectory, readDshFile, openDshPath } from '../../../dsh/renderer/dshClient';
import AgentCommandMessageContent from '../../../wfc/messages/agentCommandMessageContent';
import wfc from '../../../wfc/client/wfc';
import store from '../../../store';

const FILE_PANEL_WIDTH_KEY = 'dsh-file-panel-width';
const DEFAULT_WIDTH = 420;

export default {
    name: 'DshFilePreviewer',
    props: {
        conversation: { type: Object, default: null },
        robotId: { type: String, default: '' },
        sessionPath: { type: String, default: '' },
    },
    data() {
        return {
            panel: null,
            width: Number(localStorage.getItem(FILE_PANEL_WIDTH_KEY)) || DEFAULT_WIDTH,
            resizing: false,
            tabs: [{ id: 'workspace', title: '工作区', fixed: true }],
            activeTab: 'workspace',
            root: null,
            treeError: '',
            timer: null,
            _panelRequestKey: '',
        };
    },
    computed: {
        reserveWindowControls() {
            // Windows/Linux 主窗口是无边框的，右上角由 ElectronWindowsControlButtonView 自绘
            // 最小化/最大化/关闭按钮（绝对定位、z-index 9999、高度 30px）。本面板贴着窗口右边，
            // tab 条正好落在按钮下面，点击会被按钮吃掉，所以需要把 tab 条整体下移让开。
            const misc = store.state.misc;
            return !!(misc.isElectron && (misc.isElectronWindowsOrLinux || misc.isOhos));
        },
        cwd() {
            const panelCwd = this.panel && this.panel.cwd;
            return panelCwd || this.sessionPath || '';
        },
        activeFile() {
            const tab = this.tabs.find(t => t.id === this.activeTab);
            return tab && tab.kind === 'file' ? tab : null;
        },
        activeFileLines() {
            const file = this.activeFile;
            if (!file || !file.content) return [];
            return file.content.split('\n');
        },
        flatTree() {
            const out = [];
            const walk = (node, depth) => {
                if (!node) return;
                out.push({ node, depth });
                if (node.isDir && node.expanded && Array.isArray(node.children)) {
                    for (const child of node.children) walk(child, depth + 1);
                }
            };
            if (this.root && Array.isArray(this.root.children)) {
                for (const child of this.root.children) walk(child, 0);
            }
            return out;
        },
    },
    watch: {
        conversation: { immediate: true, handler() { this._panelRequestKey = ''; this.loadPanel(); } },
        robotId() { this._panelRequestKey = ''; this.loadPanel(); },
        cwd: { immediate: true, handler() { this.closeFileTabs(); this.resetTree(); } },
    },
    mounted() {
        this.timer = setInterval(() => this.loadPanel(), 5000);
    },
    beforeUnmount() {
        if (this.timer) clearInterval(this.timer);
        this.stopResize();
    },
    methods: {
        requestPanel() {
            if (!this.conversation || !this.conversation.target) return;
            const key = `${this.conversation.type}-${this.conversation.line}-${this.conversation.target}-${this.robotId || ''}`;
            if (this._panelRequestKey === key) return;
            this._panelRequestKey = key;
            try {
                const content = new AgentCommandMessageContent('query', '', Date.now() % 100000, this.robotId || undefined);
                wfc.sendConversationMessage(this.conversation, content);
            } catch (e) { /* ignore */ }
        },
        async loadPanel() {
            if (!this.conversation || !this.conversation.target) {
                this.panel = null;
                return;
            }
            this.requestPanel();
            try {
                this.panel = await Promise.resolve(getAgentPanelDataFor(this.conversation, this.robotId));
            } catch (e) {
                this.panel = null;
            }
        },
        closeFileTabs() {
            this.tabs = this.tabs.filter(t => t.fixed);
            this.activeTab = 'workspace';
        },
        async resetTree() {
            this.treeError = '';
            if (!this.cwd) {
                this.root = null;
                return;
            }
            const root = {
                name: this.baseName(this.cwd) || this.cwd,
                path: this.cwd,
                isDir: true,
                expanded: true,
                loaded: false,
                loading: false,
                children: [],
            };
            this.root = root;
            await this.loadDir(this.root);
        },
        async loadDir(node) {
            if (!node || !node.isDir || node.loading) return;
            node.loading = true;
            try {
                const list = await getDshDirectory(node.path);
                const entries = Array.isArray(list) ? list : [];
                node.children = entries.map(entry => ({
                    ...entry,
                    expanded: false,
                    loaded: false,
                    loading: false,
                    children: [],
                }));
                node.loaded = true;
            } catch (e) {
                node.children = [];
                node.loaded = true;
                this.treeError = e && e.message ? e.message : String(e);
            } finally {
                node.loading = false;
            }
        },
        async onTreeClick(node) {
            if (!node) return;
            if (!node.isDir) {
                this.openFile(node);
                return;
            }
            if (!node.loaded) {
                await this.loadDir(node);
                node.expanded = true;
            } else {
                node.expanded = !node.expanded;
            }
        },
        openFile(node) {
            if (!node || node.isDir) return;
            const existing = this.tabs.find(t => t.kind === 'file' && t.path === node.path);
            if (existing) {
                this.activeTab = existing.id;
                return;
            }
            const tab = {
                id: `file:${node.path}`,
                title: node.name,
                kind: 'file',
                path: node.path,
                size: node.size || 0,
                loading: true,
                error: '',
                fileKind: '',
                content: '',
                dataUrl: '',
                truncated: false,
            };
            this.tabs.push(tab);
            const stored = this.tabs.find(t => t.id === tab.id) || this.tabs[this.tabs.length - 1];
            this.activeTab = stored.id;
            this.readFile(stored);
        },
        async readFile(tab) {
            if (!tab || !tab.path) return;
            tab.loading = true;
            tab.error = '';
            try {
                const result = await readDshFile(tab.path);
                if (!result || !result.ok) {
                    tab.error = (result && result.error) || '读取失败';
                    return;
                }
                tab.fileKind = result.kind || '';
                tab.content = result.content || '';
                tab.dataUrl = result.dataUrl || '';
                tab.truncated = !!result.truncated;
                tab.size = Number(result.size) || tab.size;
            } catch (e) {
                tab.error = e && e.message ? e.message : String(e);
            } finally {
                tab.loading = false;
            }
        },
        closeTab(tab) {
            if (!tab || tab.fixed) return;
            const index = this.tabs.findIndex(t => t.id === tab.id);
            if (index < 0) return;
            this.tabs.splice(index, 1);
            if (this.activeTab === tab.id) {
                const next = this.tabs[index] || this.tabs[index - 1] || this.tabs[0];
                this.activeTab = next ? next.id : 'workspace';
            }
        },
        refreshTree() {
            this.resetTree();
        },
        async openPanelDir() {
            if (this.cwd) await openDshPath(this.cwd);
        },
        async openInSystem(tab) {
            if (tab && tab.path) await openDshPath(tab.path);
        },
        baseName(value) {
            if (!value) return '';
            const parts = String(value).split(/[\\/]/).filter(Boolean);
            return parts.length ? parts[parts.length - 1] : String(value);
        },
        formatSize(bytes) {
            const n = Number(bytes) || 0;
            if (!n) return '';
            if (n < 1024) return n + ' B';
            if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
            return (n / 1024 / 1024).toFixed(1) + ' MB';
        },
        startResize(e) {
            this.resizing = true;
            this._resizeStartX = e.clientX;
            this._resizeStartWidth = this.width;
            document.addEventListener('mousemove', this.onResize);
            document.addEventListener('mouseup', this.stopResize);
        },
        onResize(e) {
            if (!this.resizing) return;
            const next = this._resizeStartWidth + (this._resizeStartX - e.clientX);
            this.width = Math.max(300, Math.min(900, next));
        },
        stopResize() {
            if (!this.resizing) return;
            this.resizing = false;
            document.removeEventListener('mousemove', this.onResize);
            document.removeEventListener('mouseup', this.stopResize);
            try { localStorage.setItem(FILE_PANEL_WIDTH_KEY, String(this.width)); } catch (e) { /* ignore */ }
        },
    },
};
</script>

<style scoped>
.dsh-file-panel {
    position: relative;
    flex: 0 0 auto;
    min-width: 300px;
    max-width: 900px;
    height: 100%;
    display: flex;
    flex-direction: column;
    border-left: 1px solid var(--border-primary, #e5e6eb);
    background: var(--background-primary, #fff);
    color: var(--text-primary, #1f2329);
    box-sizing: border-box;
}
.dsh-file-resizer {
    position: absolute; left: -3px; top: 0; bottom: 0; width: 6px;
    cursor: col-resize; z-index: 5;
}
.dsh-file-resizer:hover { background: rgba(29, 78, 216, .12); }
.dsh-file-tabbar {
    display: flex; align-items: stretch; flex: 0 0 38px;
    border-bottom: 1px solid var(--border-primary, #e5e6eb);
    background: #f8fafc; min-width: 0;
}
/* Windows/Linux：给自绘的窗口按钮（右上角，高 30px）让出位置，tab 从按钮下方开始 */
.dsh-file-titlebar-gap {
    flex: 0 0 var(--height-titlebar, 30px);
    height: var(--height-titlebar, 30px);
    background: #f8fafc;
    -webkit-app-region: drag;
}
.dsh-file-tabs-scroll {
    display: flex; align-items: stretch; flex: 1 1 auto;
    min-width: 0; overflow-x: auto; overflow-y: hidden;
}
.dsh-file-tabs-scroll::-webkit-scrollbar { height: 3px; }
.dsh-file-tabs-scroll::-webkit-scrollbar-thumb { background: #d7dbe2; border-radius: 3px; }
.dsh-file-tab {
    display: flex; align-items: center; gap: 4px; flex: 0 0 auto;
    max-width: 190px; padding: 0 8px 0 11px; border-right: 1px solid #eceff3;
    color: #6b7280; font-size: 13px; cursor: pointer; user-select: none;
    white-space: nowrap;
}
.dsh-file-tab.active { color: #1f2329; background: #fff; box-shadow: inset 0 -2px 0 #1d4ed8; }
.dsh-file-tab-title { overflow: hidden; text-overflow: ellipsis; }
.dsh-file-tab-close {
    border: 0; background: transparent; color: #9aa0a8; cursor: pointer;
    width: 16px; height: 16px; line-height: 14px; padding: 0; border-radius: 4px;
    font-size: 14px; flex: 0 0 auto;
}
.dsh-file-tab-close:hover { background: #eef1f5; color: #1f2329; }
.dsh-file-panel-close {
    border: 0; border-left: 1px solid #eceff3; background: #f8fafc;
    color: #8a8f99; cursor: pointer; width: 30px; flex: 0 0 30px;
    font-size: 17px; line-height: 1;
}
.dsh-file-panel-close:hover { background: #eef1f5; color: #1f2329; }
.dsh-file-body { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; }
.dsh-file-browser-head, .dsh-file-view-head {
    display: flex; align-items: center; gap: 8px; flex: 0 0 auto;
    padding: 7px 10px; border-bottom: 1px solid #f0f2f5; background: #fcfcfd;
}
.dsh-file-path {
    flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis;
    white-space: nowrap; font-size: 11px; color: #8a8f99;
}
.dsh-file-browser-actions { display: flex; gap: 3px; flex: 0 0 auto; }
.dsh-file-icon-btn {
    border: 1px solid #e5e6eb; background: #fff; color: #6b7280;
    width: 22px; height: 21px; border-radius: 5px; cursor: pointer;
    font-size: 12px; line-height: 18px; padding: 0;
}
.dsh-file-icon-btn:hover { background: #f2f4f7; color: #1f2329; }
.dsh-file-tree { flex: 1 1 auto; min-height: 0; overflow: auto; padding: 4px 0 16px; }
.dsh-file-row {
    display: flex; align-items: center; gap: 5px; height: 28px;
    padding-right: 10px; font-size: 13px; color: #4b5563;
    cursor: pointer; user-select: none;
}
.dsh-file-row:hover { background: #f4f6f9; }
.dsh-file-row.active { color: #1f2329; }
.dsh-file-caret { width: 10px; flex: 0 0 10px; color: #9aa0a8; font-size: 10px; text-align: center; }
.dsh-file-icon { flex: 0 0 auto; font-size: 13px; color: #8a8f99; }
.dsh-file-row.dir .dsh-file-icon { color: #d6a84f; }
.dsh-file-name { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsh-file-size { flex: 0 0 auto; color: #a0a5ad; font-size: 10px; }
.dsh-file-empty, .dsh-file-error {
    flex: 1 1 auto; padding: 24px 16px; font-size: 12px; line-height: 1.55;
    color: #8a8f99; text-align: center;
}
.dsh-file-error { color: #b42318; }
.dsh-file-link { border: 0; background: transparent; color: #1d4ed8; cursor: pointer; padding: 0 3px; font-size: inherit; }
.dsh-file-image-wrap { flex: 1 1 auto; min-height: 0; overflow: auto; padding: 16px; display: flex; align-items: flex-start; justify-content: center; background: #fbfbfc; }
.dsh-file-image-wrap img { max-width: 100%; max-height: 100%; object-fit: contain; box-shadow: 0 2px 12px rgba(15, 23, 42, .08); background: #fff; }
.dsh-file-code-wrap { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; }
.dsh-file-note { flex: 0 0 auto; padding: 5px 10px; font-size: 10px; color: #a16207; background: #fffbeb; border-bottom: 1px solid #f5e6b8; }
.dsh-file-code-scroll { flex: 1 1 auto; min-height: 0; overflow: auto; padding: 6px 0 16px; background: #fff; }
.dsh-file-code-line { display: flex; min-width: max-content; line-height: 18px; font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace; font-size: 11px; }
.dsh-file-code-line:hover { background: #f7f9fc; }
.dsh-file-code-no { flex: 0 0 46px; width: 46px; padding: 0 8px 0 0; text-align: right; color: #b0b5bd; user-select: none; box-sizing: border-box; }
.dsh-file-code-text { flex: 0 0 auto; white-space: pre; color: #334155; padding-right: 16px; }
</style>
