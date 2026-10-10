<template>
    <div class="service-config">
        <!-- ① 粘贴配置串 → 验证 -->
        <template v-if="step === 'input'">
            <p class="title">服务配置</p>
            <textarea v-model="raw" class="raw-input" :class="{error: !!error}" rows="5" autofocus
                      placeholder="请粘贴服务配置串" :disabled="busy"></textarea>
            <p v-if="error" class="error-text">{{ error }}</p>
            <div class="current-row">
                <!-- 只显示单位名，不暴露服务地址（IP / 端口）等信息 -->
                <span>当前：{{ currentName }}</span>
                <a v-if="hasSaved" class="danger" @click="step = 'restore'">恢复默认配置</a>
            </div>
            <div class="actions">
                <button :disabled="busy" @click="close">取消</button>
                <button class="primary" :disabled="busy" @click="verify">{{ busy ? '验证中…' : '验证' }}</button>
            </div>
        </template>

        <!-- ② 安全提示 + 免责声明：必须确认来源可信才能继续 -->
        <template v-else-if="step === 'trust'">
            <p class="title"><i class="icon-ion-alert-circled danger"></i>安全提示</p>
            <p class="text">配置串包含服务地址，请仅使用单位正式渠道提供的配置串——来源不明的配置串可能把您的消息与音视频流量导向他人服务器</p>
            <p class="text hint">免责声明：数据都保存在配置串所指定服务，由配发单位保管且可查可改，使用者需知悉并自行承担所有风险。</p>
            <label class="trust-check">
                <input type="checkbox" v-model="trusted">我已确认该配置串来源可信
            </label>
            <div class="actions">
                <button @click="close">取消</button>
                <button class="primary" :disabled="!trusted" @click="step = 'confirm'">继续</button>
            </div>
        </template>

        <!-- ③ 确认应用：只显示服务供应商（单位名），不显示服务地址 -->
        <template v-else-if="step === 'confirm'">
            <p class="title">是否应用该配置？</p>
            <p v-if="!reachable" class="text danger">服务地址暂时不可达（可继续应用）</p>
            <p class="text">服务供应商：{{ verifiedTenant || appName }}</p>
            <div class="actions">
                <button :disabled="busy" @click="close">取消</button>
                <button class="primary" :disabled="busy" @click="apply">应用</button>
            </div>
        </template>

        <!-- 恢复默认配置的二次确认 -->
        <template v-else-if="step === 'restore'">
            <p class="title">恢复默认配置</p>
            <p class="text">将清除已应用的服务配置，恢复出厂默认的服务地址、备用地址与 TURN 凭据。是否继续？</p>
            <div class="actions">
                <button :disabled="busy" @click="step = 'input'">取消</button>
                <button class="danger-button" :disabled="busy" @click="restore">恢复默认配置</button>
            </div>
        </template>

        <!-- ④ 强制重启：不可取消，配置只在启动时应用，不重启各窗口不一致 -->
        <template v-else-if="step === 'restart'">
            <p class="title">需要重启客户端</p>
            <p class="text">{{ restored ? '已恢复默认配置，' : '服务配置已更新，' }}需重启客户端后生效。</p>
            <div class="actions">
                <button class="primary" @click="restart">立即重启</button>
            </div>
        </template>
    </div>
</template>

<script>
import Config from "../config";
import wfc from "../wfc/client/wfc";
import IpcEventType from "../ipcEventType";
import {ipcRenderer} from "../platform";
import {clear} from "../ui/util/storageHelper";

// 校验失败原因 → 文案（原因定义见 serviceConfigCodec.js）
const ERROR_TEXT = {
    malformed: '配置串格式不正确',
    incomplete: '配置串不完整',
    decryptFailed: '配置串无效或已被修改',
    versionUnsupported: '配置串版本过高，请升级客户端',
    expired: '配置串已过期，请向供应商索取新配置',
    invalidField: '配置内容不合法',
};

