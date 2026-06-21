<template>
    <div class="setting-container">
        <div class="content">
            <h2>{{ $t('setting.setting') }}</h2>
            <label>
                {{ $t('setting.enable_notification') }}
                <input type="checkbox"
                       :checked="sharedMiscState.enableNotification"
                       role="switch"
                       @change="enableNotification($event.target.checked)">
            </label>
            <label>
                {{ $t('setting.enable_notification_detail') }}
                <input v-bind:disabled="!sharedMiscState.enableNotification"
                       type="checkbox"
                       role="switch"
                       :checked="sharedMiscState.enableNotificationMessageDetail"
                       @change="enableNotificationDetail($event.target.checked)">
            </label>
            <label v-if="sharedMiscState.isElectron">
                {{ $t('setting.close_window_to_exit') }}
                <input type="checkbox" role="switch" :checked="sharedMiscState.enableCloseWindowToExit"
                       @change="enableCloseWindowToExit($event.target.checked)">
            </label>
            <label v-if="sharedMiscState.isElectron">
                {{ $t('setting.enable_minimize') }}
                <input type="checkbox" role="switch" :checked="sharedMiscState.enableMinimize"
                       @change="enableMinimize($event.target.checked)">
            </label>
            <label
                v-if="sharedMiscState.isElectron || (sharedMiscState.config.CLIENT_ID_STRATEGY === 1 || sharedMiscState.config.CLIENT_ID_STRATEGY === 2)">
                {{ $t('setting.auto_login') }}
                <input type="checkbox" role="switch" :checked="sharedMiscState.enableAutoLogin"
                       @change="enableAutoLogin($event.target.checked)">
            </label>
            <label v-if="sharedMiscState.isCommercialServer">
                {{ $t('setting.sync_draft') }}
                <input type="checkbox" role="switch" :checked="!sharedMiscState.isDisableSyncDraft"
                       @change="enableDraftSync($event.target.checked)">
            </label>
            <label>
                {{ $t('setting.show_send_button') }}
                <input type="checkbox" role="switch" :checked="sharedMiscState.showSendButton"
                       @change="setShowSendButton($event.target.checked)">
            </label>
            <div class="dropdown-toggle-container">
                {{ $t('setting.lang') }}
                <dropdown
                    :options="langs"
                    :selected="currentLang"
                    v-on:updateOption="setLang"
                    :placeholder="'Select an Item'"
                    :closeOnOutsideClick="true">
                </dropdown>
            </div>
            <div class="dropdown-toggle-container">
                {{ $t('setting.theme') || '外观' }}
                <dropdown
                    :options="themes"
                    :selected="currentTheme"
                    v-on:updateOption="setTheme"
                    :placeholder="'Select Theme'"
                    :closeOnOutsideClick="true">
                </dropdown>
            </div>
            <div class="font-size-section">
                <p class="font-size-title">{{ $t('setting.font_size') }}</p>
                <div class="font-size-slider">
                    <div class="slider-track-wrapper">
                        <div class="slider-rail" :style="sliderFillStyle"></div>
                        <div class="slider-ticks">
                            <span v-for="(step, index) in fontScaleSteps"
                                  :key="index"
                                  class="slider-tick"></span>
                        </div>
                        <input type="range"
                               min="0"
                               :max="fontScaleSteps.length - 1"
                               step="1"
                               :value="fontScaleIndex"
                               @input="onFontScaleInput($event.target.value)"/>
                    </div>
                    <div class="font-size-labels">
                        <span class="font-size-label start">{{ $t('setting.font_size_small') }}</span>
                        <span class="font-size-label standard"
                              :style="{ left: standardLabelLeft }">{{ $t('setting.font_size_standard') }}</span>
                        <span class="font-size-label end">{{ $t('setting.font_size_large') }}</span>
                    </div>
                </div>
            </div>
        </div>
        <div class="ad-container">
            <p>
                <a target="_blank" href="https://wildfirechat.cn/">野火IM</a>
                ，安全可靠、运维部署简单、方便二开和对接现有系统。
            </p>
            <p>私有化部署，请微信联系：wildfirechat 或 wfchat </p>
        </div>
        <footer>
            <p class="proto-version-info single-line">{{ protoRevision() }}</p>
            <a
                class="button"
                href="https://github.com/wildfirechat/vue-pc-chat/issues"
                target="_blank">
                问题反馈
            </a>
            <a v-if="sharedMiscState.isElectron && !sharedMiscState.isOhos" class="button" target="_blank" @click.prevent.stop="openLogDir">
                打开日志目录
            </a>
            <a v-if="sharedMiscState.isElectron && updaterConfigured && !sharedMiscState.isOhos" class="button" target="_blank" @click.prevent.stop="checkForUpdates">
                检查更新
            </a>
            <a class="button" target="_blank" @click.prevent.stop="showChangePasswordContextMenu">
                修改密码
            </a>
            <vue-context ref="changePasswordContextMenu" :close-on-scroll="false" v-on:close="onChangePasswordContextMenuClose">
                <li>
                    <a @click.prevent="showChangePasswordDialog()">密码验证</a>
                </li>
                <li>
                    <a @click.prevent="showResetPasswordDialog()">短信验证码验证</a>
                </li>
            </vue-context>
            <a class="button" target="_blank" @click.prevent="showBackupRestoreDialog">
                备份与恢复
            </a>
            <a class="button" target="_blank" @click="logout">
                {{ $t('setting.exit_switch_user') }}
            </a>

            <a
                class="button"
                href="https://github.com/wildfirechat/vue-pc-chat"
                target="_blank">
                Star on Github
                <i class="icon-ion-social-github"/>
            </a>

            <a
                class="button"
                href="https://wildfirechat.cn"
                target="_blank">
                关于野火
                <i class="icon-ion-home"/>
            </a>

            <a
                v-if="!sharedMiscState.isElectron"
                class="button"
                href="javascript:"
                @click="openPcChat"
            >
                打开野火PC端
                <i class="icon-ion-android-desktop"/>
            </a>
        </footer>
    </div>
