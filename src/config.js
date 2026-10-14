import {isElectron} from './platform'
import wfc from "./wfc/client/wfc";

// 组织 / 部门图标，同 wf-enterprise-chat 的 EntryTile：天蓝圆角底 + 白色 Fluent 图标（占底板 60%）
function entryTileIcon(iconPath) {
    return 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">'
        + '<rect width="40" height="40" rx="4" fill="#3098F0"/>'
        + '<path transform="translate(8 8)" fill="#fff" d="' + iconPath + '"/></svg>');
}

export default class Config {
    // 调试用
    static ENABLE_AUTO_LOGIN = true;
    // 是否支持多人音视频通话
    static ENABLE_MULTI_VOIP_CALL = true;
    // 是否支持1对1音视频通话
    static ENABLE_SINGLE_VOIP_CALL = true;

    static DEFAULT_PORTRAIT_URL = 'data:image/png;base64,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';
    static DEFAULT_GROUP_PORTRAIT_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADwAAAA+CAYAAAB3NHh5AAAGjUlEQVRoQ+1baWxUVRT+7pt57SydaaeFQodSoHUhIYRVUaGl1aCGIGDRuERkh0JSDJFUiU34AYmsKpsGNECoVhR/sCgB17IUJS0gohUbytYWBNoy087Wzrx3zX1DS6HLvDdvkNKZ82smc+fe853v3LPc9y5BKxkx94rB6KUJopbqOerTtP7tQfssEq2gpXA1cFzdiS1WV7P+xP+BksyZl0eLWs1UUGQA6AdA/6CBvEtfN4BLIDjM+YSCoq0pxQChhIFNn105kSPcWgqaBtyywQOO9rb6FASkQqTi20c+67uXZOZc6E8FfjcFhnQbjO0AIcBpovFOJhlzqhcDdBW6H7V3w6YAySMZc6tPgtJh3ZndFmyEnGIMOwFqCAvAIC6SMaeKhgdYP8oI4O7OdoThCMPdzAIRl+5mhLaBE3KGo3iC9KE6DOzPg+OA89U+HD3lgd0pdglbhgywxcRhQroRLz1jRJzpzlba7hDx3VEn9hxy4t9a4b4CDwlgfTTBO9PiMHqIHozh9oRSoKTMg3Vf2lB1/f6BDgngt16NxYtZMSABWmkGes8hBz7eVY9Gb/sVbVqyFpkj9LD20OKGTcDhk26cveSFGKIdoRpwWjKPlbkJ6GmRdyJUVy9g0doaXLzqa9XEAAOsPKZPMCFjuA6kleUEkeL4nx5s3duAc5VeMKOpEdWAJ2YYkftKbIeu3J5yH3xuw57DzpafeidokD/LgkFp0eA68JLz1V6s2mHD3xea1OBV1zwwIma8YMK0CWZFSuwucuDDQnvLfxa9HotJYzvfEozZg7+58FGhDe7G4GlWxTBjY9YkM94Yb1IE+NsjTqwusEn/iY0h+GZVEqK0gc/Sau0CFq6pQdW129tB0cKhaA+zs4xY8HIseBkKNyu3aZcdX//gkL4+OViHFbkJsvRmLC9eV4PSskZZ49sbpIphNuHgh6KwLCceFrO8oOVpoliw4gYqqrySPs8+ocd7M+NlA1i6uQ5FJ9gJbHCiGrCGA5bMsGDcqMCnRCIFfjzu34dOj38fMoNtzOspS3tBoMhdU4O/KoIPXKoBM00T4zV4d1ochg9kKaVj3c9VNmHlDhvKL/nZZcIKle1LE9EnURsQNPOKvPW1qLEFX7iEBDDTlOXhedkmPD3SAI3mTtSMy9IyD9YU2HCtTmiTS8eN0mPJjHgwb+lIfALF9n31KDzggKCiCAkZYKYoaxZGDIxG1kg9+iVpwXEE1dd9+LnEhZKyJnh97acTVprOnmyWanFdVFsXafJSFP/hwdoCGxpcKtCGIkp3xAhzbSVVkcnASYbKGqlDajIP9t3lpqio9uLoKTf2H3PB6Q4+/zbrGVKGA27CAAOYkcxGDkY9gVZDIAiA0yOi3il2nVq6GUM0TxAdRcBrIe3h5hKRRWYWXeudtEOXVmsoJf9XxTDrgR9O4dHfyqNvLy0SLRpYzIwh7lblxEACDpeIwu8dKCoNPn8qAdXZ2KAA9+mpxeRMIx4fFC01+yYDaROZWy/a4BSR/0ktfi9vmz81GuDRlCjphCSlN48ecRz0OiI9tGU1c61dROU1H8ovN+Gfi16wwkWNKAY8wKrF8vkJSO4VOG8yxZh6rHbe8JUdjbeUZXs01cpj/BgD0ofppQAlR5xuUWoV9xe7cPaiFw63qCgwsjUUA142Px4Zw+S/HMAa/Q07bdh3xP/WAWsFc6bEYuxwvZTGghEWzE6c9WD9TrvEvhJRDPjgxiToouRryqLs6h02/FLqlgC+9lwMZk40S1FYjfjbRSfe3+bvuuSKYsCHtvSRO7c0jrkha9xZwW/QEeRNtSDrMfke0tlizJjjF15VpM//CjjGwGHJ9DiMGRoawAzp2LnVEcAhTUtqXDrCsCJnbH9wxKUDGFFx0CrabL3j3DgQSS6PKPXBP5W4wVyaHRSwYiMUQilF5rwriqZSDPjT/EQ8ksLLXoQ1Dtv2NeCLAw1S7s2ZYka2jKcUchYov+zFnOXX5QxtGaMY8OghOuS9GdfmgVlnqx4/48HyrTelNm9QKo/82fHSoxQ1crNBkAqa4tMeRdMoBsxmT7Vq8fxTBlknlawiOlPRiIO/usFOLpiYYzhkZxqR1EMjnYoolZv1Ag4cc+H8FWVlJVsnKMBKFexK4yOAuxIb90KXCMP3wqpdac4Iw12JjXuhSzgyHG4viIfhFYDwuuQRdtd4wu6ilj/0h9VVvNvZjl22NIlivI/A0B0uW3I+4nbypLb1Zcv/AOmjBXoSCJhJAAAAAElFTkSuQmCC'

