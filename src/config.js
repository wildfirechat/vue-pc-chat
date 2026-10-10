import {ipcRenderer, isElectron} from './platform'
import wfc from "./wfc/client/wfc";
import IpcEventType from "./ipcEventType";

// 出厂配置（内置默认值）。登录页「服务配置」可以覆盖，「恢复默认配置」回到这里
const BUILTIN = {
    // 主机名（IM 与应用服务共用），不能带 scheme 和端口
    mainHost: 'qixin.wildfirechat.net',
    imPort: 443,
    // 应用服务端口，默认与 IM 端口相同（同入口部署）
    appPort: 443,
    backupStrategy: 0,
    // 备网主机名，null 表示不配备网
    backupHost: '124.223.173.97',
    backupImPort: 443,
    backupAppPort: 443,
    useWebsocket: true,
    useTls: true,
    turnUser: 'wfturn',
    turnPassword: 'CNSplD6LEVvm9h7N',
};

export default class Config {
    // 调试用
    static ENABLE_AUTO_LOGIN = true;
    // 是否支持多人音视频通话
    static ENABLE_MULTI_VOIP_CALL = true;
    // 是否支持1对1音视频通话
    static ENABLE_SINGLE_VOIP_CALL = true;

    static DEFAULT_PORTRAIT_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAFfgAABX4BPgLDIQAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAWCSURBVHic7Z3/T9R1HMefn7vPHXfenXeAw0a4UHSVmptKzK0knVqr+MEfwpyuzdqarVqzWcu5WrOfWuZixZitn8TNctRqTdaKvqDpzAoGZKQQaAQUJhwHx32/+/SDc7NT2u58fz7vJ/J+/AHv1xsevL9+Xu8XmmEYBhQ02GR3QPFflBAylBAylBAylBAylBAylBAylBAylBAylBAylBAylBAylBAydNkdyJdo3MDgSAojY2mkUlcurHVdw23FdpSV6HAVaJJ7mB8zSsjEVAYtP0TQ2hZFd38SqfSNvxzodg3LKpxYt9qNTWvc8M2ZOROBNhO+h8STBo58MYmPvgojFs+tu64CDVsf9GL7wz44Hfyjhl7IuYsJvPFBEEOXUjfVzoL5Ol57ugh33uEQ1DNzoBZy7Psp1B0JIZkS00WHruHF7QE8ev8cIe2ZAa2QD78M4+DHIeHtahrwbK0fWzZ5hbctAsrVruVMBO9/Il4GABgG0NAUwjc/Rk1p/2ahE9I/lMTbh8dh5rg1DGB/YxAXhpPmBckTOiH1R0M576TyIRo3cMBk8flAJeR0Vwxtv8Uti/fL7wkcb+eauqiENDZPWh6zqSVsecz/g0bIxeEUuvsTlsc925fAnyM3d8YRCY2QU53ypo5THTFpsbOhEfJrn/Wj4ypnJcbOhkbIwN/ypo0//uLZ/tIIGQ2lJcbOSIudDY0QK84e0xGNKyHXkZF4QMvw+OARoriCEkKGEkKGEkKGEkKGEkKGEkKGEkIGjRC7xJ44dJ58LRohHonZhR63EnIdJYV2abHnF8mLnQ2NkEVl8jIKKxbwZDPSCFl1V4G02JV3u6TFzoZGyJrlLikLu0PXcO9SeX8M2dAIKZxrwwOr3ZbH3VDlxlwvza+BRwgAPLbBC83CDY/NBtRu5MrxpRKyrMKJ9ZXWjZJH7vNgMdGCDpAJAYBd2wIo9pu/DS0r0fH8437T4+QKnRC/14Y9OwKmLvAFDg17niyEm/AdIp0QAKha7sLepwphM6F3Dl3DvmeKcM9ip/jGBUD7YAcAunoTeLVhFKGwmCwEv9eGN18oxtKFnDIA0hFylRVLnKheJW6Rr17lppYBkAuZjSghZCghZCghZCghZCghZFALSaUN9A+Je7sxeClF9+o2G9qDYc9AEm8dCqJ3QOxjmrUrXdi1LYB5AZ7PttdCJ6RvMInG5kmcaIua9kTBXaChZq0HtRu9mF/MJYZGSO9AEoeOTeJkR9SyaUW3a1hf6cbWh7w01/BShSRTBk60x/BZaxhdvXIfXq5Y4sTm9V5Ur3RJzdOSIiQcyaDp6zA+/W5K2MWhKAI+Gzav82DLJi88buv3PJYKSaUNfH48gsbmCQQnuERkU+S3Y0eNDzXVHkuTLywTcrorhoamkNTnz/lQXqrjuVo/qpZbkypkupBwJIP9jeNobeMq8pIr6yrdePmJALwmp7yaKqR/KInXD47NuFExHeWlOvbtLEZ5qXnFXE0T0tETx976MUxFudeKXAn4bHhn9zwsut2cbbIpQs5fTGDXgcuIxCiOOMIJ+Gyo2z0PC02QInxCHAul8cq7o7esDAAYn8zgpTpx3/qvRbiQ946GEJy8taapG3F5PI36o+ILdQoV0nE+jm9/mtm7qVxoORMRfsMgVIiMEn0yMQzgsOCfWZiQkdE02s9ZV8CShZ+7Y/gnKK60lDAhJzutu6VlImMApzrFlQgUJqSrh6dMntV09oibGYQJYawSbRUXhsXdRAgTMkZUJs9qRJYnFCYkEpu9QiJRcYunMCHp2etj2n+9lA/Cri337SwS1dSshibJQXEF6kS52YgSQoYSQoYSQoYSQoYSQoYSQoYSQoYSQoYSQoYSQoYSQoYSQoYSQoYSQsa/0LPTp+EdzPEAAAAASUVORK5CYII=';
    static DEFAULT_GROUP_PORTRAIT_URL = 'data:image/png;base64,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'

