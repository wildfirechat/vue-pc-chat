<template>
    <div class="pan-share-mask" @click.self="$emit('close')">
        <div class="pan-share">
            <div class="pan-share-title">
                <span>分享「{{ file.name }}」</span>
                <i class="icon-ion-ios-close" @click="$emit('close')"></i>
            </div>
            <div class="pan-share-body">
                <div v-if="loading" class="pan-share-hint">加载中…</div>
                <div v-else-if="shares.length === 0" class="pan-share-hint">还没有分享给任何人</div>
                <div v-else class="pan-share-list">
                    <div v-for="s in shares" :key="s.id" class="pan-share-row">
                        <div class="pan-share-avatar">
                            <img v-if="s.targetPortrait" :src="s.targetPortrait" alt=""/>
                            <span v-else>{{ s.isGroup ? '群' : (s.targetName || '?').slice(0, 1) }}</span>
                        </div>
                        <div class="pan-share-info">
                            <div class="pan-share-name">{{ s.targetName || s.targetId }}</div>
                            <div class="pan-share-meta">{{ s.isGroup ? '群聊' : '成员' }} · {{ s.createdByName }} 分享于 {{ formatPanTime(s.createdAt) }}</div>
                        </div>
                        <select :value="s.permission" @change="changePermission(s, $event.target.value)">
                            <option value="VIEW">可查看</option>
                            <option value="EDIT">可编辑</option>
                        </select>
                        <button class="link danger" @click="remove(s)">移除</button>
                    </div>
                </div>
            </div>
            <div class="pan-share-footer">
                <select v-model="newPermission">
                    <option value="VIEW">可查看</option>
                    <option value="EDIT">可编辑</option>
                </select>
                <button @click="addUser">添加成员</button>
                <button @click="addGroup">添加群</button>
            </div>
        </div>

        <div v-if="groupPickerVisible" class="pan-group-mask" @click.self="groupPickerVisible = false">
            <div class="pan-group-panel">
                <div class="pan-group-title">选择群聊</div>
                <div class="pan-group-list">
                    <label v-for="g in groups" :key="g.target" class="pan-group-item">
                        <input type="checkbox" :value="g.target" v-model="checkedGroups">
                        <span>{{ g.name || g.target }}</span>
                    </label>
                </div>
                <div class="pan-group-footer">
                    <button @click="groupPickerVisible = false">取消</button>
                    <button class="primary" @click="confirmGroupPicker">确定</button>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import panApi from "../../api/panApi";
import wfc from "../../wfc/client/wfc";
import {normalizeShare, formatPanTime, panFailMessage} from "./panUtil";

