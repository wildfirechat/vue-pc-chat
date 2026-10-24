#!/usr/bin/env node
/**
 * Prepare a self-contained DSH runtime under build/dsh-runtime.
 *
 * Source:
 *   - Node: DSH_NODE_BINARY, existing runtime node, current node, or npm node@22.x cache
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
assertWindowsSupport();

function peMachine(file) {
    try {
        const fd = fs.openSync(file, 'r');
        const buf = Buffer.alloc(64);
        fs.readSync(fd, buf, 0, 64, 0);
        fs.closeSync(fd);
        if (buf.toString('ascii', 0, 2) !== 'MZ') return null;
        const pe = buf.readUInt32LE(0x3c);
        const head = Buffer.alloc(6);
        const hfd = fs.openSync(file, 'r');
        fs.readSync(hfd, head, 0, 6, pe);
        fs.closeSync(hfd);
        if (head.toString('ascii', 0, 4) !== 'PE\0\0') return null;
        return head.readUInt16LE(4);
    } catch (e) {
        return null;
    }
}

function expectedPeMachine() {
    if (process.arch === 'x64') return 0x8664;
    if (process.arch === 'arm64') return 0xaa64;
    if (process.arch === 'ia32') return 0x014c;
    return null;
}

function assertNodeBinaryForPlatform(file) {
    if (!isWin) return;
    const machine = peMachine(file);
    const expected = expectedPeMachine();
    if (!machine) fail(`node.exe is not a Windows PE executable: ${file}`);
    if (expected && machine !== expected) {
        fail(`node.exe architecture mismatch: file=0x${machine.toString(16)}, expected=0x${expected.toString(16)} (${process.arch}). Remove build/.node-cache and build/dsh-runtime, then rebuild.`);
    }
}

function assertWindowsSupport() {
    if (process.platform !== 'win32') return;
    const release = os.release();
    const major = Number(String(release).split('.')[0]);
    if (major < 10) {
        fail(`Node 22 does not support Windows ${release}. DSH 0.2 needs Windows 10/11 x64.`);
    }
    if (process.arch === 'ia32') {
        fail('Node 22 has no supported 32-bit Windows build; use 64-bit Windows and Node.');
    }
}

function fail(message) {
    console.error(`[prepare-dsh-runtime] ${message}`);
    process.exit(1);
}

function copySiblingDshDependencies(dshSource, dshDest) {
    // npm install 的 @deepseek-ai/dsh 依赖通常被 hoist 到父级 node_modules；
    // 只复制 dsh 包目录会漏掉 dsh-app-boot 等依赖。这里把兄弟包补进
    // dsh/node_modules，保持运行时自包含。
    const packageDir = path.resolve(dshSource);
    const parent = path.dirname(packageDir);
    const nodeModules = path.basename(parent) === '@deepseek-ai' ? path.dirname(parent) : parent;
    if (path.basename(nodeModules) !== 'node_modules' || !fs.existsSync(nodeModules)) return 0;

    const targetRoot = path.join(dshDest, 'node_modules');
    fs.mkdirSync(targetRoot, { recursive: true });
    let copied = 0;
    for (const entry of fs.readdirSync(nodeModules, { withFileTypes: true })) {
        if (!entry.isDirectory() || entry.name === '.bin') continue;
        if (entry.name.startsWith('@')) {
            const scopeSrc = path.join(nodeModules, entry.name);
            const scopeDest = path.join(targetRoot, entry.name);
            fs.mkdirSync(scopeDest, { recursive: true });
            for (const sub of fs.readdirSync(scopeSrc, { withFileTypes: true })) {
                if (!sub.isDirectory()) continue;
                if (entry.name === '@deepseek-ai' && sub.name === 'dsh') continue;
                const src = path.join(scopeSrc, sub.name);
                const dest = path.join(scopeDest, sub.name);
                if (!fs.existsSync(dest)) {
                    copyDir(src, dest);
                    copied += 1;
                }
            }
        } else {
            const dest = path.join(targetRoot, entry.name);
            if (!fs.existsSync(dest)) {
                copyDir(path.join(nodeModules, entry.name), dest);
                copied += 1;
            }
        }
    }
    return copied;
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

function runNpm(args, extraEnv = {}) {
    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    // Windows 的 .cmd 不能直接 spawn，必须通过 shell 执行。
    execFileSync(npm, args, {
        stdio: 'inherit',
        shell: process.platform === 'win32',
        env: { ...process.env, ...extraEnv },
    });
}

function dshSourceComplete(dir) {
    if (!fs.existsSync(path.join(dir, 'lib', 'bin.js'))) return false;
    if (fs.existsSync(path.join(dir, 'node_modules', '@deepseek-ai', 'dsh-app-boot'))) return true;
    const parentModules = path.dirname(path.dirname(dir));
    return fs.existsSync(path.join(parentModules, '@deepseek-ai', 'dsh-app-boot'));
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
        if (dshSourceComplete(candidate)) return candidate;
        if (fs.existsSync(path.join(candidate, 'lib', 'bin.js'))) {
            console.warn(`[prepare-dsh-runtime] skip incomplete dsh source (missing dsh-app-boot): ${candidate}`);
        }
    }
    // 不要求全局安装 dsh：在构建目录临时 npm install，产物随包分发。
    const depsDir = path.join(root, 'build', '.dsh-deps');
    const version = process.env.DSH_VERSION || '0.2.0-rc.2';
    console.log(`[prepare-dsh-runtime] installing @deepseek-ai/dsh@${version} into build/.dsh-deps`);
    fs.mkdirSync(depsDir, { recursive: true });
    try {
        runNpm(['install', '--prefix', depsDir, '--no-save', '--no-package-lock', '--engine-strict=false', `@deepseek-ai/dsh@${version}`]);
    } catch (e) {
        fail(`cannot install @deepseek-ai/dsh@${version}: ${e.message}`);
    }
    const installed = path.join(depsDir, 'node_modules', '@deepseek-ai', 'dsh');
    if (!dshSourceComplete(installed)) fail(`installed dsh is incomplete (missing lib/bin.js or dsh-app-boot): ${installed}`);
    return installed;
}

function findNodeBinary(root, depth = 0) {
    if (depth > 5 || !fs.existsSync(root)) return null;
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
        const full = path.join(root, entry.name);
        if (entry.isFile() && (entry.name === 'node' || entry.name === 'node.exe')) {
            try {
                const out = execFileSync(full, ['-v'], { encoding: 'utf8', timeout: 3000 }).trim();
                if (nodeVersionOk(out)) return full;
            } catch (e) { /* not executable for this host */ }
        } else if (entry.isDirectory() && entry.name !== '.cache') {
            const found = findNodeBinary(full, depth + 1);
            if (found) return found;
        }
    }
    return null;
}

