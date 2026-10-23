<template>
    <aside class="dsh-plan-sidebar">
        <div class="dsh-plan-head">
            <span>会话详情</span>
            <div class="dsh-plan-head-actions">
                <button v-if="cwd" class="dsh-plan-icon" title="打开目录" @click="openDir">↗</button>
                <button class="dsh-plan-icon" title="收起" @click="$emit('close')">×</button>
            </div>
        </div>

        <section class="dsh-plan-section">
            <h3>Plan</h3>
            <p v-if="goal" class="dsh-plan-goal">🎯 {{ goal.objective }}</p>
            <div v-if="planSteps.length" class="dsh-plan-steps">
                <div v-for="(step, i) in planSteps" :key="i" class="dsh-plan-step">
                    <span class="dsh-plan-index">{{ i + 1 }}</span>
                    <span>{{ step.title || step.text || step }}</span>
                </div>
            </div>
            <p v-else class="dsh-plan-empty">
                {{ planOn ? '计划模式已开启，计划步骤会显示在聊天卡片中。' : '当前未开启计划模式。' }}
            </p>
        </section>

        <section class="dsh-plan-section">
            <h3>Tasks</h3>
            <div v-if="tasks.length" class="dsh-plan-tasks">
                <div v-for="t in tasks" :key="t.id || t.label" class="dsh-plan-task">
                    <span class="dsh-plan-task-dot" :class="'task-' + (t.status || 'pending')"></span>
                    <span class="dsh-plan-task-label">{{ t.label || t.id }}</span>
                    <span class="dsh-plan-task-status">{{ taskStatus(t.status) }}</span>
                </div>
            </div>
            <p v-else class="dsh-plan-empty">{{ stateText || '暂无任务' }}</p>
        </section>

        <section class="dsh-plan-section">
            <h3>Files</h3>
            <p v-if="cwd" class="mono dsh-plan-path">{{ cwd }}</p>
            <p v-else class="dsh-plan-empty">会话激活后显示工作目录。</p>
            <button v-if="cwd" class="dsh-plan-link" @click="openDir">打开工作目录</button>
        </section>

        <section class="dsh-plan-section">
            <h3>Context</h3>
            <dl class="dsh-plan-dl">
                <dt>模型</dt><dd>{{ model || '-' }}</dd>
                <dt>推理</dt><dd>{{ effort || '-' }}</dd>
                <dt>模式</dt><dd>{{ preset || '-' }}</dd>
                <dt>会话</dt><dd class="mono">{{ shortSession || '-' }}</dd>
                <dt>用量</dt><dd>{{ metricsText || '-' }}</dd>
            </dl>
        </section>
    </aside>
</template>

<script>
import {
    agentMetricsText,
    agentStatusHint,
    getAgentMetrics,
    getAgentPanelDataFor,
    getAgentState,
} from '../../util/agentState';
import { openDshPath } from '../../../dsh/renderer/dshClient';
import store from '../../../store';
import AgentTaskProgressMessageContent from '../../../wfc/messages/agentTaskProgressMessageContent';
import {AgentGoalMessageContent} from '../../../wfc/messages/agentMessageContents';