export default {
    name: "PanShareDialog",
    props: {
        file: {type: Object, required: true},
    },
    data() {
        return {
            shares: [],
            loading: false,
            newPermission: 'VIEW',
            groupPickerVisible: false,
            groups: [],
            checkedGroups: [],
        };
    },
    methods: {
        formatPanTime,
        async load() {
            this.loading = true;
            try {
                const list = await panApi.listShares(this.file.fileId);
                this.shares = (list || []).map(normalizeShare);
            } catch (e) {
                this.$notify({title: '提示', text: panFailMessage('加载分享失败', e), type: 'warn'});
            } finally {
                this.loading = false;
            }
        },
        async addTargets(type, ids) {
            try {
                for (const id of ids) {
                    await panApi.addShare(this.file.fileId, type, id, this.newPermission);
                }
                await this.load();
            } catch (e) {
                this.$notify({title: '提示', text: panFailMessage('分享失败', e), type: 'warn'});
                await this.load();
            }
        },
        addUser() {
            this.$pickContact({
                title: '选择联系人',
                successCB: (users) => this.addTargets('USER', (users || []).map(u => u.uid)),
                failCB: () => {
                },
            });
        },
        addGroup() {
            const groups = (wfc.getFavGroupList && wfc.getFavGroupList()) || [];
            if (!groups.length) {
                this.$notify({title: '提示', text: '没有可选的群聊', type: 'warn'});
                return;
            }
            this.groups = groups;
            this.checkedGroups = [];
            this.groupPickerVisible = true;
        },
        confirmGroupPicker() {
            this.groupPickerVisible = false;
            if (this.checkedGroups.length) {
                this.addTargets('GROUP', this.checkedGroups.slice());
            }
        },
        async changePermission(s, permission) {
            if (s.permission === permission) {
                return;
            }
            try {
                await panApi.addShare(this.file.fileId, s.targetType, s.targetId, permission);
                await this.load();
            } catch (e) {
                this.$notify({title: '提示', text: panFailMessage('修改权限失败', e), type: 'warn'});
                await this.load();
            }
        },
        remove(s) {
            this.$alert({
                title: '取消分享',
                content: `确定取消对「${s.targetName || s.targetId}」的分享吗？`,
                confirmCallback: async () => {
                    try {
                        await panApi.removeShare(s.id);
                        await this.load();
                    } catch (e) {
                        this.$notify({title: '提示', text: panFailMessage('取消分享失败', e), type: 'warn'});
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
.pan-share-mask {
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

.pan-share {
    width: 560px;
    height: 520px;
    background: var(--background-tertiary);
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 10px 40px var(--background-mask, rgba(0, 0, 0, 0.3));
}

.pan-share-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 18px;
    font-weight: 500;
    border-bottom: 1px solid var(--divider-color, rgba(0, 0, 0, 0.08));
}

.pan-share-title i {
    cursor: pointer;
    color: var(--text-secondary);
}

.pan-share-body {
    flex: 1;
    overflow-y: auto;
}

.pan-share-hint {
    padding: 40px 20px;
    text-align: center;
    color: var(--text-hint);
}

.pan-share-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 18px;
    border-bottom: 1px solid var(--divider-color, rgba(0, 0, 0, 0.04));
}

.pan-share-avatar {
    width: 34px;
    height: 34px;
    border-radius: 6px;
    overflow: hidden;
    background: var(--background-item-placeholder, rgba(0, 0, 0, 0.06));
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.pan-share-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.pan-share-info {
    flex: 1;
    min-width: 0;
}

.pan-share-name {
    font-size: var(--font-size-sm, 13px);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.pan-share-meta {
    font-size: var(--font-size-xs, 11px);
    color: var(--text-hint);
}

.pan-share-row select,
.pan-share-footer select {
    height: 28px;
    border-radius: 6px;
    border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
    background: var(--background-primary);
    color: var(--text-primary);
}

.pan-share-row button.link {
    border: none;
    background: transparent;
    cursor: pointer;
    color: var(--text-secondary);
}

.pan-share-row button.link.danger {
    color: var(--text-danger);
}

.pan-share-footer {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 18px;
    border-top: 1px solid var(--divider-color, rgba(0, 0, 0, 0.08));
}

.pan-share-footer button {
    height: 30px;
    padding: 0 16px;
    border-radius: 6px;
    border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
    background: transparent;
    color: var(--text-primary);
    cursor: pointer;
}

.pan-share-footer button.primary {
    background: var(--accent-color);
    color: var(--text-on-accent);
    border-color: transparent;
}

.pan-group-mask {
    position: fixed;
    left: 0;
    top: 0;
    right: 0;
    bottom: 0;
    background: var(--background-overlay);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10003;
}

.pan-group-panel {
    width: 340px;
    max-height: 70%;
    background: var(--background-tertiary);
    border-radius: 10px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.pan-group-title {
    padding: 12px 16px;
    font-weight: 500;
    border-bottom: 1px solid var(--divider-color, rgba(0, 0, 0, 0.08));
}

.pan-group-list {
    flex: 1;
    overflow-y: auto;
    padding: 4px 0;
}

.pan-group-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    cursor: pointer;
    font-size: var(--font-size-sm, 13px);
}

.pan-group-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 12px 16px;
    border-top: 1px solid var(--divider-color, rgba(0, 0, 0, 0.08));
}

.pan-group-footer button {
    height: 30px;
    padding: 0 16px;
    border-radius: 6px;
    border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
    background: transparent;
    color: var(--text-primary);
    cursor: pointer;
}

.pan-group-footer button.primary {
    background: var(--accent-color);
    color: var(--text-on-accent);
    border-color: transparent;
}
</style>
