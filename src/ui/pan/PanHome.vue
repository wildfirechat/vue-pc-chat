<template>
    <div class="pan-home">
        <!-- 空间列表 -->
        <aside class="pan-nav">
            <div class="pan-nav-title">
                <i class="icon-ion-ios-folder"></i>
                <span>网盘</span>
                <i class="icon-ion-android-refresh pan-nav-refresh" title="刷新" @click="reloadSpaces"></i>
            </div>
            <div v-if="loadingSpaces" class="pan-nav-status">加载中…</div>
            <div v-else-if="spacesError" class="pan-nav-status error">{{ spacesError }}</div>
            <div v-else class="pan-nav-list">
                <div v-for="s in spaces" :key="s.spaceId"
                     class="pan-nav-cell"
                     :class="{active: space && space.spaceId === s.spaceId}"
                     @click="selectSpace(s)">
                    <i class="icon-ion-ios-folder"></i>
                    <div class="pan-nav-cell-body">
                        <div class="pan-nav-cell-name">{{ spaceName(s) }}</div>
                        <div class="pan-nav-cell-meta">{{ s.fileCount || 0 }} 文件 · {{ quotaText(s) }}</div>
                    </div>
                </div>
                <div v-if="spaces.length === 0" class="pan-nav-status">暂无可用空间</div>
            </div>
        </aside>

        <!-- 文件区 -->
        <section class="pan-main">
            <header class="pan-header">
                <div class="pan-breadcrumb">
                    <span v-if="path.length > 0" class="pan-back" @click="goBack" title="返回上级">
                        <i class="icon-ion-ios-arrow-back"></i>
                    </span>
                    <template v-for="(seg, i) in breadcrumb" :key="i">
                        <span v-if="i > 0" class="pan-bc-sep">/</span>
                        <span class="pan-bc-item"
                              :class="{current: i === breadcrumb.length - 1}"
                              @click="onBreadcrumb(i)">{{ seg.name }}</span>
                    </template>
                </div>
                <div class="pan-actions" v-if="space">
                    <button v-if="space.canWrite" class="pan-btn" @click="createFolder">
                        <i class="icon-ion-android-folder"></i> 新建文件夹
                    </button>
                    <button v-if="space.canWrite" class="pan-btn primary" @click="pickUpload">
                        <i class="icon-ion-ios-cloud-upload"></i> 上传
                    </button>
                    <button class="pan-btn" @click="reload">
                        <i class="icon-ion-android-refresh"></i>
                    </button>
                </div>
            </header>

            <div v-if="uploadTask" class="pan-upload-strip">
                <i class="icon-ion-ios-cloud-upload"></i>
                <span class="pan-upload-name">{{ uploadTask.name }}</span>
                <div class="pan-upload-bar">
                    <div class="pan-upload-bar-inner" :style="{width: uploadPercent}"></div>
                </div>
                <span class="pan-upload-pct">{{ uploadPercent }}</span>
                <i class="icon-ion-ios-close pan-upload-cancel" @click="cancelUpload"></i>
            </div>

            <div class="pan-table-wrap"
                 @dragover.prevent="onDragOver"
                 @dragleave="onDragLeave"
                 @drop.prevent="onDrop"
                 :class="{'drag-over': dragOver}">
                <div v-if="loading" class="pan-status">加载中…</div>
                <div v-else-if="loadFailed" class="pan-status">
                    <span>加载失败</span>
                    <button class="pan-btn" @click="reload">重试</button>
                </div>
                <div v-else-if="files.length === 0" class="pan-status">
                    {{ space && space.canWrite ? '空文件夹，点击右上角上传文件或新建文件夹' : '空文件夹' }}
                </div>
                <table v-else class="pan-table">
                    <thead>
                    <tr>
                        <th class="col-name">名称</th>
                        <th class="col-size">大小</th>
                        <th class="col-creator">创建者</th>
                        <th class="col-time">修改时间</th>
                    </tr>
                    </thead>
                    <tbody>
                    <tr v-for="file in files" :key="file.fileId"
                        :class="{'menu-open': menu.visible && menu.file && menu.file.fileId === file.fileId}"
                        @click="openEntry(file)"
                        @contextmenu.prevent="showMenu($event, file)">
                        <td class="col-name">
                            <i class="pan-file-icon" :class="[panFileIconClass(file), {folder: file.isFolder}]"></i>
                            <span class="pan-file-name" :title="file.name">{{ file.name }}</span>
                        </td>
                        <td class="col-size">{{ file.isFolder ? (file.childCount + ' 项') : formatPanSize(file.size) }}</td>
                        <td class="col-creator">{{ file.creatorName || file.creatorId || '' }}</td>
                        <td class="col-time">{{ formatPanTime(file.updatedAt || file.createdAt) }}</td>
                    </tr>
                    </tbody>
                </table>
                <div v-if="dragOver" class="pan-drop-hint">松开以上传到当前目录</div>
            </div>
        </section>

        <!-- 右键菜单 -->
        <div v-if="menu.visible" class="pan-context-mask" @click="hideMenu" @contextmenu.prevent="hideMenu">
            <ul class="pan-context-menu" :style="{left: menu.x + 'px', top: menu.y + 'px'}" @click.stop>
                <li v-if="menu.file && menu.file.isFolder" @click="menuOpen(menu.file)">打开</li>
                <template v-else-if="menu.file">
                    <li v-if="canOpenOnline(menu.file)" @click="menuOpen(menu.file)">在线打开</li>
                    <li @click="download(menu.file)">{{ canOpenOnline(menu.file) ? '下载' : '打开/下载' }}</li>
                    <li @click="openShare(menu.file)">分享</li>
                    <li v-if="space && space.canManage" @click="openDestination('copy', menu.file)">复制到…</li>
                    <li v-if="space && space.canManage" @click="openVersions(menu.file)">历史版本</li>
                </template>
                <template v-if="space && space.canManage">
                    <li class="divider"></li>
                    <li v-if="menu.file && !menu.file.isFolder" @click="duplicate(menu.file)">存一份副本</li>
                    <li @click="rename(menu.file)">重命名</li>
                    <li @click="openDestination('move', menu.file)">移动到…</li>
                    <li class="danger" @click="remove(menu.file)">删除</li>
                </template>
            </ul>
        </div>

        <!-- 新建/重命名 -->
        <div v-if="nameDialog.visible" class="pan-modal-mask" @click.self="cancelNameDialog">
            <div class="pan-modal">
                <div class="pan-modal-title">{{ nameDialog.title }}</div>
                <input ref="nameInput" class="pan-modal-input" v-model="nameDialog.value"
                       :placeholder="nameDialog.placeholder || ''" @keyup.enter="confirmNameDialog"/>
                <div class="pan-modal-footer">
                    <button @click="cancelNameDialog">取消</button>
                    <button class="primary" @click="confirmNameDialog">确定</button>
                </div>
            </div>
        </div>

        <PanDestinationPicker v-if="destination.visible"
                              :file="destination.file"
                              :mode="destination.mode"
                              :current-space-id="space ? space.spaceId : 0"
                              :current-parent-id="currentFolderId"
                              @cancel="destination.visible = false"
                              @confirm="onDestinationConfirm"/>

        <PanShareDialog v-if="shareFile" :file="shareFile" @close="shareFile = null"/>

        <PanVersionsDialog v-if="versionsFile" :file="versionsFile" @close="versionsFile = null"/>

        <input ref="uploadInput" type="file" multiple style="display: none" @change="onUploadInputChange"/>
    </div>