    static DEFAULT_ORGANIZATION_PORTRAIT_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFAAAABQCAYAAACOEfKtAAAACXBIWXMAAAsTAAALEwEAmpwYAAABlUlEQVR4nO2aIW7DQBBFc409UJRD9AoFJr1DeUADSrogoDws8EslloKCLeUEOcDWEzWtii133d2xH/h0ZD/9Pzs72lVSMBRGM1gBL/zJQAAUAK1kinCgAGg4UH4nASIsABoOVPkoEmEtBGDcN5PodFgvA+Dm+WMSfUFcDMDm/WK79jObANgC0HAgETZ6oDhEjENEnMKMMWIONAbplkHauIlwlTPuwprhMuFhd74vFHJpccuEDeus6UHHfXMHXcJVVTswARCACQcGIpwqaDP0QAHQcKAYY4wxpkLFJQ3Sp8M6+1ONp5fX3ztublUHMP64xYuqBZgyfpiXmgAUAA0Higibh35FDxQADQc6jltkjAkATDjQb9wiEQ6+AY5dGqQZ1MwKcHu8DNLj23nwz9ZeMyvA7toP0vb4/W5lDjUBeAWg4UARYRf9KtIDewB2ONBv3CIR7gHY4UC/cYtEuAdghwP/Z00UndTMskwY+worzaBmFoAoADBlNgIOFACtZGvBgQKg4UD5PeGJsABoOFDlo0iEVQbgDWanvolAkB8PAAAAAElFTkSuQmCC';
    static DEFAULT_DEPARTMENT_PORTRAIT_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFAAAABQCAYAAACOEfKtAAAAAXNSR0IArs4c6QAAAIRlWElmTU0AKgAAAAgABQESAAMAAAABAAEAAAEaAAUAAAABAAAASgEbAAUAAAABAAAAUgEoAAMAAAABAAIAAIdpAAQAAAABAAAAWgAAAAAAAABIAAAAAQAAAEgAAAABAAOgAQADAAAAAQABAACgAgAEAAAAAQAAAFCgAwAEAAAAAQAAAFAAAAAAwtohTAAAAAlwSFlzAAALEwAACxMBAJqcGAAAAVlpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IlhNUCBDb3JlIDYuMC4wIj4KICAgPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4KICAgICAgPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIKICAgICAgICAgICAgeG1sbnM6dGlmZj0iaHR0cDovL25zLmFkb2JlLmNvbS90aWZmLzEuMC8iPgogICAgICAgICA8dGlmZjpPcmllbnRhdGlvbj4xPC90aWZmOk9yaWVudGF0aW9uPgogICAgICA8L3JkZjpEZXNjcmlwdGlvbj4KICAgPC9yZGY6UkRGPgo8L3g6eG1wbWV0YT4KGV7hBwAAAjlJREFUeAHt28FOwkAQgOGt8UF4Cg0nOJjo1bfgEfRkPekj8BZeOGjigRuRcNeTJ30NsW0g2UzatTNTpE3+JiS7dGba/dgAW0oIbAgggAACCCCAAAIIIIAAAgMTyI59vlcPq2lxDuVDtT3fjnNVwoGCTw9UV1N2us3CnSZhF5sbcjpP6QNgNajri7NWg/v4/A7vxaMv20lfTmSo5wGg85UDEECngDOdGQigU8CZzgwE0CngTGcGAugUcKYzAwF0CjjTmYEAOgWc6b25nPX0unYO5TjpfQBcZtvawY9+QhgV7zHL2r08mRYoLvXnl4+retp06r/u5UPEyQ0ggE4BZzozEECngDOdGQigU8CZ3smtHdbbM1LnXnyJnmZZmBRfsu9TcZZ9Xd4W0tVKxHp7RuP496+s8baPxrq7HflfAW33dwVYHe/lZrwfd9vjN8aVK5ES7xA1Gw9q2MGHiAEtTgEw1jC0ATSgxSkAxhqGNoAGtDgFwFjD0AbQgBanABhrGNoAGtDiFNXKIbHmTf4AlFp7DqVmjBa3tUu5xjVv+UoUvwBN4uJRO4/asjmUmvK8q74WsEqaz85ri8knF5uvsNi0+0vCUGrKMfIeKEWUfQCVYDIcQCmi7AOoBJPhAEoRZR9AJZgMB1CKKPsAKsFkOIBSRNkHUAkmwwGUIso+gEowGQ6gFFH2AVSCyXDT5azZ/E3WcfeHUlMOVAvY9JcEWVfTH0pNzZiIRQABBBBAAAEEEEAAAQQQ6K/ALz1vZTdxNVa5AAAAAElFTkSuQmCC';
    static DEFAULT_MESH_PORTRAIT_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFAAAABQCAMAAAC5zwKfAAAAk1BMVEUzmvD////4+/77/f+32/rl8v1ptfS53frV6/xisfRarvM5nfHp9f1AofH0+v7t9v7d7v3D4fuQyPdJpfLx+P7J5fuZzfh/wPZFo/E8nvGl0/hxufVst/Q3nPCh0fh6vfV2u/XN5vux2fmUyvdQqfKu1/mdz/hVq/PQ6Pzh8P3a7fyp1fmLxveIxPaEwvZNp/K93vpatp9RAAADjklEQVRYw+2Y23qqMBCFExEQ5CDKGRUVxXr2/Z+uzCRo4Gsl2l6yLraQb/MnmVkzhJJevXr1+pNuWaFPx/+CSswoDVwKsqI/smbZdDhRqKCR8TFstRkN6A8azj7kKfQXDcrkA54prM5fn66GXl0cRxTlXt/mxRZFWXqR4RYXfnV3JREfP2rv8cYjyoF1wLLqRrEJSaYORQX7d4A6wjCryXPEY5nfsOgqp1iaFzLUnT4oCYQ0r+Mb8Nhqsgnmm01w4ykM5ZDd5BGRISN6byR4YEBqVHjsUl15YEDCtF+6lEmZySc4Z8868FhGbJgjgxH7OqJPTaUTHPK7OSTAMa8QsTEh2rBZPBPZBOuP2wvcqjDJZltaj2LRPYoyJRMstKm0hiANdTzbhG/81MXLMdaR9tT8QBvyT7CqWOFFuHjNMwb0pRQvZ4uPAAbQ7DVw+BKnhjPxP24gjvfPga5YF9AqViusbwmgozZUZ2MphAZR2IEuMsB9K/FcaWNoTcgJHCGz5UkiOh0KLRiIa0TTFISYMLiXiaEujEVYtNpAWGOscE9Pqt+yC4gOOz/HjmyCubBGmMOCiwIuuoBLC6gG4ZoDB+4YMX2YBpstzK51AKeGAvNiO+aN64uh+Rq5aSDZAb5Xu4DkTCGJrKj2FB8Widw0gEOlnUD84eHaQYUQ0iCiaRCHMruByaReVzzgGRKJ8I/z7D2kG0i2Dvd3CL82EYltTWWAZMX8PXbbMcrFfg3xUGIpIFmiv9HUt8dRLNQnAi7iL+suYIkdb7HGqmamto3zbtR6m+SEvbpyiVp2j94uLBTK5HkqbYn7+gpTjjuAncKFsvqATezIS5Uv+/9EL+azJb9TkxsrypdaBD+z/CCNTNyc7UApYoGE6PkO2ZjG9aXcBId6c2UmnDgK2HV8hwW7eCDo0s0FRoSdlRO/kla3PZHYp0xbyaOSomHj4grGjYOEUlEiPpf0Yc6vHkrhCRWds6hjrNbtigX72o3jYaIHG/v75WZhyXBiXncXe4gWsomUNpiYLYvR1hWa6JHV2uLit149MuZRYZ3QYpGIHT9jztN4RR+ETthpHuFwZfo1Efw32urcm/KfkmgeVMYS77BOb1AA8m+AXSwLE49h6r3MqwoxkFh6OPb+V0q7kSqH+5o2dMjI+yrob3KmC/KJwh+/bjF4H2umnXdfTexaxiryWCsi/6btCv+I0atXr16f6Rsd6DUwrgFLOAAAAABJRU5ErkJggg=='
    // 默认缩略图，200 x200，#d3d3d3
    static DEFAULT_THUMBNAIL_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMgAAADICAYAAACtWK6eAAAAAXNSR0IArs4c6QAABSlJREFUeF7t1bERwzAMBEGx//JYkN2A5eDSX+UIsOCNzr338/gIEPgpcATiZRB4FxCI10Hgj4BAPA8CAvEGCDQBf5DmZmpEQCAjh7ZmExBIczM1IiCQkUNbswkIpLmZGhEQyMihrdkEBNLcTI0ICGTk0NZsAgJpbqZGBAQycmhrNgGBNDdTIwICGTm0NZuAQJqbqREBgYwc2ppNQCDNzdSIgEBGDm3NJiCQ5mZqREAgI4e2ZhMQSHMzNSIgkJFDW7MJCKS5mRoREMjIoa3ZBATS3EyNCAhk5NDWbAICaW6mRgQEMnJoazYBgTQ3UyMCAhk5tDWbgECam6kRAYGMHNqaTUAgzc3UiIBARg5tzSYgkOZmakRAICOHtmYTEEhzMzUiIJCRQ1uzCQikuZkaERDIyKGt2QQE0txMjQgIZOTQ1mwCAmlupkYEBDJyaGs2AYE0N1MjAgIZObQ1m4BAmpupEQGBjBzamk1AIM3N1IiAQEYObc0mIJDmZmpEQCAjh7ZmExBIczM1IiCQkUNbswkIpLmZGhEQyMihrdkEBNLcTI0ICGTk0NZsAgJpbqZGBAQycmhrNgGBNDdTIwICGTm0NZuAQJqbqREBgYwc2ppNQCDNzdSIgEBGDm3NJiCQ5mZqREAgI4e2ZhMQSHMzNSIgkJFDW7MJCKS5mRoREMjIoa3ZBATS3EyNCAhk5NDWbAICaW6mRgQEMnJoazYBgTQ3UyMCAhk5tDWbgECam6kRAYGMHNqaTUAgzc3UiIBARg5tzSYgkOZmakRAICOHtmYTEEhzMzUiIJCRQ1uzCQikuZkaERDIyKGt2QQE0txMjQgIZOTQ1mwCAmlupkYEBDJyaGs2AYE0N1MjAgIZObQ1m4BAmpupEQGBjBzamk1AIM3N1IiAQEYObc0mIJDmZmpEQCAjh7ZmExBIczM1IiCQkUNbswkIpLmZGhEQyMihrdkEBNLcTI0ICGTk0NZsAgJpbqZGBAQycmhrNgGBNDdTIwICGTm0NZuAQJqbqREBgYwc2ppNQCDNzdSIgEBGDm3NJiCQ5mZqREAgI4e2ZhMQSHMzNSIgkJFDW7MJCKS5mRoREMjIoa3ZBATS3EyNCAhk5NDWbAICaW6mRgQEMnJoazYBgTQ3UyMCAhk5tDWbgECam6kRAYGMHNqaTUAgzc3UiIBARg5tzSYgkOZmakRAICOHtmYTEEhzMzUiIJCRQ1uzCQikuZkaERDIyKGt2QQE0txMjQgIZOTQ1mwCAmlupkYEBDJyaGs2AYE0N1MjAgIZObQ1m4BAmpupEQGBjBzamk1AIM3N1IiAQEYObc0mIJDmZmpEQCAjh7ZmExBIczM1IiCQkUNbswkIpLmZGhEQyMihrdkEBNLcTI0ICGTk0NZsAgJpbqZGBAQycmhrNgGBNDdTIwICGTm0NZuAQJqbqREBgYwc2ppNQCDNzdSIgEBGDm3NJiCQ5mZqREAgI4e2ZhMQSHMzNSIgkJFDW7MJCKS5mRoREMjIoa3ZBATS3EyNCAhk5NDWbAICaW6mRgQEMnJoazYBgTQ3UyMCAhk5tDWbgECam6kRAYGMHNqaTUAgzc3UiIBARg5tzSYgkOZmakRAICOHtmYTEEhzMzUiIJCRQ1uzCQikuZkaERDIyKGt2QQE0txMjQgIZOTQ1mwCAmlupkYEBDJyaGs2AYE0N1MjAgIZObQ1m4BAmpupEQGBjBzamk1AIM3N1IiAQEYObc0mIJDmZmpEQCAjh7ZmExBIczM1IvAFWDC2pw/rRZEAAAAASUVORK5CYII='