function resolveNodeBinary() {
    const candidates = [
        process.env.DSH_NODE_BINARY,
        isWin ? path.join(root, 'build', 'official-node', 'node.exe') : path.join(root, 'build', 'official-node', 'bin', 'node'),
        isWin ? path.join(dest, 'node', 'node.exe') : path.join(dest, 'node', 'bin', 'node'),
        process.execPath,
    ].filter(Boolean);
    for (const candidate of candidates) {
        if (!fs.existsSync(candidate)) continue;
        try {
            const out = execFileSync(candidate, ['-v'], { encoding: 'utf8', timeout: 3000 }).trim();
            if (nodeVersionOk(out)) return candidate;
        } catch (e) { /* continue */ }
    }

    // 构建机 Node 太旧（例如 Windows 上的 Node 18）：不要求全局安装新 Node，
    // 用 npm 把带平台二进制的 node 包装到 build/.node-cache，再取其中的 node。
    const cache = path.join(root, 'build', '.node-cache');
    const version = process.env.DSH_NODE_VERSION || '22.23.3';
    console.log(`[prepare-dsh-runtime] installing node@${version} into build/.node-cache`);
    fs.mkdirSync(cache, { recursive: true });
    try {
        runNpm(['install', '--prefix', cache, '--no-save', '--no-package-lock', `node@${version}`], {
            npm_config_platform: process.platform,
            npm_config_arch: process.env.DSH_NODE_ARCH || process.arch,
        });
    } catch (e) {
        fail(`cannot install node@${version}: ${e.message}\nSet DSH_NODE_BINARY to a Node >=22.19 binary.`);
    }
    const found = findNodeBinary(cache);
    if (!found) fail(`node@${version} installed but no usable node binary found under ${cache}`);
    return found;
}

const nodeBinary = resolveNodeBinary();

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
// 复制后立即验证目标平台可执行，避免把空文件/错误架构的 node 打进安装包。
assertNodeBinaryForPlatform(nodeDest);
try {
    const out = execFileSync(nodeDest, ['-v'], { encoding: 'utf8', timeout: 5000 }).trim();
    if (!nodeVersionOk(out)) fail(`copied node is too old: ${out} (${nodeDest})`);
    console.log(`[prepare-dsh-runtime] verified node ${out}: ${nodeDest}`);
} catch (e) {
    fail(`copied node is not runnable on this platform: ${nodeDest}: ${e.message}`);
}

console.log(`[prepare-dsh-runtime] copying dsh from ${dshSource}`);
const dshDest = path.join(dest, 'dsh');
if (path.resolve(dshSource) === path.resolve(dshDest)) {
    console.log(`[prepare-dsh-runtime] reusing existing dsh: ${dshDest}`);
} else {
    copyDir(dshSource, dshDest);
    console.log(`[prepare-dsh-runtime] materialized ${materializeSymlinks(dshDest)} symlinks in dsh`);
}
const depCount = copySiblingDshDependencies(dshSource, dshDest);
if (depCount) console.log(`[prepare-dsh-runtime] copied ${depCount} sibling dsh dependencies`);
if (!dshSourceComplete(dshDest)) {
    fail(`bundled dsh is incomplete (missing @deepseek-ai/dsh-app-boot): ${dshDest}`);
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
