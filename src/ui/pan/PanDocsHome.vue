<template>
    <div class="pan-docs">
        <aside class="pan-docs-nav">
            <div class="pan-docs-nav-title">
                <i class="icon-ion-document-text"></i>
                <span>在线文档</span>
            </div>
            <div class="pan-docs-nav-cell" :class="{active: tab === 'recent'}" @click="switchTab('recent')">
                <i class="icon-ion-ios-time"></i><span>最近打开</span>
            </div>
            <div class="pan-docs-nav-cell" :class="{active: tab === 'shared'}" @click="switchTab('shared')">
                <i class="icon-ion-android-people"></i><span>共享给我</span>
            </div>
            <div class="pan-docs-nav-licenses" @click="openLicenses">
                <i class="icon-ion-document"></i><span>开源许可</span>
            </div>
        </aside>

        <section class="pan-docs-main">
            <header class="pan-docs-header">
                <span class="pan-docs-header-title">{{ tab === 'recent' ? '最近打开' : '共享给我' }}</span>
                <div class="pan-docs-actions" v-if="canCreate">
                    <button class="pan-btn primary" @click="showCreateMenu">
                        <i class="icon-ion-android-add"></i> 新建
                    </button>
                    <ul v-if="createMenuVisible" class="pan-docs-create-menu" @mouseleave="createMenuVisible = false">
                        <li @click="create('docx')">Word 文档</li>
                        <li @click="create('xlsx')">Excel 表格</li>
                        <li @click="create('pptx')">PPT 演示</li>
                    </ul>
                </div>
            </header>

            <div class="pan-docs-table-wrap">
                <div v-if="loading" class="pan-status">加载中…</div>
                <div v-else-if="failed" class="pan-status">
                    <span>加载失败</span>
                    <button class="pan-btn" @click="load(tab)">重试</button>
                </div>
                <div v-else-if="entries.length === 0" class="pan-status">
                    {{ tab === 'recent' ? '还没有打开过文档' : '还没有人共享文档给你' }}
                </div>
                <table v-else class="pan-table">
                    <thead>
                    <tr>
                        <th>名称</th>
                        <th class="col-who">{{ tab === 'recent' ? '创建者' : '来源' }}</th>
                        <th class="col-time">{{ tab === 'recent' ? '打开时间' : '分享时间' }}</th>
                        <th class="col-perm">权限</th>
                        <th class="col-op"></th>
                    </tr>
                    </thead>
                    <tbody>
                    <tr v-for="entry in entries" :key="entry.file.fileId" @dblclick="open(entry)">
                        <td>
                            <i class="icon-ion-document-text pan-file-icon"></i>
                            <span class="pan-file-name">{{ entry.file.name }}</span>
                        </td>
                        <td class="col-who">{{ whoText(entry) }}</td>
                        <td class="col-time">{{ timeText(entry) }}</td>
                        <td class="col-perm">
                            <span class="pan-perm" :class="{edit: entry.canEdit}">{{ entry.canEdit ? '可编辑' : '可查看' }}</span>
                        </td>
                        <td class="col-op">
                            <button class="pan-op" @click="open(entry)">打开</button>
                            <button v-if="canShare(entry)" class="pan-op" @click="share(entry)">分享</button>
                            <button v-if="tab === 'recent'" class="pan-op danger" @click="removeRecent(entry)">移除</button>
                        </td>
                    </tr>
                    </tbody>
                </table>
            </div>
        </section>

        <div v-if="nameDialog.visible" class="pan-modal-mask" @click.self="nameDialog.visible = false">
            <div class="pan-modal">
                <div class="pan-modal-title">新建{{ nameDialog.typeLabel }}</div>
                <input ref="nameInput" class="pan-modal-input" v-model="nameDialog.value"
                       @keyup.enter="confirmCreate"/>
                <div class="pan-modal-footer">
                    <button @click="nameDialog.visible = false">取消</button>
                    <button class="primary" @click="confirmCreate">确定</button>
                </div>
            </div>
        </div>

        <PanShareDialog v-if="shareEntry" :file="shareEntry.file" @close="shareEntry = null"/>
    </div>
</template>

<script>
import wfc from "../../wfc/client/wfc";
import panApi from "../../api/panApi";
import {normalizeRecentDoc, normalizeSharedFile, formatPanTime, panFailMessage} from "./panUtil";
import PanShareDialog from "./PanShareDialog.vue";

const CREATE_TYPES = {
    docx: {label: 'Word 文档', defaultName: '未命名文档'},
    xlsx: {label: 'Excel 表格', defaultName: '未命名表格'},
    pptx: {label: 'PPT 演示', defaultName: '未命名演示'},
};

