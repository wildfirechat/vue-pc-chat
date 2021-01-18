#!/usr/bin/env node

//var opsys = process.platform;
let protoName = "marswrapper";
switch (process.platform) {
    case "darwin":
        protoName += '.mac'
        break;
    case "linux":
        protoName += '.linux'
        if (process.arch === 'arm64') {
            protoName += '.arm64'
        }
        break
    case "win32":
        if (process.arch === 'x32') {
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

console.log("Try copy " + protoName + "\n\n")

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
