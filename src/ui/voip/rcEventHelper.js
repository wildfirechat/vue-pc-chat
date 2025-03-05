import RCEvent from "../../wfc/rc/RCEvent";
import wfrc from "../../wfc/rc/wfrc";

/**
 * 主控方注册远程控制/协助相关事件监听
 * @param {CallSession} session 当前音视频通话的 session
 * @param {HTMLVideoElement} remoteScreenVideoElement 渲染对方屏幕共享流的 video 元素
 */
export default function registerRemoteControlEventListener(session, remoteScreenVideoElement) {
    _keydownEventListener = (event) => {
        //console.log(`key down: ${event.code}`);
        _sendEventData(session, 'kd', [], [event.code])
    }
    document.addEventListener('keydown', _keydownEventListener);

    _keyupEventListener = (event) => {
        //console.log(`key up: ${event.code}`, event);
        _sendEventData(session, 'ku', [], [event.code])
    }
    document.addEventListener('keyup', _keyupEventListener);
    // click 事件，应当由被控端，自行根据 mousedown and mouseup 触发
    // remoteScreenVideoElement.addEventListener('click', (event) => {
    //     console.log(`Mouse click: ${event.button}, ${event.clientX}, ${event.clientY}`);
    //     let xy = _adjustRCXY(event, remoteScreenVideoElement)
    //     if (!xy) {
    //         return
    //     }
    //         let options = {
    //             event: 'rce',
    //             args: {
    //                 e: 'click',
    //                 btn: event.button,
    //                 ...xy
    //             }
    //         };
    //         session.sendRemoteControlInputEvent(options);
    // });
    remoteScreenVideoElement.addEventListener('mousemove', (event) => {
        // console.log(`Mouse position: ${event.clientX}, ${event.clientY}`);
        let xy = _adjustRCXY(event, remoteScreenVideoElement)
        if (!xy) {
            return
        }
        //console.log(`mouse move: `, event.offsetX, event.offsetY, xy);
        _sendEventData(session, 'mv', [xy.x, xy.y]);
    });

    remoteScreenVideoElement.addEventListener('mousedown', (event) => {
        //console.log(`Mouse down: ${event.button}, ${event.clientX}, ${event.clientY}`);
        let xy = _adjustRCXY(event, remoteScreenVideoElement)
        if (!xy) {
            return
        }

        _sendEventData(session, 'md', [event.button, xy.x, xy.y]);
    });

    remoteScreenVideoElement.addEventListener('mouseup', (event) => {
        //console.log(`Mouse up: ${event.button}, ${event.clientX}, ${event.clientY}`);
        let xy = _adjustRCXY(event, remoteScreenVideoElement)
        if (!xy) {
            return
        }

        _sendEventData(session, 'mu', [event.button, xy.x, xy.y]);
    });

    remoteScreenVideoElement.addEventListener('wheel', (event) => {
        //deltaMode 0是按像素滚动，1是按行滚动，2是按页滚动。
        //lib只能处理按行滚动，一次事件滚动一行
        //console.log(`Mouse wheel before: ${event.deltaX}, ${event.deltaY}, ${event.deltaMode}`);
        _deltaXSum += event.deltaX;
        _deltaYSum += event.deltaY;

        if (Math.abs(_deltaXSum) < 15 && Math.abs(_deltaYSum) < 15) {
            return
        }
        //console.log(`Mouse wheel: ${_deltaYSum}, ${_deltaYSum}, ${event.deltaMode}`);
        let delta;
        let axis;
        if (Math.abs(_deltaXSum) > Math.abs(_deltaYSum)) {
            delta = _deltaXSum > 0 ? 1 : -1;
            axis = 0;
        } else {
            delta = _deltaYSum > 0 ? 1 : -1;
            axis = 1;
        }

        _deltaXSum = 0;
        _deltaYSum = 0;

        _sendEventData(session, 'wl', [delta, axis])
    });
}

export function unregisterRemoteControlEventListener() {
    document.removeEventListener('keydown', _keydownEventListener);
    document.removeEventListener('keyup', _keyupEventListener);
    stopMonitorUACStatus()
}

