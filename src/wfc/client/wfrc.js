/*
 * Copyright (c) 2020 WildFireChat. All rights reserved.
 */

import impl from '../rc/rc.min.js';

export class WfrcManager {
    constructor() {

    }


    init(args = []) {
        impl.init(args);
    }

    checkPermission() {
        return impl.checkPermission();
    }

    screenSize() {
        return impl.screenSize();
    }

    start() {
        impl.start();
    }

    stop() {
        impl.stop();
    }

    isStarted() {
        return impl.isStarted();
    }

    onTextInput(text) {
        impl.onTextInput(text);
    }

    onKeyDown(key) {
        impl.onKeyDown(key);
    }

    onKeyUp(key) {
        impl.onKeyUp(key);
    }

    onMouseMove(x, y) {
        impl.onMouseMove(x, y);
    }

    onMouseScroll(delta, axis) {
        impl.onMouseScroll(delta, axis);
    }

    /* Mouse button
      Left 0,
      Middle 1,
      Right 2
     */
    onMouseDown(button) {
        impl.onMouseDown(button);
    }

    onMouseUp(button) {
        impl.onMouseUp(button);
    }

    onMouseClick(button) {
        impl.onMouseClick(button);
    }
}

const self = new WfrcManager();
export default self;
