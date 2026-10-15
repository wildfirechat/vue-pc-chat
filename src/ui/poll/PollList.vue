<template>
    <DialogFrame :title="$t('poll.my_polls')">
        <div v-if="loading && !polls.length" class="df-center">
            <span class="df-spinner"></span>
        </div>
        <div v-else-if="!polls.length" class="df-center">
            <i class="icon-ion-stats-bars poll-list-empty-icon"></i>
            <span>{{ $t('poll.no_polls') }}</span>
        </div>
        <div v-else class="poll-list">
            <div v-for="poll in polls" :key="pollIdOf(poll)" class="poll-card" @click="openDetail(poll)">
                <div class="poll-card-head">
                    <span class="poll-card-title">{{ poll.title }}</span>
                    <span v-if="poll.isCreator" class="poll-card-delete" :title="$t('common.delete')"
                          @click.stop="deletePoll(poll)"><i class="icon-ion-ios-trash-outline"></i></span>
                    <span class="df-chip poll-card-chip" :class="chipClass(poll)">{{ chipText(poll) }}</span>
                </div>
                <p v-if="descOf(poll)" class="poll-card-desc">{{ descOf(poll) }}</p>
                <div class="poll-card-meta">
                    <i class="icon-ion-android-people"></i>
                    <span>{{ $t('poll.voter_count', {count: poll.voterCount || 0}) }}</span>
                    <i class="icon-ion-stats-bars"></i>
                    <span>{{ $t('poll.vote_count', {count: poll.totalVotes || 0}) }}</span>
                    <span class="spacer"></span>
                    <span v-if="remainingText(poll)" :class="{remaining: !isEnded(poll)}">{{ remainingText(poll) }}</span>
                </div>
            </div>
        </div>
    </DialogFrame>
</template>

<script>
import pollApi from "../../api/pollApi";
import DialogFrame from "../common/DialogFrame.vue";
import {getSubWindowQuery} from '../util/subWindowNavigator';
import {showPollDetail} from "./pollUi";
import {pollRemainingText} from "./pollUtil";
import '../common/dialogForm.css';

/**
 * 我发起的投票（对齐 wf-enterprise-chat 的 PollListScreen）。点一张卡片在上面叠开详情（管理模式），
 * 关了详情回到列表并刷新；删除按钮 hover 时出现。
 */
export default {
    name: "PollList",
    props: {
        subWindowQuery: {
            type: Object,
            required: false,
            default: null,
        }
    },
    emits: ['close'],
    data() {
        return {
            loading: false,
            polls: [],
            groupId: getSubWindowQuery(this).groupId || '',
        };
    },
    mounted() {
        this.loadPolls();
    },
    methods: {
        async loadPolls() {
            this.loading = true;
            try {
                this.polls = (await pollApi.getMyPolls()) || [];
            } catch (e) {
                this.$notify({text: this.$t('poll.poll_load_failed') + ': ' + e.message, type: 'error'});
            } finally {
                this.loading = false;
            }
        },
        pollIdOf(poll) {
            return poll.id || poll.pollId;
        },
        descOf(poll) {
            return poll.description || poll.desc || '';
        },
        isEnded(poll) {
            return poll.status === 1 || (poll.endTime > 0 && poll.endTime < Date.now());
        },
        chipClass(poll) {
            if (poll.status === 1) {
                return 'ended';
            }
            return poll.hasVoted ? 'success' : '';
        },
        chipText(poll) {
            if (poll.status === 1) {
                return this.$t('poll.poll_ended');
            }
            return poll.hasVoted ? this.$t('poll.already_voted') : this.$t('poll.poll_in_progress');
        },
        remainingText(poll) {
            return pollRemainingText(this, poll);
        },
        openDetail(poll) {
            showPollDetail(this, {
                pollId: this.pollIdOf(poll),
                groupId: poll.groupId || this.groupId,
                stack: true,
                onClosed: () => this.loadPolls(),
            });
        },
        deletePoll(poll) {
            this.$alert({
                content: this.$t('poll.confirm_delete'),
                confirmText: this.$t('common.delete'),
                confirmButtonType: 'danger',
                confirmCallback: async () => {
                    try {
                        await pollApi.deletePoll(this.pollIdOf(poll), poll.groupId || this.groupId);
                        this.$notify({text: this.$t('poll.poll_deleted'), type: 'success'});
                        this.loadPolls();
                    } catch (e) {
                        this.$notify({text: this.$t('poll.delete_failed') + ': ' + e.message, type: 'error'});
                    }
                },
            });
        },
    },
    components: {
        DialogFrame,
    },
}
</script>

<style scoped>
.poll-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 16px;
}

.poll-list-empty-icon {
    font-size: 44px;
    color: var(--text-tertiary);
    opacity: .6;
}

.poll-card {
    padding: 14px 16px;
    border-radius: 8px;
    background: var(--background-primary);
    cursor: pointer;
    transition: box-shadow var(--duration-fast);
}

.poll-card:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, .06);
}

.poll-card-head {
    display: flex;
    align-items: center;
    gap: 8px;
}

.poll-card-title {
    flex: 1;
    min-width: 0;
    font-size: var(--font-size-base);
    font-weight: 500;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
}

/* 删除按钮只在 hover 时出现，并让掉状态标签的位置 */
.poll-card-delete {
    display: none;
    cursor: pointer;
}

.poll-card-delete i {
    font-size: 18px;
    color: var(--text-tertiary);
}

.poll-card-delete:hover i {
    color: var(--text-danger);
}

.poll-card:hover .poll-card-delete {
    display: flex;
}

.poll-card:hover .poll-card-delete + .poll-card-chip {
    display: none;
}

.poll-card-desc {
    margin-top: 4px;
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
}

.poll-card-meta {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-top: 10px;
    font-size: var(--font-size-xs);
    color: var(--text-tertiary);
}

.poll-card-meta i {
    font-size: 14px;
    color: var(--text-tertiary);
}

.poll-card-meta span + i {
    margin-left: 10px;
}

.poll-card-meta .spacer {
    flex: 1;
}

.poll-card-meta .remaining {
    color: var(--status-warning);
}
</style>