    // ==================== 服务地址 ====================
    //
    // ⚠️ 下面的主机 / 端口 / 协议 / TURN 都是**运行时可覆盖**的：登录页「服务配置」用加密配置串改写它们
    //    （见 src/serviceConfig/ 与 applyServiceConfiguration），各功能地址都写成 getter 由它们派生，
    //    不要改成静态初始化，否则覆盖后派生值仍是旧值。「恢复默认配置」会回到 BUILTIN 里的出厂值。
    //
    // 地址模型（与 wf-enterprise-chat 一致）：**主机通用**，端口按用途分开
    //   MAIN_HOST + IM_PORT   → IM 服务。PC 端连接 IM 的地址来自 token，这里只用于双网媒体地址转换
    //   MAIN_HOST + APP_PORT  → 应用服务 wf-app-server（合并服务）：/api/app（原 app-server）、/api/org（组织通讯录）、
    //                           /api/collection（接龙）、/api/poll（投票）、/api/asr（语音转文字）、/api/pan（网盘）、
    //                           /api/todo（待办）；在线文档页面在 /doc/
    //   BACKUP_HOST + BACKUP_IM_PORT / BACKUP_APP_PORT → 备网上的同一对服务；BACKUP_HOST 为 null 表示不配备网
    // 常见部署（一个 Nginx 后面挂 IM + 应用服务）两个端口相同；开发联调分开跑时只改 APP_PORT。
    // 合并服务的接口都在 /api/ 下，Nginx 只需把 /api/ 和 /doc/ 反代到合并服务。

