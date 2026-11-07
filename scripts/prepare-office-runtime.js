#!/usr/bin/env node
/**
 * 为客户端内置 DSH 准备 Office 能力（必选，随安装包分发）：
 *
 *   1. LibreOffice 引擎：按目标平台装 `@deepseek-ai/libreoffice-kit-<platform>`，
 *      Linux 用 wasm 引擎；装进 `dsh/node_modules`，供 `office-to-pdf` 与
 *      `dsh-skill-office` 的 CLI 使用。
 *   2. Python 运行时：下载 python-build-standalone 的 3.12（按平台/架构），
 *      pip 安装 python-docx / openpyxl / python-pptx（Office 技能默认解释器），
 *      产出 `primary-runtime/runtime.json` + `dependencies/python`，布局遵循
 *      `@deepseek-ai/dsh-tool-workspace-dependencies` 的约定。
 *   3. 技能资源：把 `@deepseek-ai/dsh-skill-office/assets` 拷到
 *      `<runtime>/office-skills`，供 profile 里的 `skill-office` 行引用。
 *
 * 用法：
 *   node scripts/prepare-office-runtime.js [--runtime build/dsh-runtime] [--force]
 *
 * 构建机需要能访问 npm registry 与 GitHub（首次构建会下载约 250-300 MB，之后走缓存）。
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// 用 CommonJS：仓库里没有 "type": "module"，Node 18 的构建机不会自动把 .js 当 ESM。
const root = path.resolve(__dirname, '..');
const isWin = process.platform === 'win32';
const npmCmd = isWin ? 'npm.cmd' : 'npm';
const PBS_TAG = '20261026';
const PBS_PY = '3.12.16';
const KIT_VERSION = '0.1.5';
const OFFICE_PY_PACKAGES = ['python-docx', 'openpyxl', 'python-pptx'];

const PY_TARGETS = {
    'darwin-arm64': 'aarch64-apple-darwin',
    'darwin-x64': 'x86_64-apple-darwin',
    'win32-x64': 'x86_64-pc-windows-msvc',
    'win32-arm64': 'aarch64-pc-windows-msvc',
    'linux-x64': 'x86_64-unknown-linux-gnu',
    'linux-arm64': 'aarch64-unknown-linux-gnu',
};
const ENGINE_TARGETS = {
    'darwin-arm64': '@deepseek-ai/libreoffice-kit-darwin-arm64',
    'darwin-x64': '@deepseek-ai/libreoffice-kit-darwin-x64',
    'win32-x64': '@deepseek-ai/libreoffice-kit-win32-x64',
    'win32-arm64': '@deepseek-ai/libreoffice-kit-win32-arm64',
    'linux-x64': '@deepseek-ai/libreoffice-kit-wasm',
    'linux-arm64': '@deepseek-ai/libreoffice-kit-wasm',
};

function parseArgs(argv) {
    const args = { runtime: path.join(root, 'build', 'dsh-runtime'), force: false, proxy: '' };
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--runtime') args.runtime = path.resolve(argv[++i]);
        else if (argv[i] === '--proxy') args.proxy = String(argv[++i] || '').trim();
        else if (argv[i] === '--force') args.force = true;
        else if (argv[i] === '--help' || argv[i] === '-h') {
            console.log('用法: node scripts/prepare-office-runtime.js [--runtime <dir>] [--proxy <url>] [--force]');
            process.exit(0);
        } else {
            console.error(`[prepare-office] 未知参数: ${argv[i]}`);
            process.exit(2);
        }
    }
    return args;
}

function log(message) {
    console.log(`[prepare-office] ${message}`);
}

function fail(message) {
    console.error(`[prepare-office] ${message}`);
    process.exit(1);
}

/**
 * 构建代理：--proxy / OFFICE_BUILD_PROXY / HTTPS_PROXY / HTTP_PROXY。
 * 公司内网构建机常用 HTTP 代理访问 GitHub 与 PyPI。
 */
function resolveProxy(argProxy) {
    return String(
        argProxy
        || process.env.OFFICE_BUILD_PROXY
        || process.env.HTTPS_PROXY
        || process.env.https_proxy
        || process.env.HTTP_PROXY
        || process.env.http_proxy
        || ''
    ).trim();
}

