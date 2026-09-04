<template>
    <div class="agent-card">
        <div class="agent-card-title">🎯 目标进度
            <span class="agent-goal-phase" :class="phaseClass">{{ phaseText }}</span>
        </div>
        <div class="agent-goal-objective">{{ content.objective }}</div>
        <div class="agent-goal-meta">{{ $t('agent.goal.rounds', [content.roundsStarted ?? 0]) }}</div>
    </div>
</template>

<script>
export default {
    name: "AgentGoalContentView",
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
            const map = {active: this.$t('agent.goal.active'), paused: this.$t('agent.goal.paused'), blocked: this.$t('agent.goal.blocked'), complete: this.$t('agent.goal.complete')};
            return map[this.content.phase] || this.content.phase || '';
        },
        phaseClass() {
            return `agent-goal-phase-${this.content.phase || 'active'}`;
        },
    },
};
</script>

<style lang="css" scoped>
.agent-card {
    margin: 4px 8px;
    padding: 10px;
    background-color: var(--background-primary);
    border-radius: var(--radius-md);
    max-width: 420px;
    border: 1px solid var(--background-tertiary);
}
.agent-card-title {
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 6px;
}
.agent-goal-phase {
    margin-left: 6px;
    padding: 1px 8px;
    border-radius: 10px;
    font-size: 11px;
    font-weight: normal;
    vertical-align: middle;
    color: var(--text-on-accent);
}
.agent-goal-phase-active {
    background-color: #22c55e;
}
.agent-goal-phase-paused {
    background-color: #94a3b8;
}
.agent-goal-phase-blocked {
    background-color: var(--status-error);
}
.agent-goal-phase-complete {
    background-color: var(--accent-color);
}
.agent-goal-objective {
    color: var(--text-primary);
    font-size: var(--font-size-sm);
    word-break: break-word;
}
.agent-goal-meta {
    color: var(--text-secondary);
    font-size: var(--font-size-xs);
    margin-top: 4px;
}
</style>