    // 主机名（IM 与应用服务共用），不能带 scheme 和端口
    static MAIN_HOST = BUILTIN.mainHost;
    // IM 服务端口
    static IM_PORT = BUILTIN.imPort;
    // 应用服务端口，默认与 IM 端口相同
    static APP_PORT = BUILTIN.appPort;
    // 备网策略：0 自动选择 / 1 主网络 / 2 备用网络
    static BACKUP_STRATEGY = BUILTIN.backupStrategy;
    // 备网主机名，null 表示不配备网
    static BACKUP_HOST = BUILTIN.backupHost;
    // 备网 IM 服务端口
    static BACKUP_IM_PORT = BUILTIN.backupImPort;
    // 备网应用服务端口，默认与备网 IM 端口相同
    static BACKUP_APP_PORT = BUILTIN.backupAppPort;
    // IM 长连接是否使用 websocket，需要 2026.9.11 之后的 IM 服务
    static IM_USE_WEBSOCKET = BUILTIN.useWebsocket;
    // 是否使用 TLS（https / wss，以及 IM 长连接加密）。自签名证书放到 build/certs，见 src/selfSignedCert.js
    static IM_USE_TLS = BUILTIN.useTls;

    // 各功能开关：关掉的功能对应地址为 null，客户端不显示入口
    static ENABLE_ORGANIZATION = true;
    static ENABLE_COLLECTION = true;
    static ENABLE_POLL = true;
    // 语音消息转文字
    static ENABLE_ASR = true;
    // 实时语音输入：输入框显示语音输入按钮，边说边把识别结果写入输入框
    static ENABLE_ASR_STREAM = true;
    // 网盘与在线文档
    static ENABLE_PAN = true;
    // 待办。服务端可用 app.feature.todo=false 关掉，客户端探测到后自动隐藏入口（见 src/ui/todo/todoStore.js），这里不用跟着改
    static ENABLE_TODO = true;

