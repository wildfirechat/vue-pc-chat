<template>
    <div class="conversation-item"
         @click.stop="onConversationItemClick(source.conversation)">
        <input class="checkbox" v-bind:value="source.conversation" type="checkbox"
               v-model="pickedConversations" placeholder="">
        <div class="header">
            <img class="avatar" :src="source.conversation._target.portrait" alt=""/>
        </div>
        <p class="title single-line">{{ source.conversation._target._displayName }}</p>
    </div>
</template>

<script>
import store from "../../../../../store";

export default {
    name: "ConversationPickItem",
    props: {
        source: {
            type: Object,
            required: true
        },
    },
    computed: {
        pickedConversations: {
            get() {
                return store.state.pick.conversations;
            },
            set(value) {
                // 更新选择状态
                store.state.pick.conversations = value;
            }
        }
    },
    methods: {
        onConversationItemClick(conversation) {
            store.pickOrUnpickConversation(conversation, true)
        },
    }
}
</script>

<style lang="css" scoped>
.conversation-item {
    width: 100%;
    height: 70px;
    display: flex;
    flex-direction: row;
    border-bottom: 1px solid #eeeeee;
    align-items: center;
    justify-content: flex-start;
    padding-left: 15px;
}

.conversation-item:active {
    background-color: #d6d6d6;
}

.conversation-item .header {
    height: 100%;
    padding: 10px 12px 10px 15px;
}

.conversation-item .header .avatar {
    position: relative;
    width: 45px;
    height: 45px;
    display: inline-block;
    top: 50%;
    background: #d6d6d6;
    transform: translateY(-50%);
    border-radius: 3px;
}

.conversation-item .title {
    font-size: 14px;
    color: #262626;
    font-style: normal;
    font-weight: normal;
    padding-right: 10px;
}

.checkbox {
    margin-right: 0;
}
</style>
