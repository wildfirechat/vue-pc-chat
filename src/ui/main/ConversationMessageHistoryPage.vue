<template>
    <section>

        <div class="conversation-message-history-page">
            <div class="title-container">
                <img src="https://static.wildfirechat.net/user-fallback.png">
                <p class="single-line">会话名称</p>
            </div>
            <div class="search-input-container">
                <input id="searchInput"
                       ref="input"
                       autocomplete="off"
                       v-model="query"
                       @keydown.esc="cancel"
                       type="text" :placeholder="$t('common.search')"/>
                <i class="icon-ion-ios-search"></i>
            </div>
            <div class="category-container">
                <div class="category-item">全部</div>
                <div class="category-item">文件</div>
                <div class="category-item">图片与视频</div>
                <div class="category-item">链接</div>
            </div>
            <div class="message-list-container">
                <ul>
                    <li v-for="(message, index) in messages"
                        :key="message.uid">
                        <div class="message-container">
                            <div class="portrait-container">
                                <img
                                    alt="" :src="message._from.portrait">
                            </div>
                            <div class="name-time-content-container">
                                <div class="name-time-container">
                                    <p class="name"> {{ message._from._displayName }}</p>
                                    <p class="time"> {{ message._timeStr }}</p>
                                    <!--                            <p class="time"> 1223</p>-->
                                </div>
                                <div class="content">
                                    <MessageContentContainerView :message="message"
                                                                 @contextmenu.prevent.native="openMessageContextMenu($event, message)"/>
                                </div>
                            </div>

                        </div>
                    </li>
                </ul>
            </div>
        </div>
    </section>
</template>

<script>
import MessageContentContainerView from "./conversation/message/MessageContentContainerView";
import Conversation from "../../wfc/model/conversation";
import store from "../../store";

export default {
    name: "ConversationMessageHistoryPage",

    data() {
        return {
            query: '',
            messages: [],
        }
    },

    mounted() {
        let hash = window.location.hash;
        document.title = ''
        console.log('xxx', hash)
        let conversation = new Conversation(0, 'GNMtGtZZ', 0);
        this.messages = store.getConversationMessages(conversation);
        console.log('xxxmsg', this.messages)
    },

    components: {
        MessageContentContainerView,
    }
}
</script>

<style scoped lang="css">
.conversation-message-history-page {
    width: 100vw;
    height: 100vh;
    background: #f3f3f3;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.title-container {
    width: 100%;
    padding: 40px 40px 0 40px;
    display: flex;
    flex-direction: row;
    align-items: center;
}

.title-container img {
    width: 60px;
    height: 60px;
    margin-right: 20px;
}

.search-input-container {
    height: 60px;
    margin: 0 40px 0 40px;
    display: flex;
    justify-content: center;
    align-items: center;
    position: relative;
}

.search-input-container input {
    height: 25px;
    padding: 0 10px 0 20px;
    text-align: left;
    flex: 1;
    border: 1px solid #e5e5e5;
    border-radius: 3px;
    outline: none;
    background-color: #eeeeee;
}

.search-input-container input:active {
    border: 1px solid #4168e0;
}

.search-input-container input:focus {
    border: 1px solid #4168e0;
}

.search-input-container i {
    position: absolute;
    left: 5px;
}

.category-container {
    display: flex;
    padding: 15px 0;
    border-top: 1px solid #e0e0e0;
    flex-direction: row;
    justify-content: space-around;
}

.category-item {

}

.message-list-container {
    flex: 1;
    padding: 0 40px 20px 40px;
    overflow: scroll;
}

.message-list-container ul {
    width: 100%;
    height: 100%;
    list-style-position: inside;
}

.message-list-container ul li {
    position: relative;
    padding: 10px 0;
}

.message-list-container ul li:not(:last-child)::after {
    content: "";
    width: calc(100% - 55px);
    position: absolute;
    margin-left: 55px;
    padding: 5px 0;
    border-bottom: 1px solid #f1f1f1;
}

.message-container {
    width: 100%;
    display: flex;
}

.name-time-content-container {
    width: 100%;
}

.name-time-container {
    width: 100%;
    padding: 5px 0;
    display: flex;
    justify-content: space-between;
}

.name-time-container p {
    font-size: 12px;
    color: #c2c2c2;
}

.name-time-content-container .content {
    display: inline-block;
    margin-left: -10px;
}

.portrait-container {
    width: 40px;
    height: 40px;
    overflow: hidden;
    margin: 10px;
}

.portrait-container img {
    width: 100%;
    height: 100%;
    border-radius: 3px;
}

>>> .text-message-container {
    background-color: #f3f3f3;
}

>>> .rightarrow::before {
    display: none;
}

>>> .leftarrow::before {
    display: none;
}

</style>