    // 服务器搜索服务地址（会话内消息搜索），对应 wf-search-server 项目（https://gitee.com/wfchat/search_server），不在合并服务里
    static SEARCH_SERVER = null;

    // 服务器搜索服务备选地址，双网环境下使用
    static SEARCH_BACKUP_SERVER = null;

    // 实时语音输入是否边说边出字。开启时说话过程中实时显示正在说的这句话，说完后修正为这句的最终结果；关闭时每说完一句才显示这句话
    // 开启后 wf-voice 会在说话过程中反复识别正在说的这句话，服务端 CPU 占用更高。旧版本 wf-voice 不支持，开启后效果和关闭一样
    static ENABLE_ASR_PARTIAL_RESULT = true;

    // 拼 scheme://host[:port]，TLS 下 443、明文下 80 时省略端口
    static _origin(scheme, host, port) {
        let defaultPort = Config.IM_USE_TLS ? 443 : 80;
        return `${scheme}://${host}${port === defaultPort ? '' : ':' + port}`;
    }

    static _httpScheme() {
        return Config.IM_USE_TLS ? 'https' : 'http';
    }

    // IM 服务的 HTTP 基址（媒体地址等）
    static get IM_BASE_ADDRESS() {
        return Config._origin(Config._httpScheme(), Config.MAIN_HOST, Config.IM_PORT);
    }

