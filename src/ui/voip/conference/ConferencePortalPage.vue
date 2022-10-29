<template>
    <div class="conference-container">
        <h2 class="title">在线会议</h2>
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
                <li v-for="(conferenceInfo, index) in favConferenceInfos"
                    :key="index">
                    <div class="fav-conference" @click="showConferenceInfo(conferenceInfo)">
                        <p class="title single-line">{{ conferenceInfo.conferenceTitle }}</p>
                        <p class="desc">{{ favConferenceDesc(conferenceInfo) }}</p>
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
import conferenceApi from "../../../api/conferenceApi";
import ConferenceInfoView from "./ConferenceInfoView";

export default {
    name: "ConferencePortalPage",
    data() {
        return {
            favConferenceInfos: [],
        }
    },
    mounted() {
        this.loadFavConferences();
    },
    methods: {
        loadFavConferences() {
            conferenceApi.getFavConferences()
                .then(favConferenceInfos => {
                    this.favConferenceInfos = favConferenceInfos;
                })
                .catch(err => {
                    console.log('getFavConferences error', err)
                });
        },
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
                    height: 300,
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
                this.loadFavConferences();
            };
            this.$modal.show(
                CreateConferenceView,
                {}, {
                    name: 'create-conference-modal',
                    width: 320,
                    height: 500,
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
                this.loadFavConferences();
            };
            this.$modal.show(
                OrderConferenceView,
                {}, {
                    name: 'order-conference-modal',
                    width: 320,
                    height: 500,
                    clickToClose: true,
                }, {
                    'before-open': beforeOpen,
                    'before-close': beforeClose,
                    'closed': closed,
                })

        },
        showConferenceInfo(info) {
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
                ConferenceInfoView,
                {
                    conferenceInfo: info,
                }, {
                    name: 'conference-info-modal',
                    width: 320,
                    height: 580,
                    clickToClose: true,
                }, {
                    'before-open': beforeOpen,
                    'before-close': beforeClose,
                    'closed': closed,
                })
        },
        favConferenceDesc(conferenceInfo) {
            let start = new Date(conferenceInfo.startTime * 1000).getTime();
            let end = new Date(conferenceInfo.endTime * 1000).getTime();
            let now = new Date().getTime();
            if (now < start) {
                return '会议尚未开始';
            } else if (start < end) {
                return '会议已开始，请尽快加入';
            } else {
                return '会议已结束';
            }
        }
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

.conference-container > .title {
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

.fav-conference {
    border-bottom: 1px solid #f1f1f1;
    padding: 5px 0;
}

.fav-conference .title {

}

.fav-conference .desc {
    color: gray;
    font-size: 12px;
}

</style>
