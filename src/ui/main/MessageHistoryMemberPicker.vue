<template>
    <div class="message-history-member-picker">
        <div class="search-container">
            <i class="icon-ion-ios-search"></i>
            <input ref="input" v-model.trim="query" type="text" autocomplete="off" :placeholder="$t('common.search')"/>
        </div>
        <ul class="member-list">
            <li v-for="user in shownMembers" :key="user.uid"
                :class="{selected: user.uid === selectedUid}"
                @click="$emit('select', user)">
                <img :src="user.portrait" draggable="false" alt="">
                <span class="single-line">{{ user._displayName }}</span>
            </li>
        </ul>
        <p v-if="!loaded" class="tip">{{ $t('common.loading') }}</p>
        <p v-else-if="shownMembers.length === 0" class="tip">{{ $t('search.result_empty') }}</p>
    </div>
</template>

<script>
import store from "../../store";

// 超大群一次渲染太多节点会卡，超过的部分需要搜索
const MAX_SHOWN_MEMBERS = 200;

// 聊天记录按群成员查找
export default {
    name: "MessageHistoryMemberPicker",
    props: {
        groupId: {
            type: String,
            required: true,
        },
        selectedUid: {
            type: String,
            default: '',
        },
    },
    emits: ['select'],

    data() {
        return {
            query: '',
            members: [],
            loaded: false,
        }
    },

    created() {
        store.getGroupMemberUserInfosAsync(this.groupId, true, true).then(users => {
            this.members = users;
            this.loaded = true;
        });
    },

    mounted() {
        this.$refs.input.focus();
    },

    computed: {
        shownMembers() {
            return store.filterUsers(this.members, this.query).slice(0, MAX_SHOWN_MEMBERS);
        },
    },
}
</script>

<style scoped lang="css">
.message-history-member-picker {
    width: 300px;
    padding: 12px 0 6px;
    border-radius: var(--radius-lg);
    background: var(--background-primary);
    box-shadow: var(--shadow-main);
    border: 1px solid var(--border-secondary);
}

.search-container {
    height: calc(32px * var(--layout-scale-cap));
    margin: 0 12px 6px;
    padding: 0 10px;
    display: flex;
    align-items: center;
    gap: 6px;
    border-radius: var(--radius-md);
    background: var(--background-input);
}

.search-container i {
    font-size: calc(16px * var(--layout-scale-cap));
    color: var(--text-tertiary);
}

.search-container input {
    flex: 1;
    min-width: 0;
    height: 100%;
    padding: 0;
    border: none;
    outline: none;
    background: transparent;
    font-size: var(--font-size-base);
}

.member-list {
    max-height: 340px;
    overflow-y: auto;
    list-style: none;
}

.member-list li {
    height: calc(44px * var(--layout-scale-row));
    padding: 0 16px;
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: var(--font-size-base);
    color: var(--text-primary);
    cursor: pointer;
}

.member-list li:hover {
    background: var(--background-item-hover);
}

.member-list li.selected {
    background: var(--background-item-active);
}

.member-list img {
    width: calc(30px * var(--layout-scale-cap));
    height: calc(30px * var(--layout-scale-cap));
    min-width: calc(30px * var(--layout-scale-cap));
    border-radius: var(--default-portrait-border-radius);
}

.tip {
    padding: 16px 0;
    text-align: center;
    font-size: var(--font-size-sm);
    color: var(--text-tertiary);
}
</style>