</template>

<script>
import wfc from "../../wfc/client/wfc";
import Config from "../../config";
import panApi from "../../api/panApi";
import {openPanDoc} from "./panDocWindow";
import {isElectron, shell} from "../../platform";
import MessageContentMediaType from "../../wfc/messages/messageContentMediaType";
import {
    normalizeSpace,
    normalizeFile,
    sortSpaces,
    panSpaceDisplayName,
    formatPanSize,
    formatPanTime,
    panFileIconClass,
    panFileCanOpenOnline,
    panMimeType,
    panFailMessage,
} from "./panUtil";
import PanDestinationPicker from "./PanDestinationPicker.vue";
import PanShareDialog from "./PanShareDialog.vue";
import PanVersionsDialog from "./PanVersionsDialog.vue";

export default {
    name: "PanHome",
    components: {PanDestinationPicker, PanShareDialog, PanVersionsDialog},
    data() {
        return {
            selfUserId: wfc.getUserId(),
            spaces: [],
            space: null,
            path: [],
            files: [],
            // 当前 files 属于哪个目录（spaceId/parentId），以及最近一次加载的序号
            filesKey: '',
            loadSeq: 0,
            loading: false,
            loadingSpaces: false,
            loadFailed: false,
            spacesError: '',
            menu: {visible: false, x: 0, y: 0, file: null},
            nameDialog: {visible: false, title: '', value: '', placeholder: '', onConfirm: null},
            destination: {visible: false, mode: 'move', file: null},
            shareFile: null,
            versionsFile: null,
            dragOver: false,
            uploadTask: null,
            // 取消上传时加一，入队时记下当时的值
            uploadGen: 0,
            uploadQueue: [],
            uploadSeq: 0,
        };
    },
    computed: {
        currentFolderId() {
            return this.path.length ? this.path[this.path.length - 1].fileId : 0;
        },
        breadcrumb() {
            if (!this.space) {
                return [];
            }
            return [{name: this.spaceName(this.space)}, ...this.path.map(f => ({name: f.name, file: f}))];
        },
        uploadPercent() {
            if (!this.uploadTask) {
                return '0%';
            }
            return Math.round((this.uploadTask.progress || 0) * 100) + '%';
        },
    },
    methods: {
        formatPanSize,
        formatPanTime,
        panFileIconClass,
        canOpenOnline(file) {
            return panFileCanOpenOnline(file);
        },
        spaceName(s) {
            return panSpaceDisplayName(s, this.selfUserId);
        },
        quotaText(s) {
            return `${formatPanSize(s.usedQuota)} / ${formatPanSize(s.totalQuota)}`;
        },

        async reloadSpaces() {
            if (!Config.isPanEnabled()) {
                return;
            }
            this.loadingSpaces = true;
            this.spacesError = '';
            try {
                const list = await panApi.getSpaces();
                this.spaces = sortSpaces((list || []).map(s => normalizeSpace(s, this.selfUserId)), this.selfUserId);
                const keepId = this.space && this.space.spaceId;
                const next = this.spaces.find(s => s.spaceId === keepId) || this.spaces[0];
                if (next) {
                    if (!this.space || this.space.spaceId !== next.spaceId) {
                        this.path = [];
                    }
                    this.space = next;
                    await this.loadFiles();
                }
            } catch (e) {
                this.spacesError = panFailMessage('网盘空间加载失败', e);
                console.error('load pan spaces error', e);
            } finally {
                this.loadingSpaces = false;
            }
        },

        selectSpace(s) {
            if (this.space && this.space.spaceId === s.spaceId) {
                return;
            }
            this.space = s;
            this.path = [];
            this.loadFiles();
        },

        async loadFiles() {
            if (!this.space) {
                return;
            }
            // 快速进出目录时，先发出的请求可能后回来：只认最后一次
            const seq = ++this.loadSeq;
            this.loading = true;
            this.loadFailed = false;
            const spaceId = this.space.spaceId;
            const parentId = this.currentFolderId;
            const key = spaceId + '/' + parentId;
            try {
                const list = await panApi.getSpaceFiles(spaceId, parentId);
                if (seq !== this.loadSeq) {
                    return;
                }
                const files = (list || []).map(normalizeFile);
                // 文件夹在前，其余保持服务端顺序
                this.files = files.filter(f => f.isFolder).concat(files.filter(f => !f.isFolder));
                this.filesKey = key;
            } catch (e) {
                if (seq !== this.loadSeq) {
                    return;
                }
                // 刷新同一目录失败时保留原列表；换了目录就不能把上一个目录的文件留在新路径下
                if (this.filesKey !== key) {
                    this.files = [];
                    this.filesKey = key;
                }
                this.loadFailed = this.files.length === 0;
                console.error('load pan files error', e);
            } finally {
                if (seq === this.loadSeq) {
                    this.loading = false;
                }
            }
        },

        reload() {
            this.loadFiles();
        },

        goBack() {
            if (this.path.length) {
                this.path.pop();
                this.loadFiles();
            }
        },
        onBreadcrumb(index) {
            // index 0 是空间根，index i 对应 path[i - 1]：保留到被点的那一级
            this.path = this.path.slice(0, index);
            this.loadFiles();
        },
        enterFolder(file) {
            this.path.push(file);
            this.loadFiles();
        },

        openEntry(file) {
            if (file.isFolder) {
                this.enterFolder(file);
                return;
            }
            if (panFileCanOpenOnline(file)) {
                this.openOnline(file);
            } else {
                this.download(file);
            }
        },

        openOnline(file) {
            openPanDoc({
                url: panApi.docOpenUrl(file.fileId),
                title: file.name,
            }, this.$eventBus);
        },

        async download(file) {
            try {
                const res = await panApi.getDownloadUrl(file.fileId);
                const url = res && res.storageUrl;
                if (url) {
                    this.openExternalUrl(url);
                }
            } catch (e) {
                this.$notify({title: '提示', text: panFailMessage('获取下载地址失败', e), type: 'warn'});
            }
        },

        openExternalUrl(url) {
            if (isElectron()) {
                shell.openExternal(url);
            } else {
                window.open(url, '_blank');
            }
        },

        // ---------------------------------------------------------- 右键菜单
        showMenu(event, file) {
            const menuWidth = 180;
            const menuHeight = 240;
            let x = event.clientX;
            let y = event.clientY;
            if (x + menuWidth > window.innerWidth) {
                x = window.innerWidth - menuWidth;
            }
            if (y + menuHeight > window.innerHeight) {
                y = window.innerHeight - menuHeight;
            }
            this.menu = {visible: true, x, y, file};
        },
        hideMenu() {
            this.menu.visible = false;
        },
        menuOpen(file) {
            this.hideMenu();
            this.openEntry(file);
        },

        // ---------------------------------------------------------- 新建 / 重命名
        showNameDialog(title, value, placeholder, onConfirm) {
            this.nameDialog = {visible: true, title, value, placeholder, onConfirm};
            this.$nextTick(() => {
                const input = this.$refs.nameInput;
                if (input) {
                    input.focus();
                    // 重命名时选中主文件名（保留扩展名）
                    const dot = value.lastIndexOf('.');
                    if (dot > 0) {
                        input.setSelectionRange(0, dot);
                    } else {
                        input.select();
                    }
                }
            });
        },
        cancelNameDialog() {
            this.nameDialog.visible = false;
        },
        confirmNameDialog() {
            const value = (this.nameDialog.value || '').trim();
            this.nameDialog.visible = false;
            if (value && this.nameDialog.onConfirm) {
                this.nameDialog.onConfirm(value);
            }
        },
        createFolder() {
            this.showNameDialog('新建文件夹', '', '请输入文件夹名称', async (name) => {
                try {
                    await panApi.createFolder(this.space.spaceId, name, this.currentFolderId);
                    this.$notify({title: '提示', text: '创建成功', type: 'success'});
                    await this.loadFiles();
                } catch (e) {
                    this.$notify({title: '提示', text: panFailMessage('创建文件夹失败', e), type: 'warn'});
                }
            });
        },
        rename(file) {
            this.hideMenu();
            this.showNameDialog('重命名', file.name, '', async (name) => {
                if (name === file.name) {
                    return;
                }
                try {
                    await panApi.renameFile(file.fileId, name);
                    await this.loadFiles();
                } catch (e) {
                    this.$notify({title: '提示', text: panFailMessage('重命名失败', e), type: 'warn'});
                }
            });
        },
        remove(file) {
            this.hideMenu();
            this.$alert({
                title: '删除',
                content: `确定删除「${file.name}」吗？`,
                confirmButtonType: 'danger',
                confirmText: '删除',
                confirmCallback: async () => {
                    try {
                        await panApi.deleteFile(file.fileId);
                        this.$notify({title: '提示', text: '删除成功', type: 'success'});
                        await this.loadFiles();
                    } catch (e) {
                        this.$notify({title: '提示', text: panFailMessage('删除失败', e), type: 'warn'});
                    }
                },
            });
        },
        duplicate(file) {
            this.hideMenu();
            this.destination = {visible: true, mode: 'duplicate', file};
        },
        openDestination(mode, file) {
            this.hideMenu();
            this.destination = {visible: true, mode, file};
        },
        async onDestinationConfirm({spaceId, parentId}) {
            const {mode, file} = this.destination;
            this.destination.visible = false;
            try {
                if (mode === 'move') {
                    await panApi.moveFile(file.fileId, spaceId, parentId);
                } else {
                    await panApi.copyFile(file.fileId, spaceId, parentId, mode === 'duplicate');
                }
                this.$notify({title: '提示', text: '操作成功', type: 'success'});
                await this.loadFiles();
            } catch (e) {
                this.$notify({title: '提示', text: panFailMessage('操作失败', e), type: 'warn'});
            }
        },

        openShare(file) {
            this.hideMenu();
            if (file.isFolder) {
                return;
            }
            this.shareFile = file;
        },
        openVersions(file) {
            this.hideMenu();
            this.versionsFile = file;
        },

        // ---------------------------------------------------------- 上传
        pickUpload() {
            this.$refs.uploadInput && this.$refs.uploadInput.click();
        },
        onUploadInputChange(e) {
            const files = Array.from(e.target.files || []);
            e.target.value = '';
            this.enqueueUpload(files);
        },
        onDragOver() {
            if (this.space && this.space.canWrite) {
                this.dragOver = true;
            }
        },
        onDragLeave() {
            this.dragOver = false;
        },
        onDrop(e) {
            this.dragOver = false;
            if (!this.space || !this.space.canWrite) {
                return;
            }
            const files = Array.from(e.dataTransfer.files || []);
            this.enqueueUpload(files);
        },
        enqueueUpload(files) {
            if (!files.length || !this.space) {
                return;
            }
            // 目标目录在入队时就定下来：上传途中切换目录，剩下的文件仍传到原来的目录
            const spaceId = this.space.spaceId;
            const parentId = this.currentFolderId;
            const gen = this.uploadGen;
            this.uploadQueue.push(...files.map(file => ({file, spaceId, parentId, gen})));
            if (!this.uploadTask) {
                this.processUploadQueue();
            }
        },
        async processUploadQueue() {
            let succeeded = 0;
            let failed = 0;
            let canceled = false;
            while (this.uploadQueue.length) {
                const item = this.uploadQueue.shift();
                this.uploadTask = {name: item.file.name, progress: 0};
                try {
                    if (await this.uploadOne(item)) {
                        succeeded++;
                    } else {
                        canceled = true;
                    }
                } catch (e) {
                    console.error('upload file error', e);
                    failed++;
                }
            }
            this.uploadTask = null;
            if (failed > 0) {
                this.$notify({title: '提示', text: `${succeeded} 个文件上传成功，${failed} 个失败`, type: 'warn'});
            } else if (canceled) {
                this.$notify({title: '提示', text: '已取消上传', type: 'info'});
            } else {
                this.$notify({title: '提示', text: '上传成功', type: 'success'});
            }
            await this.loadFiles();
        },
        /** 上传一个文件并在网盘里建出来；上传期间被取消则不建，返回 false */
        uploadOne({file, spaceId, parentId, gen}) {
            return new Promise((resolve, reject) => {
                wfc.uploadMedia(file.name, file, MessageContentMediaType.PAN,
                    async (storageUrl) => {
                        // 传输本身中断不了，只能在传完后不再建文件
                        if (gen !== this.uploadGen) {
                            resolve(false);
                            return;
                        }
                        try {
                            await panApi.createFile({
                                spaceId,
                                parentId: parentId > 0 ? parentId : null,
                                name: file.name,
                                size: file.size,
                                mimeType: file.type || panMimeType(file.name),
                                storageUrl,
                                copy: false,
                            });
                            resolve(true);
                        } catch (e) {
                            reject(e);
                        }
                    },
                    (errCode) => reject(new Error('上传失败: ' + errCode)),
                    (sent, total) => {
                        if (this.uploadTask) {
                            this.uploadTask.progress = total > 0 ? sent / total : 0;
                        }
                    });
            });
        },
        cancelUpload() {
            // 换一代：已排队的清掉，正在传的那个传完后也不再建文件
            this.uploadGen++;
            this.uploadQueue = [];
        },
    },
    mounted() {
        this.reloadSpaces();
    },
};
</script>

