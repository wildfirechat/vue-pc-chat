import {isElectron} from '../../platform';
import {isInAppSubWindow, openInAppSubWindow, pushInAppSubWindow} from './subWindowNavigator';

/**
 * 高度随内容的弹窗：最高 maxHeight（wf-enterprise-chat 的弹窗高度），也不超出窗口；
 * 再多的内容在 DialogFrame 的内容区里滚动。内容少时不留一大片空白，也不会因为差几像素冒出滚动条。
 * @param {number} width
 * @param {number} maxHeight
 * @return {Object} $modal.show 的 modal 参数（width / height / adaptive / styles）
 */
export function fitContentModalAttrs(width, maxHeight) {
    return {
        width,
        height: 'auto',
        adaptive: true,
        styles: {maxHeight: `min(${maxHeight}px, calc(100vh - 48px))`},
    };
}

/**
 * 投票 / 接龙这类功能页怎么打开：PC 是对话框（与 wf-enterprise-chat 一致）；
 * web 暂时还是右侧抽屉（SubWindowHost），回头再合并。
 *
 * 组件一律从 subWindowQuery 读参数，关自己用 closeFeatureDialog。
 * @param vm 任意组件实例
 * @param {Object} options
 * @param options.component 组件
 * @param {string} options.route web 抽屉里的路由（见 SubWindowHost 的 registry）
 * @param {Object} [options.query] 参数
 * @param {string} options.name 弹窗名
 * @param {number} options.width
 * @param {number} options.height 最大高度，弹窗按内容自适应（见 fitContentModalAttrs）
 * @param {boolean} [options.clickToClose] 点遮罩关闭；表单类传 false，免得误点丢了填的内容
 * @param {boolean} [options.stack] 叠在当前页上（我的投票 → 投票详情）；否则替换掉 web 抽屉里的当前页
 * @param {Function} [options.onClosed] 弹窗关掉之后（只有 PC 有）
 */
export function showFeatureDialog(vm, {component, route, query = {}, name, width, height, clickToClose = true, stack = false, onClosed}) {
    if (!isElectron()) {
        (stack ? pushInAppSubWindow : openInAppSubWindow)(vm, route, query);
        return;
    }
    vm.$modal.show(component, {subWindowQuery: query}, null, {
        name,
        ...fitContentModalAttrs(width, height),
        clickToClose,
        escToClose: true,
    }, onClosed ? {closed: onClosed} : {});
}

/** 在功能页组件里关掉自己：PC 关弹窗，web 抽屉退一页（退到底就关） */
export function closeFeatureDialog(vm) {
    if (isInAppSubWindow(vm)) {
        vm.$eventBus.$emit('sub-window-back');
    } else {
        vm.$emit('close');
    }
}
