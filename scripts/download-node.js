#!/usr/bin/env node
/**
 * 下载官方 Node 二进制到 build/official-node。
 *
 * 用法:
 *   npm run download-node
 *   DSH_NODE_VERSION=22.23.3 DSH_NODE_ARCH=x64 npm run download-node
 *   DSH_NODE_PLATFORM=win32 npm run download-node
 *
 * 下载后会校验 SHASUMS256.txt，并复制成:
 *   Windows: build/official-node/node.exe
 *   Unix:    build/official-node/bin/node
 * 之后 npm run package 会自动优先使用它。
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const version = String(process.env.DSH_NODE_VERSION || '22.23.3').replace(/^v/, '');
const arch = process.env.DSH_NODE_ARCH || process.arch;
const platform = process.env.DSH_NODE_PLATFORM || process.platform;
const isWin = platform === 'win32';
const platformName = platform === 'win32' ? 'win' : platform;
const ext = platform === 'win32' ? 'zip' : (platform === 'darwin' ? 'tar.gz' : 'tar.xz');
const dirName = `node-v${version}-${platformName}-${arch}`;
const archiveName = `${dirName}.${ext}`;
const distRoot = path.join(root, 'build', 'official-node');
const archivePath = path.join(distRoot, archiveName);
const extractRoot = path.join(distRoot, 'extract');
const finalNode = isWin ? path.join(distRoot, 'node.exe') : path.join(distRoot, 'bin', 'node');

function fail(msg) {
    console.error(`[download-node] ${msg}`);
    process.exit(1);
}

function download(url, dest, redirects = 0) {
    return new Promise((resolve, reject) => {
        if (redirects > 5) return reject(new Error('too many redirects'));
        const req = https.get(url, { headers: { 'User-Agent': 'wf-pc-chat-build' } }, res => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                res.resume();
                const next = new URL(res.headers.location, url).toString();
                download(next, dest, redirects + 1).then(resolve, reject);
                return;
            }
            if (res.statusCode !== 200) {
                res.resume();
                reject(new Error(`${url} -> HTTP ${res.statusCode}`));
                return;
            }
            fs.mkdirSync(path.dirname(dest), { recursive: true });
            const out = fs.createWriteStream(dest);
            res.pipe(out);
            out.on('finish', () => out.close(() => resolve(dest)));
            out.on('error', reject);
        });
        req.on('error', reject);
        req.setTimeout(120000, () => req.destroy(new Error('download timeout')));
    });
}

function readText(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'wf-pc-chat-build' } }, res => {
            if (res.statusCode !== 200) {
                res.resume();
                reject(new Error(`${url} -> HTTP ${res.statusCode}`));
                return;
            }
            let text = '';
            res.setEncoding('utf8');
            res.on('data', d => text += d);
            res.on('end', () => resolve(text));
        }).on('error', reject);
    });
}

function sha256(file) {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        fs.createReadStream(file).on('error', reject).on('data', d => hash.update(d)).on('end', () => resolve(hash.digest('hex')));
    });
}

function extract() {
    fs.rmSync(extractRoot, { recursive: true, force: true });
    fs.mkdirSync(extractRoot, { recursive: true });
    if (isWin) {
        const ps = process.env.ComSpec || 'powershell.exe';
        execFileSync('powershell.exe', [
            '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command',
            `Expand-Archive -LiteralPath '${archivePath.replace(/'/g, "''")}' -DestinationPath '${extractRoot.replace(/'/g, "''")}' -Force`
        ], { stdio: 'inherit' });
    } else {
        const flag = platform === 'darwin' ? '-xzf' : '-xJf';
        execFileSync('tar', [flag, archivePath, '-C', extractRoot], { stdio: 'inherit' });
    }
    const extracted = path.join(extractRoot, dirName);
    const source = isWin ? path.join(extracted, 'node.exe') : path.join(extracted, 'bin', 'node');
    if (!fs.existsSync(source)) fail(`extracted node not found: ${source}`);
    fs.mkdirSync(path.dirname(finalNode), { recursive: true });
    fs.copyFileSync(source, finalNode);
    if (!isWin) fs.chmodSync(finalNode, 0o755);
}

(async () => {
    if (platform === 'win32' && arch === 'ia32') {
        fail('Node 22 does not ship a 32-bit Windows binary; use x64 or arm64.');
    }
    fs.mkdirSync(distRoot, { recursive: true });
    const base = `https://nodejs.org/dist/v${version}`;
    console.log(`[download-node] ${archiveName}`);
    await download(`${base}/${archiveName}`, archivePath);
    console.log('[download-node] verifying SHA256...');
    const shasums = await readText(`${base}/SHASUMS256.txt`);
    const line = shasums.split(/\r?\n/).find(l => l.trim().endsWith(`  ${archiveName}`) || l.trim().endsWith(` *${archiveName}`));
    if (!line) fail(`SHA256 entry not found for ${archiveName}`);
    const expected = line.trim().split(/\s+/)[0].toLowerCase();
    const actual = (await sha256(archivePath)).toLowerCase();
    if (expected !== actual) fail(`SHA256 mismatch for ${archiveName}\nexpected=${expected}\nactual=${actual}`);
    console.log('[download-node] checksum OK, extracting...');
    extract();
    try {
        const out = execFileSync(finalNode, ['-v'], { encoding: 'utf8', timeout: 5000 }).trim();
        console.log(`[download-node] ready: ${finalNode} (${out})`);
    } catch (e) {
        console.error(`[download-node] warning: ${finalNode} cannot run on this host: ${e.message}`);
        console.error('[download-node] If this is Windows, check Windows version, S mode, Smart App Control or architecture.');
        process.exitCode = 1;
    }
    console.log('[download-node] npm run package will now prefer this binary.');
})().catch(e => fail(e && e.stack ? e.stack : String(e)));