<style scoped>
.pan-home {
    display: flex;
    flex: 1;
    height: 100%;
    min-width: 0;
    background: var(--background-primary);
}

.pan-nav {
    width: 232px;
    min-width: 232px;
    background: var(--background-secondary, var(--background-tertiary));
    border-right: 1px solid var(--divider-color, rgba(0, 0, 0, 0.06));
    display: flex;
    flex-direction: column;
    overflow-y: auto;
}

.pan-nav-title {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 16px 16px 12px;
    font-weight: 500;
    font-size: var(--font-size-lg, 15px);
}

.pan-nav-refresh {
    margin-left: auto;
    cursor: pointer;
    color: var(--text-secondary);
}

.pan-nav-cell {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 16px;
    cursor: pointer;
    border-radius: 8px;
    margin: 2px 8px;
}

.pan-nav-cell:hover {
    background: var(--background-item-placeholder, rgba(0, 0, 0, 0.04));
}

.pan-nav-cell.active {
    background: var(--background-item-placeholder, rgba(0, 0, 0, 0.06));
    color: var(--accent-color-active, var(--accent-color));
}

.pan-nav-cell-body {
    min-width: 0;
}

.pan-nav-cell-name {
    font-size: var(--font-size-sm, 13px);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.pan-nav-cell-meta {
    font-size: var(--font-size-xs, 11px);
    color: var(--text-hint);
}

.pan-nav-status {
    padding: 12px 16px;
    color: var(--text-hint);
    font-size: var(--font-size-sm, 13px);
}

.pan-nav-status.error {
    color: var(--text-danger);
}

.pan-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
}

