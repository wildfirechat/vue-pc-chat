<template>
    <DialogFrame :title="$t('poll.poll_detail')" :subtitle="selectionHint" :primary="primaryAction"
                 :secondary="canVote ? {label: $t('common.cancel')} : null"
                 @primary="onPrimary" @secondary="close">
        <template v-if="poll && isManagerMode" #footer-leading>
            <span class="poll-footer-link" @click="forwardPoll"><i class="icon-ion-android-share-alt"></i>{{ $t('poll.forward') }}</span>
            <span v-if="!isAnonymous" class="poll-footer-link" @click="exportDetails"><i class="icon-ion-android-download"></i>{{ $t('poll.export_details') }}</span>
        </template>

        <div v-if="!poll" class="df-center">
            <span v-if="loading" class="df-spinner"></span>
            <span v-else>{{ error || $t('poll.poll_load_failed') }}</span>
        </div>
        <div v-else class="df-form">
            <div class="poll-header">
                <p class="poll-title">{{ poll.title }}</p>
                <p v-if="desc" class="poll-desc">{{ desc }}</p>
                <div class="poll-creator">
                    <img :src="portrait(poll.creatorId)" alt="">
                    <span class="poll-creator-name">{{ $t('poll.creator_format', {name: userName(poll.creatorId)}) }}</span>
                    <span class="df-chip" :class="statusChip.cls">{{ statusChip.text }}</span>
                </div>
            </div>

            <div class="df-card poll-options">
                <div v-for="option in poll.options" :key="option.id" class="poll-option"
                     :class="{clickable: canVote, highlight: canVote && isSelected(option.id)}"
                     @click="toggleOption(option.id)">
                    <div class="poll-option-line">
                        <span v-if="canVote" class="poll-check" :class="{checked: isSelected(option.id), multi: poll.type === 2}">
                            <i v-if="isSelected(option.id)" class="icon-ion-checkmark-round"></i>
                        </span>
                        <i v-else-if="isMyVote(option.id)" class="icon-ion-android-checkmark-circle poll-my-vote"></i>
                        <span class="poll-option-text" :class="{accent: isMyVote(option.id) || isSelected(option.id), mine: isMyVote(option.id)}">
                            {{ option.optionText }}
                        </span>
                        <span v-if="shouldShowResult" class="poll-option-count" :class="{accent: isMyVote(option.id)}">
                            {{ $t('poll.vote_count', {count: option.voteCount || 0}) }} · {{ option.votePercent || 0 }}%
                        </span>
                    </div>
                    <!-- 票数条：自己投的那项走主色，其余灰阶 —— 结果靠长度读，不靠颜色 -->
                    <div v-if="shouldShowResult" class="poll-bar">
                        <div :class="{mine: isMyVote(option.id)}" :style="{width: Math.min(option.votePercent || 0, 100) + '%'}"></div>
                    </div>
                </div>
            </div>

            <p class="poll-meta">{{ metaText }}</p>
        </div>
    </DialogFrame>
</template>

<script>
import pollApi from "../../api/pollApi";
import wfc from "../../wfc/client/wfc";
import store from "../../store";
import Config from "../../config";
import DialogFrame from "../common/DialogFrame.vue";
import {getSubWindowQuery} from '../util/subWindowNavigator';
import {closeFeatureDialog} from "../util/featureDialog";
import {pollRemainingText} from "./pollUtil";
import '../common/dialogForm.css';

/**
 * 投票详情（对齐 wf-enterprise-chat 的 PollDetailScreen），两种模式：
 * - 投票模式：从消息进入，可勾选并提交；已投票 / 已结束只读，显示票数条；
 * - 管理模式：创建者从「我的投票」进入，不投票，只转发 / 导出 / 结束 / 删除。
 */
