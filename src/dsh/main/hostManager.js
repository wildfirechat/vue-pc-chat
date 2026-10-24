import fs from 'fs';
import path from 'path';
import { spawn, execFileSync } from 'child_process';
import { randomUUID } from 'crypto';
import { app, shell } from 'electron';

/**
 * 管理本机 DSH Host 子进程。
 *
 * Host 使用 dsh-plugin.js 直连 robot-gateway；Electron 不参与消息转发。
 * 这里只负责启动、停止、重启、日志与状态。
 */
export default class DshHostManager {
    constructor({ userDataPath, getWindow, onStatus }) {
        this.userDataPath = userDataPath;
        this.getWindow = getWindow;
        this.onStatus = onStatus;
        this.child = null;
        this.provision = null;
        this.userModels = [];
        this.hostId = this._loadHostId();
        this.overlayPath = null;
        this.logPath = path.join(userDataPath, 'logs', 'dsh-host.log');
        this.dshHome = process.env.WF_DSH_HOME || path.join(userDataPath, 'dsh-home');
        this.logStream = null;
        this.status = {
            state: 'stopped',
            pid: null,
            startedAt: null,
            lastError: null,
            robotId: null,
            gatewayUrl: null,
            profile: process.env.WF_DSH_PROFILE || 'wildfire',
            logPath: this.logPath,
            restarts: 0,
            hostId: this.hostId,
        };
        this.stopping = false;
        this.restartTimer = null;
        this.restartAttempts = 0;
        this._ensureLogDir();
    }

    _loadHostId() {
        const file = path.join(this.userDataPath, 'dsh-host-id');
        try {
            if (fs.existsSync(file)) {
                const value = fs.readFileSync(file, 'utf8').trim();
                if (value) return value;
            }
            const value = randomUUID();
            fs.mkdirSync(this.userDataPath, { recursive: true });
            fs.writeFileSync(file, value, { mode: 0o600 });
            return value;
        } catch (e) {
            return randomUUID();
        }
    }

    _runtimeRoot() {
        if (process.env.WF_DSH_RUNTIME) return process.env.WF_DSH_RUNTIME;
        const packaged = path.join(process.resourcesPath || '', 'dsh-runtime');
        if (fs.existsSync(path.join(packaged, 'dsh', 'lib', 'bin.js'))) return packaged;
        // 打包后只允许 resources/dsh-runtime；绝不回退宿主机的 dsh。
        if (app.isPackaged) return packaged;
        // 开发环境：Electron 的 resourcesPath 不是项目目录，使用仓库内 prepare 产物。
        return path.join(process.cwd(), 'build', 'dsh-runtime');
    }

    _ensureBundledHome(profile) {
        if (process.env.WF_DSH_HOME) return process.env.WF_DSH_HOME;
        if (profile !== 'wildfire') return null;
        try {
            const runtime = this._runtimeRoot();
            const bundledProfile = path.join(runtime, 'profile');
            const versionFile = path.join(runtime, 'VERSION');
            if (!fs.existsSync(bundledProfile) || !fs.existsSync(versionFile)) {
                // 打包版没有内置 profile 时直接失败，不能悄悄落到宿主机 ~/.dsh。
                return null;
            }
            let version = '';
            try { version = fs.readFileSync(versionFile, 'utf8'); } catch (e) { /* ignore */ }
            const home = path.join(this.userDataPath, 'dsh-home');
            const targetProfile = path.join(home, 'profiles', profile);
            const marker = path.join(home, '.runtime-version');
            const oldMarker = fs.existsSync(marker) ? fs.readFileSync(marker, 'utf8') : '';
            if (!fs.existsSync(targetProfile) || oldMarker !== version) {
                fs.mkdirSync(path.dirname(targetProfile), { recursive: true });
                fs.rmSync(targetProfile, { recursive: true, force: true });
                fs.cpSync(bundledProfile, targetProfile, { recursive: true, dereference: true, force: true });
                fs.writeFileSync(marker, version, { mode: 0o600 });
                this._appendLog(`materialized bundled profile ${profile} -> ${targetProfile}`);
            }
            return home;
        } catch (e) {
            this._appendLog(`materialize bundled profile failed: ${e.message}`);
            return null;
        }
    }

