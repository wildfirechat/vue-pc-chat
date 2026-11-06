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
        // 最近一次写入 dsh-runtime-patch.yml 时生成的模型目录（与宿主实际加载
        // 的一致）；渲染进程用它渲染「新会话」的模型 / 推理等级选择。
        this.modelCatalog = [];
        this.hostId = this._loadHostId();
        this.overlayPath = null;
        this.logPath = path.join(userDataPath, 'logs', 'dsh-host.log');
        this.dshHome = process.env.WF_DSH_HOME || path.join(userDataPath, 'dsh-home');
        this.logStream = null;
        this.permissions = null;
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
            permissions: null,
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

    _customEnvName(providerId) {
        return 'WF_AI_CUSTOM_' + String(providerId || '')
            .toUpperCase().replace(/[^A-Z0-9]/g, '_').replace(/_+/g, '_') + '_KEY';
    }

    /**
     * 模型可选的推理等级。dsh 只提供模型在 `reasoningEfforts` 里声明过的等级，
     * 之前只声明部署默认值（如 high），所以面板里永远只有一个选项。这里声明
     * 常用三档（low/medium/high）+ 部署默认值，让客户端可以按会话选择；
     * 默认值仍是部署配置，用户不选时行为不变。
     */
    _effortLevels(configured) {
        const value = String(configured || '').trim();
        if (!value) return [];
        const order = ['minimal', 'low', 'medium', 'high', 'xhigh', 'max'];
        const levels = ['low', 'medium', 'high'];
        if (!levels.includes(value)) levels.push(value);
        return levels.sort((a, b) => order.indexOf(a) - order.indexOf(b));
    }

    /** `reasoningEfforts` 的 YAML 行内映射（等级 → 供应商侧写法，同名）。 */
    _effortYaml(configured) {
        const levels = this._effortLevels(configured);
        return `{ ${levels.map((l) => `${JSON.stringify(l)}: ${JSON.stringify(l)}`).join(', ')} }`;
    }

    /**
     * 「新会话」可选的模型目录（与 dsh-runtime-patch.yml 同源）。宿主未启动时
     * 返回空数组，客户端会退回只显示默认模型。
     */
    modelCatalogData() {
        return Array.isArray(this.modelCatalog) ? this.modelCatalog : [];
    }

    _writeOverlay(provision, userModels = []) {
        const robot = provision.robot || {};
        const workspaceRoot = path.join(this.userDataPath, 'dsh-workspaces');
        try { fs.mkdirSync(workspaceRoot, { recursive: true }); } catch (e) { /* ignore */ }
        const ai = provision.ai || {};
        // All model traffic must go through the backend relay so the server can
        // authenticate, meter and enforce per-user quotas. User-supplied
        // providers are intentionally ignored here.
        const modelIds = [];
        const addModel = (id) => {
            const text = String(id || '').trim();
            if (text && !modelIds.includes(text)) modelIds.push(text);
        };
        addModel(ai.model);
        (Array.isArray(ai.allowedModels) ? ai.allowedModels : []).forEach(addModel);
        const aiUsable = !!(ai.baseUrl && ai.apiKey && ai.enabled === true
            && ai.configured === true && modelIds.length);

        const lines = [
            '- id: wildfire',
            '  config:',
            `    gatewayUrl: ${JSON.stringify(robot.gatewayUrl || '')}`,
            `    robotId: ${JSON.stringify(robot.robotId || '')}`,
            // 不把 robotSecret 写进磁盘 YAML：插件从环境变量读取。
            '    robotSecretEnv: "WF_ROBOT_SECRET"',
            '    workspace:',
            `      root: ${JSON.stringify(workspaceRoot)}`,
            '      allowCwdCommand: true',
            '    model:',
            '      allowModelCommand: true',
            '    session:',
            '      preset: standard',
            // 权限默认值：个人机器人只服务 owner；群成员可对话，但危险工具
            // 必须由 owner 审批；群内管理命令仅创建者/管理员可执行。
            '    access:',
            `      adminUsers: ${JSON.stringify(robot.owner ? [robot.owner] : [])}`,
            '      privateOwnerOnly: true',
            '    interaction:',
            '      approvalOwnerOnly: true',
            '    security:',
            '      allowGuestTurns: true',
            // 本应用只使用 provision / 用户添加的 OpenAI-compatible provider；
            // 关闭 dsh 内置 DeepSeek 路由，避免 /model 里出现没有凭据的
            // deepseek-flash / deepseek-v4-pro 两个不可用模型。
            '- id: llm-deepseek',
            '  disabled: true',
            '- id: llm-deepseek-account',
            '  disabled: true',
        ];
        this.permissions = {
            sandbox: 'workspace-write',
            approval: 'ask',
            privateOwnerOnly: true,
            approvalOwnerOnly: true,
            allowGuestTurns: true,
            adminUsers: robot.owner ? [robot.owner] : [],
            workspaceRoot,
            unknownGroups: 'ignored',
        };
        this.status.permissions = this.permissions;
        // Direct user-defined providers. They intentionally bypass the AI
        // relay: no clientKey, quota, billing or audit is applied to them.
        const customProviders = [];
        const customByProvider = new Map();
        for (const m of (Array.isArray(userModels) ? userModels : [])) {
            if (!m || !m.baseUrl || !m.model || !m.apiKey) continue;
            const providerId = String(m.providerId || '').trim().toLowerCase();
            if (!providerId || providerId === 'default' || !/^[a-z0-9][a-z0-9_-]*$/.test(providerId)) continue;
            let provider = customByProvider.get(providerId);
            if (!provider) {
                provider = { providerId, name: m.name || providerId, models: [] };
                customByProvider.set(providerId, provider);
                customProviders.push(provider);
            }
            if (!provider.models.some(x => x.model === m.model)) {
                provider.models.push(m);
            }
        }

        if (aiUsable || customProviders.length) {
            lines.push(
                '- id: llm-pi-ai',
                "  name: '@deepseek-ai/dsh-llm-pi-ai'",
                '  config:',
                '    providers:',
            );
            if (aiUsable) {
                lines.push(
                    '      default:',
                    '        displayName: "DSH (server relay)"',
                    '        api: openai-completions',
                    `        baseURL: ${JSON.stringify(ai.baseUrl)}`,
                    '        apiKeyEnv: "WF_AI_API_KEY"',
                    '        models:',
                );
                for (const id of modelIds) {
                    lines.push(
                        `          - id: ${JSON.stringify(id)}`,
                        `            name: ${JSON.stringify(id)}`,
                        `            contextWindow: ${Number(ai.contextWindow) || 1048576}`,
                        `            maxTokens: ${Number(ai.maxTokens) || 8192}`,
                        ai.reasoningEffort
                            ? `            reasoningEfforts: ${this._effortYaml(ai.reasoningEffort)}`
                            : null,
                        '            input: [ text, image ]',
                    );
                }
            }
            for (const provider of customProviders) {
                lines.push(
                    `      ${provider.providerId}:`,
                    `        displayName: ${JSON.stringify(provider.name)}`,
                    '        api: openai-completions',
                    `        baseURL: ${JSON.stringify(provider.models[0].baseUrl)}`,
                    `        apiKeyEnv: "${this._customEnvName(provider.providerId)}"`,
                    '        models:',
                );
                for (const m of provider.models) {
                    lines.push(
                        `          - id: ${JSON.stringify(m.model)}`,
                        `            name: ${JSON.stringify(m.name || m.model)}`,
                        `            contextWindow: ${Number(m.contextWindow) || 1048576}`,
                        `            maxTokens: ${Number(m.maxTokens) || 393216}`,
                        m.reasoningEffort
                            ? `            reasoningEfforts: ${this._effortYaml(m.reasoningEffort)}`
                            : null,
                        '            input: [ text, image ]',
                    );
                }
            }
            const defaultProvider = aiUsable ? 'default' : customProviders[0].providerId;
            const defaultModel = aiUsable
                ? (ai.model || modelIds[0])
                : customProviders[0].models[0].model;
            const defaultReasoning = aiUsable ? ai.reasoningEffort : customProviders[0].models[0].reasoningEffort;
            lines.push(
                '- id: agent-default-model',
                '  config:',
                `    provider: ${JSON.stringify(defaultProvider)}`,
                `    model: ${JSON.stringify(defaultModel)}`,
                defaultReasoning ? `    reasoningEffort: ${JSON.stringify(defaultReasoning)}` : null,
            );
        }
        // 与上面写出的 provider/models 同源：客户端「新会话」据此渲染模型与
        // 推理等级选择（用运行时真实的 provider/model id）。
        const defProvider = aiUsable ? 'default' : (customProviders[0] ? customProviders[0].providerId : '');
        const defModel = aiUsable
            ? (ai.model || modelIds[0] || '')
            : (customProviders[0] ? customProviders[0].models[0].model : '');
        const catalog = [];
        if (aiUsable) {
            for (const id of modelIds) {
                catalog.push({
                    provider: 'default',
                    id,
                    name: id,
                    efforts: this._effortLevels(ai.reasoningEffort),
                    defaultEffort: String(ai.reasoningEffort || ''),
                    isDefault: defProvider === 'default' && defModel === id,
                });
            }
        }
        for (const provider of customProviders) {
            for (const m of provider.models) {
                catalog.push({
                    provider: provider.providerId,
                    id: m.model,
                    name: m.name || m.model,
                    efforts: this._effortLevels(m.reasoningEffort),
                    defaultEffort: String(m.reasoningEffort || ''),
                    isDefault: defProvider === provider.providerId && defModel === m.model,
                });
            }
        }
        this.modelCatalog = catalog;
        lines.push('');
        const overlay = lines.join('\n');
        const file = path.join(this.userDataPath, 'dsh-runtime-patch.yml');
        fs.writeFileSync(file, overlay, { mode: 0o600 });
        try { fs.chmodSync(file, 0o600); } catch (e) { /* ignore */ }
        this.overlayPath = file;
        return file;
    }

    _writeRuntimeJson(provision) {
        const robot = { ...(provision.robot || {}) };
        const ai = { ...(provision.ai || {}) };
        delete robot.robotSecret;
        delete ai.apiKey;
        const runtime = {
            robot,
            ai,
            features: provision.features || {},
            permissions: this.permissions,
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
        for (const m of (Array.isArray(this.userModels) ? this.userModels : [])) {
            if (m && m.apiKey && m.providerId) {
                env[this._customEnvName(m.providerId)] = m.apiKey;
            }
        }
        env.DSH_HOME = process.env.WF_DSH_HOME || bundledHome;
        env.DSH_PROFILE = profile;
        // 强制桌面端默认权限：不继承构建机/宿主机的 DSH 权限模式（例如
        // 用户全局设了 danger-full-access，不能悄悄带进本应用）。
        env.DSH_PERMISSION_MODE = 'workspace-write';
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
        return {
            ...this.status,
            gateway: this._readGatewayStatus(),
            permissions: this.permissions,
            dshHome: this.dshHome,
        };
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

    /** List all entries in a workspace directory (lazy file-tree browsing). */
    listDirectory(dir) {
        try {
            if (!dir || !fs.existsSync(dir)) return [];
            return fs.readdirSync(dir, { withFileTypes: true })
                .map(entry => {
                    const full = path.join(dir, entry.name);
                    let size = 0;
                    let mtime = 0;
                    try {
                        const st = fs.statSync(full);
                        size = st.size;
                        mtime = st.mtimeMs;
                    } catch (e) { /* ignore */ }
                    return {
                        name: entry.name,
                        path: full,
                        isDir: entry.isDirectory(),
                        size,
                        mtime,
                    };
                })
                .sort((a, b) => (a.isDir === b.isDir ? a.name.localeCompare(b.name) : (a.isDir ? -1 : 1)));
        } catch (e) {
            return [];
        }
    }

    /** Read a workspace file for the preview panel (text / image / binary). */
    readFile(filePath) {
        try {
            if (!filePath) return { ok: false, error: 'missing path' };
            const st = fs.statSync(filePath);
            if (!st.isFile()) return { ok: false, error: '不是普通文件' };
            const ext = path.extname(filePath).slice(1).toLowerCase();
            const imageMimes = {
                png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
                webp: 'image/webp', bmp: 'image/bmp', ico: 'image/x-icon', avif: 'image/avif',
            };
            const maxTextBytes = 1024 * 1024;
            const maxImageBytes = 10 * 1024 * 1024;
            if (imageMimes[ext]) {
                if (st.size > maxImageBytes) return { ok: false, error: '图片过大，无法预览' };
                const data = fs.readFileSync(filePath);
                return {
                    ok: true,
                    kind: 'image',
                    mime: imageMimes[ext],
                    dataUrl: `data:${imageMimes[ext]};base64,${data.toString('base64')}`,
                    size: st.size,
                };
            }
            const readSize = Math.min(st.size, maxTextBytes);
            const fd = fs.openSync(filePath, 'r');
            const buf = Buffer.alloc(readSize);
            let bytes = 0;
            try {
                bytes = fs.readSync(fd, buf, 0, readSize, 0);
            } finally {
                fs.closeSync(fd);
            }
            const data = buf.subarray(0, bytes);
            if (data.includes(0)) {
                return { ok: true, kind: 'binary', size: st.size };
            }
            return {
                ok: true,
                kind: 'text',
                content: data.toString('utf8'),
                size: st.size,
                truncated: st.size > maxTextBytes,
            };
        } catch (e) {
            return { ok: false, error: e && e.message ? e.message : String(e) };
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

    /** Permission audit trail written by the plugin (newest first). */
    getAudit(limit = 100) {
        try {
            const file = path.join(this.dshHome, 'wildfire-audit.jsonl');
            if (!fs.existsSync(file)) return [];
            const lines = fs.readFileSync(file, 'utf8').trim().split(/\r?\n/).filter(Boolean);
            return lines.slice(-Math.max(1, Math.min(500, limit))).map(line => {
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
