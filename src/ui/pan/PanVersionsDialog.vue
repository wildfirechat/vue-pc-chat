<template>
    <div class="pan-ver-mask" @click.self="$emit('close')">
        <div class="pan-ver">
            <div class="pan-ver-title">
                <span>历史版本「{{ file.name }}」</span>
                <i class="icon-ion-ios-close" @click="$emit('close')"></i>
            </div>
            <div class="pan-ver-body">
                <div v-if="loading" class="pan-ver-hint">加载中…</div>
                <div v-else-if="versions.length === 0" class="pan-ver-hint">暂无历史版本</div>
                <div v-else class="pan-ver-list">
                    <div v-for="v in versions" :key="v.versionNo" class="pan-ver-row">
                        <div class="pan-ver-info">
                            <div class="pan-ver-no">
                                版本 {{ v.versionNo }}
                                <span v-if="v.current" class="pan-ver-current">当前</span>
                            </div>
                            <div class="pan-ver-meta">{{ v.editorName || v.editorId }} · {{ formatPanSize(v.size) }} · {{ formatPanTime(v.createdAt) }}</div>
                        </div>
                        <button v-if="!v.current" @click="download(v)">下载</button>
                        <button v-if="!v.current" class="primary" @click="restore(v)">恢复</button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import panApi from "../../api/panApi";
import {formatPanSize, formatPanTime, panFailMessage} from "./panUtil";
import {isElectron, shell} from "../../platform";

export default {
    name: "PanVersionsDialog",
    props: {
        file: {type: Object, required: true},
    },
    data() {
        return {
            versions: [],
            loading: false,
        };
    },
    methods: {
        formatPanSize,
        formatPanTime,
        async load() {
            this.loading = true;
            try {
                const list = await panApi.listVersions(this.file.fileId);
                this.versions = list || [];
            } catch (e) {
                this.$notify({title: '提示', text: panFailMessage('加载版本失败', e), type: 'warn'});
            } finally {
                this.loading = false;
            }
        },
        async download(v) {
            try {
                const res = await panApi.getDownloadUrl(this.file.fileId, v.versionNo);
                const url = res && res.storageUrl;
                if (url) {
                    if (isElectron()) {
                        shell.openExternal(url);
                    } else {
                        window.open(url, '_blank');
                    }
                }
            } catch (e) {
                this.$notify({title: '提示', text: panFailMessage('获取下载地址失败', e), type: 'warn'});
            }
        },
        restore(v) {
            this.$alert({
                title: '恢复版本',
                content: `确定恢复到版本 ${v.versionNo} 吗？恢复会生成一个新版本。`,
                confirmCallback: async () => {
                    try {
                        await panApi.restoreVersion(this.file.fileId, v.versionNo);
                        this.$notify({title: '提示', text: '已恢复', type: 'success'});
                        await this.load();
                    } catch (e) {
                        this.$notify({title: '提示', text: panFailMessage('恢复失败', e), type: 'warn'});
                    }
                },
            });
        },
    },
    mounted() {
        this.load();
    },
};
</script>

<style scoped>
.pan-ver-mask {
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

.pan-ver {
    width: 520px;
    max-height: 70%;
    background: var(--background-tertiary);
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 10px 40px var(--background-mask, rgba(0, 0, 0, 0.3));
}

.pan-ver-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 18px;
    font-weight: 500;
    border-bottom: 1px solid var(--divider-color, rgba(0, 0, 0, 0.08));
}

.pan-ver-title i {
    cursor: pointer;
    color: var(--text-secondary);
}

.pan-ver-body {
    flex: 1;
    overflow-y: auto;
}

.pan-ver-hint {
    padding: 40px 20px;
    text-align: center;
    color: var(--text-hint);
}

.pan-ver-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 18px;
    border-bottom: 1px solid var(--divider-color, rgba(0, 0, 0, 0.04));
}

.pan-ver-info {
    flex: 1;
    min-width: 0;
}

.pan-ver-no {
    font-size: var(--font-size-sm, 13px);
}

.pan-ver-current {
    margin-left: 8px;
    font-size: 11px;
    color: var(--accent-color);
}

.pan-ver-meta {
    font-size: var(--font-size-xs, 11px);
    color: var(--text-hint);
}

.pan-ver-row button {
    height: 28px;
    padding: 0 12px;
    border-radius: 6px;
    border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
    background: transparent;
    color: var(--text-primary);
    cursor: pointer;
}

.pan-ver-row button.primary {
    background: var(--accent-color);
    color: var(--text-on-accent);
    border-color: transparent;
}
</style>