    _resolveCommand() {
        // 只接受本应用的显式覆盖，忽略宿主机的 DSH_COMMAND。
        if (process.env.WF_DSH_COMMAND) {
            return { command: process.env.WF_DSH_COMMAND, argsPrefix: [] };
        }
        const runtime = this._runtimeRoot();
        const node = path.join(runtime, 'node', process.platform === 'win32' ? 'node.exe' : path.join('bin', 'node'));
        const cli = path.join(runtime, 'dsh', 'lib', 'bin.js');
        if (fs.existsSync(node) && fs.existsSync(cli)) {
            return { command: node, argsPrefix: [cli] };
        }
        // 打包版和开发版都只允许内置 runtime；缺失时明确失败，绝不回退宿主机的 dsh。
        throw new Error('bundled DSH runtime missing; run npm run prepare-dsh-runtime');
    }

    _ensureLogDir() {
        try { fs.mkdirSync(path.dirname(this.logPath), { recursive: true }); } catch (e) { /* ignore */ }
    }

    _emit(patch) {
        this.status = { ...this.status, ...patch };
        try {
            if (this.onStatus) this.onStatus(this.status);
            const win = this.getWindow && this.getWindow();
            if (win && !win.isDestroyed() && win.webContents) {
                win.webContents.send('dsh-status', this.status);
            }
        } catch (e) { /* ignore */ }
    }

    _appendLog(line) {
        try {
            this._ensureLogDir();
            if (!this.logStream) {
                this.logStream = fs.createWriteStream(this.logPath, { flags: 'a', mode: 0o600 });
            }
            this.logStream.write(`[${new Date().toISOString()}] ${line}\n`);
        } catch (e) { /* ignore */ }
    }

    _writeOverlay(provision, userModels = []) {
        const robot = provision.robot || {};
        const workspaceRoot = path.join(this.userDataPath, 'dsh-workspaces');
        try { fs.mkdirSync(workspaceRoot, { recursive: true }); } catch (e) { /* ignore */ }
        const ai = provision.ai || {};
        const providers = [];
        if (ai.baseUrl && ai.model && ai.apiKey) {
            providers.push({
                id: 'default',
                displayName: 'DSH (server default)',
                baseUrl: ai.baseUrl,
                apiKey: ai.apiKey,
                apiKeyEnv: 'WF_AI_API_KEY',
                model: ai.model,
                reasoningEffort: ai.reasoningEffort,
                maxTokens: ai.maxTokens,
                contextWindow: Number(ai.contextWindow) || 1048576,
            });
        }
        (userModels || []).forEach((m, index) => {
            if (!m || !m.baseUrl || !m.model || !m.apiKey) return;
            providers.push({
                id: m.providerId || `custom${index + 1}`,
                displayName: m.name || `自定义模型 ${index + 1}`,
                baseUrl: m.baseUrl,
                apiKey: m.apiKey,
                apiKeyEnv: `WF_USER_AI_KEY_${index}`,
                model: m.model,
                reasoningEffort: m.reasoningEffort,
                maxTokens: m.maxTokens,
                contextWindow: m.contextWindow,
            });
        });

        const lines = [
            '- id: wildfire',
            '  config:',
            `    gatewayUrl: ${JSON.stringify(robot.gatewayUrl || '')}`,
            `    robotId: ${JSON.stringify(robot.robotId || '')}`,
            `    robotSecret: ${JSON.stringify(robot.robotSecret || '')}`,
            '    workspace:',
            `      root: ${JSON.stringify(workspaceRoot)}`,
            '    session:',
            '      preset: standard',
            // 本应用只使用 provision / 用户添加的 OpenAI-compatible provider；
            // 关闭 dsh 内置 DeepSeek 路由，避免 /model 里出现没有凭据的
            // deepseek-flash / deepseek-v4-pro 两个不可用模型。
            '- id: llm-deepseek',
            '  disabled: true',
            '- id: llm-deepseek-account',
            '  disabled: true',
        ];
        if (providers.length) {
            lines.push('- id: llm-pi-ai', "  name: '@deepseek-ai/dsh-llm-pi-ai'", '  config:', '    providers:');
            for (const p of providers) {
                lines.push(
                    `      ${p.id}:`,
                    `        displayName: ${JSON.stringify(p.displayName)}`,
                    '        api: openai-completions',
                    `        baseURL: ${JSON.stringify(p.baseUrl)}`,
                    `        apiKeyEnv: ${p.apiKeyEnv}`,
                    '        models:',
                    `          - id: ${JSON.stringify(p.model)}`,
                    `            name: ${JSON.stringify(p.model)}`,
                    `            contextWindow: ${Number(p.contextWindow) || 131072}`,
                    `            maxTokens: ${Number(p.maxTokens) || 8192}`,
                    p.reasoningEffort ? `            reasoningEfforts: { ${JSON.stringify(p.reasoningEffort)}: ${JSON.stringify(p.reasoningEffort)} }` : null,
                    '            input: [ text, image ]',
                );
            }
            const def = providers[0];
            lines.push(
                '- id: agent-default-model',
                '  config:',
                `    provider: ${JSON.stringify(def.id)}`,
                `    model: ${JSON.stringify(def.model)}`,
                def.reasoningEffort ? `    reasoningEffort: ${JSON.stringify(def.reasoningEffort)}` : null,
            );
        }
        lines.push('');
        const overlay = lines.join('\n');
        const file = path.join(this.userDataPath, 'dsh-runtime-patch.yml');
        fs.writeFileSync(file, overlay, { mode: 0o600 });
        try { fs.chmodSync(file, 0o600); } catch (e) { /* ignore */ }
        this.overlayPath = file;
        return file;
    }

