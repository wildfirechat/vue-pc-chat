import {ipcRenderer, isElectron} from '../../platform';
import IpcEventType from '../../ipcEventType';
import wfc from '../../wfc/client/wfc';
import store from '../../store';

/**
 * 查看头像：PC 用多媒体预览窗口，网页用应用内预览。
 * 头像被当成一张图片消息，右键/工具栏与图片预览同一套（对齐 wf-enterprise-chat 96182762）。
 */
export function previewPortrait(portraitUrl, name) {
    if (!portraitUrl) {
        return;
    }
    if (isElectron()) {
        let hash = window.location.hash;
        let url = window.location.origin;
        if (hash) {
            url = window.location.href.replace(hash, '#/mmpreview');
        } else {
            url += '/mmpreview';
        }
        let mediaItems = [{
            url: portraitUrl,
            thumbUrl: portraitUrl,
            type: 3,
            title: name || '',
            messageUid: '0',
        }];
        url += `?favMediaIndex=0&favMediaData=${wfc.escape(wfc.utf8_to_b64(JSON.stringify(mediaItems)))}`;
        ipcRenderer.send(IpcEventType.SHOW_MULTIMEDIA_PREVIEW_WINDOW, {url});
    } else {
        store.previewMedias([{src: portraitUrl, thumb: portraitUrl, autoplay: false}], 0);
    }
}
