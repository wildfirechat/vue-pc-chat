import {isElectron, shell} from "../../platform";

/**
 * 查看位置：交给系统打开（对齐 wf-enterprise-chat location_launcher.dart）。
 * macOS 用 Apple 地图；其它桌面系统没有系统地图应用，直接用网页地图（高德，坐标是 GCJ-02）。
 * 位置消息气泡、收藏列表共用。
 * @return {boolean} 坐标无效（或没有坐标）时返回 false，调用方给提示
 */
export function openLocationInMap(latitude, longitude, title) {
    let lat = Number(latitude);
    let lng = Number(longitude);
    if (!isFinite(lat) || !isFinite(lng) || (lat === 0 && lng === 0)) {
        return false;
    }
    let latStr = lat.toFixed(6);
    let lngStr = lng.toFixed(6);
    let url;
    if (typeof process !== 'undefined' && process.platform === 'darwin') {
        url = `https://maps.apple.com/?ll=${latStr},${lngStr}`;
        if (title) {
            url += `&q=${encodeURIComponent(title)}`;
        }
    } else {
        url = `https://uri.amap.com/marker?position=${lngStr},${latStr}&coordinate=gaode`;
        if (title) {
            url += `&name=${encodeURIComponent(title)}`;
        }
    }
    if (isElectron()) {
        shell.openExternal(url);
    } else {
        window.open(url);
    }
    return true;
}

/** 位置缩略图在消息体里是不带头部的 base64 */
export function locationThumbnailSrc(thumbnail) {
    if (!thumbnail) {
        return '';
    }
    return thumbnail.startsWith('data:image') ? thumbnail : 'data:image/jpeg;base64,' + thumbnail;
}
