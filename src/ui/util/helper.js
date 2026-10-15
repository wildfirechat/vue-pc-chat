// ie11 not support browser-md5-file
// import MD5 from 'browser-md5-file';
import {numberValue} from '../../wfc/util/longUtil'
import IPCEventType from "../../ipcEventType";


const helper = {

    parseXml: (text, tagName) => {
        var parser = new window.DOMParser();
        var xml = parser.parseFromString(text.replace(/&lt;/g, '<').replace(/&gt;/g, '>'), 'text/xml');
        var value = {};

        tagName = Array.isArray(tagName) ? tagName : [tagName];

        tagName.forEach(e => {
            value[e] = xml.getElementsByTagName(e)[0].childNodes[0].nodeValue;
        });

        return {xml, value};
    },

    humanSize: (size) => {
        var value = (size / 1024).toFixed(1);

        if (size > (1024 << 10)) {
            value = (value / 1024).toFixed(1);
            return `${value} M`;
        } else {
            return `${value} KB`;
        }
    },

    getFiletypeIcon: (extension) => {
        // 图标取自 wf-enterprise-chat（chat/assets/images/file_type），分类对齐其 Utilities.fileType
        var filename = 'unknown';

        extension = (extension || '').toLowerCase().replace(/^\./, '');

        switch (true) {
            case ['doc', 'docx', 'pages'].includes(extension):
                filename = 'word';
                break;

            case ['xls', 'xlsx', 'numbers', 'csv'].includes(extension):
                filename = 'xls';
                break;

            case ['ppt', 'pptx', 'keynote'].includes(extension):
                filename = 'ppt';
                break;

            case ['pdf'].includes(extension):
                filename = 'pdf';
                break;

            case ['html', 'htm'].includes(extension):
                filename = 'html';
                break;

            case ['txt', 'md', 'log'].includes(extension):
                filename = 'text';
                break;

            case ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(extension):
                filename = 'image';
                break;

            case ['mp3', 'flac', 'aac', 'm4a', 'wma', 'wav', 'amr', 'aif'].includes(extension):
                filename = 'audio';
                break;

            case ['mp4', 'mkv', 'avi', 'flv', 'mov', 'wmv', 'mpeg', 'rmvb', 'f4v', 'webm'].includes(extension):
                filename = 'video';
                break;

            case ['exe', 'msi'].includes(extension):
                filename = 'exe';
                break;

            case ['xml'].includes(extension):
                filename = 'xml';
                break;

            case ['zip', 'rar', '7z', 'tar', 'gz', 'gzip', 'xz'].includes(extension):
                filename = 'zip';
                break;
            default:
                break;
        }

        return `${filename}.png`;
    },

    getPallet: (image) => {
        return new Promise((resolve, reject) => {
            new window.AlbumColors(image).getColors((colors, err) => {
                if (err) {
                    resolve([
                        [0, 0, 0],
                        [0, 0, 0],
                        [0, 0, 0],
                    ]);
                } else {
                    resolve(colors);
                }
            });
        });
    },

    decodeHTML: (text = '') => {
        return text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
    },
    escapeHtml: (text) => {
        return text.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            // /(^| ) /g 会匹配开头的空格或者前面是空格的空格，并将其替换为前一个匹配到的内容 $1 加上 &nbsp;。
            // 这样可以确保前一个字符不是空格的空格保持不变，其他情况下的空格都会被替换为 &nbsp;
            .replace(/(^| ) /g, "$1&nbsp;")
            .replace(/<script/gi, "&lt;script")
            .replace(/<iframe/gi, "&lt;iframe");
    },

    /**
     * 识别正文里的网址、邮箱、国内手机号（对齐 wf-enterprise-chat 119c7534 的 RichTextMessageWidget）。
     * 传入的是已转义的 HTML（escapeHtml 之后），必须单次扫描：分多次 replace 会把刚生成的 <a> 再包一层。
     * - 网址：http(s):// 或 www. 开头，只收 URL 允许的 ASCII 字符。中文、全角标点、空白都算网址结束
     *   （中文消息里网址后面常常直接跟文字）；末尾的句读和没有配对的右括号不算网址。
     * - 手机号：11 位，可带 +86，可按 3-4-4 用空格或横线分隔；前后紧挨着数字或字母的不算（订单号、ID 里的一段）。
     */
    linkify: (text) => {
        const pattern = /((?:https?:\/\/|www\.)[a-z0-9][-a-z0-9._~:/?#[\]@!$&'()*+,;=%]*)|((?<![a-z0-9._%+-])[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,})|((?<![0-9a-z+])(?:\+86[- ]?)?1[3-9][0-9](?:[- ]?[0-9]{4}){2}(?![0-9a-z]))/gi;
        // 转义后的 < > " ' 和连续空格（&amp; 是网址里本来的 &，保留）
        const entity = /&(?:lt|gt|quot|#39|nbsp);/i;
        const trimUrlTail = (url) => {
            const cut = url.search(entity);
            if (cut >= 0) {
                url = url.substring(0, cut);
            }
            const balanced = (end, open, close) => {
                let depth = 0;
                for (let i = 0; i < end; i++) {
                    if (url[i] === open) depth++;
                    if (url[i] === close) depth--;
                }
                return depth >= 0;
            };
            let end = url.length;
            while (end > 0) {
                const c = url[end - 1];
                if (".,;:!?'\"".indexOf(c) >= 0) {
                    end--;
                } else if (c === ')' && !balanced(end, '(', ')')) {
                    end--;
                } else if (c === ']' && !balanced(end, '[', ']')) {
                    end--;
                } else {
                    break;
                }
            }
            return url.substring(0, end);
        };
        let result = '';
        let lastIndex = 0;
        let m;
        while ((m = pattern.exec(text)) !== null) {
            let link;
            let href;
            if (m[1]) {
                link = trimUrlTail(m[1]);
                href = /^www\./i.test(link) ? 'https://' + link : link;
            } else if (m[2]) {
                link = m[2];
                href = 'mailto:' + link;
            } else {
                link = m[3];
                href = 'tel:' + link.replace(/[- ]/g, '');
            }
            if (!link || /^www\.$/i.test(link)) {
                pattern.lastIndex = m.index + 1;
                continue;
            }
            result += text.slice(lastIndex, m.index) + `<a href="${href}">${link}</a>`;
            lastIndex = m.index + link.length;
            pattern.lastIndex = lastIndex;
        }
        result += text.slice(lastIndex);
        return result;
    },

    isImage: (ext) => {
        return ['bmp', 'gif', 'jpeg', 'jpg', 'png'].includes(ext);
    },

    // 3 types supported: pic, video, doc
    getMediaType: (ext = '') => {
        ext = ext.toLowerCase();

        switch (true) {
            case helper.isImage(ext):
                return 'pic';

            case ['mp4'].includes(ext):
                return 'video';

            default:
                return 'doc';
        }
    },

    getDataURL: (src) => {
        var image = new window.Image();

        return new Promise((resolve, reject) => {
            image.src = src;
            image.onload = () => {
                var canvas = document.createElement('canvas');
                var context = canvas.getContext('2d');

                canvas.width = image.width;
                canvas.height = image.height;

                context.drawImage(image, 0, 0, image.width, image.height);
                resolve(canvas.toDataURL('image/png'));
            };

            image.onerror = () => {
                resolve('');
            };
        });
    },

    isOsx: window.process && window.process.platform === 'darwin',

    isSuspend: () => {
        return ipcRenderer.sendSync(IPCEventType.IS_SUSPEND);
    },

    // md5: (file) => {
    //     return new Promise((resolve, reject) => {
    //         new MD5().md5(file, (err, md5) => {
    //             resolve(err ? false : md5);
    //         });
    //     });
    // },

    weekFormat: (num) => {
        let str
        switch (num) {
            case 1:
                str = '星期一'
                break
            case 2:
                str = '星期二'
                break
            case 3:
                str = '星期三'
                break
            case 4:
                str = '星期四'
                break
            case 5:
                str = '星期五'
                break
            case 6:
                str = '星期六'
                break
            default:
                str = '星期天'
        }
        return str
    },

    /**
     * 会话时间显示
     */

    dateFormat(date) {
        if (!date) return ''
        if ((typeof date) === 'object') {
            date = numberValue(date);
        }
        let today = new Date().setHours(0, 0, 0, 0);
        let that = new Date(date).setHours(0, 0, 0, 0);
        if (today === that) {
            return this.timeFormat(date);
        } else {
            let thatDate = new Date(date);
            return thatDate.getFullYear() + '/' + (thatDate.getMonth() + 1) + '/' + thatDate.getDate();
        }
    },

    /**
     * 消息会话时间显示
     */
    timeFormat: (date) => {
        if (!date) return ''
        if ((typeof date) === 'object') {
            date = numberValue(date);
        }
        let newtime;
        let nowtime = new Date()
        // if (date.constructor !== Date) {
        //     date = new Date(date.replace(/\-/g, '/')) // 解决ios日期显示NAN问题
        //  }
        date = new Date(date)
        // 获取消息发送时间
        let Y = date.getFullYear()
        let M = date.getMonth() + 1 < 10 ? '0' + (date.getMonth() + 1) : date.getMonth() + 1
        let D = date.getDate() < 10 ? '0' + date.getDate() : date.getDate()
        let W = date.getDay()
        let H = date.getHours() < 10 ? '0' + date.getHours() : date.getHours()
        let Min = date.getMinutes() < 10 ? '0' + date.getMinutes() : date.getMinutes()
        // 获取当前时间
        let nowY = nowtime.getFullYear()
        let nowM = nowtime.getMonth() + 1 < 10 ? '0' + (nowtime.getMonth() + 1) : nowtime.getMonth() + 1
        let nowD = nowtime.getDate() < 10 ? '0' + nowtime.getDate() : nowtime.getDate()
        let isWeek = Math.abs(date - nowtime) < 7 * 24 * 3600 * 1000
        if (Y < nowY) {
            // 去年
            newtime = Y + '-' + M + '-' + D + ' ' + H + ':' + Min
        } else {
            if (Y === nowY && M === nowM && (nowD - D <= 7)) {
                // 昨天
                if ((nowD - D) === 1) {
                    newtime = '昨天' + ' ' + H + ':' + Min
                } else if (nowD === D) {
                    // 当天
                    newtime = H + ':' + Min
                } else {
                    // 一周内
                    newtime = helper.weekFormat(W) + ' ' + H + ':' + Min
                }
            } else {
                // 一年内
                newtime = M + '-' + D + ' ' + H + ':' + Min
            }
        }
        return newtime
    },

};


export default helper;
