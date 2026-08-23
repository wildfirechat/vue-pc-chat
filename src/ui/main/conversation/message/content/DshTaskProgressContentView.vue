<template>
    <div class="dsh-card dsh-task-card">
        <div class="dsh-card-title">🧩 任务进度
            <span class="dsh-task-summary">{{ summaryText }}</span>
        </div>
        <div v-if="!tasks.length" class="dsh-task-empty">暂无任务</div>
        <div v-for="t in tasks" :key="t.id" class="dsh-task-item">
            <span class="dsh-task-icon" :class="`dsh-task-icon-${t.status}`">{{ statusIcon(t) }}</span>
            <div class="dsh-task-main">
                <div class="dsh-task-label">{{ t.label || shortId(t.id) }}</div>
                <div class="dsh-task-meta">{{ statusText(t) }}{{ t.reason ? ' · ' + t.reason : '' }}</div>
            </div>
        </div>
    </div>
</template>

<script>
export default {
    name: "DshTaskProgressContentView",
    props: {
        message: {
            type: Object,
            required: true,
        },
    },
    computed: {
        content() {
            return this.message.messageContent.content || {tasks: []};
        },
        tasks() {
            return this.content.tasks || [];
        },
        summaryText() {
            const running = this.tasks.filter(t => t.status === 'running').length;
            if (!this.tasks.length) return '';
            if (running > 0) return `共 ${this.tasks.length} 个 · ${running} 运行中`;
            const failed = this.tasks.filter(t => t.status === 'failed').length;
            return failed > 0 ? `共 ${this.tasks.length} 个 · ${failed} 失败` : `共 ${this.tasks.length} 个 · 全部完成`;
        },
    },
    methods: {
        statusIcon(t) {
            const map = {running: '⏳', done: '✅', completed: '✅', failed: '❌', killed: '⛔'};
            return map[t.status] || '⚪';
        },
        statusText(t) {
            const map = {running: '运行中', done: '已完成', completed: '已完成', failed: '失败', killed: '已终止'};
            return map[t.status] || t.status || '';
        },
        shortId(id) {
            const s = String(id || '');
            return s.length > 12 ? `子任务 ${s.slice(-8)}` : (s || '子任务');
        },
    },
};
</script>

<style lang="css" scoped>
.dsh-card {
    margin: 4px 8px;
    padding: 10px;
    background-color: var(--background-primary);
    border-radius: var(--radius-md);
    max-width: 420px;
    border: 1px solid var(--background-tertiary);
}
.dsh-card-title {
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 6px;
}
.dsh-task-summary {
    margin-left: 6px;
    padding: 1px 8px;
    border-radius: 10px;
    font-size: 11px;
    font-weight: normal;
    vertical-align: middle;
    color: var(--text-on-accent);
    background-color: #4f8ff7;
}
.dsh-task-empty {
    color: var(--text-secondary);
    font-size: 12px;
    padding: 4px 0;
}
.dsh-task-item {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 5px 0;
    border-bottom: 1px solid var(--background-tertiary);
}
.dsh-task-item:last-child {
    border-bottom: none;
}
.dsh-task-icon {
    font-size: 14px;
    line-height: 1.4;
}
.dsh-task-main {
    flex: 1;
    min-width: 0;
}
.dsh-task-label {
    font-size: 13px;
    color: var(--text-primary);
    word-break: break-all;
}
.dsh-task-meta {
    font-size: 11px;
    color: var(--text-secondary);
}
</style>