    _writeRuntimeJson(provision) {
        const runtime = {
            robot: provision.robot || {},
            ai: provision.ai || {},
            features: provision.features || {},
            hostId: this.hostId,
            updatedAt: Date.now(),
        };
        const file = path.join(this.userDataPath, 'dsh-runtime.json');
        fs.writeFileSync(file, JSON.stringify(runtime, null, 2), { mode: 0o600 });
        try { fs.chmodSync(file, 0o600); } catch (e) { /* ignore */ }
        return file;
    }

    async start(provision, isRestart = false, userModels = null) {
        if (!provision || !provision.robot) throw new Error('missing provision');
        if (!isRestart) this.restartAttempts = 0;
        if (userModels !== null) this.userModels = Array.isArray(userModels) ? userModels : [];
        await this.stop(true);
        this.stopping = false;
        this.provision = provision;
        const overlay = this._writeOverlay(provision, this.userModels);
        this._writeRuntimeJson(provision);

        const resolved = this._resolveCommand();
        const command = resolved.command;
        const profile = process.env.WF_DSH_PROFILE || 'wildfire';
        const bundledHome = this._ensureBundledHome(profile);
        if (!bundledHome) {
            throw new Error('bundled DSH profile missing or cannot be materialized');
        }
        this.dshHome = process.env.WF_DSH_HOME || bundledHome;
        const args = [...resolved.argsPrefix, '--profile', profile, '--patch', overlay];
        const robot = provision.robot || {};
        const env = {
            ...process.env,
            WF_GATEWAY_URL: robot.gatewayUrl || '',
            WF_ROBOT_ID: robot.robotId || '',
            WF_ROBOT_SECRET: robot.robotSecret || '',
            WF_OWNER_USER_ID: robot.owner || '',
            WF_DSH_HOST_ID: this.hostId,
            WF_PARENT_PID: String(process.pid),
            WF_DSH_TAGS: process.env.WF_DSH_TAGS || '',
            WF_DSH_DISPLAY_NAME: robot.displayName || '',
            WF_AI_BASE_URL: (provision.ai && provision.ai.baseUrl) || '',
            WF_AI_API_KEY: (provision.ai && provision.ai.apiKey) || '',
            WF_AI_MODEL: (provision.ai && provision.ai.model) || '',
        };
        (this.userModels || []).forEach((m, index) => {
            env[`WF_USER_AI_KEY_${index}`] = m.apiKey || '';
        });
        env.DSH_HOME = process.env.WF_DSH_HOME || bundledHome;
        env.DSH_PROFILE = profile;
        // 不继承宿主机的 DeepSeek 凭据；内置 deepseek-official 路由也已禁用。
        delete env.DEEPSEEK_API_KEY;

        this._emit({
            state: 'starting',
            lastError: null,
            robotId: robot.robotId,
            gatewayUrl: robot.gatewayUrl,
            profile,
            command,
            restarts: this.restartAttempts,
        });
        this._appendLog(`runtime: ${this._runtimeRoot()} (bundled=${fs.existsSync(path.join(this._runtimeRoot(), 'dsh', 'lib', 'bin.js'))})`);
        this._appendLog(`starting: ${command} ${args.join(' ')}`);
        this._appendLog(`gateway=${robot.gatewayUrl} robot=${robot.robotId}`);

        try {
            const child = spawn(command, args, {
                cwd: this.userDataPath,
                env,
                stdio: ['ignore', 'pipe', 'pipe'],
                windowsHide: true,
            });
            this.child = child;
            this._emit({ pid: child.pid || null, startedAt: Date.now(), state: 'running' });
            child.stdout.on('data', data => this._appendLog(`[stdout] ${String(data).trimEnd()}`));
            child.stderr.on('data', data => this._appendLog(`[stderr] ${String(data).trimEnd()}`));
            child.on('error', err => {
                const detail = err && err.message ? err.message : String(err);
                this._appendLog(`spawn error: ${detail} command=${command} args=${args.join(' ')}`);
                this._emit({ state: 'error', lastError: `${detail} (command=${command})` });
            });
            child.on('exit', (code, signal) => {
                this._appendLog(`exited code=${code} signal=${signal}`);
                this.child = null;
                if (this.stopping) {
                    this._emit({ state: 'stopped', pid: null });
                    return;
                }
                this.restartAttempts += 1;
                const restarts = this.restartAttempts;
                if (restarts <= 2) {
                    this._emit({ state: 'restarting', pid: null, restarts, lastError: `host exited (${code}/${signal})` });
                    this.restartTimer = setTimeout(() => {
                        if (this.provision && !this.stopping) {
                            this.start(this.provision, true).catch(e => this._appendLog(`restart failed: ${e.message}`));
                        }
                    }, 2000 * restarts);
                } else {
                    this._emit({ state: 'crashed', pid: null, restarts, lastError: `host exited (${code}/${signal})` });
                }
            });
        } catch (e) {
            this._emit({ state: 'error', lastError: e.message });
            throw e;
        }
        return this.status;
    }

