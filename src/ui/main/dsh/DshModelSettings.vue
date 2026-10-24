<template>
    <section class="dsh-model-settings">
        <div class="dsh-model-head">
            <div>
                <h2>模型配置</h2>
                <p>服务端下发的默认模型只读；可以添加更多 OpenAI-compatible 模型。</p>
            </div>
            <button class="dsh-btn primary" @click="openAdd">＋ 添加模型</button>
        </div>

        <div v-if="serverModel" class="dsh-model-card server">
            <div class="dsh-model-card-head">
                <div>
                    <strong>{{ serverModel.model }}</strong>
                    <span class="dsh-model-badge">服务端默认 · 不可修改</span>
                </div>
                <span class="dsh-model-state" :class="{missing: !serverConfigured}">
                    {{ serverConfigured ? '已配置' : '缺少 API Key' }}
                </span>
            </div>
            <dl class="dsh-model-dl">
                <dt>Provider ID</dt><dd class="mono">default</dd>
                <dt>Base URL</dt><dd class="mono">{{ serverModel.baseUrl || '-' }}</dd>
                <dt>模型</dt><dd class="mono">{{ serverModel.model }}</dd>
                <dt>推理等级</dt><dd>{{ serverModel.reasoningEffort || '-' }}</dd>
                <dt>Max Tokens</dt><dd>{{ serverModel.maxTokens || '-' }}</dd>
                <dt>Context Window</dt><dd>{{ serverModel.contextWindow || 131072 }}</dd>
            </dl>
        </div>

        <div v-else class="dsh-model-warning">
            <strong>服务端没有下发可用的模型配置</strong>
            <p>请添加至少一个自定义模型；第一个自定义模型会作为默认模型。</p>
        </div>
        <div v-if="serverModel && !serverConfigured" class="dsh-model-warning">
            <strong>服务端默认模型缺少 API Key</strong>
            <p>默认模型不可修改；请添加一个自定义模型，DSH 会用它作为默认。</p>
        </div>

        <div v-if="models.length" class="dsh-model-list">
            <div v-for="m in models" :key="m.id" class="dsh-model-card">
                <div class="dsh-model-card-head">
                    <div>
                        <strong>{{ m.name }}</strong>
                        <span class="dsh-model-badge user">自定义</span>
                        <span v-if="!serverModel && m.id === models[0].id" class="dsh-model-badge default">默认</span>
                    </div>
                    <div class="dsh-model-actions">
                        <button class="dsh-link-btn" @click="openEdit(m)">编辑</button>
                        <button class="dsh-link-btn danger" @click="remove(m)">删除</button>
                    </div>
                </div>
                <dl class="dsh-model-dl">
                    <dt>Provider ID</dt><dd class="mono">{{ m.providerId }}</dd>
                    <dt>Base URL</dt><dd class="mono">{{ m.baseUrl }}</dd>
                    <dt>模型</dt><dd class="mono">{{ m.model }}</dd>
                    <dt>API Key</dt><dd class="mono">{{ m.apiKeyPreview || (m.hasApiKey ? '已配置' : '-') }}</dd>
                    <dt>推理等级</dt><dd>{{ m.reasoningEffort || '-' }}</dd>
                    <dt>Max Tokens / Context</dt><dd>{{ m.maxTokens || 8192 }} / {{ m.contextWindow || 131072 }}</dd>
                </dl>
            </div>
        </div>
        <div v-else-if="serverModel" class="dsh-model-empty">暂无自定义模型。可以添加其他模型，在会话里用 <code>/model</code> 切换。</div>

        <div v-if="showForm" class="dsh-modal-mask" @click.self="showForm = false">
            <div class="dsh-modal">
                <h2>{{ editing ? '编辑模型' : '添加模型' }}</h2>
                <p class="dsh-modal-hint">仅支持 OpenAI-compatible /chat/completions 接口。</p>
                <label class="dsh-field"><span>名称</span><input v-model.trim="form.name" placeholder="例如：DeepSeek 官方"/></label>
                <label class="dsh-field">
                    <span>Provider ID</span>
                    <input v-model.trim="form.providerId" placeholder="例如 deepseek；留空按名称生成"/>
                    <small class="dsh-field-help">会显示为 /model &lt;provider&gt;/&lt;model&gt;，不能与已有模型重复</small>
                </label>
                <label class="dsh-field"><span>Base URL</span><input v-model.trim="form.baseUrl" placeholder="https://api.deepseek.com"/></label>
                <label class="dsh-field"><span>模型 ID</span><input v-model.trim="form.model" placeholder="deepseek-chat"/></label>
                <label class="dsh-field">
                    <span>API Key</span>
                    <input v-model.trim="form.apiKey" type="password" :placeholder="editing ? '留空则保留原 Key' : 'sk-...'"/>
                </label>
                <div class="dsh-form-row">
                    <label class="dsh-field"><span>推理等级</span>
                        <select v-model="form.reasoningEffort">
                            <option value="">默认</option>
                            <option value="low">low</option>
                            <option value="medium">medium</option>
                            <option value="high">high</option>
                        </select>
                    </label>
                    <label class="dsh-field"><span>Max Tokens</span><input v-model.number="form.maxTokens" type="number" min="1"/></label>
                </div>
                <details class="dsh-advanced">
                    <summary>高级</summary>
                    <label class="dsh-field"><span>Context Window</span><input v-model.number="form.contextWindow" type="number" min="1024"/></label>
                </details>
                <p v-if="formError" class="dsh-form-error">{{ formError }}</p>
                <div class="dsh-modal-actions">
                    <button class="dsh-btn" :disabled="saving" @click="showForm = false">取消</button>
                    <button class="dsh-btn primary" :disabled="saving" @click="save">{{ saving ? '保存中…' : '保存并重启 Host' }}</button>
                </div>
            </div>
        </div>
    </section>