    // Fluent building_24_filled
    static DEFAULT_ORGANIZATION_PORTRAIT_URL = entryTileIcon('M3.98 4.27Q3.98 3.31 4.66 2.66Q5.33 2.02 6.24 2.02H14.26Q15.17 2.02 15.84 2.66Q16.51 3.31 16.51 4.27V9.5H17.76Q18.67 9.5 19.34 10.15Q20.02 10.8 20.02 11.76V21.26Q20.02 21.55 19.8 21.77Q19.58 21.98 19.25 21.98H16.51V18.24Q16.51 17.71 16.13 17.35Q15.74 16.99 15.26 16.99H8.74Q8.26 16.99 7.87 17.35Q7.49 17.71 7.49 18.24V21.98H4.75Q4.42 21.98 4.2 21.77Q3.98 21.55 3.98 21.26ZM15.02 18.48V21.98H12.77V18.48ZM11.23 18.48V21.98H9.02V18.48ZM7.49 6.48Q7.49 6.91 7.78 7.2Q8.06 7.49 8.5 7.49Q8.93 7.49 9.22 7.2Q9.5 6.91 9.5 6.5Q9.5 6.1 9.22 5.81Q8.93 5.52 8.5 5.52Q8.06 5.52 7.78 5.81Q7.49 6.1 7.49 6.48ZM8.5 12.48Q8.06 12.48 7.78 12.79Q7.49 13.1 7.49 13.51Q7.49 13.92 7.78 14.21Q8.06 14.5 8.5 14.5Q8.93 14.5 9.22 14.21Q9.5 13.92 9.5 13.51Q9.5 13.1 9.22 12.79Q8.93 12.48 8.5 12.48ZM8.5 8.98Q7.92 8.98 7.63 9.48Q7.34 9.98 7.63 10.49Q7.92 10.99 8.5 10.99Q8.93 10.99 9.22 10.7Q9.5 10.42 9.5 10.01Q9.5 9.6 9.22 9.31Q8.93 9.02 8.5 8.98ZM12 5.52Q11.57 5.52 11.28 5.81Q10.99 6.1 10.99 6.5Q10.99 6.91 11.28 7.2Q11.57 7.49 12 7.49Q12.43 7.49 12.72 7.2Q13.01 6.91 13.01 6.5Q13.01 6.1 12.72 5.81Q12.43 5.52 12 5.52ZM12 12.48Q11.57 12.48 11.28 12.79Q10.99 13.1 10.99 13.51Q10.99 13.92 11.28 14.21Q11.57 14.5 12 14.5Q12.43 14.5 12.72 14.21Q13.01 13.92 13.01 13.51Q13.01 13.1 12.72 12.79Q12.43 12.48 12 12.48ZM15.5 12.48Q15.07 12.48 14.78 12.79Q14.5 13.1 14.5 13.51Q14.5 13.92 14.78 14.21Q15.07 14.5 15.5 14.5Q15.94 14.5 16.22 14.21Q16.51 13.92 16.51 13.51Q16.51 13.1 16.22 12.79Q15.94 12.48 15.5 12.48ZM12 8.98Q11.42 8.98 11.14 9.48Q10.85 9.98 11.14 10.49Q11.42 10.99 12 10.99Q12.43 10.99 12.72 10.7Q13.01 10.42 13.01 10.01Q13.01 9.6 12.72 9.31Q12.43 9.02 12 8.98Z');
    // Fluent people_list_24_filled
    static DEFAULT_DEPARTMENT_PORTRAIT_URL = entryTileIcon('M8.02 12Q9.65 12 10.82 10.82Q12 9.65 12 7.99Q12 6.34 10.82 5.16Q9.65 3.98 7.99 3.98Q6.34 3.98 5.16 5.16Q3.98 6.34 3.98 7.99Q3.98 9.65 5.16 10.82Q6.34 12 8.02 12ZM16.99 12Q18.24 12 19.13 11.11Q20.02 10.22 20.02 9Q20.02 7.78 19.13 6.89Q18.24 6 16.99 6Q15.74 6 14.88 6.89Q14.02 7.78 14.02 9Q14.02 10.22 14.88 11.11Q15.74 12 16.99 12ZM4.27 14.02Q3.31 14.02 2.66 14.66Q2.02 15.31 2.02 16.27V16.51L2.06 16.94Q2.16 17.52 2.4 18.1Q2.74 18.86 3.31 19.44Q4.03 20.11 5.09 20.54Q6.34 20.98 8.02 20.98Q10.51 20.98 12 19.97Q12.1 19.39 12.53 19.01Q12 18.48 12 17.74Q12 16.99 12.53 16.51Q12 15.98 12 15.29Q12 14.59 12.43 14.11Q12.1 14.02 11.76 14.02ZM13.73 14.5Q13.44 14.5 13.22 14.71Q13.01 14.93 13.01 15.24Q13.01 15.55 13.22 15.77Q13.44 15.98 13.73 15.98H21.26Q21.55 15.98 21.77 15.77Q21.98 15.55 21.98 15.24Q21.98 14.93 21.77 14.71Q21.55 14.5 21.26 14.5ZM13.73 16.99Q13.44 16.99 13.22 17.21Q13.01 17.42 13.01 17.74Q13.01 18.05 13.22 18.26Q13.44 18.48 13.73 18.48H21.26Q21.55 18.48 21.77 18.26Q21.98 18.05 21.98 17.74Q21.98 17.42 21.77 17.21Q21.55 16.99 21.26 16.99ZM13.73 19.49Q13.44 19.49 13.22 19.7Q13.01 19.92 13.01 20.23Q13.01 20.54 13.22 20.76Q13.44 20.98 13.73 20.98H21.26Q21.55 20.98 21.77 20.76Q21.98 20.54 21.98 20.23Q21.98 19.92 21.77 19.7Q21.55 19.49 21.26 19.49Z');
    static DEFAULT_MESH_PORTRAIT_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFAAAABQCAMAAAC5zwKfAAAAk1BMVEUzmvD////4+/77/f+32/rl8v1ptfS53frV6/xisfRarvM5nfHp9f1AofH0+v7t9v7d7v3D4fuQyPdJpfLx+P7J5fuZzfh/wPZFo/E8nvGl0/hxufVst/Q3nPCh0fh6vfV2u/XN5vux2fmUyvdQqfKu1/mdz/hVq/PQ6Pzh8P3a7fyp1fmLxveIxPaEwvZNp/K93vpatp9RAAADjklEQVRYw+2Y23qqMBCFExEQ5CDKGRUVxXr2/Z+uzCRo4Gsl2l6yLraQb/MnmVkzhJJevXr1+pNuWaFPx/+CSswoDVwKsqI/smbZdDhRqKCR8TFstRkN6A8azj7kKfQXDcrkA54prM5fn66GXl0cRxTlXt/mxRZFWXqR4RYXfnV3JREfP2rv8cYjyoF1wLLqRrEJSaYORQX7d4A6wjCryXPEY5nfsOgqp1iaFzLUnT4oCYQ0r+Mb8Nhqsgnmm01w4ykM5ZDd5BGRISN6byR4YEBqVHjsUl15YEDCtF+6lEmZySc4Z8868FhGbJgjgxH7OqJPTaUTHPK7OSTAMa8QsTEh2rBZPBPZBOuP2wvcqjDJZltaj2LRPYoyJRMstKm0hiANdTzbhG/81MXLMdaR9tT8QBvyT7CqWOFFuHjNMwb0pRQvZ4uPAAbQ7DVw+BKnhjPxP24gjvfPga5YF9AqViusbwmgozZUZ2MphAZR2IEuMsB9K/FcaWNoTcgJHCGz5UkiOh0KLRiIa0TTFISYMLiXiaEujEVYtNpAWGOscE9Pqt+yC4gOOz/HjmyCubBGmMOCiwIuuoBLC6gG4ZoDB+4YMX2YBpstzK51AKeGAvNiO+aN64uh+Rq5aSDZAb5Xu4DkTCGJrKj2FB8Widw0gEOlnUD84eHaQYUQ0iCiaRCHMruByaReVzzgGRKJ8I/z7D2kG0i2Dvd3CL82EYltTWWAZMX8PXbbMcrFfg3xUGIpIFmiv9HUt8dRLNQnAi7iL+suYIkdb7HGqmamto3zbtR6m+SEvbpyiVp2j94uLBTK5HkqbYn7+gpTjjuAncKFsvqATezIS5Uv+/9EL+azJb9TkxsrypdaBD+z/CCNTNyc7UApYoGE6PkO2ZjG9aXcBId6c2UmnDgK2HV8hwW7eCDo0s0FRoSdlRO/kla3PZHYp0xbyaOSomHj4grGjYOEUlEiPpf0Yc6vHkrhCRWds6hjrNbtigX72o3jYaIHG/v75WZhyXBiXncXe4gWsomUNpiYLYvR1hWa6JHV2uLit149MuZRYZ3QYpGIHT9jztN4RR+ETthpHuFwZfo1Efw32urcm/KfkmgeVMYS77BOb1AA8m+AXSwLE49h6r3MqwoxkFh6OPb+V0q7kSqH+5o2dMjI+yrob3KmC/KJwh+/bjF4H2umnXdfTexaxiryWCsi/6btCv+I0atXr16f6Rsd6DUwrgFLOAAAAABJRU5ErkJggg=='
    // 默认缩略图，200 x200，#d3d3d3
    static DEFAULT_THUMBNAIL_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMgAAADICAYAAACtWK6eAAAAAXNSR0IArs4c6QAABSlJREFUeF7t1bERwzAMBEGx//JYkN2A5eDSX+UIsOCNzr338/gIEPgpcATiZRB4FxCI10Hgj4BAPA8CAvEGCDQBf5DmZmpEQCAjh7ZmExBIczM1IiCQkUNbswkIpLmZGhEQyMihrdkEBNLcTI0ICGTk0NZsAgJpbqZGBAQycmhrNgGBNDdTIwICGTm0NZuAQJqbqREBgYwc2ppNQCDNzdSIgEBGDm3NJiCQ5mZqREAgI4e2ZhMQSHMzNSIgkJFDW7MJCKS5mRoREMjIoa3ZBATS3EyNCAhk5NDWbAICaW6mRgQEMnJoazYBgTQ3UyMCAhk5tDWbgECam6kRAYGMHNqaTUAgzc3UiIBARg5tzSYgkOZmakRAICOHtmYTEEhzMzUiIJCRQ1uzCQikuZkaERDIyKGt2QQE0txMjQgIZOTQ1mwCAmlupkYEBDJyaGs2AYE0N1MjAgIZObQ1m4BAmpupEQGBjBzamk1AIM3N1IiAQEYObc0mIJDmZmpEQCAjh7ZmExBIczM1IiCQkUNbswkIpLmZGhEQyMihrdkEBNLcTI0ICGTk0NZsAgJpbqZGBAQycmhrNgGBNDdTIwICGTm0NZuAQJqbqREBgYwc2ppNQCDNzdSIgEBGDm3NJiCQ5mZqREAgI4e2ZhMQSHMzNSIgkJFDW7MJCKS5mRoREMjIoa3ZBATS3EyNCAhk5NDWbAICaW6mRgQEMnJoazYBgTQ3UyMCAhk5tDWbgECam6kRAYGMHNqaTUAgzc3UiIBARg5tzSYgkOZmakRAICOHtmYTEEhzMzUiIJCRQ1uzCQikuZkaERDIyKGt2QQE0txMjQgIZOTQ1mwCAmlupkYEBDJyaGs2AYE0N1MjAgIZObQ1m4BAmpupEQGBjBzamk1AIM3N1IiAQEYObc0mIJDmZmpEQCAjh7ZmExBIczM1IiCQkUNbswkIpLmZGhEQyMihrdkEBNLcTI0ICGTk0NZsAgJpbqZGBAQycmhrNgGBNDdTIwICGTm0NZuAQJqbqREBgYwc2ppNQCDNzdSIgEBGDm3NJiCQ5mZqREAgI4e2ZhMQSHMzNSIgkJFDW7MJCKS5mRoREMjIoa3ZBATS3EyNCAhk5NDWbAICaW6mRgQEMnJoazYBgTQ3UyMCAhk5tDWbgECam6kRAYGMHNqaTUAgzc3UiIBARg5tzSYgkOZmakRAICOHtmYTEEhzMzUiIJCRQ1uzCQikuZkaERDIyKGt2QQE0txMjQgIZOTQ1mwCAmlupkYEBDJyaGs2AYE0N1MjAgIZObQ1m4BAmpupEQGBjBzamk1AIM3N1IiAQEYObc0mIJDmZmpEQCAjh7ZmExBIczM1IiCQkUNbswkIpLmZGhEQyMihrdkEBNLcTI0ICGTk0NZsAgJpbqZGBAQycmhrNgGBNDdTIwICGTm0NZuAQJqbqREBgYwc2ppNQCDNzdSIgEBGDm3NJiCQ5mZqREAgI4e2ZhMQSHMzNSIgkJFDW7MJCKS5mRoREMjIoa3ZBATS3EyNCAhk5NDWbAICaW6mRgQEMnJoazYBgTQ3UyMCAhk5tDWbgECam6kRAYGMHNqaTUAgzc3UiIBARg5tzSYgkOZmakRAICOHtmYTEEhzMzUiIJCRQ1uzCQikuZkaERDIyKGt2QQE0txMjQgIZOTQ1mwCAmlupkYEBDJyaGs2AYE0N1MjAgIZObQ1m4BAmpupEQGBjBzamk1AIM3N1IiAQEYObc0mIJDmZmpEQCAjh7ZmExBIczM1IvAFWDC2pw/rRZEAAAAASUVORK5CYII='

