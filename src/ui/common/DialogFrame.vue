<template>
    <div class="dialog-frame" :class="{pane}">
        <div class="dialog-frame-header">
            <div class="dialog-frame-title">
                <span class="title">{{ title }}</span>
                <span v-if="subtitle" class="subtitle">{{ subtitle }}</span>
            </div>
            <slot name="header-actions"/>
        </div>
        <div class="dialog-frame-body" :class="{tinted}">
            <slot/>
        </div>
        <div v-if="hasFooter" class="dialog-frame-footer">
            <slot name="footer-leading"/>
            <span class="spacer"></span>
            <slot name="actions-prefix"/>
            <button v-if="secondary" class="dialog-frame-button tonal" :class="{danger: secondary.danger}"
                    :disabled="secondary.disabled" @click="$emit('secondary')">{{ secondary.label }}
            </button>
            <button v-if="primary" class="dialog-frame-button" :class="[primary.danger ? 'danger' : 'primary', {busy: primary.busy}]"
                    :disabled="primary.disabled || primary.busy" @click="$emit('primary')">
                <span v-if="primary.busy" class="dialog-frame-spinner"></span>
                <template v-else>{{ primary.label }}</template>
            </button>
        </div>
    </div>
</template>

<script>
/**
 * 弹窗骨架：52px 标题栏 / 内容 / 60px 操作栏，与 wf-enterprise-chat 的 PcDialogFrame 同形。
 * 按约定不放右上角关闭：点遮罩、按 Esc 关，表单类弹窗由操作栏的「取消」关。
 *
 * primary / secondary 传 {label, disabled?, busy?, danger?}，点了发 primary / secondary 事件；
 * 都不传、也没有 footer-leading 时不画操作栏（纯浏览型弹窗，如「我的投票」）。
 * pane：同样的骨架放在主窗口右栏里用。
 */
export default {
    name: "DialogFrame",
    props: {
        title: {type: String, default: ''},
        // 标题右侧的补充说明（如多选投票的「已选 2/3」）
        subtitle: {type: String, default: ''},
        primary: {type: Object, default: null},
        secondary: {type: Object, default: null},
        // 内容区铺浅灰底，里面放白色卡片
        tinted: {type: Boolean, default: true},
        // 不是弹窗，是主窗口右栏里的一块（待办页的详情）：60px 标题栏，可拖动窗口（header-actions 里的按钮自己设 no-drag）
        pane: {type: Boolean, default: false},
    },
    emits: ['primary', 'secondary'],
    computed: {
        hasFooter() {
            return !!(this.primary || this.secondary || this.$slots['footer-leading'] || this.$slots['actions-prefix']);
        },
    },
}
</script>

<style scoped>
.dialog-frame {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    /* 高度随内容的弹窗（fitContentModalAttrs）：弹窗只有 max-height，这里接过来，超出的在内容区滚动 */
    max-height: inherit;
    background: var(--background-primary);
    color: var(--text-primary);
}

.dialog-frame-header {
    flex: 0 0 52px;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 10px 0 20px;
    border-bottom: 0.5px solid var(--border-primary);
    box-sizing: border-box;
}

.dialog-frame.pane .dialog-frame-header {
    flex-basis: 60px;
    -webkit-app-region: drag;
}

.dialog-frame.pane .dialog-frame-body.tinted {
    background: var(--background-secondary);
}

.dialog-frame-title {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: baseline;
    gap: 8px;
}

.dialog-frame-title .title {
    font-size: var(--font-size-lg);
    font-weight: 600;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
}

.dialog-frame-title .subtitle {
    flex: 0 0 auto;
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
}

.dialog-frame-body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    position: relative;
}

.dialog-frame-body.tinted {
    background: var(--background-tertiary);
}

.dialog-frame-footer {
    flex: 0 0 60px;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 20px;
    border-top: 0.5px solid var(--border-primary);
    box-sizing: border-box;
}

.dialog-frame-footer .spacer {
    flex: 1;
}

.dialog-frame-button {
    min-width: 76px;
    height: 32px;
    padding: 0 16px;
    border-radius: 6px;
    font-size: var(--font-size-sm);
    font-weight: 500;
}

/* 全局的禁用样式会去色成灰块；这里保留主色，只是变淡 */
.dialog-frame-button:disabled {
    filter: none;
    opacity: .4;
}

.dialog-frame-button.busy:disabled {
    opacity: 1;
}

.dialog-frame-button.tonal {
    border-color: transparent;
    background: var(--background-tertiary);
    color: var(--text-primary);
}

.dialog-frame-button.tonal:hover {
    background: var(--background-item-hover);
}

.dialog-frame-button.tonal.danger {
    color: var(--text-danger);
}

.dialog-frame-spinner {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    border: 2px solid var(--text-trans-light);
    border-top-color: var(--text-on-accent);
    animation: dialog-frame-spin .8s linear infinite;
}

@keyframes dialog-frame-spin {
    to {
        transform: rotate(360deg);
    }
}
</style>