    // 备网 IM 服务的 HTTP 基址，未配备网时为 null
    static get IM_BACKUP_BASE_ADDRESS() {
        return Config.BACKUP_HOST ? Config._origin(Config._httpScheme(), Config.BACKUP_HOST, Config.BACKUP_IM_PORT) : null;
    }

    // 应用服务（合并服务）的根地址，/api/**、/doc/** 都挂在它下面
    static get APP_SERVICE_ADDRESS() {
        return Config._origin(Config._httpScheme(), Config.MAIN_HOST, Config.APP_PORT);
    }

    // 备网上的应用服务根地址，未配备网时为 null
    static get APP_SERVICE_BACKUP_ADDRESS() {
        return Config.BACKUP_HOST ? Config._origin(Config._httpScheme(), Config.BACKUP_HOST, Config.BACKUP_APP_PORT) : null;
    }

    static _api(category, enabled = true) {
        return enabled ? `${Config.APP_SERVICE_ADDRESS}/api/${category}` : null;
    }

    static _backupApi(category, enabled = true) {
        let backup = Config.APP_SERVICE_BACKUP_ADDRESS;
        return enabled && backup ? `${backup}/api/${category}` : null;
    }

    // 应用服务（原 app-server）的接口前缀：登录、PC 扫码、收藏、群公告、会议、头像等
    static get APP_SERVER() {
        return Config._api('app');
    }

    // 应用服务备选地址，双网环境下使用
    static get APP_BACKUP_SERVER() {
        return Config._backupApi('app');
    }

    // 接龙
    static get COLLECTION_SERVER() {
        return Config._api('collection', Config.ENABLE_COLLECTION);
    }

    static get COLLECTION_BACKUP_SERVER() {
        return Config._backupApi('collection', Config.ENABLE_COLLECTION);
    }

    // 投票
    static get POLL_SERVER() {
        return Config._api('poll', Config.ENABLE_POLL);
    }

    static get POLL_BACKUP_SERVER() {
        return Config._backupApi('poll', Config.ENABLE_POLL);
    }

    // 网盘客户端接口；在线文档 H5 页面不在这个前缀下，在应用服务根地址的 /doc/（见 panApi.docBase）
    static get PAN_SERVER() {
        return Config._api('pan', Config.ENABLE_PAN);
    }

    static get PAN_BACKUP_SERVER() {
        return Config._backupApi('pan', Config.ENABLE_PAN);
    }