    async stop(silent = false) {
        this.stopping = true;
        if (this.restartTimer) {
            clearTimeout(this.restartTimer);
            this.restartTimer = null;
        }
        const child = this.child;
        this.child = null;
        if (child && !child.killed) {
            if (process.platform === 'win32' && child.pid) {
                // Windows 上 child.kill 只杀直接进程；DSH 可能还有子进程。
                try {
                    execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', timeout: 5000 });
                } catch (e) { /* process may already be gone */ }
            } else {
                try {
                    child.kill('SIGTERM');
                } catch (e) { /* ignore */ }
            }
            await new Promise(resolve => {
                const timer = setTimeout(() => {
                    try { child.kill('SIGKILL'); } catch (e) { /* ignore */ }
                    resolve();
                }, 5000);
                child.once('exit', () => { clearTimeout(timer); resolve(); });
            });
        }
        try {
            if (this.overlayPath && fs.existsSync(this.overlayPath)) fs.unlinkSync(this.overlayPath);
        } catch (e) { /* ignore */ }
        this.overlayPath = null;
        if (!silent) this._emit({ state: 'stopped', pid: null });
        return this.status;
    }

    async restart(userModels = null) {
        if (!this.provision) throw new Error('no provision to restart');
        return this.start(this.provision, false, userModels === null ? this.userModels : userModels);
    }

    _readGatewayStatus() {
        try {
            const file = path.join(this.dshHome, 'wildfire-gateway-status.json');
            if (!fs.existsSync(file)) return { connected: false, state: 'unknown' };
            const data = JSON.parse(fs.readFileSync(file, 'utf8'));
            const age = Date.now() - Number(data.updatedAt || 0);
            return {
                ...data,
                state: data.connected ? 'connected' : 'disconnected',
                stale: age > 90000,
            };
        } catch (e) {
            return { connected: false, state: 'unknown', error: e.message };
        }
    }

    getStatus() {
        return { ...this.status, gateway: this._readGatewayStatus(), dshHome: this.dshHome };
    }

