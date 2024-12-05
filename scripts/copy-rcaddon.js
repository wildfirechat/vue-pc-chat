#!/usr/bin/env node

//var opsys = process.platform;
const argv = process.argv;
let addonName = "wfremotecontrol";

platform = process.platform;
arch = process.arch;

if (argv.length > 2) {
    platform = argv[2];
    if (argv.length === 4)
        arch = argv[3];
}

switch (platform) {
    case "darwin":
        addonName += '.darwin'
        break;
    case "linux":
        // addonName += '.linux'
        // if (arch === 'arm64') {
        //     addonName += '.arm64'
        // } else if (arch === 'mips64el') {
        //     addonName += '.mips64el'
        // } else if (arch == 'loong64') {
        //    addonName += '.loongarch64'
        // } else if (arch == 'sw_64') {
        //    addonName += '.sw64'
        // }
        console.log('not support Linux platform', process.platform)
        break
    case "win32":
        if (arch === 'ia32') {
            addonName += '.win32-ia32-msvc'
        } else {
            addonName += '.win32-x64-msvc'
        }
        break
    default:
        console.log('unknown platform', process.platform)
        return;
}
addonName += '.node'

console.log("Copy " + addonName + "\n\n")

var shelljs = require('shelljs');
var addCheckMark = require('./checkmark');
var path = require('path');

var cpy = path.join(__dirname, '../node_modules/cpy-cli/cli.js ');

let fromParam = './rc_addon/' + addonName
let toParam = './'
shelljs.exec('node ' + cpy + ' --rename=rc.node ' + fromParam + ' ' + toParam, addCheckMark.bind(null, callback));

function callback() {
    process.stdout.write(' Copied ' + fromParam + ' to the ' + toParam + ' directory\n\n');
}
