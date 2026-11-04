import DshProvisionStore from './provisionStore';

/**
 * 机器人 provision 缓存。真正的创建/复用逻辑在 AI Agent 服务：
 * 客户端用 AI session 调 {aiAgent.serverUrl}/robot/provision，成功后将
 * robot + AI 配置缓存到主进程。
 */
export default class DshProvisionService {
    constructor({ userDataPath }) {
        this.store = new DshProvisionStore(userDataPath);
    }

    getCached(userId) {
        const record = this.store.get(userId);
        if (!record) return null;
        const publicView = DshProvisionStore.publicView(record.provision, true);
        if (publicView) publicView.updatedAt = record.updatedAt || publicView.updatedAt || 0;
        return {
            publicView,
            full: record.provision,
        };
    }

    async provision({ userId, aiAgentService, serverUrl, authCode, clientId, platform, forceRefresh }) {
        if (!userId) throw new Error('missing userId');
        const cached = this.getCached(userId);
        if (cached && !forceRefresh) return cached;
        if (!aiAgentService) throw new Error('AI Agent 服务未初始化');
        let provision;
        try {
            provision = await aiAgentService.provision({
                userId,
                serverUrl,
                authCode,
                forceRefresh: !!forceRefresh,
            });
        } catch (e) {
            if (cached) return cached;
            throw e;
        }
        this.store.put(userId, provision, (provision.aiAgent && provision.aiAgent.serverUrl) || '');
        return {
            publicView: DshProvisionStore.publicView(provision, false),
            full: provision,
        };
    }

    renameRobot(userId, displayName) {
        const record = this.store.get(userId);
        if (!record || !record.provision || !record.provision.robot) return null;
        record.provision.robot.displayName = displayName;
        this.store.put(userId, record.provision, record.appServerUrl || '');
        return {
            publicView: DshProvisionStore.publicView(record.provision, true),
            full: record.provision,
        };
    }

    clear(userId) {
        this.store.clear(userId);
    }
}