export default {
    name: "PanDocsHome",
    components: {PanShareDialog},
    data() {
        return {
            tab: 'recent',
            entries: [],
            loading: false,
            failed: false,
            canCreate: true,
            createMenuVisible: false,
            nameDialog: {visible: false, typeLabel: '', type: '', value: ''},
            manageableSpaces: new Set(),
            shareEntry: null,
        };
    },
    methods: {
        formatPanTime,
        switchTab(tab) {
            if (this.tab === tab) {
                return;
            }
            this.tab = tab;
            this.load(tab);
        },
        async load(tab = this.tab) {
            this.loading = true;
            this.failed = false;
            this.createMenuVisible = false;
            try {
                if (tab === 'recent') {
                    const list = await panApi.recentDocs();
                    if (this.tab !== 'recent') {
                        return;
                    }
                    this.entries = (list || []).map(normalizeRecentDoc).filter(e => e.file);
                } else {
                    const list = await panApi.sharedWithMe();
                    if (this.tab !== 'shared') {
                        return;
                    }
                    this.entries = (list || []).map(normalizeSharedFile).filter(e => e.file);
                }
            } catch (e) {
                this.failed = this.entries.length === 0;
                console.error('load docs error', e);
            } finally {
                this.loading = false;
            }
        },
        async loadManageableSpaces() {
            try {
                const list = await panApi.getSpaces();
                const selfUserId = wfc.getUserId();
                this.manageableSpaces = new Set((list || [])
                    .filter(s => s.canManage && (s.spaceType !== 'USER_PUBLIC' || s.ownerId === selfUserId))
                    .map(s => (s.spaceId !== undefined ? s.spaceId : s.id)));
            } catch (e) {
                console.error('load manageable spaces error', e);
            }
        },
        whoText(entry) {
            if (this.tab === 'recent') {
                return entry.file.creatorName || entry.file.creatorId || '';
            }
            const sources = entry.sources || [];
            const names = sources.map(s => s.targetType === 'GROUP' ? `群：${s.targetName || ''}` : (s.createdByName || ''));
            return Array.from(new Set(names.filter(Boolean))).join('、');
        },
        timeText(entry) {
            const t = this.tab === 'recent' ? entry.openedAt : entry.sharedAt;
            return formatPanTime(t);
        },
        canShare(entry) {
            return !!entry.file && !entry.file.isFolder && this.manageableSpaces.has(entry.file.spaceId);
        },
        share(entry) {
            this.shareEntry = entry;
        },
        open(entry) {
            this.$eventBus.$emit('pan-doc-open', {
                url: panApi.docOpenUrl(entry.file.fileId),
                title: entry.file.name,
            });
            // 文档页自己会记录「最近打开」，稍后刷新列表
            if (this.tab === 'recent') {
                setTimeout(() => this.load('recent'), 1500);
            }
        },
        openLicenses() {
            this.$eventBus.$emit('pan-doc-open', {
                url: panApi.docLicensesUrl(),
                title: '开源许可',
            });
        },
        showCreateMenu() {
            this.createMenuVisible = !this.createMenuVisible;
        },
        create(type) {
            this.createMenuVisible = false;
            const conf = CREATE_TYPES[type];
            this.nameDialog = {visible: true, typeLabel: conf.label, type, value: conf.defaultName};
            this.$nextTick(() => {
                const input = this.$refs.nameInput;
                if (input) {
                    input.focus();
                    input.select();
                }
            });
        },
        async confirmCreate() {
            const {type, value} = this.nameDialog;
            this.nameDialog.visible = false;
            try {
                const file = await panApi.createDoc(type, (value || '').trim());
                if (file) {
                    const f = {fileId: file.fileId !== undefined ? file.fileId : file.id, name: file.name};
                    this.$eventBus.$emit('pan-doc-open', {url: panApi.docOpenUrl(f.fileId), title: f.name});
                    setTimeout(() => this.load('recent'), 1500);
                }
            } catch (e) {
                this.$notify({title: '提示', text: panFailMessage('新建文档失败', e), type: 'warn'});
            }
        },
        removeRecent(entry) {
            // 只移除最近打开的记录，不删文件
            const before = this.entries.slice();
            this.entries = this.entries.filter(e => e.file.fileId !== entry.file.fileId);
            panApi.removeRecentDoc(entry.file.fileId).catch(e => {
                this.entries = before;
                this.$notify({title: '提示', text: panFailMessage('移除失败', e), type: 'warn'});
            });
        },
    },
    mounted() {
        this.load('recent');
        this.loadManageableSpaces();
    },
};
</script>

<style scoped>
.pan-docs {
    display: flex;
    flex: 1;
    height: 100%;
    min-width: 0;
    background: var(--background-primary);
}

.pan-docs-nav {
    width: 232px;
    min-width: 232px;
    background: var(--background-secondary, var(--background-tertiary));
    border-right: 1px solid var(--divider-color, rgba(0, 0, 0, 0.06));
    display: flex;
    flex-direction: column;
    padding-bottom: 12px;
}

.pan-docs-nav-title {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 16px 16px 12px;
    font-weight: 500;
    font-size: var(--font-size-lg, 15px);
}

.pan-docs-nav-cell {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 16px;
    margin: 2px 8px;
    border-radius: 8px;
    cursor: pointer;
    font-size: var(--font-size-sm, 13px);
}

