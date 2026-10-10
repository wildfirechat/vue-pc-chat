import wfc from "../../wfc/client/wfc";
import Config from "../../config";
import { getItem } from './storageHelper';

let updateWaterMarkInterval;

/**
 * 是否显示水印：应用服务登录（密码登录 / 扫码登录）成功时下发了水印开关（服务端 watermark.enable）就以它为准，
 * 存在本地沿用到下次登录；旧版服务不下发时用 Config.ENABLE_WATER_MARK
 */
export function isWaterMarkEnabled() {
    let value = getItem('watermark');
    if (value === '1' || value === '0') {
        return value === '1';
    }
    return Config.ENABLE_WATER_MARK;
}

function updateWaterMark(watermarkStr, re) {
    const id = 'wf-watermark'
    const dom = document.getElementById(id)
    if (!isWaterMarkEnabled()) {
        // 登录后才知道服务端关了水印：把已经画上的去掉
        dom && document.body.removeChild(dom)
        return;
    }
    if (!watermarkStr) {
        return;
    }
    let waterMarkDataURL = genWaterMarkDataURL(watermarkStr)
    if (dom !== null) {
        if (!re) {
            dom.style.background = 'url(' + waterMarkDataURL + ') left top repeat'
            return
        } else {
            document.body.removeChild(dom)
        }
    }
    let div = document.createElement('div')
    div.id = id
    div.style.pointerEvents = 'none'
    div.style.top = '65px'
    div.style.left = '0px'
    div.style.position = 'fixed'
    div.style.zIndex = '999'
    div.style.opacity = '0.3'
    div.style.width = document.documentElement.clientWidth + 'px'
    div.style.height = document.documentElement.clientHeight - 65 + 'px'
    div.style.background =
        'url(' + waterMarkDataURL + ') left top repeat'
    document.body.appendChild(div)
}

function genWaterMarkDataURL(waterMarkStr) {
    const canvas = document.createElement('canvas')
    canvas.width = 250
    canvas.height = 200

    let ctx = canvas.getContext('2d')
    if (ctx) {
        ctx.rotate((-20 * Math.PI) / 180)
        ctx.font = '18px Vedana'
        // Read color from CSS variable
        ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-watermark').trim() || 'rgba(0, 0, 0, 0.1)';
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillText(waterMarkStr, canvas.width / 20, canvas.height)
        return canvas.toDataURL('image/png')
    }
    return ''
}

class watermark {
    watermarkStr = '';
    // 该方法只允许调用一次
    init(str) {
        console.log('init watermark')
        this.watermarkStr = str
        updateWaterMark(this.watermarkStr)
        if (!str) {
            setTimeout(() => {
                updateWaterMark(this.defaultWaterMark())
                updateWaterMarkInterval = setInterval(() => {
                    updateWaterMark(this.defaultWaterMark())
                }, 60 * 1000)
            }, 1000)
        }

        window.addEventListener('resize', () => {
            if (location.hash !== '#/') {
                updateWaterMark(this.watermarkStr ? this.watermarkStr : this.defaultWaterMark(), true)
            }
        })
    }

    refresh() {
        if (this.watermarkStr || updateWaterMarkInterval) {
            updateWaterMark(this.watermarkStr ? this.watermarkStr : this.defaultWaterMark(), true)
        }
    }

    remove() {
        window.removeEventListener('resize', () => {
        })
        const id = 'watermark'
        const dom = document.getElementById(id)
        if (dom !== null) {
            document.body.removeChild(dom)
        }
        clearInterval(updateWaterMarkInterval)
    }

    defaultWaterMark() {
        let now = new Date()
        let dateStr = now.getMonth() + 1 + '-' + now.getDate() + ' ' + now.getHours() + ':' + now.getMinutes()
        let userId = wfc.getUserId()
        return userId ? userId + ' ' + dateStr : ''
    }
}

export default new watermark()
