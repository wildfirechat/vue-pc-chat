<template>
    <DialogFrame :title="$t('collection.collection_detail')"
                 :primary="joinable ? {label: $t('collection.collection_submit'), disabled: !canSubmit, busy} : null"
                 :secondary="joinable ? {label: $t('common.cancel')} : null"
                 @primary="onSubmit" @secondary="close">
        <div v-if="!collection" class="df-center">
            <span v-if="loading" class="df-spinner"></span>
            <span v-else>{{ error || $t('collection.collection_load_failed') }}</span>
        </div>
        <div v-else class="df-form">
            <div class="collection-header">
                <p class="collection-title">{{ collection.title }}</p>
                <p v-if="desc" class="collection-desc">{{ desc }}</p>
                <span v-if="collection.template" class="collection-template">{{ $t('collection.collection_template_label') }}{{ collection.template }}</span>
                <div class="collection-creator">
                    <img :src="portrait(collection.creatorId)" alt="">
                    <span class="collection-creator-name">{{ $t('collection.collection_creator_suffix', {name: userName(collection.creatorId)}) }}</span>
                    <span class="collection-count">{{ $t('collection.people_count', {count: entries.length}) }}</span>
                </div>
            </div>

            <div v-if="entries.length || showNewEntry" class="df-card collection-entries">
                <div v-for="(entry, index) in entries" :key="entry.userId + '-' + index" class="collection-entry"
                     :class="{editable: isEditable(entry)}">
                    <span class="collection-index">{{ index + 1 }}</span>
                    <textarea v-if="isEditable(entry)" ref="editInput" v-model="draft" rows="1" class="collection-input"
                              :placeholder="collection.template || $t('collection.collection_join_hint')"
                              @input="autoResize" @keydown.enter.exact.prevent="onSubmit"></textarea>
                    <span v-else class="collection-entry-text">{{ entry.content }}</span>
                </div>
                <!-- 还没参与、接龙进行中：清单末尾挂一行空的编辑位 -->
                <div v-if="showNewEntry" class="collection-entry editable">
                    <span class="collection-index">{{ entries.length + 1 }}</span>
                    <textarea ref="editInput" v-model="draft" rows="1" class="collection-input"
                              :placeholder="collection.template || $t('collection.collection_join_hint')"
                              @input="autoResize" @keydown.enter.exact.prevent="onSubmit"></textarea>
                </div>
            </div>
        </div>
    </DialogFrame>
</template>

<script>
import collectionApi from "../../api/collectionApi";
import wfc from "../../wfc/client/wfc";
import Config from "../../config";
import DialogFrame from "../common/DialogFrame.vue";
import {getSubWindowQuery} from '../util/subWindowNavigator';
import {closeFeatureDialog} from "../util/featureDialog";
import '../common/dialogForm.css';

/**
 * 接龙详情（对齐 wf-enterprise-chat 的 CollectionDetailScreen）：接龙内容 + 参与清单，自己那条就地编辑。
 * 清空自己的内容再提交即退出接龙，所以按钮叫「提交」。进来直接聚焦到自己那一行，没参与时预填「昵称 - 」。
 */
