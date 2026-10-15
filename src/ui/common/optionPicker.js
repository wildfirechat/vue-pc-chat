import OptionPickerView from "./OptionPickerView.vue";

/**
 * 弹出单选选择器。
 * @param vm 任意组件实例（用它的 $modal）
 * @param {{title: string, current: *, options: Array<{value: *, label: string}>}} props
 * @return {Promise<*>} 选中的 value；点遮罩 / Esc 取消时为 undefined
 */
export function pickOption(vm, props) {
    return new Promise(resolve => {
        vm.$modal.show(OptionPickerView, props, null, {
            name: 'option-picker-modal',
            width: 280,
            height: 'auto',
            clickToClose: true,
            escToClose: true,
        }, {
            'before-close': event => resolve(event && event.params ? event.params.value : undefined),
        });
    });
}