    // APP SERVER的地址，不能省略http(s)前缀。
    // 默认的app server使用端口是8888，注意端口号别忘记了。
    // 上线建议使用https，使用https更安全。
    //static APP_SERVER = 'http://app.wildfirechat.net:8888';
    static APP_SERVER = 'https://app.wildfirechat.net';

    // APP SERVER 备选地址，双网环境下使用
    static APP_BACKUP_SERVER = null;

    // 接龙服务地址
    static COLLECTION_SERVER = 'https://jielong.wildfirechat.net';

    // 接龙服务备选地址，双网环境下使用
    static COLLECTION_BACKUP_SERVER = null;

    // 投票服务地址
    static POLL_SERVER = 'https://poll.wildfirechat.net';

    // 投票服务备选地址，双网环境下使用
    static POLL_BACKUP_SERVER = null;

    // 服务器搜索服务地址（会话内消息搜索），对应 wf-search-server 项目（https://gitee.com/wfchat/search_server）
    static SEARCH_SERVER = null;

    // 服务器搜索服务备选地址，双网环境下使用
    static SEARCH_BACKUP_SERVER = null;

    // 语音转文字服务地址，如果没有部署语音转文字服务，或者不需要语音转文字的话，可置为 null
    // 语音转文字服务项目：https://gitee.com/wfchat/asr-api ，请求时会在 HTTP header authCode 中带上从 IM 服务获取的认证码，由 asr-api 校验
    static ASR_SERVER = 'https://app.wildfirechat.net/asr/api/recognize';

