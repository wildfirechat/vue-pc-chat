<template>
    <div class="pan-send">
        <div class="pan-send-title">
            <span>发送云盘文件</span>
            <i class="icon-ion-ios-close" @click="close"></i>
        </div>
        <div class="pan-send-body">
            <div class="pan-send-spaces">
                <div v-for="s in spaces" :key="s.spaceId" class="pan-send-space"
                     :class="{active: space && space.spaceId === s.spaceId}" @click="enterSpace(s)">
                    <i class="icon-ion-ios-folder"></i>
                    <span>{{ spaceName(s) }}</span>
                </div>
                <div v-if="loadingSpaces" class="pan-send-hint">加载中…</div>
            </div>
            <div class="pan-send-files">
                <div class="pan-send-crumb">
                    <template v-if="space">
                        <span class="link" @click="goTo(0)">{{ spaceName(space) }}</span>
                        <template v-for="(f, i) in path" :key="f.fileId">
                            <span class="sep">/</span>
                            <span class="link" @click="goTo(i + 1)">{{ f.name }}</span>
                        </template>
                    </template>
                </div>
                <div class="pan-send-list">
                    <div v-if="!space" class="pan-send-hint">请选择一个空间</div>
                    <div v-else-if="loadingFiles" class="pan-send-hint">加载中…</div>
                    <div v-else-if="!files.length" class="pan-send-hint">该目录下没有文件</div>
                    <template v-else>
                        <div v-for="f in files" :key="f.fileId" class="pan-send-file" @click="onClickFile(f)">
                            <input v-if="!f.isFolder" type="checkbox" :checked="isPicked(f)" @click.stop="toggle(f)">
                            <i :class="f.isFolder ? 'icon-ion-ios-folder folder' : panFileIconClass(f)"></i>
                            <span class="name">{{ f.name }}</span>
                            <span v-if="!f.isFolder" class="size">{{ formatPanSize(f.size) }}</span>
                        </div>
                    </template>
                </div>
            </div>
        </div>
        <div class="pan-send-footer">
            <span class="pan-send-count">已选 {{ picked.length }} 个文件</span>
            <template v-if="needsGrant">
                <span>对方权限</span>
                <select v-model="permission">
                    <option value="VIEW">可查看</option>
                    <option value="EDIT">可编辑</option>
                </select>
            </template>
            <button @click="close">取消</button>
            <button class="primary" :disabled="!picked.length || sending" @click="send">{{ sending ? '发送中…' : '发送' }}</button>
        </div>
    </div>
</template>

<script>
import wfc from "../../wfc/client/wfc";
import panApi from "../../api/panApi";
import Conversation from "../../wfc/model/conversation";
import ConversationType from "../../wfc/model/conversationType";
import LinkMessageContent from "../../wfc/messages/linkMessageContent";
import {
    formatPanSize,
    normalizeFile,
    normalizeShare,
    normalizeSpace,
    panFailMessage,
    panFileIconClass,
    panSpaceDisplayName,
    sortSpaces
} from "./panUtil";

/** 会话里能不能发云盘文件：开了网盘，且是单聊或群聊（发之前要给对方授权，频道、聊天室授不了） */
export function canSendPanFiles(conversation) {
    return panApi.enabled && conversation
        && (conversation.type === ConversationType.Single || conversation.type === ConversationType.Group);
}

/**
 * 云盘文件卡片：链接消息，点开是在线文档页（编辑还是只读由服务端按权限决定，格式打不开时页面给下载）。
 * 与在线文档里「分享」发出去的是同一种卡片
 */
export function panFileCard(file) {
    let content = new LinkMessageContent();
    content.title = file.name;
    content.contentDigest = file.size ? `云盘文件 · ${formatPanSize(file.size)}` : '云盘文件';
    content.url = panApi.docOpenUrl(file.fileId);
    return content;
}

/**
 * 会话里「云盘文件」：在云盘里勾文件（可跨文件夹）、选对方权限，逐个授权后发文件卡片
 */
