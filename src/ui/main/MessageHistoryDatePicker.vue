<template>
    <div class="message-history-date-picker">
        <div class="month-bar">
            <i class="icon-ion-ios-arrow-left" :class="{disabled: !canPrev}" @click="changeMonth(-1)"></i>
            <p>{{ monthLabel }}</p>
            <i class="icon-ion-ios-arrow-right" :class="{disabled: !canNext}" @click="changeMonth(1)"></i>
        </div>
        <ul class="week-days">
            <li v-for="(weekDay, index) in weekDays" :key="index">{{ weekDay }}</li>
        </ul>
        <ul class="days">
            <li v-for="(cell, index) in cells" :key="index"
                :class="{active: cell && cell.active, today: cell && cell.today, selected: cell && cell.selected}"
                @click="cell && cell.active && $emit('select', cell.timestamp)">
                {{ cell ? cell.day : '' }}
            </li>
        </ul>
    </div>
</template>

<script>
import wfc from "../../wfc/client/wfc";
import {numberValue} from "../../wfc/util/longUtil";

// 聊天记录按日期查找：日历中只有当天有消息的日期可以点击
export default {
    name: "MessageHistoryDatePicker",
    props: {
        conversation: {
            type: Object,
            required: true,
        },
        // 当前选中日期当天 0 点的时间戳
        selected: {
            type: Number,
            default: 0,
        },
    },
    emits: ['select'],

    data() {
        let date = this.selected ? new Date(this.selected) : new Date();
        return {
            year: date.getFullYear(),
            month: date.getMonth(),
            activeDays: new Set(),
            // 最早一条消息所在的月份，不能再往前翻
            earliestMonthIndex: null,
        }
    },

    created() {
        this.activeDaysCache = new Map();
        this.loadToken = 0;
        this.loadEarliestMonth();
        this.loadActiveDays();
    },

    computed: {
        monthIndex() {
            return this.year * 12 + this.month;
        },
        canPrev() {
            return this.earliestMonthIndex === null || this.monthIndex > this.earliestMonthIndex;
        },
        canNext() {
            let now = new Date();
            return this.monthIndex < now.getFullYear() * 12 + now.getMonth();
        },
        monthLabel() {
            return new Date(this.year, this.month, 1).toLocaleDateString(this.$i18n.locale, {year: 'numeric', month: 'long'});
        },
        weekDays() {
            let format = new Intl.DateTimeFormat(this.$i18n.locale, {weekday: 'narrow'});
            // 2023-01-01 是星期日
            return [0, 1, 2, 3, 4, 5, 6].map(i => format.format(new Date(2023, 0, 1 + i)));
        },
        cells() {
            let cells = [];
            let firstWeekDay = new Date(this.year, this.month, 1).getDay();
            for (let i = 0; i < firstWeekDay; i++) {
                cells.push(null);
            }
            let today = new Date().setHours(0, 0, 0, 0);
            let dayCount = new Date(this.year, this.month + 1, 0).getDate();
            for (let day = 1; day <= dayCount; day++) {
                let timestamp = new Date(this.year, this.month, day).getTime();
                cells.push({
                    day,
                    timestamp,
                    active: this.activeDays.has(day),
                    today: timestamp === today,
                    selected: timestamp === this.selected,
                });
            }
            return cells;
        },
    },

    methods: {
        changeMonth(delta) {
            if ((delta < 0 && !this.canPrev) || (delta > 0 && !this.canNext)) {
                return;
            }
            let date = new Date(this.year, this.month + delta, 1);
            this.year = date.getFullYear();
            this.month = date.getMonth();
            this.loadActiveDays();
        },

        async loadActiveDays() {
            let monthIndex = this.monthIndex;
            let token = ++this.loadToken;
            let days = this.activeDaysCache.get(monthIndex);
            if (!days) {
                this.activeDays = new Set();
                days = await this.queryActiveDays(this.year, this.month);
                this.activeDaysCache.set(monthIndex, days);
            }
            if (token === this.loadToken) {
                this.activeDays = days;
            }
        },

        // 从月末往前跳：取某个时间点之前的最后一条消息，记下它所在的日期，再从那天 0 点继续往前取，
        // 请求次数约等于当月有消息的天数 + 1
        async queryActiveDays(year, month) {
            let start = new Date(year, month, 1).getTime();
            let timestamp = new Date(year, month + 1, 1).getTime();
            let days = new Set();
            // 正常最多 32 次，上限只用来防止死循环
            for (let i = 0; i < 64; i++) {
                let msg = await this.lastMessageBefore(timestamp);
                let msgTimestamp = msg ? numberValue(msg.timestamp) : 0;
                if (msgTimestamp < start) {
                    break;
                }
                let date = new Date(msgTimestamp);
                days.add(date.getDate());
                let dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
                timestamp = dayStart < timestamp ? dayStart : timestamp - 1;
            }
            return days;
        },

        lastMessageBefore(timestamp) {
            return new Promise(resolve => {
                wfc.getMessagesByTimestampV2(this.conversation, [], timestamp, true, 1, '', msgs => {
                    resolve(msgs && msgs.length > 0 ? msgs[msgs.length - 1] : null);
                }, () => resolve(null));
            });
        },

        loadEarliestMonth() {
            wfc.getMessagesByTimestampV2(this.conversation, [], 1, false, 1, '', msgs => {
                if (msgs && msgs.length > 0) {
                    let date = new Date(numberValue(msgs[0].timestamp));
                    this.earliestMonthIndex = date.getFullYear() * 12 + date.getMonth();
                }
            }, () => {
            });
        },
    },
}
</script>

<style scoped lang="css">
.message-history-date-picker {
    width: 300px;
    padding: 12px;
    border-radius: var(--radius-lg);
    background: var(--background-primary);
    box-shadow: var(--shadow-main);
    border: 1px solid var(--border-secondary);
    user-select: none;
}

.month-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 4px 8px;
}

.month-bar p {
    font-size: calc(15px * var(--font-scale));
    font-weight: 500;
    color: var(--text-primary);
}

.month-bar i {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-sm);
    font-size: var(--font-size-lg);
    color: var(--text-secondary);
    cursor: pointer;
}

.month-bar i:hover {
    background: var(--background-item-hover);
}

.month-bar i.disabled {
    color: var(--text-placeholder);
    cursor: default;
    background: none;
}

.week-days, .days {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    list-style: none;
}

.week-days li {
    height: 30px;
    line-height: 30px;
    text-align: center;
    font-size: var(--font-size-sm);
    color: var(--text-tertiary);
}

.days li {
    height: calc(36px * var(--layout-scale-cap));
    margin: 1px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-sm);
    font-size: var(--font-size-base);
    color: var(--text-placeholder);
}

.days li.today {
    font-weight: 600;
}

.days li.active {
    color: var(--text-primary);
    cursor: pointer;
}

.days li.active:hover {
    background: var(--background-item-hover);
}

.days li.selected {
    color: var(--text-on-accent);
    background: var(--accent-color);
}

.days li.selected:hover {
    background: var(--accent-color-active);
}
</style>