function proxyEnv(proxy) {
    if (!proxy) return {};
    return {
        HTTPS_PROXY: proxy,
        https_proxy: proxy,
        HTTP_PROXY: proxy,
        http_proxy: proxy,
        npm_config_proxy: proxy,
        npm_config_https_proxy: proxy,
    };
}

/** 用 curl 下载（支持代理、重试、断点续传）；curl 在 macOS/Linux/Win10+ 均可用。 */
function download(url, dest, proxy) {
    fs.rmSync(`${dest}.part`, { force: true });
    const args = [
        '-L', '--fail', '--retry', '3', '--retry-delay', '2', '--retry-all-errors',
        '--max-time', '1800', '--connect-timeout', '30',
        '-o', `${dest}.part`, url,
    ];
    if (proxy) args.unshift('-x', proxy);
    log(`下载 ${url}${proxy ? `（代理 ${proxy}）` : ''}`);
    execFileSync('curl', args, { stdio: 'inherit' });
    const size = fs.statSync(`${dest}.part`).size;
    if (!size) fail(`下载为空: ${url}`);
    fs.renameSync(`${dest}.part`, dest);
}

function extract(archive, dest) {
    fs.mkdirSync(dest, { recursive: true });
    execFileSync('tar', ['-xzf', archive, '-C', dest], { stdio: 'inherit' });
}

function copyDir(src, dest) {
    fs.rmSync(dest, { recursive: true, force: true });
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const from = path.join(src, entry.name);
        const to = path.join(dest, entry.name);
        if (entry.isDirectory()) copyDir(from, to);
        else if (entry.isFile()) fs.copyFileSync(from, to);
    }
}

/** 从 npm 取平台引擎包（tgz），解到 dsh/node_modules/@deepseek-ai/<name>。 */
function installEngine(runtime, key, cacheDir, proxy) {
    const pkg = ENGINE_TARGETS[key];
    if (!pkg) fail(`不支持的平台: ${key}`);
    const short = pkg.split('/')[1];
    const target = path.join(runtime, 'dsh', 'node_modules', '@deepseek-ai', short);
    const marker = path.join(target, 'package.json');
    if (fs.existsSync(marker)) {
        try {
            const version = JSON.parse(fs.readFileSync(marker, 'utf8')).version;
            if (version === KIT_VERSION) {
                log(`LibreOffice 引擎已存在: ${pkg}@${version}`);
                return { package: pkg, version };
            }
        } catch (e) { /* 重新安装 */ }
    }
    fs.mkdirSync(cacheDir, { recursive: true });
    // 解出来的引擎缓存：prepare-dsh-runtime 每次会重拷 dsh 目录，缓存避免每次重下 150-200 MB。
    const engineCache = path.join(cacheDir, 'engine', short);
    if (fs.existsSync(path.join(engineCache, 'package.json'))) {
        log(`从缓存复制 LibreOffice 引擎 ${pkg}`);
        copyDir(engineCache, target);
        return { package: pkg, version: KIT_VERSION };
    }
    log(`安装 LibreOffice 引擎 ${pkg}@${KIT_VERSION}（约 150-200 MB）`);
    const tgz = execFileSync(npmCmd, ['pack', `${pkg}@${KIT_VERSION}`], {
        cwd: cacheDir,
        encoding: 'utf8',
        shell: isWin,
        env: { ...process.env, ...proxyEnv(proxy) },
    }).trim().split(/\r?\n/).pop();
    const archive = path.join(cacheDir, tgz);
    if (!fs.existsSync(archive)) fail(`未找到引擎包: ${archive}`);
    const tmp = path.join(cacheDir, `extract-${short}`);
    fs.rmSync(tmp, { recursive: true, force: true });
    extract(archive, tmp);
    fs.rmSync(engineCache, { recursive: true, force: true });
    copyDir(path.join(tmp, 'package'), engineCache);
    copyDir(engineCache, target);
    fs.rmSync(tmp, { recursive: true, force: true });
    return { package: pkg, version: KIT_VERSION };
}

