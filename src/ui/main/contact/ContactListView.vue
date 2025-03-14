<template>
    <section class="contact-list">
        <ul>
            <li>
                <div @click="showNewFriends" class="category-item-container">
                    <i class="arrow right" v-bind:class="{down: sharedContactState.expandFriendRequestList}"></i>
                    <div class="category-item">
                        <div>
                            <span class="title">{{ $t('contact.new_friend') }}</span>
                            <span class="tip">(上方搜索框，添加好友)</span>
                        </div>
                        <span class="desc" v-if="sharedContactState.unreadFriendRequestCount === 0">{{ sharedContactState.unreadFriendRequestCount }}</span>
                    </div>
                </div>
                <NewFriendListView v-if="sharedContactState.expandFriendRequestList"/>
            </li>
            <li>
                <div @click="showGroups" class="category-item-container">
                    <i class="arrow right" v-bind:class="{down: sharedContactState.expandGroup}"></i>
                    <div class="category-item">
                        <div>
                            <span class="title">{{ $t('contact.group') }}</span>
                            <span class="tip">(保存在通讯录的群组)</span>
                        </div>
                        <span class="desc">{{ sharedContactState.favGroupList.length }}</span>
                    </div>
                </div>
                <GroupListVue v-if="sharedContactState.expandGroup"/>
            </li>
            <li>
                <div @click="showChannels" class="category-item-container">
                    <i class="arrow right" v-bind:class="{down: sharedContactState.expandChanel}"></i>
                    <div class="category-item">
                        <span class="title">{{ $t('contact.channel') }}</span>
                        <span class="desc">{{ sharedContactState.channelList.length }}</span>
                    </div>
                </div>
                <ChannelListView v-if="sharedContactState.expandChanel"/>
            </li>
            <li>
                <div @click="showOrganization" class="category-item-container">
                    <i class="arrow right" v-bind:class="{down: sharedContactState.expandOrganization}"></i>
                    <div class="category-item">
                        <span class="title">组织结构</span>
                        <span class="desc"></span>
                    </div>
                </div>
                <OrganizationListView v-if="sharedContactState.expandOrganization"/>
            </li>
            <li v-if="sharedContactState.isEnableMesh">
                <div @click="showExternalDomains" class="category-item-container">
                    <i class="arrow right" v-bind:class="{down: sharedContactState.expandExternalDomain}"></i>
                    <div class="category-item">
                        <span class="title">外部单位</span>
                        <span class="desc"></span>
                    </div>
                </div>
                <ExternalDomainListView v-if="sharedContactState.expandExternalDomain"/>
            </li>
            <li>
                <div @click="showChatroom" class="category-item-container">
                    <i class="arrow right" v-bind:class="{down: sharedContactState.expandChatroom}"></i>
                    <div class="category-item">
                        <div>
                            <span class="title">聊天室</span>
                            <span class="tip">(野火官方测试聊天室)</span>
                        </div>
                    </div>
                </div>
                <ChatroomListView v-if="sharedContactState.expandChatroom"/>
            </li>
            <li>
                <div @click="showContacts" class="category-item-container">
                    <i class="arrow right" v-bind:class="{down: sharedContactState.expandFriendList}"></i>
                    <div class="category-item">
                        <span class="title">{{ $t('contact.contact') }}</span>
                        <span class="desc">{{ sharedContactState.friendList.length }}</span>
                    </div>
                </div>
                <UserListView
                    v-if="sharedContactState.expandFriendList && users.length < 100 && false"
                    :enable-pick="false"
                    :users="users"
                    :click-user-item-func="setCurrentUser"
                    :padding-left="'30px'"
                    :enable-contact-context-menu="true"
                />
                <virtual-list
                    v-else-if="sharedContactState.expandFriendList"
                    :data-component="contactItemView" :data-sources="groupedContacts" :data-key="'uid'"
                    :estimate-size="30"
                    style="max-height: 700px; overflow-y: auto"/>

                <vue-context ref="menu" v-slot="{data:userInfo}" v-on:close="onContactContextMenuClose">
                    <li>
                        <a @click.prevent="sendMessage(userInfo)">{{
                                $t('message.send_message')
                            }}</a>
                    </li>
                    <li>
                        <a @click.prevent="sendUserCard(userInfo)">{{
                                $t('misc.share_to_friend')
                            }}</a>
                    </li>
                </vue-context>
            </li>
        </ul>
    </section>