export default {
    name: "ServiceConfigDialog",
    data() {
        return {
            step: 'input',
            raw: '',
            error: '',
            busy: false,
            trusted: false,
            reachable: true,
            verifiedTenant: '',
            restored: false,
            appName: '野火IM',
            // 恢复默认配置只在确实应用过配置串时才有意义
            hasSaved: Config.hasServiceConfiguration,
        };
    },
    computed: {
        currentName() {
            return Config.TENANT_NAME || this.appName;
        },
    },
    methods: {
        close() {
            this.$modal.hide('service-config-modal');
        },

        async verify() {
            let raw = this.raw.trim();
            if (!raw) {
                this.error = '请先粘贴服务配置串';
                return;
            }
            this.busy = true;
            this.error = '';
            try {
                let result = await ipcRenderer.invoke(IpcEventType.SERVICE_CONFIG_VERIFY, raw);
                if (!result.ok) {
                    let text = ERROR_TEXT[result.error] || ERROR_TEXT.malformed;
                    this.error = result.error === 'invalidField' ? `${text}：${result.detail}` : text;
                    return;
                }
                this.verifiedTenant = result.tenant;
                this.reachable = result.reachable;
                this.trusted = false;
                this.step = 'trust';
            } catch (e) {
                console.error('verify service config error', e);
                this.error = ERROR_TEXT.malformed;
            } finally {
                this.busy = false;
            }
        },

        async apply() {
            this.busy = true;
            try {
                let result = await ipcRenderer.invoke(IpcEventType.SERVICE_CONFIG_APPLY, this.raw.trim());
                if (!result.ok) {
                    this.error = ERROR_TEXT[result.error] || ERROR_TEXT.malformed;
                    this.step = 'input';
                    return;
                }
                this._resetLoginState();
                this.restored = false;
                this.step = 'restart';
            } finally {
                this.busy = false;
            }
        },

        async restore() {
            this.busy = true;
            try {
                let result = await ipcRenderer.invoke(IpcEventType.SERVICE_CONFIG_RESTORE);
                if (!result.ok) {
                    this.$notify({text: '恢复默认配置失败：' + result.detail, type: 'error'});
                    return;
                }
                this._resetLoginState();
                this.restored = true;
                this.step = 'restart';
            } finally {
                this.busy = false;
            }
        },

        // 换了服务地址，之前的登录状态（IM token、应用服务 authToken、记住的账号）都不能再用
        _resetLoginState() {
            wfc.disconnect();
            clear();
        },

        restart() {
            ipcRenderer.send(IpcEventType.RESTART_APP);
        },
    },
}
</script>

<style scoped>
.service-config {
    padding: 18px 20px 14px;
    background: var(--background-tertiary);
    color: var(--text-primary);
    display: flex;
    flex-direction: column;
}

.title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: var(--font-size-lg, 16px);
    font-weight: 500;
    padding-bottom: 14px;
}

.raw-input {
    width: 100%;
    box-sizing: border-box;
    resize: none;
    padding: 8px 10px;
    font-size: var(--font-size-sm, 13px);
    font-family: monospace;
    word-break: break-all;
    color: var(--text-primary);
    background: var(--background-primary);
    border: 1px solid var(--border-primary);
    border-radius: 4px;
    outline: none;
}

.raw-input:focus {
    border-color: var(--accent-color);
}

.raw-input.error {
    border-color: var(--text-danger);
}

.error-text {
    padding-top: 6px;
    font-size: var(--font-size-xs, 12px);
    color: var(--text-danger);
}

.current-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 8px;
    font-size: var(--font-size-xs, 12px);
    color: var(--text-tertiary);
}

.current-row a {
    cursor: pointer;
}

.text {
    font-size: var(--font-size-sm, 13px);
    line-height: 1.6;
    padding-bottom: 8px;
}

.text.hint {
    font-size: var(--font-size-xs, 12px);
    color: var(--text-tertiary);
}

.danger {
    color: var(--text-danger);
}

.trust-check {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: var(--font-size-sm, 13px);
    cursor: pointer;
    padding: 4px 0;
}

.actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    padding-top: 16px;
}

.actions button {
    min-width: 72px;
    height: 30px;
    padding: 0 14px;
    border-radius: 4px;
    border: 1px solid var(--border-primary);
    background: var(--background-primary);
    color: var(--text-primary);
    cursor: pointer;
}

.actions button.primary {
    border: none;
    background: var(--accent-color);
    color: white;
}

.actions button.danger-button {
    border: none;
    background: var(--text-danger);
    color: white;
}

.actions button:disabled {
    opacity: 0.5;
    cursor: default;
}
</style>
