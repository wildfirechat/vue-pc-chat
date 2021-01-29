<template>
  <section class="file-record-page">
    <h2 class="title">文件记录</h2>
    <div class="file-record-container">

      <div class="category-container">
        <!--      我的-->
        <!--      聊天-->
        <ul>
          <li>
            <div class="category-item" @click="showMyFiles">
              <i class="icon-ion-folder"></i>
              <p>我的</p>
            </div>
          </li>
          <li>
            <div class="category-item" @click="showConversations">
              <i class="icon-ion-ios-chatboxes"></i>
              <p>聊天</p>
            </div>
          </li>
        </ul>

      </div>
      <div v-if="!showMyFileRecrods" class="conversation-list-container">
        <!--      聊天列表-->
        <ul>
          <li v-for="conversationInfo in sharedConversationState.conversationInfoList"
              :key="conversationInfoKey(conversationInfo)">
            <div class="conversation-item">
              <img :src="conversationInfo.conversation._target.portrait" alt="">
              <p class="single-line">{{ conversationInfo.conversation._target._displayName }}</p>
            </div>
          </li>
        </ul>
      </div>
      <div class="file-record-list-container">
        <!--      文件记录-->
        <ul>
          <li v-for="a in [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20]"
              :key="a">
            <div class="file-record-item">
              <img src="@/assets/images/filetypes/unknow.png" alt="">
              <div class="file-name-sender-container">
                <p class="name single-line">
                  文文文文件名称文件文文文件名称文件文文文件名名称文件文文文件名称文件文文文件名称文称文件文文文件名称文件文文件名称文件11111111111234567890</p>
                <p class="sender single-line">发送者|会话名称</p>
              </div>
              <div class="file-date-size-container">
                <p class="date single-line">2020/11/23</p>
                <p class="size single-line">1,021KB</p>
              </div>
            </div>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>

<script>
import store from "@/store";
import ConversationType from "@/wfc/model/conversationType";

export default {
  name: "FileRecordPage",
  data() {
    return {
      showMyFileRecrods: false,
      sharedConversationState: store.state.conversation,
    }
  },
  methods: {
    conversationInfoKey(conversationInfo) {
      let conv = conversationInfo.conversation;
      return conv.target + '-' + conv.type + '-' + conv.line;
    },
    conversationTitle(info) {
      if (info.conversation.type === ConversationType.Single) {
        return info.conversation._target.displayName;
      } else {
        return info.conversation._target.name;
      }
    },
    showMyFiles() {
      this.showMyFileRecrods = true;
    },
    showConversations() {
      this.showMyFileRecrods = false;
      // TODO

    }
  }
}
</script>

<style scoped>

.file-record-page {
  padding-top: 25px;
  display: flex;
  flex-direction: column;
  height: 100%;
  width: calc(100% - 70px);
  background-color: #f7f7f7;
}

.file-record-page .title {
  padding-left: 20px;
  height: 40px;
}

.file-record-page .file-record-container {
  flex: 1;
  height: calc(100% - 40px);
  display: flex;
  flex-direction: row;
}

.file-record-container .category-container {
  width: 120px;
  height: 100%;
}

.category-item {
  display: flex;
  flex-direction: row;
  padding: 5px 0 5px 20px;
  height: 40px;
  align-items: center;
}

.category-item:active {
  background-color: #dedede;
}

.category-item p {
  margin-left: 10px;
  font-size: 14px;
  flex: 1;
}

.conversation-list-container {
  border-left: 1px solid #e4e4e4;
  width: 240px;
  height: 100%;
  overflow: auto;
}

.conversation-item {
  height: 50px;
  width: 100%;
  display: flex;
  align-items: center;
}

.conversation-item img {
  width: 36px;
  height: 36px;
  margin: 8px 16px;
  min-width: 36px;
  min-height: 36px;
}

.conversation-item p {
  flex: 1;
  font-size: 14px;
  margin-right: 16px;
}

.conversation-item:active {
  background-color: #dedede;
}


.file-record-container .file-record-list-container {
  flex: 1;
  height: 100%;
  background-color: white;
  overflow: auto;
}

.file-record-item {
  height: 50px;
  display: flex;
  margin: 0 35px 0 35px;
  border-bottom: 1px solid #f2f2f2;
  align-items: center;
  justify-content: space-between;
}

.file-record-item img {
  width: 40px;
  height: 40px;
  margin: 0 15px 0 0;
}

.file-name-sender-container {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  max-width: calc(100% - 40px - 100px);
  flex: 1;
}

.file-name-sender-container .name {
  font-size: 13px;
  color: #252525;
}

.file-name-sender-container .sender {
  font-size: 12px;
  color: #b6b6b6;
}

.file-date-size-container {
  display: flex;
  align-items: flex-end;
  flex-direction: column;
  width: 100px;
  justify-content: center;
}

.file-date-size-container .date {
  font-size: 12px;
  padding-left: 15px;
  color: #b6b6b6;
}

.file-date-size-container .size {
  font-size: 13px;
  color: #b2b2b2;
}

</style>