</template>

<script>
import wfc from '../../../wfc/client/wfc';
import { addDshModel, deleteDshModel, getDshModels, updateDshModel } from '../../../dsh/renderer/dshClient';

export default {
    name: 'DshModelSettings',
    props: {
        ai: { type: Object, default: () => ({}) },
    },
    data() {
        return {
            models: [],
            showForm: false,
            editing: null,
            saving: false,
            formError: '',
            form: this.emptyForm(),
        };
    },
    computed: {
        serverModel() {
            const ai = this.ai || {};
            return ai.model && ai.baseUrl ? ai : null;
        },
        serverConfigured() {
            return !!(this.ai && this.ai.apiKey) || !!(this.ai && this.ai.configured);
        },
    },
    created() {
        window.addEventListener('dsh-provision-updated', this.load);
    },
    mounted() {
        this.load();
    },
    beforeUnmount() {
        window.removeEventListener('dsh-provision-updated', this.load);
    },
    methods: {
        emptyForm() {
            return {
                name: '', providerId: '', baseUrl: '', model: '', apiKey: '',
                reasoningEffort: '', maxTokens: 8192, contextWindow: 131072,
            };
        },
        async load() {
            try { this.models = (await getDshModels(wfc.getUserId())) || []; } catch (e) { this.models = []; }
        },
        openAdd() {
            this.editing = null;
            this.form = this.emptyForm();
            this.formError = '';
            this.showForm = true;
        },
        openEdit(m) {
            this.editing = m;
            this.form = {
                name: m.name, providerId: m.providerId || '', baseUrl: m.baseUrl, model: m.model, apiKey: '',
                reasoningEffort: m.reasoningEffort || '', maxTokens: m.maxTokens || 8192,
                contextWindow: m.contextWindow || 131072,
            };
            this.formError = '';
            this.showForm = true;
        },
        async save() {
            if (this.saving) return;
            this.formError = '';
            this.saving = true;
            try {
                const userId = wfc.getUserId();
                const result = this.editing
                    ? await updateDshModel(userId, this.editing.id, this.form)
                    : await addDshModel(userId, this.form);
                if (!result || !result.ok) {
                    this.formError = (result && result.error) || '保存失败';
                    return;
                }
                this.models = result.models || [];
                this.showForm = false;
                this.$notify({ title: '模型已保存', text: 'Host 已重启，新会话/切换模型后生效。', type: 'success' });
            } catch (e) {
                this.formError = (e && e.message) || '保存失败';
            } finally {
                this.saving = false;
            }
        },
        async remove(m) {
            if (!window.confirm(`删除模型「${m.name}」？`)) return;
            const result = await deleteDshModel(wfc.getUserId(), m.id);
            if (result && result.ok) {
                this.models = result.models || [];
                this.$notify({ title: '模型已删除', type: 'success' });
            } else {
                this.$notify({ title: '删除失败', text: (result && result.error) || '', type: 'error' });
            }
        },
    },
};
</script>

<style scoped>
.dsh-model-settings { display: flex; flex-direction: column; gap: 12px; }
.dsh-model-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; }
.dsh-model-head h2 { margin: 0 0 3px; font-size: 15px; }
.dsh-model-head p { margin: 0; font-size: 12px; color: #8a8f99; }
.dsh-model-card { border: 1px solid #e5e6eb; border-radius: 10px; padding: 14px; background: #fafbfc; }
.dsh-model-card.server { border-color: #b8c9f5; background: #f5f8ff; }
.dsh-model-card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
.dsh-model-card-head > div:first-child { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
.dsh-model-card-head strong { font-size: 14px; }
.dsh-model-badge { font-size: 10px; padding: 1px 6px; border-radius: 999px; background: #eef2f7; color: #475569; }
.dsh-model-badge.server { background: #e8f1ff; color: #1d4ed8; }
.dsh-model-badge.user { background: #eef2f7; color: #475569; }
.dsh-model-badge.default { background: #e7f7ed; color: #1a7f37; }
.dsh-model-state { font-size: 11px; color: #1a7f37; }
.dsh-model-state.missing { color: #b42318; }
.dsh-model-dl { display: grid; grid-template-columns: 78px 1fr; gap: 5px 8px; margin: 10px 0 0; font-size: 11px; }
.dsh-model-dl dt { color: #8a8f99; }
.dsh-model-dl dd { margin: 0; word-break: break-all; }
.dsh-model-actions { display: flex; gap: 4px; flex-shrink: 0; }
.dsh-link-btn.danger { color: #b42318; }
.dsh-model-warning { border: 1px solid #f1d18a; background: #fffbeb; border-radius: 10px; padding: 14px; }
.dsh-model-warning strong { font-size: 13px; color: #92400e; }
.dsh-model-warning p { margin: 4px 0 0; font-size: 12px; color: #a16207; line-height: 1.5; }
.dsh-model-empty { font-size: 12px; color: #8a8f99; padding: 4px 2px; }
.dsh-model-empty code { padding: 1px 4px; border-radius: 3px; background: #eef0f3; }
.dsh-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.dsh-field select { border: 1px solid #dfe3e8; border-radius: 7px; padding: 8px 9px; font-size: 12px; background: #fff; }
.dsh-advanced { margin: 0 0 10px; font-size: 12px; color: #6b7280; }
.dsh-advanced summary { cursor: pointer; margin-bottom: 8px; }
.dsh-form-error { color: #b42318; font-size: 12px; margin: 0 0 10px; }
@media (max-width: 720px) { .dsh-form-row { grid-template-columns: 1fr; } }
</style>