.pan-docs-nav-cell:hover {
    background: var(--background-item-placeholder, rgba(0, 0, 0, 0.04));
}

.pan-docs-nav-cell.active {
    background: var(--background-item-placeholder, rgba(0, 0, 0, 0.06));
    color: var(--accent-color-active, var(--accent-color));
}

.pan-docs-nav-licenses {
    margin-top: auto;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    cursor: pointer;
    color: var(--text-secondary);
    font-size: var(--font-size-sm, 13px);
}

.pan-docs-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
}

.pan-docs-header {
    display: flex;
    align-items: center;
    height: 52px;
    padding: 0 16px;
    border-bottom: 1px solid var(--divider-color, rgba(0, 0, 0, 0.06));
    position: relative;
}

.pan-docs-header-title {
    flex: 1;
    font-size: var(--font-size-md, 14px);
    font-weight: 500;
}

.pan-docs-actions {
    position: relative;
}

.pan-docs-create-menu {
    position: absolute;
    right: 0;
    top: 36px;
    min-width: 130px;
    background: var(--background-tertiary);
    border-radius: 8px;
    box-shadow: 0 6px 24px var(--background-mask, rgba(0, 0, 0, 0.25));
    list-style: none;
    margin: 0;
    padding: 6px 0;
    z-index: 20;
    font-size: var(--font-size-sm, 13px);
}

.pan-docs-create-menu li {
    padding: 8px 16px;
    cursor: pointer;
}

.pan-docs-create-menu li:hover {
    background: var(--background-item-placeholder, rgba(0, 0, 0, 0.05));
}

.pan-btn {
    height: 32px;
    padding: 0 12px;
    border-radius: 8px;
    border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.1));
    background: transparent;
    color: var(--text-primary);
    cursor: pointer;
    font-size: var(--font-size-sm, 13px);
}

.pan-btn.primary {
    background: var(--accent-color);
    color: var(--text-on-accent);
    border-color: transparent;
}

.pan-docs-table-wrap {
    flex: 1;
    overflow: auto;
}

.pan-table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--font-size-sm, 13px);
}

.pan-table th {
    text-align: left;
    font-weight: 400;
    color: var(--text-hint);
    padding: 8px 12px;
    border-bottom: 1px solid var(--divider-color, rgba(0, 0, 0, 0.06));
    position: sticky;
    top: 0;
    background: var(--background-primary);
}

.pan-table td {
    padding: 8px 12px;
    border-bottom: 1px solid var(--divider-color, rgba(0, 0, 0, 0.04));
    color: var(--text-primary);
}

.pan-table tbody tr:hover {
    background: var(--background-item-placeholder, rgba(0, 0, 0, 0.04));
}

.col-who {
    width: 150px;
}

.col-time {
    width: 140px;
}

.col-perm {
    width: 80px;
}

.col-op {
    width: 200px;
    text-align: right;
}

.pan-file-icon {
    font-size: 18px;
    margin-right: 8px;
    vertical-align: -2px;
    color: var(--accent-color);
}

.pan-file-name {
    word-break: break-all;
}

.pan-perm {
    display: inline-block;
    padding: 1px 8px;
    border-radius: 10px;
    font-size: var(--font-size-xs, 11px);
    background: var(--background-item-placeholder, rgba(0, 0, 0, 0.06));
    color: var(--text-secondary);
}

.pan-perm.edit {
    color: var(--accent-color);
}

.pan-op {
    border: none;
    background: transparent;
    cursor: pointer;
    color: var(--text-secondary);
    font-size: var(--font-size-xs, 12px);
    margin-left: 8px;
}

.pan-op:hover {
    color: var(--accent-color);
}

.pan-op.danger:hover {
    color: var(--text-danger);
}

.pan-status {
    padding: 60px 0;
    text-align: center;
    color: var(--text-hint);
}

.pan-status button {
    margin-left: 12px;
}

.pan-modal-mask {
    position: fixed;
    left: 0;
    top: 0;
    right: 0;
    bottom: 0;
    background: var(--background-overlay);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10001;
}

.pan-modal {
    width: 380px;
    background: var(--background-tertiary);
    border-radius: 10px;
    padding: 18px 20px;
    box-shadow: 0 8px 32px var(--background-mask, rgba(0, 0, 0, 0.3));
}

.pan-modal-title {
    font-size: var(--font-size-md, 14px);
    font-weight: 500;
    margin-bottom: 14px;
}

.pan-modal-input {
    width: 100%;
    height: 34px;
    border-radius: 8px;
    border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
    background: var(--background-primary);
    color: var(--text-primary);
    padding: 0 10px;
    box-sizing: border-box;
}

.pan-modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 18px;
}

.pan-modal-footer button {
    height: 30px;
    padding: 0 16px;
    border-radius: 6px;
    border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
    background: transparent;
    color: var(--text-primary);
    cursor: pointer;
}

.pan-modal-footer button.primary {
    background: var(--accent-color);
    color: var(--text-on-accent);
    border-color: transparent;
}
</style>