</template>

<script>
import wfc from '../../../wfc/client/wfc';
import store from '../../../store';
import dropdown from 'vue-dropdowns';
import { clear } from '../../util/storageHelper';
import { ipcRenderer, isElectron } from '../../../platform';
import { getItem, setItem } from '../../util/storageHelper';
import ChangePasswordView from './ChangePasswordView';
import ResetPasswordView from './ResetPasswordView';
import BackupRestoreView from '../../../backup/BackupRestoreView.vue';
import { shell } from '../../../platform';
import IpcEventType from '../../../ipcEventType';
import avenginekit from '../../../wfc/av/internal/engine.min';

export default {
    name: 'SettingPage',
    data() {
        return {
            sharedMiscState: store.state.misc,
            sharedContactState: store.state.contact,
            openPcChatTimeoutHandler: 0,
            updaterConfigured: false,
            langs: [{ lang: 'zh-CN', name: '简体中文' }, { lang: 'zh-TW', name: '繁體中文' }, { lang: 'en', name: 'English' }],
            themes: [{ id: 'system', name: '跟随系统' }, { id: 'light', name: '浅色' }, { id: 'dark', name: '暗黑' }],
            // 字体缩放档位，1 为标准（参考微信PC端）
            fontScaleSteps: [0.85, 1, 1.15, 1.3, 1.45],
        }
    },
    methods: {

        newIssue() {

        },
        openLogDir() {
            let appPath = wfc.getAppPath();
            shell.openPath(appPath);
        },
        checkForUpdates() {
            if (isElectron()) {
                ipcRenderer.send(IpcEventType.CHECK_FOR_UPDATES);
            }
        },
        showChangePasswordContextMenu(event) {
            this.$refs.changePasswordContextMenu.open(event);
        },

        onChangePasswordContextMenuClose() {
        },

        showChangePasswordDialog() {
            let beforeOpen = () => {
                console.log('Opening...')
            };
            let beforeClose = (event) => {
                console.log('Closing...', event, event.params)
            };
            let closed = (event) => {
                console.log('Close...', event)
            };
            this.$modal.show(
                ChangePasswordView,
                {},
                null,
                {
                    name: 'change-password-modal',
                    width: 320,
                    height: 400,
                    clickToClose: true,
                },
                {
                    'before-open': beforeOpen,
                    'before-close': beforeClose,
                    'closed': closed,
                })
        },

        showResetPasswordDialog() {
            let beforeOpen = () => {
                console.log('Opening...')
            };
            let beforeClose = (event) => {
                console.log('Closing...', event, event.params)
            };
            let closed = (event) => {
                console.log('Close...', event)
            };
            this.$modal.show(
                ResetPasswordView,
                {}, null, {
                    name: 'rest-password-modal',
                    width: 320,
                    height: 400,
                    clickToClose: true,
                }, {
                    'before-open': beforeOpen,
                    'before-close': beforeClose,
                    'closed': closed,
                })
        },

        showBackupRestoreDialog() {
            this.$modal.show(
                BackupRestoreView,
                {}, null, {
                    name: 'backup-restore-modal',
                    width: 560,
                    height: 380,
                    clickToClose: true,
                }, {
                    'closed': () => {
                        console.log('Backup restore dialog closed');
                    }
                })
        },

        logout() {
            clear();
            wfc.disconnect();
            if (isElectron()) {
                ipcRenderer.send(IpcEventType.LOGOUT);
            }
        },

        enableNotification(enable) {
            store.setEnableNotification(enable)
        },
        enableMinimize(enable) {
            store.setEnableMinimize(enable)
        },
        enableNotificationDetail(enable) {
            store.setEnableNotificationDetail(enable)
        },
        enableCloseWindowToExit(enable) {
            store.setEnableCloseWindowToExit(enable)
        },

        enableAutoLogin(enable) {
            store.setEnableAutoLogin(enable);
        },
        enableDraftSync(enable) {
            wfc.setDisableSyncDraft(!enable)
        },

        setShowSendButton(enable) {
            store.setShowSendButton(enable);
        },

        setLang(lang) {
            setItem('lang', lang.lang)
            // this.$router.go();
        },

        setTheme(theme) {
            store.setTheme(theme.id);
        },

        onFontScaleInput(index) {
            let scale = this.fontScaleSteps[parseInt(index)] || 1;
            store.setFontScale(scale);
        },

        openPcChat() {
            // pc 端，deeplink 的 scheme 是 wfc://
            // 打开和 小火的会话
            let url = 'wfc://conversation?target=FireRobot&line=0&type=0';
            // 未安装 pc  版时，跳转到 pc 版的下载链接
            let fallback = 'https://github.com/wildfirechat/vue-pc-chat';
            window.location = url;
            this.openPcChatTimeoutHandler = setTimeout(() => {
                window.open(fallback, '_blank');
            }, 1000)
        },

        blurListener() {
            if (this.openPcChatTimeoutHandler) {
                clearTimeout(this.openPcChatTimeoutHandler);
                this.openPcChatTimeoutHandler = 0;
            }
        },

        protoRevision() {
            let version = '';
            try {
                version = wfc.getProtoRevision();
            } catch (e) {
                version = 'unknown proto version'
                console.log(e)
            }
            let supportConference = avenginekit.startConference !== undefined
            return version + (supportConference ? ' av-conference' : ' av-multi');
        }

    },

    async mounted() {
        window.addEventListener('blur', this.blurListener)
        if (isElectron()) {
            this.updaterConfigured = await ipcRenderer.invoke('is-updater-configured');
        }
    },
    beforeUnmount() {
        window.removeEventListener('blur', this.blurListener)
    },
    computed: {
        currentLang() {
            let lang = getItem('lang')
            lang = lang ? lang : 'zh-CN';
            let index = this.langs.findIndex(l => l.lang === lang);
            index = index >= 0 ? index : 0;
            return this.langs[index];
        },
        currentTheme() {
            let themeId = this.sharedMiscState.theme || 'light';
            return this.themes.find(t => t.id === themeId) || this.themes[0];
        },
        fontScaleIndex() {
            let scale = this.sharedMiscState.fontScale || 1;
            // 取最接近当前缩放值的档位
            let index = this.fontScaleSteps.indexOf(scale);
            if (index >= 0) {
                return index;
            }
            let closest = 0;
            let minDiff = Infinity;
            this.fontScaleSteps.forEach((step, i) => {
                let diff = Math.abs(step - scale);
                if (diff < minDiff) {
                    minDiff = diff;
                    closest = i;
                }
            });
            return closest;
        },
        // “标准”档位（缩放为 1）所在的下标，用于定位刻度标签
        fontStandardIndex() {
            let index = this.fontScaleSteps.indexOf(1);
            return index >= 0 ? index : 0;
        },
        // “标准”标签水平位置（与对应刻度对齐）
        standardLabelLeft() {
            let max = this.fontScaleSteps.length - 1;
            let pct = max > 0 ? (this.fontStandardIndex / max) * 100 : 0;
            return pct + '%';
        },
        // 已选档位之前的轨道填充主题色，之后为浅色（iOS/鸿蒙风格）
        sliderFillStyle() {
            let max = this.fontScaleSteps.length - 1;
            let pct = max > 0 ? (this.fontScaleIndex / max) * 100 : 0;
            return {
                background: `linear-gradient(to right,` +
                    ` var(--accent-color) 0%, var(--accent-color) ${pct}%,` +
                    ` var(--border-primary) ${pct}%, var(--border-primary) 100%)`,
            };
        },
        selfPortrait() {
            let self = this.sharedContactState.selfUserInfo;
            return (self && self.portrait) || '';
        },
        selfDisplayName() {
            let self = this.sharedContactState.selfUserInfo;
            return (self && (self._displayName || self.displayName)) || '';
        },
    },
    components: {
        'dropdown':
        dropdown,
    },
}
</script>

