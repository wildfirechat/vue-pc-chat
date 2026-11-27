<template>
    <!-- 选人页最外层的「机器人」分组：和组织架构/联系人一样点击展开，默认收起 -->
    <div v-show="visible && robotList.length > 0" class="robot-pick-entry">
        <div class="category-item-container" @click="toggle">
            <i class="arrow right" v-bind:class="{down: opened}"></i>
            <div class="category-item">
                <span class="title">机器人</span>
                <span class="desc">{{ robotList.length }}</span>
            </div>
        </div>
        <div v-show="opened" class="robot-inline-list">
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
                        <span v-else class="radio" :class="{checked: isPicked(robot)}"></span>
                        <img class="avatar" :src="robot.portrait" alt="" @error="onPortraitError">
                        <span class="name single-line">{{ robot._displayName || robot.displayName }}</span>
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
        toggle() {
            this.opened = !this.opened;
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
            // 单选：选中机器人后回到原选人流程，由原来的确定按钮提交
            this.opened = false;
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
    margin-right: 16px;
    flex-shrink: 0;
    color: var(--text-secondary);
    font-size: var(--font-size-xs);
}

/* 机器人列表直接展开在分组下面，和联系人列表一致 */
.robot-inline-list {
    background-color: var(--background-primary);
}

.robot-inline-list ul {
    list-style: none;
    margin: 0;
    padding: 0;
}

.robot-item {
    display: flex;
    align-items: center;
    height: 48px;
    padding: 0 16px 0 32px;
    color: var(--text-primary);
    font-size: var(--font-size-sm);
    cursor: pointer;
}

.robot-item:hover {
    background-color: var(--background-item-hover);
}

.robot-item.checked {
    background-color: var(--background-selected-dim);
}

.robot-item.disabled {
    opacity: 0.5;
    pointer-events: none;
}

.robot-item .checkbox {
    width: 16px;
    height: 16px;
    margin-right: 12px;
    flex-shrink: 0;
}

.robot-item .radio {
    width: 14px;
    height: 14px;
    margin-right: 12px;
    flex-shrink: 0;
    border: 1px solid var(--border-primary);
    border-radius: var(--radius-circle);
    background: transparent;
}

.robot-item .radio.checked {
    background: var(--accent-color);
    border-color: var(--accent-color);
}

.robot-item .avatar {
    width: 32px;
    height: 32px;
    margin-right: 12px;
    flex-shrink: 0;
    border-radius: var(--radius-sm);
    object-fit: cover;
}

.robot-item .name {
    flex: 1;
    min-width: 0;
}

.no-result {
    padding: 20px 32px;
    color: var(--text-secondary);
    text-align: left;
    font-size: var(--font-size-sm);
}

.arrow {
    border: solid var(--contact-arrow-border);
    border-width: 0 1px 1px 0;
    display: inline-block;
    padding: 3px;
    margin-right: 8px;
    flex-shrink: 0;
    transition: transform var(--duration-fast);
}

.right {
    transform: rotate(-45deg);
    -webkit-transform: rotate(-45deg);
}

.down {
    transform: rotate(45deg);
    -webkit-transform: rotate(45deg);
}
</style>
