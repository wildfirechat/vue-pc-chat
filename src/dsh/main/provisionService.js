import axios from 'axios';
import DshProvisionStore from './provisionStore';

/**
 * 调应用服务 /robot/provision，并把完整凭据缓存到主进程。
 */
export default class DshProvisionService {
    constructor({ userDataPath, httpsAgent }) {
        this.store = new DshProvisionStore(userDataPath);
        this.httpsAgent = httpsAgent;
    }

    getCached(userId) {
        const record = this.store.get(userId);
        if (!record) return null;
        return {
            publicView: DshProvisionStore.publicView(record.provision, true),
            full: record.provision,
        };
    }

    async provision({ userId, appServerUrl, authToken, clientId, platform, forceRefresh }) {
        if (!userId) throw new Error('missing userId');
        if (!appServerUrl) throw new Error('missing appServerUrl');

        // 有缓存时优先复用（离线/应用服务不可用时也能启动 Host）。
        if (!forceRefresh) {
            const cached = this.getCached(userId);
            if (cached) return cached;
        }
        if (!authToken) throw new Error('missing authToken');

        const base = String(appServerUrl).replace(/\/+$/, '');
        const url = `${base}/robot/provision`;
        const body = {
            clientId: clientId || '',
            platform: platform || 4,
            forceRefresh: !!forceRefresh,
        };
        let response;
        try {
            response = await axios.post(url, body, {
                timeout: 20000,
                headers: {
                    'Content-Type': 'application/json',
                    authToken,
                },
                httpsAgent: this.httpsAgent,
                proxy: false,
            });
        } catch (e) {
            const message = e && e.response && e.response.data && e.response.data.message
                ? e.response.data.message
                : (e && e.message ? e.message : 'provision request failed');
            throw new Error(`机器人开通失败：${message}`);
        }

        const data = response && response.data;
        if (!data || data.code !== 0 || !data.result) {
            throw new Error(`机器人开通失败：${(data && data.message) || 'invalid response'}`);
        }
        const provision = data.result;
        if (!provision.robot || !provision.robot.robotId || !provision.robot.robotSecret) {
            throw new Error('机器人开通失败：返回缺少 robotId/robotSecret');
        }
        this.store.put(userId, provision, base);
        return {
            publicView: DshProvisionStore.publicView(provision, false),
            full: provision,
        };
    }

    clear(userId) {
        this.store.clear(userId);
    }
}