</template>
<script>
import FriendRequestListView from "../../main/contact/FriendRequestListView";
import GroupListVue from "../../main/contact/GroupListView";
import store from "../../../store";
import UserListView from "../user/UserListView.vue";
import ChannelListView from "./ChannelListView";
import ContactItemView from "./ContactItemView";
import OrganizationListView from "./OrganizationListView.vue";
import Conversation from "../../../wfc/model/conversation";
import ConversationType from "../../../wfc/model/conversationType";
import ForwardType from "../conversation/message/forward/ForwardType";
import CardMessageContent from "../../../wfc/messages/cardMessageContent";
import wfc from "../../../wfc/client/wfc";
import Message from "../../../wfc/messages/message";
import ChatroomListView from "./ChatroomListView.vue";
import {markRaw} from "vue";
import ExternalDomainListView from "./ExternalDomainListView.vue";

export default {
    name: "ContactListView",
    components: {
        ExternalDomainListView,
        ChatroomListView,
        OrganizationListView,
        ChannelListView,
        UserListView,
        GroupListVue,
        NewFriendListView: FriendRequestListView
    },
    data() {
        return {
            sharedContactState: store.state.contact,
            contactItemView: markRaw(ContactItemView),
            rootOrganizations: [],
        }
    },
    created() {
        this.$eventBus.$on('showContactContextMenu', ([event, userInfo]) => {
            this.showContactContextMenu(event, userInfo);
        });
    },
    unmounted() {
        this.$eventBus.$off('showContactContextMenu');
    },
    methods: {
        setCurrentUser(userInfo) {
            store.setCurrentFriend(userInfo)
        },
        showNewFriends() {
            store.toggleFriendRequestList();
        },
        showGroups() {
            store.toggleGroupList();
        },
        showChannels() {
            store.toggleChannelList();
        },
        showContacts() {
            store.toggleFriendList();
        },
        showOrganization() {
            store.toggleOrganizationList();
        },
        showExternalDomains() {
            store.toggleExternalDomainList();
        },
        showChatroom() {
            store.toggleChatroom();
        },
        sendMessage(userInfo) {
            let conversation = new Conversation(ConversationType.Single, userInfo.uid, 0);
            store.setCurrentConversation(conversation);
            this.$router.replace('/home');
        },
        sendUserCard(userInfo) {
            let userCardMessageContent = new CardMessageContent(0, userInfo.uid, userInfo.displayName, userInfo.portrait, wfc.getUserId());
            userCardMessageContent.name = userInfo.name;
            let message = new Message(null, userCardMessageContent);

            return this.$forwardMessage({
                forwardType: ForwardType.NORMAL,
                messages: [message],
            });
        },

        showContactContextMenu(event, userInfo) {
            if (!this.$refs.menu) {
                return;
            }
            console.log('showContactContextMenu')
            this.sharedContactState.contextMenuUserInfo = userInfo;
            this.$refs.menu.open(event, userInfo)
        },
        onContactContextMenuClose() {
            this.sharedContactState.contextMenuUserInfo = null;
        }
    },
    computed: {
        groupedContacts() {
            let groupedUsers = [];
            let currentCategory = {};
            let lastCategory = null;
            this.users.forEach((user) => {
                if (!lastCategory || lastCategory !== user._category) {
                    lastCategory = user._category;
                    currentCategory = {
                        type: 'category',
                        category: user._category,
                        uid: user._category,
                    };
                    groupedUsers.push(currentCategory);
                    groupedUsers.push(user);
                } else {
                    groupedUsers.push(user);
                }
            });
            return groupedUsers;
        },

        users() {
            return store.state.contact.favContactList.concat(store.state.contact.friendList);
        },
    }
}
</script>

<style lang="css" scoped>

.contact-list {
    height: 100%;
    overflow: auto;
}

.contact-list::-webkit-scrollbar {
    width: 0;
}

.category-item-container {
    height: 40px;
    display: flex;
    align-items: center;
    padding-left: 15px;
    color: #262626;
    font-size: 14px;
    position: sticky;
    background-color: #fafafa;
    top: 0;
}

.category-item {
    display: flex;
    width: 100%;
    justify-content: space-between;
}

.category-item span:last-of-type {
    margin-right: 15px;
}

.category-item .tip {
    font-size: 12px;
    padding-left: 5px;
    color: #7f7f7f;
}

.arrow {
    border: solid #b9b9b9;
    border-width: 0 1px 1px 0;
    display: inline-block;
    padding: 3px;
    margin-right: 10px;
}

.right {
    transform: rotate(-45deg);
    -webkit-transform: rotate(-45deg);
}

.left {
    transform: rotate(135deg);
    -webkit-transform: rotate(135deg);
}

.up {
    transform: rotate(-135deg);
    -webkit-transform: rotate(-135deg);
}

.down {
    transform: rotate(45deg);
    -webkit-transform: rotate(45deg);
}

</style>
