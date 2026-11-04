<template>
    <section class="dsh-plugins" :class="{ 'dsh-plugins-embedded': embedded }">
        <header class="dsh-plugins-head">
            <div>
                <h1>插件</h1>
                <p>当前 profile 已加载的 DSH 插件。</p>
            </div>
            <div class="dsh-plugins-actions">
                <button class="dsh-top-btn" @click="openProfileDir">打开插件目录</button>
                <button class="dsh-top-btn" @click="load">刷新</button>
            </div>
        </header>

        <div v-if="!plugins.length" class="dsh-plugins-empty">
            暂无插件信息。
        </div>

        <div v-for="p in plugins" :key="p.id" class="dsh-plugin-card">
            <div class="dsh-plugin-icon" :class="'kind-' + p.kind">
                {{ p.kind === 'core' ? 'DSH' : (p.kind === 'channel' ? 'IM' : 'P') }}
            </div>
            <div class="dsh-plugin-main">
                <div class="dsh-plugin-title">
                    <strong>{{ p.name }}</strong>
                    <span class="dsh-plugin-version">v{{ p.version || '-' }}</span>
                    <span class="dsh-plugin-state">已启用</span>
                </div>
                <p class="mono dsh-plugin-id">{{ p.id }}</p>
                <p class="dsh-plugin-desc">{{ p.description || '—' }}</p>
            </div>
        </div>

        <p class="dsh-plugins-tip">
            插件安装/升级目前请通过 DSH profile 管理；这里展示运行中的插件清单。
        </p>
    </section>
</template>

<script>
import { getDshPlugins, openDshPath } from '../../../dsh/renderer/dshClient';

export default {
    name: 'DshPlugins',
    props: {
        embedded: { type: Boolean, default: false },
    },
    data() {
        return { plugins: [], profileDir: '' };
    },
    mounted() { this.load(); },
    methods: {
        async load() {
            try {
                const result = await getDshPlugins();
                this.plugins = (result && result.plugins) || [];
                this.profileDir = (result && result.profileDir) || '';
            } catch (e) {
                this.plugins = [];
            }
        },
        async openProfileDir() {
            if (this.profileDir) await openDshPath(this.profileDir);
        },
    },
};
</script>

<style scoped>
.dsh-plugins { flex: 1; overflow-y: auto; padding: 22px 26px 40px; background: #fff; box-sizing: border-box; }
.dsh-plugins.dsh-plugins-embedded { flex: none; overflow: visible; padding: 0; background: transparent; }
.dsh-plugins-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 18px; }
.dsh-plugins-head h1 { margin: 0 0 3px; font-size: 18px; }
.dsh-plugins-head p { margin: 0; font-size: 12px; color: #8a8f99; }
.dsh-plugins-actions { display: flex; gap: 8px; }
.dsh-plugins-empty { padding: 40px 0; text-align: center; color: #8a8f99; font-size: 12px; }
.dsh-plugin-card { display: flex; gap: 12px; padding: 14px; border: 1px solid #e8eaee; border-radius: 10px; margin-bottom: 10px; background: #fafbfc; }
.dsh-plugin-icon { width: 34px; height: 34px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; background: #eef2f7; color: #475569; flex: 0 0 auto; }
.dsh-plugin-icon.kind-core { background: #e8f1ff; color: #1d4ed8; }
.dsh-plugin-icon.kind-channel { background: #e7f7ed; color: #1a7f37; }
.dsh-plugin-main { min-width: 0; flex: 1; }
.dsh-plugin-title { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
.dsh-plugin-title strong { font-size: 13px; }
.dsh-plugin-version { font-size: 10px; color: #8a8f99; }
.dsh-plugin-state { margin-left: auto; font-size: 10px; color: #1a7f37; background: #e7f7ed; padding: 1px 6px; border-radius: 999px; }
.dsh-plugin-id { margin: 3px 0; font-size: 10px; color: #9aa0a8; }
.dsh-plugin-desc { margin: 0; font-size: 12px; color: #6b7280; line-height: 1.45; }
.dsh-plugins-tip { margin-top: 18px; font-size: 11px; color: #9aa0a8; }
</style>
