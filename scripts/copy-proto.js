#!/usr/bin/env node

//var opsys = process.platform;
const argv = process.argv;
let protoName = "marswrapper";

platform = process.platform;
arch = process.arch;

if (argv.length > 2) {
    platform = argv[2];
    if(argv.length === 4)
      arch = argv[3];
}

switch (platform) {
    case "darwin":
        protoName += '.mac'
        break;
    case "linux":
        protoName += '.linux'
        if (arch === 'arm64') {
            protoName += '.arm64'
        } else if (arch === 'mips64el') {
            protoName += '.mips64el'
        }

        break
    case "win32":
        if (arch === 'ia32') {
            protoName += '.win32'
        } else {
            protoName += '.win64'
        }
        break
    default:
        console.log('unknown platform', process.platform)
        return;
}
protoName += '.node'

console.log("Copy " + protoName + "\n\n")

var shelljs = require('shelljs');
var addCheckMark = require('./checkmark');
var path = require('path');

var cpy = path.join(__dirname, '../node_modules/cpy-cli/cli.js ');

let fromParam = './proto_addon/' + protoName
let toParam = './'
shelljs.exec('node ' + cpy + ' --rename=marswrapper.node ' + fromParam + ' ' + toParam, addCheckMark.bind(null, callback));

function callback() {
    process.stdout.write(' Copied ' + fromParam + ' to the ' + toParam + ' directory\n\n');
}