export default {
    name: "PanSendPicker",
    props: {
        conversation: {type: Conversation, required: true},
    },
    data() {
        return {
            selfUserId: wfc.getUserId(),
            spaces: [],
            space: null,
            path: [],
            files: [],
            // 勾选的文件，跨文件夹保留，按勾选顺序发
            picked: [],
            permission: 'VIEW',
            loadingSpaces: false,
            loadingFiles: false,
            sending: false,
        };
    },
    computed: {
        // 发给自己（文件传输助手之类）的不用授权
        needsGrant() {
            let c = this.conversation;
            return c.type === ConversationType.Group || (c.type === ConversationType.Single && c.target !== this.selfUserId);
        },
        parentId() {
            return this.path.length ? this.path[this.path.length - 1].fileId : 0;
        },
    },
    mounted() {
        this.loadSpaces();
    },
    methods: {
        formatPanSize,
        panFileIconClass,
        spaceName(s) {
            return panSpaceDisplayName(s, this.selfUserId);
        },
        async loadSpaces() {
            this.loadingSpaces = true;
            try {
                let list = await panApi.getSpaces();
                // 全局公共空间 + 自己的两个，别人的公共空间不列
                let spaces = (list || []).map(s => normalizeSpace(s, this.selfUserId)).filter(s => s.canWrite);
                this.spaces = sortSpaces(spaces, this.selfUserId);
                if (this.spaces.length) {
                    this.enterSpace(this.spaces[0]);
                }
            } catch (e) {
                this.$notify({title: '提示', text: panFailMessage('加载空间失败', e), type: 'warn'});
            } finally {
                this.loadingSpaces = false;
            }
        },
        enterSpace(s) {
            this.space = s;
            this.path = [];
            this.loadFiles();
        },
        goTo(index) {
            this.path = this.path.slice(0, index);
            this.loadFiles();
        },
        async loadFiles() {
            let space = this.space;
            let parentId = this.parentId;
            this.loadingFiles = true;
            try {
                let list = await panApi.getSpaceFiles(space.spaceId, parentId);
                if (space !== this.space || parentId !== this.parentId) {
                    return;
                }
                let files = (list || []).map(normalizeFile);
                // 文件夹在前
                files.sort((a, b) => (b.isFolder ? 1 : 0) - (a.isFolder ? 1 : 0));
                this.files = files;
            } catch (e) {
                this.$notify({title: '提示', text: panFailMessage('加载目录失败', e), type: 'warn'});
            } finally {
                this.loadingFiles = false;
            }
        },
        onClickFile(f) {
            if (f.isFolder) {
                this.path.push(f);
                this.loadFiles();
            } else {
                this.toggle(f);
            }
        },
        isPicked(f) {
            return this.picked.some(p => p.fileId === f.fileId);
        },
        toggle(f) {
            if (this.isPicked(f)) {
                this.picked = this.picked.filter(p => p.fileId !== f.fileId);
            } else {
                this.picked.push(f);
            }
        },
        // 已经分享给这个会话、权限够用就不重复授权
        async grant(file) {
            let c = this.conversation;
            let isGroup = c.type === ConversationType.Group;
            let shares = ((await panApi.listShares(file.fileId)) || []).map(normalizeShare);
            let existing = shares.find(s => s.isGroup === isGroup && s.targetId === c.target);
            if (existing && (existing.canEdit || this.permission === 'VIEW')) {
                return;
            }
            await panApi.addShare(file.fileId, isGroup ? 'GROUP' : 'USER', c.target, this.permission);
        },
        // 按勾选顺序一个个来：先授权再发，授权失败的不发（对方点开只会看到「无权限」）
        async send() {
            this.sending = true;
            let failed = 0;
            for (const file of this.picked) {
                if (this.needsGrant) {
                    try {
                        await this.grant(file);
                    } catch (e) {
                        console.error('pan send grant error', e);
                        failed++;
                        continue;
                    }
                }
                wfc.sendConversationMessage(this.conversation, panFileCard(file));
            }
            this.sending = false;
            if (failed) {
                this.$notify({title: '提示', text: `${failed} 个文件授权失败，未发送`, type: 'warn'});
            }
            this.close();
        },
        close() {
            this.$modal.hide('pan-send-modal');
        },
    },
};
</script>

<style scoped>
.pan-send {
    height: 520px;
    background: var(--background-tertiary);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    color: var(--text-primary);
}

.pan-send-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 18px;
    font-weight: 500;
    border-bottom: 1px solid var(--border-primary);
}

.pan-send-title i {
    cursor: pointer;
    color: var(--text-secondary);
}

.pan-send-body {
    flex: 1;
    display: flex;
    min-height: 0;
}

.pan-send-spaces {
    width: 150px;
    flex: 0 0 150px;
    overflow-y: auto;
    border-right: 1px solid var(--border-primary);
    padding: 6px 0;
}

.pan-send-space {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    cursor: pointer;
    font-size: var(--font-size-sm, 13px);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.pan-send-space:hover {
    background: var(--background-item-hover);
}

.pan-send-space.active {
    background: var(--background-item-active);
}

.pan-send-files {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
}

.pan-send-crumb {
    padding: 8px 12px;
    font-size: var(--font-size-xs, 12px);
    color: var(--text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.pan-send-crumb .link {
    cursor: pointer;
    color: var(--text-link);
}

.pan-send-crumb .sep {
    margin: 0 4px;
}

.pan-send-list {
    flex: 1;
    overflow-y: auto;
}

.pan-send-file {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    cursor: pointer;
    font-size: var(--font-size-sm, 13px);
}

.pan-send-file:hover {
    background: var(--background-item-hover);
}

.pan-send-file i.folder {
    color: var(--status-warning);
    margin-left: 21px;
}

.pan-send-file .name {
    flex: 1;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.pan-send-file .size {
    font-size: var(--font-size-xs, 12px);
    color: var(--text-secondary);
}

.pan-send-hint {
    padding: 40px 20px;
    text-align: center;
    color: var(--text-hint);
    font-size: var(--font-size-sm, 13px);
}

.pan-send-footer {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 18px;
    border-top: 1px solid var(--border-primary);
    font-size: var(--font-size-sm, 13px);
}

.pan-send-count {
    flex: 1;
    color: var(--text-secondary);
}

.pan-send-footer button {
    height: 30px;
    padding: 0 14px;
    border-radius: 4px;
    border: 1px solid var(--border-primary);
    background: var(--background-primary);
    color: var(--text-primary);
    cursor: pointer;
}

.pan-send-footer button.primary {
    border: none;
    background: var(--accent-color);
    color: var(--text-on-accent);
}

.pan-send-footer button:disabled {
    opacity: .5;
    cursor: default;
}
</style>
