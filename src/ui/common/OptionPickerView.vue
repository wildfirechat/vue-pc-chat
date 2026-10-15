<template>
    <div class="option-picker">
        <div class="option-picker-title">{{ title }}</div>
        <div class="option-picker-list">
            <div v-for="option in options" :key="String(option.value)" class="option-picker-item"
                 :class="{current: option.value === current}" @click="pick(option.value)">
                <span>{{ option.label }}</span>
                <i v-if="option.value === current" class="icon-ion-checkmark-round"></i>
            </div>
        </div>
    </div>
</template>

<script>
/**
 * 单选选择器：一列选项，当前项打勾，点了就关。与 wf-enterprise-chat 的 showFormOptionPicker 对应。
 * 用 pickOption() 打开。
 */
export default {
    name: "OptionPickerView",
    props: {
        title: {type: String, default: ''},
        current: {default: null},
        // [{value, label}]
        options: {type: Array, default: () => []},
    },
    methods: {
        pick(value) {
            this.$modal.hide('option-picker-modal', {value});
        },
    },
}
</script>

<style scoped>
.option-picker {
    padding: 8px 0;
    background: var(--background-primary);
}

.option-picker-title {
    padding: 12px 20px 10px;
    font-size: var(--font-size-lg);
    color: var(--text-primary);
}

.option-picker-list {
    max-height: 60vh;
    overflow-y: auto;
}

.option-picker-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 20px;
    height: 44px;
    font-size: var(--font-size-base);
    color: var(--text-primary);
    cursor: pointer;
}

.option-picker-item span {
    flex: 1;
}

.option-picker-item:hover {
    background: var(--background-item-hover);
}

.option-picker-item i {
    font-size: 16px;
    color: var(--accent-color);
}
</style>
