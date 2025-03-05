/*
 * Copyright (c) 2020 WildFireChat. All rights reserved.
 */

/**
 * 远程控制接口
 * <pre>
 * 错误码说明，所有的输入都会返回i32，0是成功，-1是没有start，-2是UAC授权，-1000是输入非法字符，
 * 1 是Mapping(String) Mapping a keycode to a keysym failed，
 * 2 是Unmapping(String) There was no space to map any keycodes，
 * 3 是NoEmptyKeycodes There was an error with the protocol
 * 4 是Simulate(&'static str),
 *      /// The input you want to simulate is invalid
 *      /// This happens for example if you want to enter text that contains NULL
 *      /// bytes (`\0`)
 * 5 是InvalidInput(&'static str),

 * 当-2时，需要被控电脑用户进行授权。可能会有连续多个，比如鼠标移动，需要注意不要重复。
 * </pre>
 */
// export class WfrcManager {
//     rcAddon
//
//     constructor() {
//         // this.rcAddon = this._loadthis.rcAddon()
//     }
//
//     init(args = []) {
//         //this.rcAddon = this._loadthis.rcAddon()
//         // this.rcAddon.init(args);
//     }
//
//     checkPermission() {
//         return this.rcAddon.checkPermission();
//     }
//
//     screenSize() {
//         return this.rcAddon.screenSize();
//     }
//
//     start() {
//         console.log('wfrc start')
//         if (!this.rcAddon) {
//             this.rcAddon = require('../../../rc.node')
//         }
//         this.rcAddon.start();
//     }
//
//     stop() {
//         if (this.rcAddon) {
//             this.rcAddon.stop();
//         }
//     }
//
//     isStarted() {
//         return this.rcAddon.isStarted();
//     }
//
//     isUac() {
//         return this.rcAddon.isUac();
//     }
//
//     onTextInput(text) {
//         return this.rcAddon.onTextInput(text);
//     }
//
//     onKeyDown(key) {
//         return this.rcAddon.onKeyEvent(key, 0);
//     }
//
//     onKeyUp(key) {
//         return this.rcAddon.onKeyEvent(key, 1);
//     }
//
//     onMouseMove(x, y) {
//         return this.rcAddon.onMouseMove(x, y);
//     }
//
//     onMouseScroll(delta, axis) {
//         return this.rcAddon.onMouseScroll(delta, axis);
//     }
//
//     /* Mouse button
//       Left 0,
//       Middle 1,
//       Right 2
//      */
//     onMouseDown(button) {
//         return this.rcAddon.onMouseClick(button, 0);
//     }
//
//     onMouseUp(button) {
//         return this.rcAddon.onMouseClick(button, 1);
//     }
//
//     onMouseClick(button) {
//         return this.rcAddon.onMouseClick(button, 1);
//     }
// }
//
// const self = new WfrcManager();

import rc from './rc.min'
export default rc;
