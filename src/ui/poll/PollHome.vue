<template>
    <DialogFrame :title="$t('poll.poll')" :tinted="false">
        <div class="poll-home">
            <div class="poll-home-item" @click="openCreate">
                <span class="poll-home-icon"><i class="icon-ion-android-add-circle"></i></span>
                <div class="poll-home-text">
                    <p class="title">{{ $t('poll.create_poll') }}</p>
                    <p class="subtitle">{{ $t('poll.create_poll_subtitle') }}</p>
                </div>
                <i class="icon-ion-ios-arrow-right poll-home-arrow"></i>
            </div>
            <div class="poll-home-item" @click="openList">
                <span class="poll-home-icon"><i class="icon-ion-android-list"></i></span>
                <div class="poll-home-text">
                    <p class="title">{{ $t('poll.my_polls') }}</p>
                    <p class="subtitle">{{ $t('poll.my_polls_subtitle') }}</p>
                </div>
                <i class="icon-ion-ios-arrow-right poll-home-arrow"></i>
            </div>
        </div>
    </DialogFrame>
</template>

<script>
import DialogFrame from "../common/DialogFrame.vue";
import {getSubWindowQuery} from '../util/subWindowNavigator';
import {closeFeatureDialog} from "../util/featureDialog";
import {showPollCreate, showPollList} from "./pollUi";

/**
 * 投票入口：发起投票 / 我的投票。矮弹窗，选完即关，再打开下一个弹窗（不做弹窗套弹窗）。
 */
export default {
    name: "PollHome",
    props: {
        subWindowQuery: {
            type: Object,
            required: false,
            default: null,
        }
    },
    emits: ['close'],
    methods: {
        groupId() {
            return getSubWindowQuery(this).groupId || '';
        },
        openCreate() {
            let groupId = this.groupId();
            closeFeatureDialog(this);
            showPollCreate(this, groupId);
        },
        openList() {
            let groupId = this.groupId();
            closeFeatureDialog(this);
            showPollList(this, groupId);
        },
    },
    components: {
        DialogFrame,
    },
}
</script>

<style scoped>
.poll-home {
    padding: 8px;
}

.poll-home-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    border-radius: 8px;
    cursor: pointer;
    transition: background var(--duration-fast);
}

.poll-home-item:hover {
    background: var(--background-item-hover);
}

.poll-home-icon {
    width: 40px;
    height: 40px;
    flex: 0 0 40px;
    border-radius: 10px;
    background: var(--accent-color-subtle);
    display: flex;
    align-items: center;
    justify-content: center;
}

.poll-home-icon i {
    font-size: 20px;
    color: var(--accent-color);
}

.poll-home-text {
    flex: 1;
    min-width: 0;
}

.poll-home-text .title {
    font-size: var(--font-size-base);
    font-weight: 500;
    line-height: 20px;
}

.poll-home-text .subtitle {
    margin-top: 2px;
    font-size: var(--font-size-xs);
    line-height: 18px;
    color: var(--text-tertiary);
}

.poll-home-arrow {
    font-size: 14px;
    color: var(--text-tertiary);
}
</style>