<style lang="css" scoped>
.setting-container {
    height: 100%;
    max-width: calc(100% - 60px);
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    overflow-y: auto;
}

.setting-container .content {
    flex: 1;
    margin: 8px 20px 0;
}

.setting-container .content h2 {
    font-weight: normal;
    font-style: normal;
    padding-bottom: 8px;
}

.setting-container .content label {
    padding: 8px 0;
    display: flex;
    justify-content: space-between;
    width: 100%;
    font-size: var(--font-size-base);
}

.setting-container .content label input {
    margin: 0;
    flex-shrink: 0;
}

.setting-container .dropdown-toggle-container {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    font-size: var(--font-size-base);
}

.font-size-section {
    padding: 12px 0 4px;
}

.font-size-title {
    font-size: var(--font-size-base);
    color: var(--text-primary);
    padding-bottom: 12px;
}

.font-size-slider {
    padding: 0 0 16px 0;
}

.slider-track-wrapper {
    position: relative;
    height: 24px;
}

/* 轨道（填充进度由 sliderFillStyle 内联设置） */
.slider-rail {
    position: absolute;
    left: 0;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    height: 6px;
    border-radius: 3px;
}

/* 档位刻度：位于轨道之上、滑块之下 */
.slider-ticks {
    position: absolute;
    left: 0;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    align-items: center;
    justify-content: space-between;
    pointer-events: none;
    z-index: 1;
}