    // 语音转文字服务备选地址，双网环境下使用
    static ASR_BACKUP_SERVER = null;

    // 实时语音输入服务地址，配置之后，发送语音按钮后面会显示语音输入按钮，点击后边说边把识别结果写入输入框。不需要的话，可置为 null
    // 请配置为 asr-api 的实时语音识别地址，例如 wss://example.com/asr/api/stream，连接时会在 HTTP header authCode 中带上从 IM 服务获取的认证码
    // 内网测试时也可以直连 wf-voice 的 WebSocket 地址（默认端口 12436），例如 ws://192.168.1.100:12436。wf-voice 本身没有鉴权，也不支持 wss，请勿直接暴露到公网
    static ASR_STREAM_SERVER = 'wss://app.wildfirechat.net/asr/api/stream';

    // 实时语音输入服务备选地址，双网环境下使用
    static ASR_STREAM_BACKUP_SERVER = null;

    // 实时语音输入是否边说边出字。开启时说话过程中实时显示正在说的这句话，说完后修正为这句的最终结果；关闭时每说完一句才显示这句话
    // 开启后 wf-voice 会在说话过程中反复识别正在说的这句话，服务端 CPU 占用更高。旧版本 wf-voice 不支持，开启后效果和关闭一样
    static ENABLE_ASR_PARTIAL_RESULT = true;

