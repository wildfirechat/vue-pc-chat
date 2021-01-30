<template>
  <section class="file-record-page">
    <h2 class="title">文件记录</h2>
    <div class="file-record-container">

      <div class="category-container">
        <!--      我的-->
        <!--      聊天-->
        <ul>
          <li>
            <div class="category-item" v-bind:class="{active:showMyFileRecords}" @click="showMyFiles">
              <i class="icon-ion-folder"></i>
              <p>我的</p>
            </div>
          </li>
          <li>
            <div class="category-item" v-bind:class="{active:!showMyFileRecords}" @click="showConversations">
              <i class="icon-ion-ios-chatboxes"></i>
              <p>聊天</p>
            </div>
          </li>
        </ul>

      </div>
      <div v-if="!showMyFileRecords" class="conversation-list-container">
        <!--      聊天列表-->
        <ul>
          <li v-for="conversationInfo in sharedConversationState.conversationInfoList"
              @click="getConversationFileRecords(conversationInfo.conversation)"
              :key="conversationInfoKey(conversationInfo)">
            <div class="conversation-item"
                 v-bind:class="{active:currentConversation && currentConversation.equal(conversationInfo.conversation)}">
              <img :src="conversationInfo.conversation._target.portrait" alt="">
              <p class="single-line">{{ conversationInfo.conversation._target._displayName }}</p>
            </div>
          </li>
        </ul>
      </div>
      <div class="file-record-list-container" infinite-wrapper>
        <!--      文件记录-->
        <div v-if="fileRecords.length > 0">
          <ul>
            <li v-for="fr in fileRecords"
                :key="fr.messageUid.toString()">
              <div class="file-record-item" @click="clickFile(fr)">
                <img :src="require(`@/assets/images/filetypes/${fr._fileIconName}`)" alt="">
                <div class="file-name-sender-container">
                  <p class="name single-line"> {{ fr.name }}</p>
                  <p class="sender single-line">{{ fr._userDisplayName + ' | ' + fr._conversationDisplayName }}</p>
                </div>
                <div class="file-date-size-container">
                  <p class="date single-line">{{ fr._timeStr }}</p>
                  <p class="size single-line">{{ fr._sizeStr }}</p>
                </div>
              </div>
            </li>
          </ul>
          <infinite-loading :identifier="loadingIdentifier" force-use-infinite-wrapper direction="bottom"
                            @infinite="infiniteHandler">
            <!--            <template slot="spinner">加载中...</template>-->
            <template slot="no-more">没有更多文件</template>
            <template slot="no-results">已加载全部文件 :(</template>
          </infinite-loading>
        </div>
        <div v-else class="file-record-empty-container">没有文件记录</div>
      </div>
    </div>
  </section>
</template>

<script>
import store from "@/store";
import ConversationType from "@/wfc/model/conversationType";
import InfiniteLoading from "vue-infinite-loading";
import {ipcRenderer, isElectron} from "@/platform";

export default {
  name: "FileRecordPage",
  data() {
    return {
      showMyFileRecords: true,
      currentConversation: null,
      sharedConversationState: store.state.conversation,
      fileRecords: [],
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
      if (this.showMyFileRecords) {
        return;
      }
      this.showMyFileRecords = true;
      this.fileRecords = [];
      this.getMyFileRecords();
    },

    showConversations() {
      if (!this.showMyFileRecords) {
        return;
      }
      this.showMyFileRecords = false;
      this.fileRecords = [];
      if (this.currentConversation) {
        this.getConversationFileRecords(this.currentConversation, true)
      }
    },

    getMyFileRecords() {
      store.getMyFileRecords(0, 20, fileRecords => {
        this.fileRecords = this.fileRecords.concat(fileRecords);

      }, err => {
        // TODO

      })
    },

    getConversationFileRecords(conversation, force = false) {
      if (!force && this.currentConversation && this.currentConversation.equal(conversation)) {
        return;
      }
      this.currentConversation = conversation;
      this.fileRecords = [];
      store.getConversationFileRecords(conversation, 0, 20, fileRecords => {
        this.fileRecords = this.fileRecords.concat(fileRecords);
      }, err => {
        // TODO
      })
    },

    infiniteHandler($state) {
      let lastMessageUid = this.fileRecords.length > 0 ? this.fileRecords[this.fileRecords.length - 1].messageUid : 0;
      console.log('to load more file records', $state, lastMessageUid.toString());
      let successCB = (fileRecords) => {
        if (fileRecords.length === 0) {
          console.log('load file records complete')
          $state.complete();
          return;
        }
        this.fileRecords = this.fileRecords.concat(fileRecords);
        $state.loaded();
      };
      let failCB = (err) => {
        $state.complete()
        console.log('getMyFileRecords error', err)
      };
      if (this.showMyFileRecords) {
        store.getMyFileRecords(lastMessageUid, 20, successCB, failCB);
      } else if (this.currentConversation) {
        store.getConversationFileRecords(this.currentConversation, lastMessageUid, 20, successCB, failCB)
      }
    },

    clickFile(fileRecord) {
      if (isElectron()) {
        ipcRenderer.send('file-download', {
          // TODO -1时，不通知进度
          messageId: -1,
          remotePath: fileRecord.url,
          fileName: fileRecord.name,
        });
      }
    }
  },

  computed: {
    loadingIdentifier() {
      if (this.showMyFileRecords) {
        return 'my-fileRecords';
      } else {
        return this.currentConversation.type + '-' + this.currentConversation.target + '-' + this.currentConversation.line;
      }
    }
  },

  mounted() {
    this.getMyFileRecords();
  },

  components: {
    InfiniteLoading,
  }
}
</script>

<style scoped>

.file-record-page {
  padding-top: 10px;
  display: flex;
  flex-direction: column;
  height: 100%;
  flex: 1;
  width: calc(100% - 68px);
  background-color: #f7f7f7;
}

.file-record-page .title {
  padding-left: 20px;
  height: 40px;
  font-weight: normal;
  font-style: normal;
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

.category-item.active {
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

.conversation-item.active {
  background-color: #dedede;
}

.file-record-container .file-record-list-container {
  flex: 1;
  height: 100%;
  background-color: white;
  overflow: auto;
}

.file-record-empty-container {
  height: 100%;
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  color: #b6b6b6;
}


.file-record-item {
  height: 70px;
  display: flex;
  padding: 0 35px 0 35px;
  border-bottom: 1px solid #f2f2f2;
  align-items: center;
  justify-content: space-between;
}

.file-record-item:active {
  background-color: #dedede;
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
  padding-bottom: 3px;
}

.file-name-sender-container .sender {
  padding-top: 3px;
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
  padding-bottom: 3px;
}

.file-date-size-container .size {
  font-size: 12px;
  color: #b2b2b2;
  padding-top: 3px;
}

</style>
