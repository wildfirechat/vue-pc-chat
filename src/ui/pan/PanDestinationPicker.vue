<template>
    <div class="pan-dest-mask" @click.self="$emit('cancel')">
        <div class="pan-dest">
            <div class="pan-dest-title">
                <span>{{ title }}</span>
                <i class="icon-ion-ios-close" @click="$emit('cancel')"></i>
            </div>
            <div class="pan-dest-body">
                <div class="pan-dest-spaces">
                    <div v-for="s in spaces" :key="s.spaceId"
                         class="pan-dest-space"
                         :class="{active: space && space.spaceId === s.spaceId}"
                         @click="enterSpace(s)">
                        <i class="icon-ion-ios-folder"></i>
                        <span>{{ spaceName(s) }}</span>
                    </div>
                    <div v-if="loadingSpaces" class="pan-dest-hint">加载中…</div>
                </div>
                <div class="pan-dest-folders">
                    <div class="pan-dest-crumb">
                        <span class="link" @click="goTo(0)">全部空间</span>
                        <template v-if="space">
                            <span class="sep">/</span>
                            <span class="link" @click="goTo(1)">{{ spaceName(space) }}</span>
                        </template>
                        <template v-for="(f, i) in path" :key="f.fileId">
                            <span class="sep">/</span>
                            <span class="link" @click="goTo(i + 2)">{{ f.name }}</span>
                        </template>
                    </div>
                    <div class="pan-dest-list">
                        <div v-for="f in folders" :key="f.fileId"
                             class="pan-dest-folder"
                             @click="enterFolder(f)">
                            <i class="icon-ion-ios-folder"></i>
                            <span>{{ f.name }}</span>
                        </div>
                        <div v-if="space && folders.length === 0" class="pan-dest-hint">该目录下没有子文件夹</div>
                        <div v-if="!space" class="pan-dest-hint">请选择一个空间</div>
                    </div>
                </div>
            </div>
            <div class="pan-dest-footer">
                <span class="pan-dest-loc">{{ locationText }}</span>
                <button @click="$emit('cancel')">取消</button>
                <button class="primary" :disabled="!canConfirm" @click="confirm">{{ confirmLabel }}</button>
            </div>
        </div>
    </div>
</template>

<script>
import wfc from "../../wfc/client/wfc";
import panApi from "../../api/panApi";
import {normalizeSpace, normalizeFile, sortSpaces, panSpaceDisplayName, panFailMessage} from "./panUtil";

export default {
    name: "PanDestinationPicker",
    props: {
        file: {type: Object, required: true},
        mode: {type: String, default: 'move'},
        currentSpaceId: {type: Number, default: 0},
        currentParentId: {type: Number, default: 0},
    },
    data() {
        return {
            selfUserId: wfc.getUserId(),
            spaces: [],
            space: null,
            path: [],
            folders: [],
            loadingSpaces: false,
        };
    },
    computed: {
        ownSpacesOnly() {
            return this.mode === 'duplicate';
        },
        title() {
            if (this.mode === 'move') return '移动到';
            if (this.mode === 'duplicate') return '存一份副本到';
            return '复制到';
        },
        confirmLabel() {
            if (this.mode === 'move') return '移动';
            if (this.mode === 'duplicate') return '保存';
            return '复制';
        },
        targetParentId() {
            return this.path.length ? this.path[this.path.length - 1].fileId : 0;
        },
        canConfirm() {
            if (!this.space) {
                return false;
            }
            return !(this.space.spaceId === this.currentSpaceId && this.targetParentId === this.currentParentId);
        },
        locationText() {
            if (!this.space) {
                return '';
            }
            const parts = [this.spaceName(this.space), ...this.path.map(f => f.name)];
            return '目标：' + parts.join(' / ');
        },
    },
    methods: {
        spaceName(s) {
            return panSpaceDisplayName(s, this.selfUserId);
        },
        async loadSpaces() {
            this.loadingSpaces = true;
            try {
                const list = await panApi.getSpaces();
                let spaces = (list || []).map(s => normalizeSpace(s, this.selfUserId)).filter(s => s.canWrite);
                if (this.ownSpacesOnly) {
                    spaces = spaces.filter(s => s.spaceType !== 'GLOBAL_PUBLIC');
                }
                this.spaces = sortSpaces(spaces, this.selfUserId);
            } catch (e) {
                this.$notify({title: '提示', text: panFailMessage('加载空间失败', e), type: 'warn'});
            } finally {
                this.loadingSpaces = false;
            }
        },
        enterSpace(s) {
            this.space = s;
            this.path = [];
            this.loadFolders();
        },
        enterFolder(f) {
            // 移动文件夹时，不能移动到它自己里面
            if (this.file && this.file.isFolder && f.fileId === this.file.fileId) {
                this.$notify({title: '提示', text: '不能移动到文件夹自身', type: 'warn'});
                return;
            }
            this.path.push(f);
            this.loadFolders();
        },
        goTo(index) {
            if (index === 0) {
                this.space = null;
                this.path = [];
                this.folders = [];
                return;
            }
            this.path = this.path.slice(0, index - 1);
            this.loadFolders();
        },
        async loadFolders() {
            if (!this.space) {
                return;
            }
            try {
                const list = await panApi.getSpaceFiles(this.space.spaceId, this.targetParentId);
                this.folders = (list || []).map(normalizeFile).filter(f => f.isFolder);
            } catch (e) {
                this.$notify({title: '提示', text: panFailMessage('加载目录失败', e), type: 'warn'});
            }
        },
        confirm() {
            if (!this.canConfirm) {
                return;
            }
            this.$emit('confirm', {spaceId: this.space.spaceId, parentId: this.targetParentId});
        },
    },
    mounted() {
        this.loadSpaces();
    },
};
</script>