    getLogTail(maxLines = 300) {
        try {
            if (!fs.existsSync(this.logPath)) return '';
            const stat = fs.statSync(this.logPath);
            const start = Math.max(0, stat.size - 128 * 1024);
            const fd = fs.openSync(this.logPath, 'r');
            const buf = Buffer.alloc(stat.size - start);
            fs.readSync(fd, buf, 0, buf.length, start);
            fs.closeSync(fd);
            const lines = buf.toString('utf8').split(/\r?\n/);
            return lines.slice(-Math.max(1, maxLines)).join('\n');
        } catch (e) {
            return `读取日志失败: ${e.message}`;
        }
    }

    listFiles(dir, limit = 30) {
        try {
            if (!dir || !fs.existsSync(dir)) return [];
            return fs.readdirSync(dir, { withFileTypes: true })
                .slice(0, Math.max(1, limit))
                .map(entry => {
                    const full = path.join(dir, entry.name);
                    let size = 0;
                    try { size = entry.isFile() ? fs.statSync(full).size : 0; } catch (e) { /* ignore */ }
                    return { name: entry.name, path: full, isDir: entry.isDirectory(), size };
                })
                .sort((a, b) => (a.isDir === b.isDir ? a.name.localeCompare(b.name) : (a.isDir ? -1 : 1)));
        } catch (e) {
            return [];
        }
    }

    getPlugins() {
        const profileDir = path.join(this.dshHome, 'profiles', 'wildfire');
        const plugins = [];
        const readPkg = (dir) => {
            try { return JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')); } catch (e) { return null; }
        };
        const core = readPkg(path.join(this._runtimeRoot(), 'dsh'));
        if (core) {
            plugins.push({
                id: core.name || '@deepseek-ai/dsh',
                name: 'DeepSeek Harness',
                version: core.version || '',
                description: '内置 DSH Agent runtime / LLM / 工具系统',
                kind: 'core',
                enabled: true,
            });
        }
        const wildfire = readPkg(path.join(profileDir, 'node_modules', '@wildfirechat', 'dsh-wildfire'));
        if (wildfire) {
            plugins.push({
                id: wildfire.name,
                name: 'Wildfire IM 渠道',
                version: wildfire.version || '',
                description: '通过 robot-gateway 接入野火IM群聊',
                kind: 'channel',
                enabled: true,
            });
        }
        // 可选的 DSH 官方 UI/工具插件：从 profile 的依赖里挑出 dsh 插件描述。
        try {
            const pkg = readPkg(profileDir);
            for (const dep of Object.keys((pkg && pkg.dependencies) || {})) {
                if (dep === '@wildfirechat/dsh-wildfire') continue;
                const info = readPkg(path.join(profileDir, 'node_modules', dep));
                if (info && info.dsh) {
                    plugins.push({
                        id: dep,
                        name: info.dsh.title || dep,
                        version: info.version || '',
                        description: info.description || '',
                        kind: 'plugin',
                        enabled: true,
                    });
                }
            }
        } catch (e) { /* ignore */ }
        return { plugins, profileDir };
    }

    getWorkspaces() {
        try {
            const file = path.join(this.dshHome, 'wildfire-workspaces.json');
            if (!fs.existsSync(file)) return {};
            const data = JSON.parse(fs.readFileSync(file, 'utf8'));
            return (data && data.overrides) || {};
        } catch (e) {
            return {};
        }
    }

    getRouting(limit = 100) {
        try {
            const file = path.join(this.dshHome, 'wildfire-routing.jsonl');
            if (!fs.existsSync(file)) return [];
            const lines = fs.readFileSync(file, 'utf8').trim().split(/\r?\n/).filter(Boolean);
            return lines.slice(-Math.max(1, limit)).map(line => {
                try { return JSON.parse(line); } catch (e) { return null; }
            }).filter(Boolean).reverse();
        } catch (e) {
            return [];
        }
    }

    openLog() {
        try {
            this._ensureLogDir();
            if (!fs.existsSync(this.logPath)) fs.writeFileSync(this.logPath, '', { mode: 0o600 });
            shell.openPath(this.logPath);
            return true;
        } catch (e) {
            return false;
        }
    }
}