    // 待办
    static get TODO_SERVER() {
        return Config._api('todo', Config.ENABLE_TODO);
    }

    static get TODO_BACKUP_SERVER() {
        return Config._backupApi('todo', Config.ENABLE_TODO);
    }

    // 组织通讯录
    static get ORGANIZATION_SERVER() {
        return Config._api('org', Config.ENABLE_ORGANIZATION);
    }

    static get ORGANIZATION_BACKUP_SERVER() {
        return Config._backupApi('org', Config.ENABLE_ORGANIZATION);
    }

    // 语音消息转文字，完整的接口地址
    static get ASR_SERVER() {
        let api = Config._api('asr', Config.ENABLE_ASR);
        return api ? api + '/recognize' : null;
    }

    static get ASR_BACKUP_SERVER() {
        let api = Config._backupApi('asr', Config.ENABLE_ASR);
        return api ? api + '/recognize' : null;
    }

    // 实时语音输入的 WebSocket 地址：连合并服务，由它转发给 wf-voice。
    // 内网测试时也可以直连 wf-voice（默认端口 12436），把这里改成例如 ws://192.168.1.100:12436 即可：
    // 地址路径里没有 /api/ 时不带鉴权头（wf-voice 本身没有鉴权，也不支持 wss，请勿直接暴露到公网）
    static get ASR_STREAM_SERVER() {
        let api = Config._api('asr', Config.ENABLE_ASR_STREAM);
        return api ? Config._wsBase(api) + '/stream' : null;
    }

    static get ASR_STREAM_BACKUP_SERVER() {
        let api = Config._backupApi('asr', Config.ENABLE_ASR_STREAM);
        return api ? Config._wsBase(api) + '/stream' : null;
    }

