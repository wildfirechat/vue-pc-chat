<template>
    <DialogFrame :title="$t('collection.create_collection')" :tinted="false"
                 :primary="{label: $t('collection.done'), disabled: !canSubmit, busy: creating}"
                 :secondary="{label: $t('common.cancel'), disabled: creating}"
                 @primary="createCollection" @secondary="close">
        <div class="df-form">
            <label class="df-label">{{ $t('collection.collection_title') }}</label>
            <input ref="title" v-model="title" type="text" class="df-input" maxlength="100"
                   :placeholder="$t('collection.collection_title_hint')">
            <div class="df-gap"></div>
            <label class="df-label">{{ $t('collection.collection_desc') }}</label>
            <textarea v-model="desc" rows="3" class="df-input" maxlength="500"
                      :placeholder="$t('collection.collection_desc_hint')"></textarea>
            <div class="df-gap"></div>
            <!-- 模板：群成员参与时输入框里的占位格式 -->
            <label class="df-label">{{ $t('collection.collection_template') }}</label>
            <input v-model="template" type="text" class="df-input" maxlength="100"
                   :placeholder="$t('collection.collection_template_example')">
            <p class="df-hint">{{ $t('collection.collection_template_hint') }}</p>
            <div class="df-gap"></div>
            <div class="df-card">
                <div class="df-row clickable" @click="$refs.expirePicker.open(expireAt || tomorrow())">
                    <span class="df-row-label">{{ $t('collection.collection_end_time') }}</span>
                    <span class="df-row-value" :class="{set: expireAt}">{{ expireAt ? formatTime(expireAt) : $t('collection.collection_no_end_time') }}</span>
                    <span v-if="expireAt" class="collection-clear" @click.stop="expireAt = 0"><i class="icon-ion-close-circled"></i></span>
                    <i v-else class="icon-ion-ios-arrow-right df-row-arrow"></i>
                    <NativeDateTimePicker ref="expirePicker" @pick="expireAt = $event"/>
                </div>
            </div>
        </div>
    </DialogFrame>
</template>

<script>
import collectionApi from "../../api/collectionApi";
import DialogFrame from "../common/DialogFrame.vue";
import NativeDateTimePicker from "../common/NativeDateTimePicker.vue";
import {getSubWindowQuery} from '../util/subWindowNavigator';
import {closeFeatureDialog} from "../util/featureDialog";
import '../common/dialogForm.css';

function pad(n) {
    return n < 10 ? '0' + n : '' + n;
}

/**
 * 发起接龙（对齐 wf-enterprise-chat 的 CreateCollectionScreen）：标题、描述、填写模板（预填一个示例）、截止时间。
 */
export default {
    name: "CollectionCreate",
    props: {
        subWindowQuery: {
            type: Object,
            required: false,
            default: null,
        }
    },
    emits: ['close'],
    data() {
        return {
            groupId: getSubWindowQuery(this).groupId || '',
            title: '',
            desc: '',
            // 模板用示例预填好，群成员直接按这个格式接龙
            template: this.$t('collection.collection_template_example'),
            // 0 = 无截止时间
            expireAt: 0,
            creating: false,
        };
    },
    mounted() {
        this.$nextTick(() => this.$refs.title && this.$refs.title.focus());
    },
    computed: {
        canSubmit() {
            return !this.creating && !!this.title.trim();
        },
    },
    methods: {
        tomorrow() {
            return Date.now() + 24 * 3600 * 1000;
        },
        formatTime(ms) {
            let d = new Date(ms);
            return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
        },
        async createCollection() {
            if (!this.canSubmit) {
                return;
            }
            if (this.expireAt && this.expireAt <= Date.now()) {
                this.$notify({text: this.$t('collection.expire_time_invalid'), type: 'warn'});
                return;
            }
            this.creating = true;
            try {
                await collectionApi.createCollection(
                    this.groupId,
                    this.title.trim(),
                    this.desc.trim(),
                    this.template.trim(),
                    this.expireAt ? 1 : 0,
                    this.expireAt,
                    0
                );
                this.$notify({text: this.$t('collection.collection_create_success'), type: 'success'});
                this.close();
            } catch (e) {
                this.$notify({text: this.$t('collection.collection_create_failed') + ': ' + e.message, type: 'error'});
            } finally {
                this.creating = false;
            }
        },
        close() {
            closeFeatureDialog(this);
        },
    },
    components: {
        DialogFrame,
        NativeDateTimePicker,
    },
}
</script>

<style scoped>
.collection-clear {
    display: flex;
    align-items: center;
    cursor: pointer;
}

.collection-clear i {
    font-size: 15px;
    color: var(--text-tertiary);
}

.collection-clear:hover i {
    color: var(--text-secondary);
}
</style>