function pythonExecutable(pythonRoot) {
    return isWin
        ? path.join(pythonRoot, 'python.exe')
        : path.join(pythonRoot, 'bin', 'python3');
}

function sitePackages(pythonRoot, version) {
    const short = version.split('.').slice(0, 2).join('.');
    return isWin
        ? path.join(pythonRoot, 'Lib', 'site-packages')
        : path.join(pythonRoot, 'lib', `python${short}`, 'site-packages');
}

/**
 * 删除 Python 的字节码缓存：.pyc 是二进制文件，macOS 的 osx-sign 会逐个 codesign
 * （带 --timestamp），1,000 多个 .pyc 会让签名多花十几分钟。运行时我们用
 * PYTHONDONTWRITEBYTECODE=1，不会重新生成，也不会破坏安装包签名。
 */
function stripBytecode(root) {
    let removed = 0;
    const walk = (dir) => {
        let entries = [];
        try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
        for (const entry of entries) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                if (entry.name === '__pycache__') {
                    fs.rmSync(full, { recursive: true, force: true });
                    removed++;
                } else {
                    walk(full);
                }
            } else if (entry.isFile() && entry.name.endsWith('.pyc')) {
                fs.rmSync(full, { force: true });
                removed++;
            }
        }
    };
    walk(root);
    return removed;
}

function readPythonPackages(dir) {
    const out = {};
    if (!fs.existsSync(dir)) return out;
    for (const entry of fs.readdirSync(dir)) {
        if (!entry.endsWith('.dist-info')) continue;
        const meta = path.join(dir, entry, 'METADATA');
        if (!fs.existsSync(meta)) continue;
        const text = fs.readFileSync(meta, 'utf8');
        const name = /^Name:\s*(.+)$/m.exec(text);
        const version = /^Version:\s*(.+)$/m.exec(text);
        if (name && version) out[name[1].trim()] = version[1].trim();
    }
    return out;
}

function preparePython(runtime, key, cacheDir, proxy) {
    const primary = path.join(runtime, 'primary-runtime');
    const pythonRoot = path.join(primary, 'dependencies', 'python');
    const py = pythonExecutable(pythonRoot);
    const site = sitePackages(pythonRoot, PBS_PY);
    const runtimeFile = path.join(primary, 'runtime.json');
    if (fs.existsSync(runtimeFile) && fs.existsSync(py)) {
        try {
            const existing = JSON.parse(fs.readFileSync(runtimeFile, 'utf8'));
            if (existing.platform === process.platform && existing.arch === process.arch) {
                const stripped = stripBytecode(pythonRoot);
                log(`Python 运行时已存在: ${existing.python} (${existing.platform}-${existing.arch})` + (stripped ? `，清理 ${stripped} 个字节码缓存` : ''));
                return { pythonRoot, py, site, version: existing.python };
            }
        } catch (e) { /* 重建 */ }
    }
    const asset = `cpython-${PBS_PY}+${PBS_TAG}-${PY_TARGETS[key]}-install_only.tar.gz`;
    const url = `https://github.com/astral-sh/python-build-standalone/releases/download/${PBS_TAG}/${asset}`;
    const archive = path.join(cacheDir, asset);
    fs.mkdirSync(cacheDir, { recursive: true });
    const validArchive = () => {
        try { return fs.statSync(archive).size > 1024 * 1024; } catch (e) { return false; }
    };
    if (!validArchive()) {
        fs.rmSync(archive, { force: true });
        log(`下载 Python ${PBS_PY} (${PY_TARGETS[key]})…`);
        download(url, archive, proxy);
    } else {
        log(`使用缓存 ${asset}`);
    }
    const unpack = () => {
        log(`解压 ${asset}`);
        fs.rmSync(primary, { recursive: true, force: true });
        fs.mkdirSync(path.join(primary, 'dependencies'), { recursive: true });
        extract(archive, path.join(primary, 'dependencies'));
    };
    unpack();
    if (!fs.existsSync(py)) {
        // 缓存可能损坏（例如上次中断留下半包）：丢弃后重下一次。
        log('解压后缺少 Python 可执行文件，删除缓存并重新下载');
        fs.rmSync(archive, { force: true });
        download(url, archive, proxy);
        unpack();
    }
    if (!fs.existsSync(py)) fail(`解压后仍缺少 Python 可执行文件: ${py}`);
    return installPythonPackages(primary, pythonRoot, site, py, proxy);
}

