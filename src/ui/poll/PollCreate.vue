<template>
    <DialogFrame :title="$t('poll.create_poll')" :tinted="false"
                 :primary="{label: $t('poll.publish'), disabled: !canSubmit, busy: creating}"
                 :secondary="{label: $t('common.cancel'), disabled: creating}"
                 @primary="createPoll" @secondary="close">
        <div class="df-form">
            <label class="df-label">{{ $t('poll.poll_title') }}</label>
            <input ref="title" v-model="title" type="text" class="df-input" :placeholder="$t('poll.poll_title_hint')" maxlength="100">
            <div class="df-gap"></div>
            <label class="df-label">{{ $t('poll.poll_desc') }}</label>
            <textarea v-model="desc" rows="3" class="df-input" :placeholder="$t('poll.poll_desc_hint')" maxlength="500"></textarea>
            <div class="df-gap"></div>

            <label class="df-label">{{ $t('poll.poll_options') }}</label>
            <div v-for="(option, index) in options" :key="option.key" class="poll-option-row">
                <input v-model="option.text" type="text" class="df-input" maxlength="100"
                       :class="{removable: options.length > minOptions}"
                       :placeholder="$t('poll.option_hint', {index: index + 1})">
                <span v-if="options.length > minOptions" class="poll-option-remove" :title="$t('common.delete')"
                      @click="removeOption(index)"><i class="icon-ion-close-circled"></i></span>
            </div>
            <div v-if="options.length < maxOptions" class="poll-option-add" @click="addOption">
                <i class="icon-ion-plus-round"></i>
                <span>{{ $t('poll.add_option') }}</span>
            </div>
            <div class="df-gap"></div>

            <div class="df-card">
                <div class="df-row clickable" @click="pickType">
                    <span class="df-row-label">{{ $t('poll.poll_type') }}</span>
                    <span class="df-row-value">{{ type === 1 ? $t('poll.single_choice') : $t('poll.multiple_choice') }}</span>
                    <i class="icon-ion-ios-arrow-right df-row-arrow"></i>
                </div>
                <div v-if="type === 2" class="df-row clickable" @click="pickMaxSelect">
                    <span class="df-row-label">{{ $t('poll.max_select') }}</span>
                    <span class="df-row-value">{{ $t('poll.option_count', {count: maxSelect}) }}</span>
                    <i class="icon-ion-ios-arrow-right df-row-arrow"></i>
                </div>
                <label class="df-row">
                    <span class="df-row-label">{{ $t('poll.anonymous_poll') }}</span>
                    <input v-model="anonymous" type="checkbox" role="switch">
                </label>
                <label class="df-row">
                    <span class="df-row-label">{{ $t('poll.show_result_always') }}</span>
                    <input v-model="showResult" type="checkbox" role="switch">
                </label>
                <div class="df-row clickable" @click="$refs.endTimePicker.open(endTime || tomorrow())">
                    <span class="df-row-label">{{ $t('poll.end_time') }}</span>
                    <span class="df-row-value" :class="{set: endTime}">{{ endTime ? formatTime(endTime) : $t('poll.no_end_time') }}</span>
                    <span v-if="endTime" class="poll-clear" @click.stop="endTime = 0"><i class="icon-ion-close-circled"></i></span>
                    <i v-else class="icon-ion-ios-arrow-right df-row-arrow"></i>
                    <NativeDateTimePicker ref="endTimePicker" @pick="endTime = $event"/>
                </div>
            </div>
        </div>
    </DialogFrame>
</template>

<script>
import pollApi from "../../api/pollApi";
import DialogFrame from "../common/DialogFrame.vue";
import NativeDateTimePicker from "../common/NativeDateTimePicker.vue";
import {pickOption} from "../common/optionPicker";
import {getSubWindowQuery} from '../util/subWindowNavigator';
import {closeFeatureDialog} from "../util/featureDialog";
import '../common/dialogForm.css';

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 10;

let optionKey = 0;

function pad(n) {
    return n < 10 ? '0' + n : '' + n;
}

/**
 * 发起投票（对齐 wf-enterprise-chat 的 CreatePollScreen）：标题、描述、选项（2~10 个，都要填），
 * 类型（多选时可设最多选几项）、匿名、始终显示结果、截止时间。只发到本群。
 */