export default {
    name: 'DshPlanSidebar',
    props: {
        conversation: { type: Object, default: null },
        robotId: { type: String, default: '' },
    },
    data() {
        return { panel: null, state: null, metrics: null };
    },
    computed: {
        cwd() { return (this.panel && this.panel.cwd) || ''; },
        model() { return (this.panel && this.panel.model) || ''; },
        effort() { return (this.panel && this.panel.effort) || ''; },
        preset() { return (this.panel && this.panel.preset) || ''; },
        shortSession() {
            const id = (this.panel && this.panel.sessionId) || '';
            return id.length > 18 ? id.slice(0, 8) + '…' + id.slice(-6) : id;
        },
        planOn() {
            const plan = this.panel && this.panel.plan;
            return !!(plan && (plan.on === true || plan === true || plan.enabled));
        },
        planSteps() {
            const plan = this.panel && this.panel.plan;
            if (Array.isArray(plan)) return plan;
            if (plan && Array.isArray(plan.steps)) return plan.steps;
            return [];
        },
        stateText() {
            if (!this.state) return '';
            return agentStatusHint(this.state) || this.state.state || '';
        },
        metricsText() { return agentMetricsText(this.metrics) || ''; },
        tasks() {
            const list = (store.state.conversation && store.state.conversation.currentConversationMessageList) || [];
            for (let i = list.length - 1; i >= 0; i--) {
                const content = list[i] && list[i].messageContent;
                if (content instanceof AgentTaskProgressMessageContent) {
                    return (content.content && content.content.tasks) || [];
                }
            }
            return [];
        },
        goal() {
            const list = (store.state.conversation && store.state.conversation.currentConversationMessageList) || [];
            for (let i = list.length - 1; i >= 0; i--) {
                const content = list[i] && list[i].messageContent;
                if (content instanceof AgentGoalMessageContent) return content.content || null;
            }
            return null;
        },
    },
    watch: {
        conversation: { immediate: true, handler() { this.load(); } },
        robotId() { this.load(); },
    },
    mounted() {
        this.timer = setInterval(() => this.load(), 5000);
    },
    beforeUnmount() {
        if (this.timer) clearInterval(this.timer);
    },
    methods: {
        async load() {
            if (!this.conversation || !this.conversation.target) {
                this.panel = null; this.state = null; this.metrics = null;
                return;
            }
            try {
                const [panel, state, metrics] = await Promise.all([
                    Promise.resolve(getAgentPanelDataFor(this.conversation, this.robotId)),
                    getAgentState(this.conversation),
                    getAgentMetrics(this.conversation),
                ]);
                this.panel = panel;
                this.state = state;
                this.metrics = metrics;
            } catch (e) { /* ignore */ }
        },
        taskStatus(status) {
            return ({ pending: '待执行', running: '进行中', completed: '完成', failed: '失败', cancelled: '取消' })[status] || status || '';
        },
        async openDir() {
            if (this.cwd) await openDshPath(this.cwd);
        },
    },
};
</script>

<style scoped>
.dsh-plan-sidebar {
    width: 286px; flex: 0 0 286px; height: 100%; overflow-y: auto;
    border-left: 1px solid var(--border-separator, #eceef1);
    background: var(--background-primary, #fff);
    box-sizing: border-box; padding: 14px 14px 28px;
}
.dsh-plan-head {
    display: flex; align-items: center; justify-content: space-between;
    font-size: 12px; font-weight: 650; color: var(--text-secondary, #6b7280);
    margin-bottom: 14px;
}
.dsh-plan-head-actions { display: flex; gap: 4px; }
.dsh-plan-icon {
    border: 1px solid var(--border-color, #e5e6eb); background: transparent;
    border-radius: 5px; color: inherit; cursor: pointer; width: 24px; height: 22px;
}
.dsh-plan-section { margin-bottom: 18px; }
.dsh-plan-section h3 {
    margin: 0 0 6px; font-size: 11px; text-transform: uppercase; letter-spacing: .06em;
    color: var(--text-secondary, #8a8f99);
}
.dsh-plan-empty { margin: 0; font-size: 12px; line-height: 1.55; color: var(--text-secondary, #8a8f99); }
.dsh-plan-path { font-size: 10px; color: var(--text-secondary, #8a8f99); word-break: break-all; margin: 0 0 6px; }
.dsh-plan-link { border: 0; background: transparent; color: #1d4ed8; font-size: 12px; padding: 0; cursor: pointer; }
.dsh-plan-dl { display: grid; grid-template-columns: 42px 1fr; gap: 5px 6px; margin: 0; font-size: 11px; }
.dsh-plan-dl dt { color: var(--text-secondary, #8a8f99); }
.dsh-plan-dl dd { margin: 0; word-break: break-all; }
.dsh-plan-goal { margin: 0 0 8px; font-size: 12px; line-height: 1.45; color: #4b5563; }
.dsh-plan-steps { display: flex; flex-direction: column; gap: 5px; }
.dsh-plan-tasks { display: flex; flex-direction: column; gap: 5px; }
.dsh-plan-task { display: flex; align-items: center; gap: 5px; font-size: 11px; }
.dsh-plan-task-dot { width: 6px; height: 6px; border-radius: 50%; background: #b0b5bd; flex: 0 0 auto; }
.dsh-plan-task-dot.task-running { background: #d97706; }
.dsh-plan-task-dot.task-completed { background: #1a7f37; }
.dsh-plan-task-dot.task-failed { background: #b42318; }
.dsh-plan-task-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsh-plan-task-status { color: #8a8f99; font-size: 10px; }
.dsh-plan-step { display: flex; gap: 6px; font-size: 12px; line-height: 1.4; }
.dsh-plan-index {
    flex: 0 0 16px; height: 16px; border-radius: 50%; background: #eef2f7;
    color: #475569; font-size: 9px; text-align: center; line-height: 16px;
}
@media (max-width: 1100px) { .dsh-plan-sidebar { width: 240px; flex-basis: 240px; } }
</style>