function installPythonPackages(primary, pythonRoot, site, py, proxy) {
    if (!fs.existsSync(py)) fail(`Python 可执行文件缺失: ${py}`);
    log(`安装 Office Python 依赖: ${OFFICE_PY_PACKAGES.join(', ')}`);
    const pipArgs = [
        '-m', 'pip', 'install',
        '--disable-pip-version-check',
        '--no-warn-script-location',
        '--only-binary=:all:',
        '--upgrade',
        '--target', site,
    ];
    if (proxy) pipArgs.push('--proxy', proxy);
    pipArgs.push(...OFFICE_PY_PACKAGES);
    execFileSync(py, pipArgs, {
        stdio: 'inherit',
        env: { ...process.env, ...proxyEnv(proxy), PYTHONDONTWRITEBYTECODE: '1' },
    });
    const stripped = stripBytecode(pythonRoot);
    if (stripped) log(`清理 ${stripped} 个 Python 字节码缓存（避免签名逐个处理 .pyc）`);

    const version = execFileSync(py, ['-c', "import sys;print('%d.%d.%d' % sys.version_info[:3])"], { encoding: 'utf8' }).trim();
    const packages = readPythonPackages(site);
    const manifest = {
        desktopVersion: readAppVersion(),
        platform: process.platform,
        arch: process.arch,
        python: version,
        pythonPackages: packages,
    };
    fs.writeFileSync(path.join(primary, 'runtime.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    const probe = execFileSync(py, ['-c', 'import docx, openpyxl, pptx; print("ok")'], {
        encoding: 'utf8',
        cwd: primary,
        env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
    }).trim();
    if (probe !== 'ok') fail('Python Office 依赖导入校验失败');
    log(`Python 运行时就绪: ${version}, ${Object.keys(packages).length} 个包`);
    return { pythonRoot, py, site, version };
}

function readAppVersion() {
    try {
        return JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version || '1.0.0';
    } catch (e) {
        return '1.0.0';
    }
}

function prepareSkills(runtime) {
    const assets = path.join(runtime, 'dsh', 'node_modules', '@deepseek-ai', 'dsh-skill-office', 'assets');
    if (!fs.existsSync(assets)) fail(`缺少 Office 技能资源: ${assets}`);
    const dest = path.join(runtime, 'office-skills');
    copyDir(assets, dest);
    const required = ['office-docx', 'office-pptx', 'office-xlsx', 'scripts'];
    for (const name of required) {
        if (!fs.existsSync(path.join(dest, name))) fail(`Office 技能资源不完整: ${path.join(dest, name)}`);
    }
    log(`Office 技能资源: ${dest}`);
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const runtime = args.runtime;
    if (!fs.existsSync(path.join(runtime, 'dsh', 'lib', 'bin.js'))) {
        fail(`runtime 不存在或未准备: ${runtime}（先运行 prepare-dsh-runtime）`);
    }
    const key = `${process.platform}-${process.arch}`;
    if (!PY_TARGETS[key] || !ENGINE_TARGETS[key]) fail(`不支持的构建平台: ${key}`);
    const cacheDir = path.join(root, 'build', '.office-cache');
    fs.mkdirSync(cacheDir, { recursive: true });
    const proxy = resolveProxy(args.proxy);
    if (proxy) log(`使用代理: ${proxy}`);

    const engine = installEngine(runtime, key, cacheDir, proxy);
    const python = await preparePython(runtime, key, cacheDir, proxy);
    prepareSkills(runtime);

    const stamp = {
        platform: process.platform,
        arch: process.arch,
        python: python.version,
        engine,
        preparedAt: new Date().toISOString(),
    };
    fs.writeFileSync(path.join(runtime, 'office-runtime.json'), `${JSON.stringify(stamp, null, 2)}\n`);
    log(`完成: python=${python.version}, engine=${engine.package}@${engine.version}`);
}

main().catch((err) => {
    console.error(`[prepare-office] 失败: ${err && err.message ? err.message : err}`);
    process.exit(1);
});