export default {
    name: "PollDetail",
    props: {
        subWindowQuery: {
            type: Object,
            required: false,
            default: null,
        }
    },
    emits: ['close'],
    data() {
        let query = getSubWindowQuery(this);
        return {
            loading: false,
            error: null,
            groupId: query.groupId || '',
            pollId: parseInt(query.pollId),
            fromMessage: query.fromMessage === '1',
            messageId: Number(query.messageId) || 0,
            poll: null,
            selectedOptions: [],
            busy: false,
        };
    },
    mounted() {
        this.fetchPoll();
    },
    computed: {
        desc() {
            return this.poll.description || this.poll.desc || '';
        },
        isEnded() {
            if (!this.poll) {
                return false;
            }
            return this.poll.status === 1 || (this.poll.endTime > 0 && this.poll.endTime < Date.now());
        },
        isAnonymous() {
            return this.poll && this.poll.anonymous === 1;
        },
        // 管理模式：创建者从列表进入
        isManagerMode() {
            return !!this.poll && this.poll.isCreator && !this.fromMessage;
        },
        canVote() {
            return !!this.poll && !this.isManagerMode && !this.poll.hasVoted && !this.isEnded;
        },
        shouldShowResult() {
            if (!this.poll) {
                return false;
            }
            return this.isEnded || this.poll.hasVoted || this.poll.showResult === 1 || this.isManagerMode;
        },
        // 多选投票时在标题旁提示已选几项
        selectionHint() {
            if (this.canVote && this.poll.type === 2 && this.selectedOptions.length) {
                return this.$t('poll.selected_count', {count: this.selectedOptions.length, max: this.poll.maxSelect || this.poll.options.length});
            }
            return '';
        },
        statusChip() {
            if (this.isEnded) {
                return {text: this.$t('poll.poll_ended'), cls: 'ended'};
            }
            if (this.poll.hasVoted) {
                return {text: this.$t('poll.already_voted'), cls: 'success'};
            }
            return {text: this.$t('poll.poll_in_progress'), cls: ''};
        },
        // 主操作：管理模式「结束 / 删除」，投票模式「提交投票」，只读时没有
        primaryAction() {
            if (!this.poll) {
                return null;
            }
            if (this.isManagerMode) {
                return this.isEnded
                    ? {label: this.$t('poll.delete_poll'), danger: true, busy: this.busy}
                    : {label: this.$t('poll.end_poll'), busy: this.busy};
            }
            if (this.canVote) {
                return {label: this.$t('poll.submit_vote'), disabled: !this.selectedOptions.length, busy: this.busy};
            }
            return null;
        },
        // 一行灰字：实名 / 匿名 · N人参与 · 剩余时间 · 状态
        metaText() {
            let parts = [
                this.isAnonymous ? this.$t('poll.anonymous') : this.$t('poll.named'),
                this.$t('poll.voter_count', {count: this.poll.voterCount || 0}),
            ];
            if (!this.isEnded) {
                parts.push(this.poll.endTime > 0 ? pollRemainingText(this, this.poll) : this.$t('poll.no_end_time'));
            }
            if (this.isEnded) {
                parts.push(this.$t('poll.poll_ended'));
            } else if (this.poll.hasVoted) {
                parts.push(this.$t('poll.already_voted'));
            }
            return parts.filter(p => !!p).join(' · ');
        },
    },
    methods: {
        async fetchPoll() {
            this.loading = true;
            try {
                let poll = await pollApi.getPoll(this.pollId, this.groupId);
                this.poll = poll;
                this.error = null;
                // 只在投票模式恢复已投的选项
                this.selectedOptions = !this.isManagerMode && poll.myOptionIds ? [...poll.myOptionIds] : [];
                this.updateLocalMessage();
            } catch (e) {
                this.error = this.$t('poll.poll_load_failed') + ': ' + e.message;
            } finally {
                this.loading = false;
            }
        },
        // 服务端状态比消息里的快照新时回写本地消息，气泡上的票数 / 状态才不会一直是旧的
        updateLocalMessage() {
            if (!this.messageId) {
                return;
            }
            let message = store.state.conversation.currentConversationMessageList.find(m => m.messageId === this.messageId);
            let content = message && message.messageContent;
            if (!content || String(content.pollId) !== String(this.pollId)) {
                return;
            }
            let status = this.isEnded ? 1 : this.poll.status;
            let totalVotes = this.poll.totalVotes || 0;
            if (content.status !== status || content.totalVotes !== totalVotes) {
                content.status = status;
                content.totalVotes = totalVotes;
                wfc.updateMessageContent(this.messageId, content);
            }
        },
        isSelected(optionId) {
            return this.selectedOptions.includes(optionId);
        },
        isMyVote(optionId) {
            return !this.isManagerMode && !!this.poll.myOptionIds && this.poll.myOptionIds.includes(optionId);
        },
        toggleOption(optionId) {
            if (!this.canVote) {
                return;
            }
            let selected = this.isSelected(optionId);
            if (this.poll.type !== 2) {
                this.selectedOptions = selected ? [] : [optionId];
                return;
            }
            if (selected) {
                this.selectedOptions = this.selectedOptions.filter(id => id !== optionId);
                return;
            }
            if (this.poll.maxSelect > 0 && this.selectedOptions.length >= this.poll.maxSelect) {
                this.$notify({text: this.$t('poll.max_select_limit', {max: this.poll.maxSelect}), type: 'warn'});
                return;
            }
            this.selectedOptions = [...this.selectedOptions, optionId];
        },
        onPrimary() {
            if (this.isManagerMode) {
                this.isEnded ? this.deletePoll() : this.closePoll();
            } else {
                this.submitVote();
            }
        },
        // 投完留在详情里看结果
        async submitVote() {
            if (!this.selectedOptions.length || this.busy) {
                return;
            }
            this.busy = true;
            try {
                await pollApi.vote(this.pollId, this.groupId, this.selectedOptions);
                this.$notify({text: this.$t('poll.vote_success'), type: 'success'});
                await this.fetchPoll();
            } catch (e) {
                this.$notify({text: this.$t('poll.vote_failed') + ': ' + e.message, type: 'error'});
            } finally {
                this.busy = false;
            }
        },
        closePoll() {
            this.$alert({
                content: this.$t('poll.confirm_close'),
                confirmText: this.$t('poll.end_poll'),
                confirmButtonType: 'danger',
                confirmCallback: async () => {
                    this.busy = true;
                    try {
                        await pollApi.closePoll(this.pollId, this.groupId);
                        this.$notify({text: this.$t('poll.poll_closed'), type: 'success'});
                        await this.fetchPoll();
                    } catch (e) {
                        this.$notify({text: this.$t('poll.close_failed') + ': ' + e.message, type: 'error'});
                    } finally {
                        this.busy = false;
                    }
                },
            });
        },
        deletePoll() {
            this.$alert({
                content: this.$t('poll.confirm_delete'),
                confirmText: this.$t('common.delete'),
                confirmButtonType: 'danger',
                confirmCallback: async () => {
                    this.busy = true;
                    try {
                        await pollApi.deletePoll(this.pollId, this.groupId);
                        this.$notify({text: this.$t('poll.poll_deleted'), type: 'success'});
                        this.close();
                    } catch (e) {
                        this.$notify({text: this.$t('poll.delete_failed') + ': ' + e.message, type: 'error'});
                    } finally {
                        this.busy = false;
                    }
                },
            });
        },
        // TODO 接入转发：把投票拼回 PollMessageContent 转发出去。先留入口（同 wf-enterprise-chat）
        forwardPoll() {
            this.$notify({text: this.$t('poll.forward_coming_soon'), type: 'info'});
        },
        async exportDetails() {
            try {
                let details = await pollApi.exportPollDetails(this.pollId, this.groupId);
                if (!details || !details.length) {
                    this.$notify({text: this.$t('poll.no_voter_details'), type: 'info'});
                    return;
                }
                this.downloadCSV(details);
            } catch (e) {
                this.$notify({text: this.$t('poll.export_failed') + ': ' + e.message, type: 'error'});
            }
        },
        downloadCSV(details) {
            // BOM：Excel 打开才不乱码
            let csv = '﻿' + [this.$t('poll.csv_option'), this.$t('poll.csv_user'), this.$t('poll.csv_time')].join(',') + '\n';
            details.forEach(detail => {
                let time = new Date(detail.voteTime || detail.createdAt).toLocaleString();
                csv += this.escapeCSV(detail.optionText) + ',' + this.escapeCSV(detail.userName) + ',' + time + '\n';
            });
            let blob = new Blob([csv], {type: 'text/csv;charset=utf-8;'});
            let link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = (this.poll.title || this.$t('poll.default_file_name')) + '_' + this.$t('poll.details_suffix') + '.csv';
            link.click();
        },
        escapeCSV(field) {
            if (!field) {
                return '';
            }
            if (field.includes(',') || field.includes('"') || field.includes('\n')) {
                return '"' + field.replace(/"/g, '""') + '"';
            }
            return field;
        },
        userName(userId) {
            return wfc.getGroupMemberDisplayName(this.groupId, userId) || wfc.getUserDisplayName(userId);
        },
        portrait(userId) {
            let userInfo = wfc.getUserInfo(userId, false, this.groupId);
            return (userInfo && userInfo.portrait) || Config.DEFAULT_PORTRAIT_URL;
        },
        close() {
            closeFeatureDialog(this);
        },
    },
    components: {
        DialogFrame,
    },
}
</script>

<style scoped>
.poll-header {
    padding: 16px;
    border-radius: 8px;
    background: var(--background-primary);
}

.poll-title {
    font-size: calc(18px * var(--font-scale, 1));
    font-weight: 600;
    line-height: 1.4;
    word-break: break-word;
}

.poll-desc {
    margin-top: 6px;
    font-size: var(--font-size-base);
    line-height: 1.5;
    color: var(--text-secondary);
    white-space: pre-wrap;
    word-break: break-word;
}

.poll-creator {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 14px;
}

.poll-creator img {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    object-fit: cover;
}

.poll-creator-name {
    flex: 1;
    min-width: 0;
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
}

.poll-options {
    margin-top: 12px;
}

.poll-option {
    padding: 12px 14px;
    transition: background var(--duration-fast);
}

.poll-option.clickable {
    cursor: pointer;
}

.poll-option.clickable:hover {
    background: var(--background-item-hover);
}

.poll-option.highlight, .poll-option.highlight:hover {
    background: var(--accent-color-subtle);
}

.poll-option-line {
    display: flex;
    align-items: center;
    gap: 10px;
}

/* 单选圆形、多选方形 —— 形状要和「能选几个」对得上 */
.poll-check {
    flex: 0 0 18px;
    height: 18px;
    box-sizing: border-box;
    border-radius: 50%;
    border: 1.5px solid var(--text-tertiary);
    transition: background var(--duration-fast), border-color var(--duration-fast);
    display: flex;
    align-items: center;
    justify-content: center;
}

.poll-check.multi {
    border-radius: 4px;
}

.poll-check.checked {
    border-color: var(--accent-color);
    background: var(--accent-color);
}

.poll-check i {
    font-size: 11px;
    color: var(--text-on-accent);
}

.poll-my-vote {
    flex: 0 0 auto;
    font-size: 18px;
    color: var(--accent-color);
}

.poll-option-text {
    flex: 1;
    min-width: 0;
    font-size: var(--font-size-base);
    line-height: 20px;
    color: var(--text-primary);
    word-break: break-word;
}

.poll-option-text.accent {
    color: var(--accent-color);
}

.poll-option-text.mine {
    font-weight: 500;
}

.poll-option-count {
    flex: 0 0 auto;
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
}

.poll-option-count.accent {
    color: var(--accent-color);
}

.poll-bar {
    margin-top: 8px;
    height: 6px;
    border-radius: 3px;
    background: var(--background-tertiary);
    overflow: hidden;
}

.poll-bar > div {
    height: 100%;
    border-radius: 3px;
    background: var(--text-placeholder);
    transition: width var(--duration-slow);
}

.poll-bar > div.mine {
    background: var(--accent-color);
}

.poll-meta {
    margin-top: 12px;
    text-align: center;
    font-size: var(--font-size-xs);
    color: var(--text-tertiary);
}

.poll-footer-link {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    cursor: pointer;
}

.poll-footer-link i {
    font-size: 16px;
    color: var(--text-secondary);
}

.poll-footer-link:hover {
    background: var(--background-item-hover);
}
</style>