    // 组织结构服务地址，如果没有部署组织结构服务，或者不需要组织结构的话，可置为 null
    // 组织结构项目：https://github.com/wildfirechat/organization-platform 或 https://gitee.com/wfchat/organization-platform
    static ORGANIZATION_SERVER = 'https://org.wildfirechat.net';

    // 组织结构服务备选地址，双网环境下使用
    static ORGANIZATION_BACKUP_SERVER = null;

    // 自动更新服务地址。各平台的更新文件放在它下面的子目录（mac-universal、win-x64、linux-x64、linux-arm64），
    // 即 vue.config.js 里 mac、win、linux 各自 publish.url 的上一级目录；检查更新时会拼上 publish.url 的最后一级目录。
    // publish 必须配置：打包时据此生成 app-update.yml 和 latest.yml 等更新文件，electron-updater 下载更新时也要读 app-update.yml。
    // 为 null 时直接使用 publish.url，不做双网切换
    static UPDATE_SERVER = null;

    // 自动更新服务备选地址，双网环境下使用，配置时 UPDATE_SERVER 也必须配置。主备地址下要放同一套更新文件
    static UPDATE_BACKUP_SERVER = null;

    // 野火二维码 scheme，不要修改，如果需要修改的话，所有端都需要一起修改
    static QR_CODE_PREFIX_PC_SESSION = "wildfirechat://pcsession/";