export default {
    name: "PollCreate",
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
            options: [{key: ++optionKey, text: ''}, {key: ++optionKey, text: ''}],
            // 1 = 单选，2 = 多选
            type: 1,
            maxSelect: 1,
            anonymous: false,
            showResult: false,
            endTime: 0,
            creating: false,
            minOptions: MIN_OPTIONS,
            maxOptions: MAX_OPTIONS,
        };
    },
    mounted() {
        this.$nextTick(() => this.$refs.title && this.$refs.title.focus());
    },
    computed: {
        canSubmit() {
            return !this.creating && !!this.title.trim() && this.options.every(o => !!o.text.trim());
        },
    },
    methods: {
        addOption() {
            if (this.options.length >= MAX_OPTIONS) {
                this.$notify({text: this.$t('poll.max_options_limit', {count: MAX_OPTIONS}), type: 'warn'});
                return;
            }
            this.options.push({key: ++optionKey, text: ''});
        },
        removeOption(index) {
            if (this.options.length <= MIN_OPTIONS) {
                return;
            }
            this.options.splice(index, 1);
            // 选项少了，「最多选几项」可能越界
            if (this.maxSelect > this.options.length) {
                this.maxSelect = this.options.length;
            }
        },
        async pickType() {
            let type = await pickOption(this, {
                title: this.$t('poll.poll_type'),
                current: this.type,
                options: [
                    {value: 1, label: this.$t('poll.single_choice')},
                    {value: 2, label: this.$t('poll.multiple_choice')},
                ],
            });
            if (type === undefined) {
                return;
            }
            this.type = type;
            // 单选恒为 1；切到多选给一个合法的默认上限
            this.maxSelect = type === 1 ? 1 : Math.min(Math.max(this.maxSelect, 2), this.options.length);
        },
        async pickMaxSelect() {
            // 下限 2（否则等同单选），上限是选项总数
            let choices = [];
            for (let n = 2; n <= this.options.length; n++) {
                choices.push({value: n, label: this.$t('poll.option_count', {count: n})});
            }
            let value = await pickOption(this, {title: this.$t('poll.max_select'), current: this.maxSelect, options: choices});
            if (value !== undefined) {
                this.maxSelect = value;
            }
        },
        tomorrow() {
            return Date.now() + 24 * 3600 * 1000;
        },
        formatTime(ms) {
            let d = new Date(ms);
            return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
        },
        async createPoll() {
            if (!this.canSubmit) {
                return;
            }
            if (this.endTime && this.endTime <= Date.now()) {
                this.$notify({text: this.$t('poll.end_time_must_be_future'), type: 'warn'});
                return;
            }
            this.creating = true;
            try {
                let options = this.options.map(o => o.text.trim());
                await pollApi.createPoll(
                    this.groupId,
                    this.title.trim(),
                    this.desc.trim(),
                    options,
                    1,
                    this.type,
                    this.type === 2 ? this.maxSelect : 1,
                    this.anonymous ? 1 : 0,
                    this.endTime,
                    this.showResult ? 1 : 0
                );
                this.$notify({text: this.$t('poll.poll_create_success'), type: 'success'});
                this.close();
            } catch (e) {
                this.$notify({text: this.$t('poll.poll_create_failed') + ': ' + e.message, type: 'error'});
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
/* 选项输入框一样宽，删除按钮收在框内右侧，鼠标移上来才显示 */
.poll-option-row {
    position: relative;
}

.poll-option-row + .poll-option-row {
    margin-top: 8px;
}

.poll-option-row input.removable {
    padding-right: 36px;
}

.poll-option-remove {
    position: absolute;
    top: 50%;
    right: 6px;
    width: 24px;
    height: 24px;
    margin-top: -12px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    cursor: pointer;
    opacity: 0;
    transition: opacity var(--duration-fast);
}

.poll-option-row:hover .poll-option-remove, .poll-option-row:focus-within .poll-option-remove {
    opacity: 1;
}

.poll-option-remove i {
    font-size: 15px;
    color: var(--text-tertiary);
}

.poll-option-remove:hover i {
    color: var(--text-danger);
}

.poll-option-add {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: calc(36px * var(--layout-scale-row, 1));
    margin-top: 8px;
    border: 1px dashed var(--border-strong);
    border-radius: 6px;
    cursor: pointer;
    color: var(--accent-color);
    font-size: var(--font-size-sm);
    transition: border-color var(--duration-fast), background var(--duration-fast);
}

.poll-option-add:hover {
    border-color: var(--accent-color);
    background: var(--accent-color-subtle);
}

.poll-option-add i {
    font-size: 12px;
    color: var(--accent-color);
}

.poll-clear {
    display: flex;
    align-items: center;
    cursor: pointer;
}

.poll-clear i {
    font-size: 15px;
    color: var(--text-tertiary);
}

.poll-clear:hover i {
    color: var(--text-secondary);
}
</style>
