<template>
    <div class="dsh-card">
        <div class="dsh-card-title">🎯 目标进度
            <span class="dsh-goal-phase" :class="phaseClass">{{ phaseText }}</span>
        </div>
        <div class="dsh-goal-objective">{{ content.objective }}</div>
        <div class="dsh-goal-meta">{{ $t('dsh.goal.rounds', [content.roundsStarted ?? 0]) }}</div>
    </div>
</template>

<script>
export default {
    name: "DshGoalContentView",
    props: {
        message: {
            type: Object,
            required: true,
        },
    },
    computed: {
        content() {
            return this.message.messageContent.content || {};
        },
        phaseText() {
            const map = {active: this.$t('dsh.goal.active'), paused: this.$t('dsh.goal.paused'), blocked: this.$t('dsh.goal.blocked'), complete: this.$t('dsh.goal.complete')};
            return map[this.content.phase] || this.content.phase || '';
        },
        phaseClass() {
            return `dsh-goal-phase-${this.content.phase || 'active'}`;
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
.dsh-goal-phase {
    margin-left: 6px;
    padding: 1px 8px;
    border-radius: 10px;
    font-size: 11px;
    font-weight: normal;
    vertical-align: middle;
    color: var(--text-on-accent);
}
.dsh-goal-phase-active {
    background-color: #22c55e;
}
.dsh-goal-phase-paused {
    background-color: #94a3b8;
}
.dsh-goal-phase-blocked {
    background-color: var(--status-error);
}
.dsh-goal-phase-complete {
    background-color: var(--accent-color);
}
.dsh-goal-objective {
    color: var(--text-primary);
    font-size: var(--font-size-sm);
    word-break: break-word;
}
.dsh-goal-meta {
    color: var(--text-secondary);
    font-size: var(--font-size-xs);
    margin-top: 4px;
}
</style>