    // 如果使用的是高级版音视频 SDK，则不需要配置 ICE_SERVER，否则需要配置。<br>
    // 请参考 src/wfc/av/internal/README.MD 切换音视频 SDK <br>
    // turn server 配置，可以添加多个<br>
    // 格式: [uri, 用户名, 密码]，可以添加多个<br>
    // Turn服务配置，用户音视频通话功能，详情参考 https://docs.wildfirechat.net/webrtc/ <br>
    // 我们提供的服务能力有限，总体带宽仅3Mbps，只能用于用户测试和体验，为了保证测试可用，我们会不定期的更改密码。<br>
    // 上线时请一定要切换成你们自己的服务。可以购买腾讯云或者阿里云的轻量服务器，价格很便宜，可以避免影响到您的用户体验。<br>
    // ICE_SERVERS 是数组数据，可以同时配置多个主备 turn 地址，不需要按双网动态选择
    static ICE_SERVERS = [['turn:turn.wildfirechat.net:3478', 'wfchat', 'wfchatpwd']];

    static LANGUAGE = 'zh_CN';

    static SDK_PLATFORM_WINDOWS = 3;
    static SDK_PLATFORM_OSX = 4;
    static SDK_PLATFORM_WEB = 5;
    static SDK_PLATFORM_WX = 6;