function _adjustRCXY(event, remoteScreenVideoElement) {
    let x = event.offsetX;
    let y = event.offsetY;
    let rcSW = remoteScreenVideoElement.videoWidth
    let rcSH = remoteScreenVideoElement.videoHeight
    let videoElWidth = remoteScreenVideoElement.clientWidth
    let videoElHeight = remoteScreenVideoElement.clientHeight;
    let scaledVideoWidth = videoElWidth
    let scaledVideoHeight = videoElHeight

    // 保持宽高比缩放
    // object-fit: contain;
    let xMargin = 0
    let yMargin = 0
    if (rcSW / videoElWidth > rcSH / videoElHeight) {
        // 宽度填满，缩放高度
        scaledVideoHeight = rcSH / rcSW * videoElWidth;
        yMargin = (videoElHeight - scaledVideoHeight)
    } else {
        scaledVideoWidth = videoElHeight / rcSH * rcSW
        xMargin = (videoElWidth - scaledVideoWidth)
    }

    if (xMargin > 0 && (x < xMargin / 2 || x > xMargin / 2 + scaledVideoWidth)) {
        return undefined
    }

    if (yMargin > 0 && (y < yMargin / 2 || y > yMargin / 2 + scaledVideoHeight)) {
        return undefined
    }

    x = x - xMargin / 2
    y = y - yMargin / 2

    return {
        x: Math.round(x * rcSW / scaledVideoWidth),
        y: Math.round(y * rcSH / scaledVideoHeight)
    }
}

function _sendEventData(session, eventName, numberValues = [], strValues = []) {
    let rcEvent = new RCEvent()
    rcEvent.name = eventName
    rcEvent.numberArgs = numberValues
    rcEvent.strArgs = strValues
    let buffer = rcEvent.toArrayBuffer()

    //console.log('buffer', eventName, numberValues, buffer.length)
    session.sendRemoteControlInputEvent(buffer);
}

// only for windows
export function startMonitorUACStatus(session) {
    _uacMonitorInterval = setInterval(() => {
        let isUac = wfrc.isUac();
        if (isUac !== _lastUACStatus) {
            _lastUACStatus = isUac
            _sendEventData(session, 'uac', [isUac ? 1 : 0], [])
        }
    }, 100)
}

// only for windows
export function stopMonitorUACStatus() {
    _lastUACStatus = false
    if (_uacMonitorInterval) {
        clearInterval(_uacMonitorInterval);
        _uacMonitorInterval = null;
    }
}

export function simulateRemoteControlInputEvent(rcEvent) {
    // console.log('receive rc event', rcEvent);
    let eventName = rcEvent.name
    let numberArgs = rcEvent.numberArgs
    let strArgs = rcEvent.strArgs

    let retValue = 0

    if (eventName === 'kd') {
        retValue = wfrc.onKeyDown(...strArgs);
    } else if (eventName === 'ku') {
        retValue = wfrc.onKeyUp(...strArgs);
    } else if (eventName === 'click') {
        // TODO
        // wfrc.onMouseClick(...data.args);
    } else if (eventName === 'mv') {
        retValue = _mouseMove(...numberArgs);
    } else if (eventName === 'md') {
        _mouseMove(...numberArgs.slice(1));
        retValue = wfrc.onMouseDown(numberArgs[0]);
    } else if (eventName === 'mu') {
        _mouseMove(...numberArgs.slice(1));
        retValue = wfrc.onMouseUp(numberArgs[0]);
    } else if (eventName === 'wl') {
        retValue = wfrc.onMouseScroll(...numberArgs);
    } else {
        console.log("Unknown event ", rcEvent);
    }
    return retValue
}

function _mouseMove(x, y) {
    x = x * window.devicePixelRatio;
    y = y * window.devicePixelRatio;
    if (x !== _lastMouseX || y !== _lastMouseY) {
        _lastMouseX = x;
        _lastMouseY = y;
        return wfrc.onMouseMove(x, y);
    }
    return 0
}

let _lastMouseX = 0;
let _lastMouseY = 0;

let _deltaXSum = 0;
let _deltaYSum = 0;

let _keydownEventListener = null;
let _keyupEventListener = null;
let _uacMonitorInterval = null;
let _lastUACStatus = false
