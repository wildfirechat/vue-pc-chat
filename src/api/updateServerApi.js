import axios from "axios";
import Config from "../config";
import wfc from "../wfc/client/wfc";
import ConnectionStatus from "../wfc/client/connectionStatus";
import {ipcRenderer} from "../platform";
import IPCEventType from "../ipcEventType";

/**
 * 自动更新服务
 *
 * 检查更新在主进程执行，这里按双网选好更新地址后交给主进程
 */
export class UpdateServerApi {

    /**
     * 检查更新
     * @param {boolean} manual 是否是用户手动检查，手动检查时，无更新、出错等情况会弹窗提示
     */
    async checkForUpdates(manual) {
        let feedUrl = await this._getUpdateServer();
        ipcRenderer.send(IPCEventType.CHECK_FOR_UPDATES, {manual, feedUrl});
    }

    /**
     * @return {Promise<string|null>} 为 null 时，主进程使用 app-update.yml 里的 publish.url
     * @private
     */
    async _getUpdateServer() {
        if (!Config.UPDATE_BACKUP_SERVER) {
            return Config.getUpdateServer();
        }
        // IM 已连接时，直接用 wfc 的网络状态判断
        let status = wfc.getConnectionStatus();
        if (status === ConnectionStatus.ConnectionStatusConnected || status === ConnectionStatus.ConnectionStatusReceiveing) {
            return Config.getUpdateServer();
        }

        // IM 未连接时（登录前、断线重连中），wfc 的网络状态不可靠，探测可用地址。主备网络是隔离的，一般只有一个地址可达
        // 更新地址是静态文件目录，访问目录本身可能返回 403/404，收到任何 HTTP 响应都说明网络可达
        // 检查更新不频繁，不缓存探测结果
        const probe = async (url) => {
            await axios.head(url, {
                timeout: 5000,
                validateStatus: () => true,
            });
            return url;
        };
        try {
            return await Promise.any([
                probe(Config.UPDATE_SERVER),
                probe(Config.UPDATE_BACKUP_SERVER)
            ]);
        } catch (e) {
            console.log('all update server probes failed', e);
            // 都探测失败时，回退到主地址，让检查更新正常报错
            return Config.UPDATE_SERVER;
        }
    }
}

const updateServerApi = new UpdateServerApi();
export default updateServerApi;