.slider-ticks .slider-tick {
    width: 2px;
    height: 6px;
    border-radius: 1px;
    background: rgba(255, 255, 255, 0.65);
}

/* 原生 range 轨道透明，仅保留滑块；滑块层级最高，覆盖刻度 */
.slider-track-wrapper input[type="range"] {
    position: relative;
    z-index: 2;
    width: 100%;
    height: 24px;
    margin: 0;
    -webkit-appearance: none;
    appearance: none;
    background: transparent;
    outline: none;
    cursor: pointer;
    padding: 0 !important;
    border: none !important;
}

.slider-track-wrapper input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: #ffffff;
    border: 0.5px solid rgba(0, 0, 0, 0.04);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
    cursor: pointer;
}

/* 刻度标签：小 / 标准 / 大，与对应刻度对齐 */
.font-size-labels {
    position: relative;
    height: 18px;
    margin-top: 6px;
}

.font-size-labels .font-size-label {
    position: absolute;
    top: 0;
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
    white-space: nowrap;
}

.font-size-labels .font-size-label.start {
    left: 0;
}

.font-size-labels .font-size-label.standard {
    transform: translateX(-50%);
}

.font-size-labels .font-size-label.end {
    right: 0;
}

.setting-container .ad-container {
    padding: 10px 20px;
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    background: var(--background-secondary);
    border-top: 1px solid var(--border-separator);
}

.ad-container p {
    padding: 2px 0;
    line-height: 1.6;
}

.setting-container footer {
    width: 100%;
    height: 52px;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    border-top: 1px solid var(--border-primary);
}

.proto-version-info {
    margin-right: auto;
    padding-left: 12px;
    font-size: var(--font-size-xs);
    color: var(--text-hint);
    max-width: 300px;
}

.setting-container .button {
    margin-right: 4px;
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
    padding: 6px 10px;
    border: 0;
    border-radius: var(--radius-sm);
    background: transparent;
    outline: 0;
    cursor: pointer;
    text-decoration: none;
    transition: background-color var(--duration-fast), color var(--duration-fast);
    white-space: nowrap;
}

.setting-container .button:hover {
    background: var(--background-item-hover);
    color: var(--text-primary);
}

</style>
