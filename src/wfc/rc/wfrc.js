/*
 * Copyright (c) 2020 WildFireChat. All rights reserved.
 */

// import this.rcAddon from '../../../rc.node';
export class WfrcManager {
    rcAddon

    constructor() {
        // this.rcAddon = this._loadthis.rcAddon()
    }

    init(args = []) {
        //this.rcAddon = this._loadthis.rcAddon()
        // this.rcAddon.init(args);
    }

    checkPermission() {
        return this.rcAddon.checkPermission();
    }

    screenSize() {
        return this.rcAddon.screenSize();
    }

    start() {
        if (!this.rcAddon) {
            this.rcAddon = require('../../../rc.node')
        }
        this.rcAddon.start();
    }

    stop() {
        if (this.rcAddon) {
            this.rcAddon.stop();
        }
    }

    isStarted() {
        return this.rcAddon.isStarted();
    }

    onTextInput(text) {
        this.rcAddon.onTextInput(text);
    }

    onKeyDown(key) {
        this.rcAddon.onKeyEvent(key, 0);
    }

    onKeyUp(key) {
        this.rcAddon.onKeyEvent(key, 1);
    }

    onMouseMove(x, y) {
        this.rcAddon.onMouseMove(x, y);
    }

    onMouseScroll(delta, axis) {
        this.rcAddon.onMouseScroll(delta, axis);
    }

    /* Mouse button
      Left 0,
      Middle 1,
      Right 2
     */
    onMouseDown(button) {
        this.rcAddon.onMouseClick(button, 0);
    }

    onMouseUp(button) {
        this.rcAddon.onMouseClick(button, 1);
    }

    onMouseClick(button) {
        this.rcAddon.onMouseClick(button, 1);
    }
}

const self = new WfrcManager();
export default self;
