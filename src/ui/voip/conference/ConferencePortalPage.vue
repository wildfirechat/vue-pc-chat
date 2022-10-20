<template>
    <div class="conference-container">
        <p class="title">在线会议</p>
        <div class="action-container">
            <div class="action" @click="joinConference">
                <img :src="require(`@/assets/images/av_join_conference.png`)" alt="">
                <p>加入会议</p>
            </div>
            <div class="action" @click="createConference">
                <img :src="require(`@/assets/images/av_start_conference.png`)" alt="">
                <p>发起会议</p>
            </div>
            <div class="action" @click="orderConference">
                <img :src="require(`@/assets/images/av_book_conference.png`)" alt="">
                <p>预约会议</p>
            </div>
        </div>
        <div class="fav-container">
            <ul>
                <li>
                    <div>
                        <p>xxx 发起的会议</p>
                    </div>
                </li>
                <li>
                    <div>
                        <p>yyy 发起的会议</p>
                    </div>
                </li>
                <li>
                    <div>
                        <p>zzz 发起的会议</p>
                    </div>
                </li>
            </ul>
        </div>
    </div>

</template>

<script>
import CreateConferenceView from "./CreateConferenceView";
import JoinConferenceView from "./JoinConferenceView";
import OrderConferenceView from "./OrderConferenceView";

export default {
    name: "ConferencePortalPage",
    methods: {
        joinConference() {
            let beforeOpen = () => {
                console.log('Opening...')
            };
            let beforeClose = (event) => {
                console.log('Closing...', event, event.params)
            };
            let closed = (event) => {
                console.log('Close...', event)
            };
            this.$modal.show(
                JoinConferenceView,
                {}, {
                    name: 'join-conference-modal',
                    width: 320,
                    height: 330,
                    clickToClose: true,
                }, {
                    'before-open': beforeOpen,
                    'before-close': beforeClose,
                    'closed': closed,
                })
        },
        createConference() {
            let beforeOpen = () => {
                console.log('Opening...')
            };
            let beforeClose = (event) => {
                console.log('Closing...', event, event.params)
            };
            let closed = (event) => {
                console.log('Close...', event)
            };
            this.$modal.show(
                CreateConferenceView,
                {}, {
                    name: 'create-conference-modal',
                    width: 320,
                    height: 480,
                    clickToClose: true,
                }, {
                    'before-open': beforeOpen,
                    'before-close': beforeClose,
                    'closed': closed,
                })
        },
        orderConference() {
            let beforeOpen = () => {
                console.log('Opening...')
            };
            let beforeClose = (event) => {
                console.log('Closing...', event, event.params)
            };
            let closed = (event) => {
                console.log('Close...', event)
            };
            this.$modal.show(
                OrderConferenceView,
                {}, {
                    name: 'order-conference-modal',
                    width: 320,
                    height: 520,
                    clickToClose: true,
                }, {
                    'before-open': beforeOpen,
                    'before-close': beforeClose,
                    'closed': closed,
                })

        },
    }
}
</script>

<style scoped>

.conference-container {
    display: flex;
    flex: 1;
    height: 100%;
    flex-direction: column;
    align-items: center;
}

.title {
    margin-top: 30px;
    font-size: 20px;
}

.action-container {
    display: flex;
    justify-content: center;
    padding: 20px 80px;
}

.action {
    width: 200px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 10px;
}

.action:hover {
    filter: contrast(200%);
}

.action img {
    width: 80px;
    height: 80px;
    border-radius: 10px;
}

.fav-container {
    width: calc(100% - 200px);
    border-top: 1px lightgrey solid;
    padding-top: 10px;
}

</style>