    // html5 audio 标签不能播放amr格式的音频，需要将amr格式转换为mp3格式
    // 本服务传入amr音频文件的地址，将音频文件转换为mp3格式，并以application/octet-stream的格式返回
    // 如果语音消息很多，建议使用cdn
    static getAmrToMp3ServerAddress() {
        return Config.getAppServer() + '/amr2mp3?path=';
    }

    // 文件传输助手ID
    // 不需要文件传输助手时，可以配置为 null
    static FILE_HELPER_ID = 'wfc_file_transfer';

    /**
     * 允许重新编辑多长时间内的撤回消息，单位是秒
     */
    static RECALL_REEDIT_TIME_LIMIT = 60;

    static SECRET_CHAT_MEDIA_DECODE_SERVER_PORT = 7982;
    // 如果不支持工作台，将其置空即可
    static OPEN_PLATFORM_WORK_SPACE_URL = 'https://open.wildfirechat.cn/work.html';

    // 工作台备选地址，双网环境下使用
    static OPEN_PLATFORM_WORK_SPACE_BACKUP_URL = null;

    // background.js#startOpenPlatformServer 里面写死了 7983 端口，如果改动这个端口的话，要一起改动
    static OPEN_PLATFORM_SERVE_PORT = 7983;

    // AI 入口地址，如果不需要 AI 功能，置为 null 即可
    static AI_PORTAL_URL = null;

    // 允许主动加入多人音视频通话
    static ENABLE_MULTI_CALL_AUTO_JOIN = false;

    // 需要专业版 im-server 才支持，是否打开语音对讲功能，和对讲机类似的功能，不是发送语音消息
    static ENABLE_PTT = true;

    // 是否支持图文混排、文件文本混排，目前之后 pc 端支持，故默认关闭
    static ENABLE_MIX_MEDIA_MESSAGE = false;

    // 发送日志命令，当发送此文本消息时，会把协议栈日志发送到当前会话中，为空时关闭此功能。
    static SEND_LOG_COMMAND = '*#marslog#';

    // 是否支持水印
    static ENABLE_WATER_MARK = true

    // 单人音视频通话页面是否显示音视频 SDK 相关提示
    static SHOW_VOIP_TIP = true


    // 是否启用登录页滑动验证码
    static ENABLE_LOGIN_SLIDE_VERIFY = true

    // AI机器人ID
    static AI_ROBOT = "FireRobot";

    // 禁止发送的文件类型
    static DISABLED_SEND_FILE_TYPES = ['exe', 'bat', 'apk'];
    // 禁止接收的文件类型
    static DISABLED_RECEIVE_FILE_TYPES = ['exe', 'bat', 'apk'];
    // 打开消息链接的策略，0=不限制, 1=提醒, 2=禁止
    static OPEN_LINK_POLICY = 1;

    // AI会议纪要机器人ID，为空时不启用会议纪要跳转功能
    static AI_MINUTES_ROBOT_ID = "robotminutes";
    // 会议纪要页面URL
    static MINUTES_URL = "http://101.42.4.222:8883/index.html";

    // 会议纪要页面备选地址，双网环境下使用
    static MINUTES_BACKUP_URL = null;

    /**
     * 双网环境下，根据当前网络选择主网或备选网络地址
     * @param {string|Array|null} mainUrl
     * @param {string|Array|null} backupUrl
     * @return {string|Array|null}
     * @private
     */
    static _selectServer(mainUrl, backupUrl) {
        if (wfc.connectedToMainNetwork() || !backupUrl) {
            return mainUrl;
        }
        return backupUrl;
    }

    static getAppServer() {
        return Config._selectServer(Config.APP_SERVER, Config.APP_BACKUP_SERVER);
    }

