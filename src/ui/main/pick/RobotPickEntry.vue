<template>
    <!-- 选人页最外层的「机器人」分组：独立于组织树节点，只有组织架构里配了机器人才显示 -->
    <div v-show="visible && robotList.length > 0" class="robot-pick-entry">
        <div v-if="!opened" class="category-item-container" @click="open">
            <!-- 分组勾选框：跟着机器人整体的勾选状态走，支持全部 / 部分选中 -->
            <span v-if="multiSelect" class="checkbox-wrapper" @click.stop="toggleAll">
                <input type="checkbox"
                       :checked="allChecked"
                       :indeterminate.prop="partlyChecked"
                       :disabled="selectableRobots.length === 0">
            </span>
            <img class="robot-icon" :src="robotIcon" alt="">
            <div class="category-item">
                <span class="title">机器人</span>
                <span class="desc">{{ pickedCount }}<template v-if="robotList.length !== pickedCount">/{{ robotList.length }}</template></span>
            </div>
            <i class="row-chevron icon-ion-ios-arrow-right"></i>
        </div>
        <div v-else class="robot-pick-view">
            <div class="back" @click="close">返回</div>
            <ul>
                <li v-for="robot in filteredRobots" :key="robot.uid">
                    <div class="robot-item"
                         v-bind:class="{checked: isPicked(robot), disabled: isUncheckable(robot)}"
                         @click="clickRobot(robot)">
                        <input v-if="multiSelect"
                               class="checkbox"
                               type="checkbox"
                               :checked="isPicked(robot)"
                               :disabled="isUncheckable(robot)">
                        <img class="avatar" :src="robot.portrait" alt="" @error="onPortraitError">
                        <span class="name single-line">{{ robot._displayName || robot.displayName }}</span>
                        <i v-if="!multiSelect && isPicked(robot)" class="check-icon icon-ion-ios-checkmark"></i>
                    </div>
                </li>
                <li v-if="filteredRobots.length === 0">
                    <p class="no-result">没有匹配的机器人</p>
                </li>
            </ul>
        </div>
    </div>
</template>

<script>
import store from "../../../store";
import Config from "../../../config";

/**
 * 选人界面的「机器人」入口：点一下进入机器人列表（单选 / 多选），选中的机器人直接进
 * 现有的 pick 状态，确定时按原有的选人回调把 uid 返回给调用方。
 * 机器人列表里不显示组织节点，组织树那边也不显示机器人。
 */
export default {
    name: "RobotPickEntry",
    props: {
        // 不传就用组织架构机器人（store 里已经合并去重、按 sort 排好序）
        robots: {
            type: Array,
            required: false,
            default: null,
        },
        searchQuery: {
            type: String,
            required: false,
            default: '',
        },
        multiSelect: {
            type: Boolean,
            required: false,
            default: true,
        },
        initialCheckedUsers: {
            type: Array,
            required: false,
            default: null,
        },
        uncheckableUsers: {
            type: Array,
            required: false,
            default: null,
        },
        // 选中人页外层才显示，进到组织内部时由调用方置 false
        visible: {
            type: Boolean,
            required: false,
            default: true,
        },
    },
    data() {
        return {
            sharedContactState: store.state.contact,
            opened: false,
            robotIcon: Config.DEFAULT_ROBOT_PORTRAIT_URL,
        }
    },
    computed: {
        robotList() {
            return this.robots || this.sharedContactState.organizationRobots;
        },
        filteredRobots() {
            if (this.searchQuery && this.searchQuery.trim()) {
                return store.filterUsers(this.robotList, this.searchQuery);
            }
            return this.robotList;
        },
        selectableRobots() {
            return this.robotList.filter(robot => !this.isUncheckable(robot));
        },
        pickedRobots() {
            return this.selectableRobots.filter(robot => store.isUserPicked(robot));
        },
        pickedCount() {
            return this.pickedRobots.length;
        },
        allChecked() {
            return this.selectableRobots.length > 0 && this.pickedRobots.length === this.selectableRobots.length;
        },
        partlyChecked() {
            return this.pickedRobots.length > 0 && !this.allChecked;
        },
    },
    mounted() {
        this.syncInitialChecked();
    },
    watch: {
        // 机器人可能比选人界面晚到（组织结构服务登录慢），到货后再补一次初始勾选
        robotList() {
            this.syncInitialChecked();
        },
    },
    methods: {
        /**
         * 和组织成员列表一样，初始勾选的机器人（如群里已有的机器人）要同步成勾选状态。
         * 只处理第一次见到的机器人，避免用户取消勾选后列表刷新又把它勾回去
         */
        syncInitialChecked() {
            if (!this.initialCheckedUsers || this.initialCheckedUsers.length === 0) {
                return;
            }
            if (!this._syncedInitialRobots) {
                this._syncedInitialRobots = new Set();
            }
            this.robotList.forEach(robot => {
                if (this._syncedInitialRobots.has(robot.uid)) {
                    return;
                }
                this._syncedInitialRobots.add(robot.uid);
                if (this.initialCheckedUsers.findIndex(u => u.uid === robot.uid) > -1 && !store.isUserPicked(robot)) {
                    store.pickOrUnpickUser(robot);
                }
            });
        },
        open() {
            this.opened = true;
            this.$emit('open-change', true);
            this.scrollCategoryToTop();
        },
        close() {
            this.opened = false;
            this.$emit('open-change', false);
            this.scrollCategoryToTop();
        },
        // 切换列表后把选人页的滚动位置回到顶部，免得停在上一个列表的中间
        scrollCategoryToTop() {
            this.$nextTick(() => {
                let container = this.$el && this.$el.closest ? this.$el.closest('.pick-category-container') : null;
                if (container) {
                    container.scrollTop = 0;
                }
            });
        },
        toggleAll() {
            let pick = !this.allChecked;
            this.selectableRobots.forEach(robot => {
                if (store.isUserPicked(robot) !== pick) {
                    store.pickOrUnpickUser(robot);
                }
            });
        },
        clickRobot(robot) {
            if (this.isUncheckable(robot)) {
                return;
            }
            if (this.multiSelect) {
                store.pickOrUnpickUser(robot);
                return;
            }
            // 单选：机器人之间互斥，选完回到选人页，由原来的确定按钮把结果交回去
            this.robotList.forEach(item => {
                if (item.uid !== robot.uid && store.isUserPicked(item)) {
                    store.pickOrUnpickUser(item);
                }
            });
            if (!store.isUserPicked(robot)) {
                store.pickOrUnpickUser(robot);
            }
            this.close();
        },
        isPicked(robot) {
            return store.isUserPicked(robot);
        },
        isUncheckable(robot) {
            return this.uncheckableUsers && this.uncheckableUsers.findIndex(u => u.uid === robot.uid) > -1;
        },
        onPortraitError(e) {
            e.target.src = this.robotIcon;
        },
    },
}
</script>