.pan-header {
    display: flex;
    align-items: center;
    height: 52px;
    padding: 0 16px;
    border-bottom: 1px solid var(--divider-color, rgba(0, 0, 0, 0.06));
    flex-shrink: 0;
}

.pan-breadcrumb {
    flex: 1;
    display: flex;
    align-items: center;
    min-width: 0;
    overflow: hidden;
    font-size: var(--font-size-md, 14px);
}

.pan-back {
    cursor: pointer;
    margin-right: 8px;
    color: var(--text-secondary);
}

.pan-bc-sep {
    margin: 0 6px;
    color: var(--text-hint);
}

.pan-bc-item {
    cursor: pointer;
    color: var(--text-secondary);
    white-space: nowrap;
}

.pan-bc-item.current {
    color: var(--text-primary);
    font-weight: 500;
    cursor: default;
}

.pan-actions {
    display: flex;
    gap: 8px;
    flex-shrink: 0;
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

.pan-upload-strip {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 16px;
    background: var(--background-item-placeholder, rgba(0, 0, 0, 0.03));
    font-size: var(--font-size-sm, 13px);
}

.pan-upload-name {
    max-width: 260px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.pan-upload-bar {
    flex: 1;
    height: 4px;
    border-radius: 2px;
    background: var(--divider-color, rgba(0, 0, 0, 0.1));
    overflow: hidden;
}

.pan-upload-bar-inner {
    height: 100%;
    background: var(--accent-color);
    transition: width 0.15s;
}

.pan-upload-cancel {
    cursor: pointer;
    color: var(--text-secondary);
}

.pan-table-wrap {
    flex: 1;
    overflow: auto;
    position: relative;
}

.pan-table-wrap.drag-over {
    outline: 2px dashed var(--accent-color);
    outline-offset: -8px;
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

.pan-table tbody tr {
    cursor: default;
}

.pan-table tbody tr:hover,
.pan-table tbody tr.menu-open {
    background: var(--background-item-placeholder, rgba(0, 0, 0, 0.04));
}

.col-name {
    width: auto;
}

.col-size {
    width: 110px;
}

.col-creator {
    width: 120px;
}

.col-time {
    width: 140px;
}

.pan-file-icon {
    font-size: 18px;
    margin-right: 8px;
    vertical-align: -2px;
    color: var(--text-secondary);
}

.pan-file-icon.folder {
    color: var(--accent-color);
}

.pan-file-name {
    word-break: break-all;
}

.pan-status {
    padding: 60px 0;
    text-align: center;
    color: var(--text-hint);
}

.pan-status button {
    margin-left: 12px;
}

.pan-drop-hint {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    padding: 16px 28px;
    border-radius: 10px;
    background: var(--accent-color);
    color: var(--text-on-accent);
    pointer-events: none;
}

.pan-context-mask {
    position: fixed;
    left: 0;
    top: 0;
    right: 0;
    bottom: 0;
    z-index: 10000;
}

.pan-context-menu {
    position: fixed;
    min-width: 160px;
    background: var(--background-tertiary);
    border-radius: 8px;
    box-shadow: 0 6px 24px var(--background-mask, rgba(0, 0, 0, 0.25));
    padding: 6px 0;
    margin: 0;
    list-style: none;
    font-size: var(--font-size-sm, 13px);
}

.pan-context-menu li {
    padding: 8px 16px;
    cursor: pointer;
    color: var(--text-primary);
}

.pan-context-menu li:hover {
    background: var(--background-item-placeholder, rgba(0, 0, 0, 0.05));
}

.pan-context-menu li.divider {
    height: 1px;
    padding: 0;
    margin: 6px 0;
    background: var(--divider-color, rgba(0, 0, 0, 0.08));
    cursor: default;
}

.pan-context-menu li.danger {
    color: var(--text-danger);
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