export default {
    name: "CollectionDetail",
    props: {
        subWindowQuery: {
            type: Object,
            required: false,
            default: null,
        }
    },
    emits: ['close'],
    data() {
        let query = getSubWindowQuery(this);
        return {
            loading: false,
            error: null,
            busy: false,
            groupId: query.groupId || '',
            collectionId: query.collectionId,
            collection: null,
            draft: '',
            original: '',
            me: wfc.getUserId(),
        };
    },
    mounted() {
        this.fetchCollection();
    },
    computed: {
        desc() {
            return this.collection.description || this.collection.desc || '';
        },
        entries() {
            return ((this.collection && this.collection.entries) || []).filter(e => !e.deleted);
        },
        myEntry() {
            return this.entries.find(e => e.userId === this.me) || null;
        },
        joinable() {
            let c = this.collection;
            if (!c || c.status !== 0) {
                return false;
            }
            if (c.expireType && c.expireAt > 0 && c.expireAt < Date.now()) {
                return false;
            }
            return !(c.maxParticipants > 0 && this.entries.length >= c.maxParticipants);
        },
        showNewEntry() {
            return this.joinable && !this.myEntry;
        },
        // 没参与：有内容才能提交；参与过：内容变了才能提交（清空 = 退出接龙）
        canSubmit() {
            if (!this.joinable || this.busy) {
                return false;
            }
            let current = this.draft.trim();
            if (this.myEntry) {
                return current === '' ? !!this.original : current !== this.original;
            }
            return current !== '';
        },
    },
    methods: {
        async fetchCollection() {
            this.loading = true;
            try {
                let collection = await collectionApi.getCollection(this.collectionId, this.groupId);
                if (!collection.entries) {
                    collection.entries = [];
                }
                if (!this.groupId && collection.groupId) {
                    this.groupId = collection.groupId;
                }
                this.collection = collection;
                this.error = null;
                this.resetDraft();
            } catch (e) {
                this.error = this.$t('collection.collection_load_failed') + ': ' + e.message;
            } finally {
                this.loading = false;
            }
        },
        resetDraft() {
            if (this.myEntry) {
                this.draft = this.myEntry.content || '';
                this.original = this.draft.trim();
            } else {
                // 没填过：新行预填「昵称 - 」，省得每次自己打名字
                let name = wfc.getGroupMemberDisplayName(this.groupId, this.me);
                this.draft = name && !name.startsWith('<') ? name + ' - ' : '';
                this.original = '';
            }
            this.$nextTick(() => {
                let input = this.$refs.editInput;
                input = Array.isArray(input) ? input[0] : input;
                if (input) {
                    this.autoResize({target: input});
                    input.focus();
                    input.setSelectionRange(input.value.length, input.value.length);
                }
            });
        },
        isEditable(entry) {
            return this.joinable && entry.userId === this.me;
        },
        onSubmit() {
            if (!this.canSubmit) {
                return;
            }
            let content = this.draft.trim();
            if (this.myEntry && content === '') {
                this.$alert({
                    content: this.$t('collection.confirm_delete_entry'),
                    confirmText: this.$t('common.delete'),
                    confirmButtonType: 'danger',
                    confirmCallback: () => this.deleteEntry(),
                });
                return;
            }
            this.join(content);
        },
        // 参与和修改是同一个接口，只是提示语不同
        async join(content) {
            let joined = !!this.myEntry;
            this.busy = true;
            try {
                await collectionApi.joinCollection(this.collectionId, this.groupId, content);
                this.$notify({text: this.$t(joined ? 'collection.collection_update_success' : 'collection.collection_join_success'), type: 'success'});
                this.close();
            } catch (e) {
                this.toastError(e, this.$t(joined ? 'collection.collection_update_failed' : 'collection.collection_join_failed'));
            } finally {
                this.busy = false;
            }
        },
        async deleteEntry() {
            this.busy = true;
            try {
                await collectionApi.deleteCollectionEntry(this.collectionId, this.groupId);
                this.$notify({text: this.$t('collection.collection_delete_success'), type: 'success'});
                await this.fetchCollection();
            } catch (e) {
                this.toastError(e, this.$t('collection.delete_failed'));
            } finally {
                this.busy = false;
            }
        },
        // 3003 = 已不在该群，接龙里很常见，单独给一句人话
        toastError(e, fallback) {
            let msg = (e && e.message) || String(e);
            this.$notify({
                text: msg.indexOf('3003') >= 0 ? this.$t('collection.collection_not_in_group') : fallback + ': ' + msg,
                type: 'error',
            });
        },
        autoResize(event) {
            let el = event && event.target;
            if (!el) {
                return;
            }
            el.style.height = 'auto';
            let max = parseFloat(getComputedStyle(el).maxHeight) || Infinity;
            el.style.height = Math.min(el.scrollHeight, max) + 'px';
            // 没到最高时不出滚动条，到了才能滚
            el.style.overflowY = el.scrollHeight > max ? 'auto' : 'hidden';
        },
        userName(userId) {
            return wfc.getGroupMemberDisplayName(this.groupId, userId);
        },
        portrait(userId) {
            let userInfo = wfc.getUserInfo(userId, false, this.groupId);
            return (userInfo && userInfo.portrait) || Config.DEFAULT_PORTRAIT_URL;
        },
        close() {
            closeFeatureDialog(this);
        },
    },
    components: {
        DialogFrame,
    },
}
</script>

<style scoped>
.collection-header {
    padding: 16px;
    border-radius: 8px;
    background: var(--background-primary);
}

.collection-title {
    font-size: calc(18px * var(--font-scale, 1));
    font-weight: 600;
    line-height: 1.4;
    word-break: break-word;
}

.collection-desc {
    margin-top: 6px;
    font-size: var(--font-size-base);
    line-height: 1.5;
    color: var(--text-secondary);
    white-space: pre-wrap;
    word-break: break-word;
}

.collection-template {
    display: inline-block;
    margin-top: 10px;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: var(--font-size-xs);
    color: var(--accent-color);
    background: var(--accent-color-subtle);
}

.collection-creator {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 14px;
}

.collection-creator img {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    object-fit: cover;
}

.collection-creator-name {
    flex: 1;
    min-width: 0;
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
}

.collection-count {
    font-size: var(--font-size-xs);
    color: var(--text-tertiary);
}

.collection-entries {
    margin-top: 12px;
}

.collection-entry {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 11px 14px;
}

.collection-entry.editable {
    background: var(--accent-color-subtle);
}

.collection-index {
    flex: 0 0 20px;
    height: 20px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--font-size-xxs);
    font-weight: 500;
    color: var(--text-secondary);
    background: var(--border-secondary);
}

.collection-entry.editable .collection-index {
    color: var(--text-on-accent);
    background: var(--accent-color);
}

.collection-entry-text {
    flex: 1;
    min-width: 0;
    font-size: var(--font-size-base);
    line-height: 20px;
    white-space: pre-wrap;
    word-break: break-word;
}

textarea.collection-input {
    flex: 1;
    min-width: 0;
    height: 20px;
    max-height: 60px;
    padding: 0;
    border: none;
    border-radius: 0;
    background: transparent;
    font-size: var(--font-size-base);
    line-height: 20px;
    overflow-y: hidden;
    font-family: inherit;
    color: var(--text-primary);
    resize: none;
    outline: none;
}

textarea.collection-input::placeholder {
    color: var(--text-tertiary);
}
</style>