    static getCollectionServer() {
        return Config._selectServer(Config.COLLECTION_SERVER, Config.COLLECTION_BACKUP_SERVER);
    }

    static getPollServer() {
        return Config._selectServer(Config.POLL_SERVER, Config.POLL_BACKUP_SERVER);
    }

    static getSearchServer() {
        return Config._selectServer(Config.SEARCH_SERVER, Config.SEARCH_BACKUP_SERVER);
    }
    static getAsrServer() {
        return Config._selectServer(Config.ASR_SERVER, Config.ASR_BACKUP_SERVER);
    }

    static getAsrStreamServer() {
        return Config._selectServer(Config.ASR_STREAM_SERVER, Config.ASR_STREAM_BACKUP_SERVER);
    }

    static getOrganizationServer() {
        return Config._selectServer(Config.ORGANIZATION_SERVER, Config.ORGANIZATION_BACKUP_SERVER);
    }

    static getUpdateServer() {
        return Config._selectServer(Config.UPDATE_SERVER, Config.UPDATE_BACKUP_SERVER);
    }

    static getOpenPlatformWorkSpaceUrl() {
        return Config._selectServer(Config.OPEN_PLATFORM_WORK_SPACE_URL, Config.OPEN_PLATFORM_WORK_SPACE_BACKUP_URL);
    }

    static getMinutesUrl() {
        return Config._selectServer(Config.MINUTES_URL, Config.MINUTES_BACKUP_URL);
    }

    static getWFCPlatform() {
        if (isElectron()) {
            if (window.process && window.process.platform === 'darwin') {
                // osx
                return 4;
            } else if (window.process && window.process.platform === 'linux') {
                return 7;
            } else {
                // windows
                return 3;
            }

        } else {
            // web
            return 5;
        }
    }

    static config(options) {
        Object.keys(options).forEach(key => {
            Config[key] = options[key];
        });
    }

    /**
     * 网络地址重定向
     *
     * 仅当双网环境时，需要特殊处理，默认原样返回
     *
     * @param {string} url
     * @return {string} newUrl
     */
    static urlRedirect(url) {
        if (!url) {
            return url;
        }
        // 示例代码
        // 双网环境时，将媒体文件地址切到当前连接的网络
        // 主备网络是隔离的，从备选网络切回主网络时，也需要把备选网络地址切回主网络
        if (Config.isUseBackupAddress()) {
            url = url.replace('oss.xxxx.com', '192.168.2.19');
        } else {
            url = url.replace('192.168.2.19', 'oss.xxxx.com');
        }
        return url;
    }

    /**
     * 双网环境时，判断当前是否使用备选网络
     *
     * 和 _selectServer 一样以 wfc.connectedToMainNetwork() 为准，保证服务地址选择和媒体地址转换选的是同一个网络：
     * 设置了固定的备选网络策略（1 主网络 / 2 备选网络）时，以策略为准；
     * 否则以 IM 连接的网络为准，断线重连等未连接状态时沿用最近一次连接的网络，还没有连接过时按主网络处理。
     *
     * 不要直接用 wfc.getConnectedNetworkType()：它不考虑固定策略，且每次都是同步 IPC 调用，
     * 而本方法会被 urlRedirect 在解析每条媒体消息时调用。
     * @return {boolean}
     */
    static isUseBackupAddress() {
        return !wfc.connectedToMainNetwork();
    }

    /**
     * 表情 base 路径
     * @return {string}
     */
    static emojiBaseUrl() {
        // 表情的 baseUrl，一定要求以 / 结尾
        // 表情图片已内置在 public/twemoji/assets/ 下，随安装包分发，不依赖网络
        // 如需改为从服务器加载，可改为类似 'https://static.wildfirechat.net/twemoji/assets/' 的地址
        return './twemoji/assets/';
    }

    /**
     * 动态表情 base 路径
     * @return {string}
     */
    static stickerBaseUrl() {
        // 动态表情的 baseUrl，一定要求以 / 结尾
        let stickerBaseUrl = 'https://static.wildfirechat.net/sticker/';
        // 实例代码
        // 双网环境时，将动态表情地址切换到备选网络
        // if (Config.isUseBackupAddress()) {
        //     stickerBaseUrl = 'https://192.168.2.169/sticker/';
        // }
        return stickerBaseUrl;
    }
}