<style lang="css" scoped>

.category-item-container {
    height: 40px;
    display: flex;
    align-items: center;
    padding-left: 16px;
    color: var(--text-primary);
    font-size: var(--font-size-base);
    border-top: 1px solid var(--border-tertiary);
    background-color: var(--background-secondary);
    transition: background var(--duration-fast);
    cursor: pointer;
    user-select: none;
}

.category-item {
    display: flex;
    flex: 1;
    min-width: 0;
    justify-content: space-between;
    align-items: center;
}

.category-item .title {
    font-size: var(--font-size-sm);
    font-weight: 500;
    color: var(--text-primary);
}

.category-item .desc {
    margin-right: 8px;
    color: var(--text-secondary);
    font-size: var(--font-size-xs);
}

/* 带彩色背景的机器人图标（与组织 / 部门图标同一套视觉） */
.robot-icon {
    width: 24px;
    height: 24px;
    flex-shrink: 0;
    border-radius: var(--radius-sm);
    margin-right: 8px;
}

.row-chevron {
    flex-shrink: 0;
    margin-right: 16px;
    font-size: var(--font-size-lg);
    color: var(--text-tertiary);
}

.checkbox-wrapper {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding-right: 10px;
    flex-shrink: 0;
}

.checkbox-wrapper input[type="checkbox"] {
    cursor: pointer;
}

.robot-pick-view .back {
    height: 40px;
    display: flex;
    align-items: center;
    padding-left: 16px;
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    background-color: var(--background-item-normal);
    cursor: pointer;
    transition: background var(--duration-fast);
}

.robot-pick-view .back:hover {
    background-color: var(--background-item-hover);
}

.robot-pick-view ul {
    list-style: none;
    width: 100%;
}

.robot-item {
    display: flex;
    align-items: center;
    height: 56px;
    padding: 0 20px;
    font-size: var(--font-size-base);
    cursor: pointer;
}

.robot-item:hover {
    background: var(--background-item-hover);
}

.robot-item.checked {
    background-color: var(--background-item-placeholder);
}

.robot-item.disabled {
    pointer-events: none;
    opacity: 0.5;
}

.robot-item .checkbox {
    margin-right: 8px;
    flex-shrink: 0;
    cursor: pointer;
}

.robot-item .avatar {
    width: 36px;
    height: 36px;
    flex-shrink: 0;
    border-radius: var(--radius-sm);
    margin-right: 8px;
}

.robot-item .name {
    flex: 1;
    min-width: 0;
}

.robot-item .check-icon {
    flex-shrink: 0;
    color: var(--accent-color);
    font-size: var(--font-size-lg);
}

.no-result {
    padding: 20px;
    color: var(--text-secondary);
    text-align: center;
    font-size: var(--font-size-base);
}

</style>
