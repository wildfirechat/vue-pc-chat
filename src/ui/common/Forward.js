import store from "../../store";
import ForwardMessageByPickConversationView from "../main/conversation/message/forward/ForwardMessageByPickConversationView";
import ForwardMessageByCreateConversationView from "../main/conversation/message/forward/ForwardMessageByCreateConversationView";

export default {
    install(app, options) {
        app.config.globalProperties.$forwardMessage = function (options) {
            // 子窗口里打开时，最近会话、好友列表可能还没加载
            store.ensureForwardPickData();
            const pickConversationAndForwardMessage = (forwardType, messages) => {
                return new Promise(((resolve, reject) => {
                    let beforeClose = (event) => {
                        console.log('Closing...', event, event.params)
                        // What a gamble... 50% chance to cancel closing
                        if (event && event.params && event.params.toCreateConversation) {
                            // Promise.race([createConversationAndForwardMessage(forwardType, messages)])
                            //     .then(resolve)
                            //     .catch(reject);
                            createConversationAndForwardMessage(forwardType, messages).then(resolve).catch(reject)
                        } else if (event.params && event.params.confirm) {
                            let conversations = event.params.conversations;
                            let extraMessageText = event.params.extraMessageText;
                            store.forwardMessage(forwardType, conversations, messages, extraMessageText)
                            resolve();
                        } else {
                            console.log('cancel')
                            resolve();
                        }
                    };

                    const modalWidth = Math.min(760, Math.max(600, window.innerWidth - 80));
                    const modalHeight = Math.min(600, Math.max(480, window.innerHeight - 64));
                    this.$modal.show(
                        ForwardMessageByPickConversationView,
                        {
                            forwardType: forwardType,
                            messages: messages
                        },null, {
                            name: 'forward-by-pick-conversation-modal',
                            width: modalWidth,
                            height: modalHeight,
                            adaptive: true,
                            clickToClose: false,
                        }, {
                            'before-close': beforeClose,
                        })
                }));
            }

            const createConversationAndForwardMessage = (forwardType, messages) => {
                return new Promise(((resolve, reject) => {
                    let beforeClose = (event) => {
                        console.log('Closing...', event, event.params)
                        if (event.params.backPickConversation) {
                            // Promise.race([pickConversationAndForwardMessage(forwardType, messages)])
                            //     .then(resolve)
                            //     .catch(reject);
                            pickConversationAndForwardMessage(forwardType, messages).then(resolve).then(reject)
                        } else if (event.params.confirm) {
                            let users = event.params.users;
                            let extraMessageText = event.params.extraMessageText;
                            store.forwardByCreateConversation(forwardType, users, messages, extraMessageText)
                            resolve();
                        } else {
                            console.log('cancel')
                            reject();
                        }
                    };
                    const modalWidth = Math.min(760, Math.max(600, window.innerWidth - 80));
                    const modalHeight = Math.min(600, Math.max(480, window.innerHeight - 64));
                    this.$modal.show(
                        ForwardMessageByCreateConversationView,
                        {
                            forwardType: forwardType,
                            messages: messages,
                            users: store.state.contact.aiRobotList.concat(store.state.contact.favContactList).concat(store.state.contact.friendList),
                        }, null, {
                            name: 'forward-by-create-conversation-modal',
                            width: modalWidth,
                            height: modalHeight,
                            adaptive: true,
                            clickToClose: false,
                        }, {
                            'before-close': beforeClose,
                        });
                }));
            };
            //return pickConversationAndForwardMessage(ForwardType.NORMAL, [message]);
            return pickConversationAndForwardMessage(options.forwardType, options.messages);
        }
    }
}