<style scoped>
.pan-dest-mask {
    position: fixed;
    left: 0;
    top: 0;
    right: 0;
    bottom: 0;
    background: var(--background-overlay);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10002;
}

.pan-dest {
    width: 560px;
    height: 480px;
    background: var(--background-tertiary);
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 10px 40px var(--background-mask, rgba(0, 0, 0, 0.3));
}

.pan-dest-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 18px;
    font-weight: 500;
    border-bottom: 1px solid var(--divider-color, rgba(0, 0, 0, 0.08));
}

.pan-dest-title i {
    cursor: pointer;
    color: var(--text-secondary);
}

.pan-dest-body {
    flex: 1;
    display: flex;
    min-height: 0;
}

.pan-dest-spaces {
    width: 190px;
    border-right: 1px solid var(--divider-color, rgba(0, 0, 0, 0.06));
    overflow-y: auto;
    padding: 6px;
}

.pan-dest-space {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    border-radius: 6px;
    cursor: pointer;
    font-size: var(--font-size-sm, 13px);
}

.pan-dest-space:hover,
.pan-dest-space.active {
    background: var(--background-item-placeholder, rgba(0, 0, 0, 0.06));
}

.pan-dest-space.active {
    color: var(--accent-color);
}

.pan-dest-folders {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
}

.pan-dest-crumb {
    padding: 10px 14px;
    font-size: var(--font-size-xs, 12px);
    color: var(--text-secondary);
    border-bottom: 1px solid var(--divider-color, rgba(0, 0, 0, 0.05));
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
}

.pan-dest-crumb .link {
    cursor: pointer;
    color: var(--accent-color);
}

.pan-dest-crumb .sep {
    margin: 0 6px;
    color: var(--text-hint);
}

.pan-dest-list {
    flex: 1;
    overflow-y: auto;
    padding: 6px;
}

.pan-dest-folder {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    border-radius: 6px;
    cursor: pointer;
    font-size: var(--font-size-sm, 13px);
}

.pan-dest-folder:hover {
    background: var(--background-item-placeholder, rgba(0, 0, 0, 0.05));
}

.pan-dest-folder i {
    color: var(--accent-color);
}

.pan-dest-hint {
    padding: 20px;
    text-align: center;
    color: var(--text-hint);
    font-size: var(--font-size-sm, 13px);
}

.pan-dest-footer {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 18px;
    border-top: 1px solid var(--divider-color, rgba(0, 0, 0, 0.08));
}

.pan-dest-loc {
    flex: 1;
    font-size: var(--font-size-xs, 12px);
    color: var(--text-hint);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.pan-dest-footer button {
    height: 30px;
    padding: 0 16px;
    border-radius: 6px;
    border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
    background: transparent;
    color: var(--text-primary);
    cursor: pointer;
}

.pan-dest-footer button.primary {
    background: var(--accent-color);
    color: var(--text-on-accent);
    border-color: transparent;
}

.pan-dest-footer button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}
</style>
