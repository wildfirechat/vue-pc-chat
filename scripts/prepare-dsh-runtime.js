#!/usr/bin/env node
/**
 * Prepare a self-contained DSH runtime under build/dsh-runtime.
 *
 * Source:
 *   - Node: current node (must be >= 22.19) or DSH_NODE_BINARY
 *   - DSH:  DSH_SOURCE or `npm root -g` + @deepseek-ai/dsh
 *   - Profile: DSH_PROFILE_SOURCE or ~/.dsh/profiles/wildfire
 *
 * The copied profile must already contain the wildfire plugin and its
 * node_modules. build/dsh-runtime/{node,dsh,profile} are gitignored; only the
 * README is tracked.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
if (process.env.SKIP_DSH_RUNTIME === '1') {
    console.log('[prepare-dsh-runtime] skipped (SKIP_DSH_RUNTIME=1)');
    process.exit(0);
}
const dest = path.join(root, 'build', 'dsh-runtime');
const isWin = process.platform === 'win32';

function fail(message) {
    console.error(`[prepare-dsh-runtime] ${message}`);
    process.exit(1);
}

function copyDir(from, to) {
    fs.rmSync(to, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.cpSync(from, to, { recursive: true, dereference: true, force: true });
}

function materializeSymlinks(root) {
    let count = 0;
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
        const full = path.join(root, entry.name);
        if (entry.isSymbolicLink()) {
            const target = fs.realpathSync(full);
            const stat = fs.statSync(target);
            fs.rmSync(full, { recursive: true, force: true });
            if (stat.isDirectory()) {
                copyDir(target, full);
            } else {
                fs.copyFileSync(target, full);
                fs.chmodSync(full, stat.mode);
            }
            count++;
        } else if (entry.isDirectory()) {
            count += materializeSymlinks(full);
        }
    }
    return count;
}

function sanitizeProfile(profileDest) {
    // 绝不把构建机器的 ~/.dsh 配置、备份、lockfile 带进安装包。
    for (const name of fs.readdirSync(profileDest)) {
        if (name.startsWith('cordis.patch.yml.bak-') || name === 'pnpm-lock.yaml' || name === 'pnpm-workspace.yaml') {
            fs.rmSync(path.join(profileDest, name), { recursive: true, force: true });
        }
    }
    fs.rmSync(path.join(profileDest, '.plugin-manager'), { recursive: true, force: true });

    // 只保留一个最小、无宿主机信息的 wildfire patch；真实 gateway/robot/workspace
    // 与模型由 Host 的运行时 overlay 注入。
    fs.writeFileSync(path.join(profileDest, 'cordis.patch.yml'), `- insert:
    - id: tool-ask-user
      name: '@deepseek-ai/dsh-tool-ask-user'
    - id: wildfire
      name: '@wildfirechat/dsh-wildfire'
      config:
        gatewayUrl: ""
        robotId: ""
        robotSecret: ""
        workspace:
          root: "."
`);

    // profile package.json 不再引用构建机的绝对 tgz 路径。
    const packageFile = path.join(profileDest, 'package.json');
    let pkg = {};
    try { pkg = JSON.parse(fs.readFileSync(packageFile, 'utf8')); } catch (e) { pkg = {}; }
    pkg.dependencies = { '@wildfirechat/dsh-wildfire': '0.2.0' };
    fs.writeFileSync(packageFile, JSON.stringify(pkg, null, 2) + '\n');

    // pnpm 的 store/lock 元数据会记录构建机路径；扁平 node_modules 已足够运行。
    for (const name of ['.pnpm', '.modules.yaml', '.pnpm-workspace-state-v1.json']) {
        fs.rmSync(path.join(profileDest, 'node_modules', name), { recursive: true, force: true });
    }
    // 插件 README 里可能有构建机源码路径，运行不需要。
    fs.rmSync(path.join(profileDest, 'node_modules', '@wildfirechat', 'dsh-wildfire', 'README.md'), { force: true });
}

function nodeVersionOk(version) {
    const m = /^v(\d+)\.(\d+)\.(\d+)/.exec(version || '');
    if (!m) return false;
    const major = Number(m[1]);
    const minor = Number(m[2]);
    return major > 22 || (major === 22 && minor >= 19) || major >= 24;
}

function resolveDshSource() {
    if (process.env.DSH_SOURCE) return process.env.DSH_SOURCE;
    const candidates = [
        path.join(root, 'build', 'vendor', '@deepseek-ai', 'dsh'),
        path.join(root, 'build', '.dsh-deps', 'node_modules', '@deepseek-ai', 'dsh'),
        // 已经 prepare 过的 runtime：重复打包时直接复用，避免再次 npm install。
        path.join(root, 'build', 'dsh-runtime', 'dsh'),
    ];
    for (const candidate of candidates) {
        if (fs.existsSync(path.join(candidate, 'lib', 'bin.js'))) return candidate;
    }
    // 不要求全局安装 dsh：在构建目录临时 npm install，产物随包分发。
    const depsDir = path.join(root, 'build', '.dsh-deps');
    const version = process.env.DSH_VERSION || '0.2.0-rc.2';
    console.log(`[prepare-dsh-runtime] installing @deepseek-ai/dsh@${version} into build/.dsh-deps`);
    fs.mkdirSync(depsDir, { recursive: true });
    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    try {
        execFileSync(npm, ['install', '--prefix', depsDir, '--no-save', '--no-package-lock', `@deepseek-ai/dsh@${version}`], { stdio: 'inherit' });
    } catch (e) {
        fail(`cannot install @deepseek-ai/dsh@${version}: ${e.message}`);
    }
    const installed = path.join(depsDir, 'node_modules', '@deepseek-ai', 'dsh');
    if (!fs.existsSync(path.join(installed, 'lib', 'bin.js'))) fail(`installed dsh not found: ${installed}`);
    return installed;
}

const nodeBinary = process.env.DSH_NODE_BINARY || process.execPath;
if (!nodeVersionOk(process.version)) {
    fail(`current Node ${process.version} is too old; need >=22.19. Set DSH_NODE_BINARY to a supported node.`);
}
if (!fs.existsSync(nodeBinary)) fail(`node binary not found: ${nodeBinary}`);

const dshSource = resolveDshSource();
if (!fs.existsSync(path.join(dshSource, 'lib', 'bin.js'))) {
    fail(`dsh source not found: ${dshSource} (set DSH_SOURCE)`);
}
const profileSource = process.env.DSH_PROFILE_SOURCE
    || (fs.existsSync(path.join(root, 'build', 'dsh-profile-template'))
        ? path.join(root, 'build', 'dsh-profile-template')
        : path.join(os.homedir(), '.dsh', 'profiles', 'wildfire'));
if (!fs.existsSync(path.join(profileSource, 'cordis.patch.yml'))) {
    fail(`profile source not found: ${profileSource} (set DSH_PROFILE_SOURCE to a profile with @wildfirechat/dsh-wildfire installed)`);
}

fs.mkdirSync(dest, { recursive: true });
const nodeDest = path.join(dest, 'node', isWin ? 'node.exe' : path.join('bin', 'node'));
fs.mkdirSync(path.dirname(nodeDest), { recursive: true });
fs.copyFileSync(nodeBinary, nodeDest);
if (!isWin) fs.chmodSync(nodeDest, 0o755);

console.log(`[prepare-dsh-runtime] copying dsh from ${dshSource}`);
const dshDest = path.join(dest, 'dsh');
if (path.resolve(dshSource) === path.resolve(dshDest)) {
    console.log(`[prepare-dsh-runtime] reusing existing dsh: ${dshDest}`);
} else {
    copyDir(dshSource, dshDest);
    console.log(`[prepare-dsh-runtime] materialized ${materializeSymlinks(dshDest)} symlinks in dsh`);
}
console.log(`[prepare-dsh-runtime] copying profile from ${profileSource}`);
const profileDest = path.join(dest, 'profile');
copyDir(profileSource, profileDest);
console.log(`[prepare-dsh-runtime] materialized ${materializeSymlinks(profileDest)} symlinks in profile`);

// Ensure the bundled profile uses the local plugin build (dist + package.json),
// not an older tgz that happened to be installed in the source profile.
const pluginSource = process.env.DSH_PLUGIN_SOURCE || path.resolve(root, '..', 'robot-gateway', 'dsh-plugin.js');
const pluginTarget = path.join(profileDest, 'node_modules', '@wildfirechat', 'dsh-wildfire');
if (fs.existsSync(path.join(pluginSource, 'dist', 'index.js'))) {
    fs.mkdirSync(pluginTarget, { recursive: true });
    fs.rmSync(path.join(pluginTarget, 'dist'), { recursive: true, force: true });
    fs.cpSync(path.join(pluginSource, 'dist'), path.join(pluginTarget, 'dist'), { recursive: true, dereference: true, force: true });
    fs.copyFileSync(path.join(pluginSource, 'package.json'), path.join(pluginTarget, 'package.json'));
    console.log(`[prepare-dsh-runtime] bundled plugin from ${pluginSource}`);
} else {
    console.warn(`[prepare-dsh-runtime] plugin dist not found at ${pluginSource}; using profile copy`);
}
sanitizeProfile(profileDest);

const version = {
    node: process.version,
    dsh: (() => {
        try { return JSON.parse(fs.readFileSync(path.join(dshSource, 'package.json'), 'utf8')).version; }
        catch { return 'unknown'; }
    })(),
    profile: path.basename(profileSource),
    preparedAt: new Date().toISOString(),
};
fs.writeFileSync(path.join(dest, 'VERSION'), JSON.stringify(version, null, 2));
console.log('[prepare-dsh-runtime] done:', version);
