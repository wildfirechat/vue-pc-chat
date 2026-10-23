import { RobotGatewayClient } from './RobotGatewayClient.js';

/**
 * 野火 Platform 号（ProtoConstants.Platform）：
 * 1=iOS, 2=Android, 3=Windows, 4=OSX, 5=WEB, 6=WX, 7=Linux, 10=Harmony ...
 */

/**
 * 按当前运行环境自动探测机器人平台号。
 * Node 进程跑在哪个 OS 就上报哪个平台；无法识别时兜底 Linux（7，服务器语义）。
 */
export function detectPlatform() {
    const p = typeof process !== 'undefined' && process.platform ? process.platform : '';
    switch (p) {
        case 'darwin': return 4;  // OSX
        case 'win32': return 3;   // Windows
        case 'linux': return 7;   // Linux
        default: return 7;        // 兜底 Linux
    }
}

/**
 * 连接管理器
 * 管理 WebSocket 连接的生命周期和自动重连
 */
export class ConnectionManager {
    constructor(gatewayUrl, messageHandler = null, options = {}) {
        this.gatewayUrl = gatewayUrl;
        this.messageHandler = messageHandler;
        this.options = options;
        
        this.client = null;
        this.running = false;
        this.robotId = null;
        this.robotSecret = null;
        
        // 事件处理器
        this.onConnected = null;
        this.onDisconnected = null;
        this.onAuthenticated = null;
        this.onAuthFailed = null;
        this.onError = null;
    }

    /**
     * 连接并鉴权
     * @param {string} robotId - 机器人ID
     * @param {string} robotSecret - 机器人密钥
     * @param {number} timeoutSeconds - 超时时间（秒）
     * @returns {Promise<boolean>} - 是否成功
     */
    async connect(robotId, robotSecret, timeoutSeconds = 30, platform = null) {
        if (this.running) {
            throw new Error('Already running');
        }

        this.running = true;
        this.robotId = robotId;
        this.robotSecret = robotSecret;
        // 平台号：显式参数优先，其次构造 options.platform，最后按运行环境自动探测
        // （Linux=7 / macOS=4 / Windows=3）。重连时沿用本次连接上报的平台。
        this.platform = platform ?? this.options?.platform ?? detectPlatform();

        try {
            // 创建客户端
            this.client = new RobotGatewayClient(this.gatewayUrl, this.messageHandler, this.options);
            
            // 绑定事件
            this.bindEvents();

            // 连接到网关
            await this.client.connect();

            // 发送鉴权请求
            const authPromise = this.waitForAuth(timeoutSeconds);
            this.client.sendConnect(robotId, robotSecret, this.platform);

            // 等待鉴权结果
            const authResult = await authPromise;
            
            if (authResult) {
                if (this.onAuthenticated) {
                    this.onAuthenticated();
                }
            }

            return authResult;

        } catch (error) {
            console.error('Connection failed:', error.message);
            if (this.onError) {
                this.onError(error.message);
            }
            this.running = false;
            return false;
        }
    }

    /**
     * 断开连接
     */
    disconnect() {
        this.running = false;
        if (this.client) {
            this.client.close();
            this.client = null;
        }
        this.robotId = null;
        this.robotSecret = null;
    }

    /**
     * 重新连接
     */
    async reconnect() {
        if (!this.running || !this.robotId || !this.robotSecret) {
            throw new Error('Cannot reconnect: no credentials');
        }

        console.log('Reconnecting...');
        
        if (this.client) {
            this.client.close();
            this.client = null;
        }

        return this.connect(this.robotId, this.robotSecret, 30, this.platform);
    }

    /**
     * 绑定事件处理器
     */
    bindEvents() {
        this.client.onConnected = () => {
            if (this.onConnected) {
                this.onConnected();
            }
        };

        this.client.onDisconnected = () => {
            if (this.onDisconnected) {
                this.onDisconnected();
            }
        };

        this.client.onAuthenticated = () => {
            console.log('ConnectionManager: Authenticated');
        };

        this.client.onAuthFailed = (code, msg) => {
            console.error('ConnectionManager: Auth failed:', code, msg);
            this.running = false;
            if (this.onAuthFailed) {
                this.onAuthFailed(code, msg);
            }
        };

        this.client.onError = (error) => {
            if (this.onError) {
                this.onError(error);
            }
        };
    }

    /**
     * 等待鉴权结果
     */
    waitForAuth(timeoutSeconds) {
        return new Promise((resolve) => {
            let resolved = false;

            const timer = setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    resolve(false);
                }
            }, timeoutSeconds * 1000);

            const originalOnAuth = this.client.onAuthenticated;
            const originalOnAuthFailed = this.client.onAuthFailed;

            this.client.onAuthenticated = () => {
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timer);
                    if (originalOnAuth) originalOnAuth();
                    resolve(true);
                }
            };

            this.client.onAuthFailed = (code, msg) => {
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timer);
                    if (originalOnAuthFailed) originalOnAuthFailed(code, msg);
                    resolve(false);
                }
            };
        });
    }

    /**
     * 获取底层的 RobotGatewayClient
     */
    getClient() {
        return this.client;
    }

    /**
     * 是否正在运行
     */
    isRunning() {
        return this.running;
    }

    /**
     * 是否已连接
     */
    isConnected() {
        return this.client && this.client.isConnected();
    }

    /**
     * 是否已鉴权
     */
    isAuthenticated() {
        return this.client && this.client.isAuthenticated();
    }
}
