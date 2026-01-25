<template>
    <div class="conversation-item"
         :class="{ selected: selected }"
         @click="$emit('click')">
        <div class="checkbox">
            <div v-if="selected" class="checkbox-checked">✓</div>
            <div v-else class="checkbox-unchecked"></div>
        </div>
        <div class="avatar">
            <img v-if="portrait"
                 :src="portrait"
                 @error="onPortraitError"
                 alt="头像" />
            <div v-else class="avatar-placeholder">{{ icon }}</div>
        </div>
        <div class="info">
            <div class="name">{{ title }}</div>
            <div class="detail">{{ messageCount }} 条消息</div>
        </div>
    </div>
</template>

<script>
import wfc from "../../../wfc/client/wfc";
import Config from "../../../config";

export default {
    name: "ConversationBackupItemView",
    props: {
        source: {
            type: Object,
            required: true
        },
        selected: {
            type: Boolean,
            default: false
        }
    },
    emits: ['click'],
    methods: {
        onPortraitError(e) {
            let conv = this.source.conversation;
            if (conv.type === 2) {
                e.target.src = Config.DEFAULT_GROUP_PORTRAIT_URL;
            } else {
                e.target.src = Config.DEFAULT_PORTRAIT_URL;
            }
        }
    },
    computed: {
        title() {
            // 参考ConversationItemView的conversationTitle实现
            let info = this.source;
            if (info.conversation._target) {
                return info.conversation._target._displayName || info.conversation._target.displayName || '未知会话';
            }
            return '';
        },
        portrait() {
            // 参考ConversationItemView的portrait实现
            let info = this.source;
            let conv = info.conversation;

            if (conv.type === 2) { // Group
                if (conv._target && conv._target.portrait) {
                    return conv._target.portrait;
                } else {
                    let dp = wfc.defaultGroupPortrait(conv._target);
                    if (conv._target) {
                        conv._target.portrait = dp;
                    }
                    return dp;
                }
            } else {
                // Single, Channel
                if (conv._target) {
                    return conv._target.portrait;
                }
            }
            return '';
        },
        messageCount() {
            let conv = this.source.conversation;
            return wfc.getMessageCount(conv);
        },
        icon() {
            let conv = this.source.conversation;
            if (conv.type === 1) return '👤';
            if (conv.type === 2) return '👥';
            if (conv.type === 3) return '📢';
            return '💬';
        }
    }
}
</script>

<style lang="css" scoped>
.conversation-item {
    display: flex;
    align-items: center;
    padding: 12px;
    border-bottom: 1px solid #f0f0f0;
    cursor: pointer;
    border-radius: 6px;
    transition: background 0.2s;
}

.conversation-item:last-child {
    border-bottom: none;
}

.conversation-item:hover {
    background: #f9f9f9;
}

.conversation-item.selected {
    background: #e3f2fd;
}

.checkbox {
    width: 24px;
    height: 24px;
    margin-right: 12px;
    flex-shrink: 0;
}

.checkbox-unchecked {
    width: 20px;
    height: 20px;
    border: 2px solid #999;
    border-radius: 4px;
}

.checkbox-checked {
    width: 20px;
    height: 20px;
    background: #2196F3;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 14px;
    font-weight: bold;
}

.avatar {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f0f0f0;
    border-radius: 6px;
    margin-right: 12px;
    flex-shrink: 0;
    overflow: hidden;
}

.avatar img {
    width: 40px;
    height: 40px;
    object-fit: cover;
    border-radius: 6px;
}

.avatar-placeholder {
    font-size: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
}

.info {
    flex: 1;
    min-width: 0;
}

.name {
    font-size: 16px;
    font-weight: 500;
    color: #333;
    margin-bottom: 4px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.detail {
    font-size: 13px;
    color: #999;
}
</style>
