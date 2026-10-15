<template>
    <input ref="input" type="datetime-local" class="native-datetime-picker" tabindex="-1" :min="minValue"
           @change="onChange">
</template>

<script>
function pad(n) {
    return n < 10 ? '0' + n : '' + n;
}

export function toDateTimeInputValue(ms) {
    let d = new Date(ms);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * 「截止时间」这类整行可点的字段：行里放一个看不见的 datetime-local，点行时 open() 弹出系统的日期时间面板，
 * 选了发 pick(毫秒)。父元素要 position: relative，面板贴着行的下沿弹出。
 */
export default {
    name: "NativeDateTimePicker",
    props: {
        // 最早可选的时间（毫秒），默认现在
        min: {type: Number, default: 0},
    },
    emits: ['pick'],
    computed: {
        minValue() {
            return toDateTimeInputValue(this.min || Date.now());
        },
    },
    methods: {
        open(initial) {
            let input = this.$refs.input;
            input.value = toDateTimeInputValue(initial || Date.now());
            try {
                input.showPicker();
            } catch (e) {
                input.focus();
                input.click();
            }
        },
        onChange(e) {
            let time = new Date(e.target.value).getTime();
            if (!isNaN(time)) {
                this.$emit('pick', time);
            }
        },
    },
}
</script>

<style scoped>
.native-datetime-picker {
    position: absolute;
    left: 0;
    bottom: 0;
    width: 100%;
    height: 1px;
    padding: 0;
    margin: 0;
    border: none;
    opacity: 0;
    pointer-events: none;
}
</style>
