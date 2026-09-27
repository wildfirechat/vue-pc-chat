#!/usr/bin/env node

// electron-builder afterPack 钩子：给 macOS 包里的主程序和各个 Helper 换一个本应用专属的 Mach-O UUID。
//
// 为什么要换：macOS 15 起访问同网段地址要「本地网络」权限，系统记录权限时要把可执行文件的 Mach-O UUID 对应到 App 的签名标识。
// electron-builder 打包时只是把 Electron 官方二进制改个名，UUID 不变，所以同一 Electron 版本的所有 App UUID 都一样。
// 这个 UUID 已经对应到别的 Electron App 时（实测被对应到了 uTools），本应用不弹授权框、
// 也不出现在「系统设置 → 隐私与安全性 → 本地网络」里，访问同网段地址直接报 net::ERR_ADDRESS_UNREACHABLE。
//
// 新 UUID 由 appId + Electron 版本 + 文件路径 + CPU 架构算出来：
//   - 同一个输入每次结果一样，重复执行不会再变（打 universal 包时 x64、arm64 临时包和合并后的包各会调一次）
//   - 同一 appId、同一 Electron 版本的每次打包 UUID 不变，升级客户端不用重新授权
//
// 改完后给这个可执行文件补一个 ad-hoc 签名，保证没有签名证书、electron-builder 跳过签名时程序也能启动（arm64 上签名无效会被系统杀掉）；
// 有证书时 electron-builder 随后会用正式证书重新签名。
//
// 手动执行（排查用）：node scripts/mac-unique-uuid.js <xxx.app> <appId> <electronVersion>

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const {execFileSync} = require('child_process');

const FAT_MAGIC = 0xcafebabe;
const FAT_MAGIC_64 = 0xcafebabf;
const MH_MAGIC = 0xfeedface;
const MH_MAGIC_64 = 0xfeedfacf;
const LC_UUID = 0x1b;

// fat（universal）文件返回每个架构的偏移，单架构文件返回 [0]
function sliceOffsets(buf) {
    let magic = buf.readUInt32BE(0);
    if (magic !== FAT_MAGIC && magic !== FAT_MAGIC_64) {
        return [0];
    }
    let offsets = [];
    let count = buf.readUInt32BE(4);
    for (let i = 0; i < count; i++) {
        if (magic === FAT_MAGIC) {
            offsets.push(buf.readUInt32BE(8 + i * 20 + 8));
        } else {
            offsets.push(Number(buf.readBigUInt64BE(8 + i * 32 + 8)));
        }
    }
    return offsets;
}

// 改一个架构的 LC_UUID，内容有变化时返回 true
function patchSlice(buf, offset, makeUuid) {
    let magic = buf.readUInt32LE(offset);
    if (magic !== MH_MAGIC && magic !== MH_MAGIC_64) {
        return false;
    }
    let cpuType = buf.readUInt32LE(offset + 4);
    let commandCount = buf.readUInt32LE(offset + 16);
    let p = offset + (magic === MH_MAGIC_64 ? 32 : 28);
    for (let i = 0; i < commandCount; i++) {
        let cmd = buf.readUInt32LE(p);
        if (cmd === LC_UUID) {
            let uuid = makeUuid(cpuType);
            if (uuid.equals(buf.subarray(p + 8, p + 24))) {
                return false;
            }
            uuid.copy(buf, p + 8);
            return true;
        }
        p += buf.readUInt32LE(p + 4);
    }
    return false;
}

// 主程序和 Frameworks 下各个 Helper.app 的可执行文件
function findExecutables(appPath) {
    let executables = [];
    let addDir = dir => {
        if (fs.existsSync(dir)) {
            fs.readdirSync(dir).forEach(name => executables.push(path.join(dir, name)));
        }
    };
    addDir(path.join(appPath, 'Contents/MacOS'));
    let frameworksDir = path.join(appPath, 'Contents/Frameworks');
    if (fs.existsSync(frameworksDir)) {
        fs.readdirSync(frameworksDir)
            .filter(name => name.endsWith('.app'))
            .forEach(name => addDir(path.join(frameworksDir, name, 'Contents/MacOS')));
    }
    return executables.filter(file => fs.statSync(file).isFile());
}

// 只签可执行文件本身，不签整个 .app：这时包里的 Electron Framework 等还没签名，签 .app 会报 code object is not signed at all。
// 对 .app 里的主程序执行 codesign 会按整个 .app 签，所以复制到包外签好再放回去
function adhocSign(file) {
    let tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mac-unique-uuid-'));
    let tmpFile = path.join(tmpDir, path.basename(file));
    try {
        fs.copyFileSync(file, tmpFile);
        execFileSync('codesign', ['--force', '--sign', '-', tmpFile], {stdio: 'pipe'});
        fs.copyFileSync(tmpFile, file);
    } finally {
        fs.rmSync(tmpDir, {recursive: true, force: true});
    }
}

function makeUuidFactory(appId, electronVersion, relativePath) {
    return cpuType => {
        let hash = crypto.createHash('sha256').update(`${appId}|${electronVersion}|${relativePath}|${cpuType}`).digest();
        let uuid = hash.subarray(0, 16);
        // 按 RFC 4122 标成 version 5 格式
        uuid[6] = (uuid[6] & 0x0f) | 0x50;
        uuid[8] = (uuid[8] & 0x3f) | 0x80;
        return Buffer.from(uuid);
    };
}

function patchApp(appPath, appId, electronVersion) {
    for (let file of findExecutables(appPath)) {
        let buf = fs.readFileSync(file);
        let relativePath = path.relative(appPath, file);
        let makeUuid = makeUuidFactory(appId, electronVersion, relativePath);
        let changed = false;
        for (let offset of sliceOffsets(buf)) {
            changed = patchSlice(buf, offset, makeUuid) || changed;
        }
        if (!changed) {
            continue;
        }
        fs.writeFileSync(file, buf);
        adhocSign(file);
        console.log(`[mac-unique-uuid] ${relativePath}`);
    }
}

exports.default = async function (context) {
    if (context.electronPlatformName !== 'darwin' && context.electronPlatformName !== 'mas') {
        return;
    }
    let packager = context.packager;
    let appPath = path.join(context.appOutDir, `${packager.appInfo.productFilename}.app`);
    patchApp(appPath, packager.appInfo.id, packager.info.framework.version);
};

if (require.main === module) {
    let [appPath, appId, electronVersion] = process.argv.slice(2);
    if (!appPath || !appId || !electronVersion) {
        console.log('usage: node scripts/mac-unique-uuid.js <xxx.app> <appId> <electronVersion>');
        process.exit(1);
    }
    patchApp(appPath, appId, electronVersion);
}