    static _wsBase(httpBase) {
        return httpBase.replace(/^https:\/\//, 'wss://').replace(/^http:\/\//, 'ws://');
    }

    // 野火二维码 scheme，不要修改，如果需要修改的话，所有端都需要一起修改
    static QR_CODE_PREFIX_PC_SESSION = "wildfirechat://pcsession/";

    // ==================== TURN（音视频通话） ====================
    // 详情参考 https://docs.wildfirechat.net/webrtc/ ；如果使用的是高级版音视频 SDK，不需要配置
    // 下面四项都可以被登录页「服务配置」的配置串覆盖

    // TURN 服务器地址，null = 跟随 MAIN_HOST（配置了备网时同时加上 BACKUP_HOST）
    static TURN_HOST = null;
    static TURN_PORT = 3478;
    static TURN_USER = BUILTIN.turnUser;
    static TURN_PASSWORD = BUILTIN.turnPassword;

    // 格式: [[uri, 用户名, 密码], ...]，主备 turn 地址都放进去，不需要按双网动态选择
    static get ICE_SERVERS() {
        let server = (host) => [`turn:${host}:${Config.TURN_PORT}`, Config.TURN_USER, Config.TURN_PASSWORD];
        if (Config.TURN_HOST) {
            return [server(Config.TURN_HOST)];
        }
        let servers = [server(Config.MAIN_HOST)];
        if (Config.BACKUP_HOST) {
            servers.push(server(Config.BACKUP_HOST));
        }
        return servers;
    }

    // 服务配置串里带的单位名称（登录页显示），没有配置时为空
    static TENANT_NAME = '';

    /**
     * 用登录页「服务配置」解析出的配置覆盖地址 / 协议 / TURN。
     * 渲染进程启动时（任何 Config 读取之前）由本文件末尾调用，配置来自主进程，见 src/serviceConfig/serviceConfigMain.js
     * @param {Object} config 解析结果，结构见 src/serviceConfig/serviceConfigCodec.js
     */
    static applyServiceConfiguration(config) {
        Config.MAIN_HOST = config.im.host;
        Config.IM_PORT = config.im.port;
        Config.APP_PORT = config.im.appPort;
        Config.IM_USE_TLS = config.im.tls;
        Config.IM_USE_WEBSOCKET = config.im.websocket;
        if (config.backup) {
            Config.BACKUP_HOST = config.backup.host;
            Config.BACKUP_IM_PORT = config.backup.port;
            Config.BACKUP_APP_PORT = config.backup.appPort;
            Config.BACKUP_STRATEGY = config.backup.strategy;
        } else {
            Config.BACKUP_HOST = null;
            // 协议栈会持久化之前设置过的备选地址，没有备网时把策略钉成只走主网络
            Config.BACKUP_STRATEGY = 1;
        }
        // 配置串没带 TURN：跟随 IM 地址，用户名密码回到内置默认值，避免沿用上一份配置的
        Config.TURN_HOST = config.turn ? config.turn.host : null;
        Config.TURN_PORT = config.turn ? config.turn.port : 3478;
        Config.TURN_USER = config.turn ? config.turn.user : BUILTIN.turnUser;
        Config.TURN_PASSWORD = config.turn ? config.turn.password : BUILTIN.turnPassword;
        Config.TENANT_NAME = config.tenant || '';
        Config.hasServiceConfiguration = true;
    }

    // 是否应用了登录页「服务配置」里的配置串
    static hasServiceConfiguration = false;

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

    // 是否支持水印。应用服务登录时会下发水印开关（服务端 watermark.enable），下发了就以下发的为准，见 waterMark.isEnabled
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

    static getPanServer() {
        return Config._selectServer(Config.PAN_SERVER, Config.PAN_BACKUP_SERVER);
    }

    // 应用服务（合并服务）当前网络下的根地址
    static getAppServiceAddress() {
        return Config._selectServer(Config.APP_SERVICE_ADDRESS, Config.APP_SERVICE_BACKUP_ADDRESS);
    }

    static getTodoServer() {
        return Config._selectServer(Config.TODO_SERVER, Config.TODO_BACKUP_SERVER);
    }

    // 是否配置了网盘服务：未配置时隐藏网盘与在线文档的全部入口
    static isPanEnabled() {
        return !!Config.getPanServer();
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
            let desc = Object.getOwnPropertyDescriptor(Config, key);
            if (desc && desc.get && !desc.set) {
                console.warn(`Config.${key} 由 MAIN_HOST / APP_PORT 等派生，不能直接设置`);
                return;
            }
            Config[key] = options[key];
        });
    }

    /**
     * 网络地址重定向
     *
     * 双网环境下，媒体文件、生成头像等地址是按发出时所在的网络生成的，换到另一个网络后要换成当前网络可访问的地址：
     * IM 服务与应用服务的主备基址互换。未配置备网时原样返回
     *
     * @param {string} url
     * @return {string} newUrl
     */
    static urlRedirect(url) {
        if (!url || !Config.BACKUP_HOST) {
            return url;
        }
        let backup = Config.isUseBackupAddress();
        let pairs = [
            [Config.IM_BASE_ADDRESS, Config.IM_BACKUP_BASE_ADDRESS],
            [Config.APP_SERVICE_ADDRESS, Config.APP_SERVICE_BACKUP_ADDRESS],
        ];
        for (const [main, other] of pairs) {
            let from = backup ? main : other;
            let to = backup ? other : main;
            if (from && to && from !== to && (url === from || url.startsWith(from + '/'))) {
                return to + url.substring(from.length);
            }
        }
        return url;
    }

    /**
     * 双网环境时，判断是否是备选网络
     * @return {boolean}
     */
    static isUseBackupAddress() {
        return !!Config.BACKUP_HOST && !wfc.connectedToMainNetwork();
    }

    /**
     * 表情 base 路径
     * @return {string}
     */
    static emojiBaseUrl() {
        // 表情的 baseUrl，一定要求以 / 结尾
        let emojiBaseUrl = 'https://static.wildfirechat.net/twemoji/assets/';
        // 实例代码
        // 双网环境时，将表情地址切换到备选网络
        // if (Config.isUseBackupAddress()) {
        //     emojiBaseUrl = 'https://192.168.2.169/twemoji/assets/';
        // }
        return emojiBaseUrl;
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

// 渲染进程启动时应用登录页「服务配置」里保存的配置串（主进程已解析好），必须早于任何 Config 地址读取。
// 每个窗口都会执行到这里，所以改了配置要重启客户端，所有窗口才一致
if (isElectron() && ipcRenderer) {
    try {
        let serviceConfig = ipcRenderer.sendSync(IpcEventType.GET_SERVICE_CONFIG);
        if (serviceConfig) {
            Config.applyServiceConfiguration(serviceConfig);
        }
    } catch (e) {
        console.error('apply service config error', e);
    }
}
