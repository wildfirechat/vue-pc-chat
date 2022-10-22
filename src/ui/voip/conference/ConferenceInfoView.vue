<template>
    <div class="conference-info-container">
        <h2>会议详情</h2>
        <div class="item-container">
            <div class="item">
                <p class="title">会议主题</p>
                <p class="desc">xxx 的会议</p>
            </div>
            <div class="item">
                <p class="title"> 发起人</p>
                <p class="desc">xxx</p>
            </div>
            <div class="item">
                <p class="title">会议号</p>
                <p class="desc">xxx</p>
            </div>
            <div class="item">
                <p class="title">二维码</p>
                <i>&gt;</i>
            </div>
        </div>
        <div class="item-container">
            <div class="item">
                <p class="title">开始时间</p>
                <p class="desc">2022-10-22 10:00</p>
            </div>
            <div class="item">
                <p class="title">结束时间</p>
                <p class="desc">2022-10-22 11:00</p>
            </div>
        </div>
        <div class="item-container">
            <div class="item">
                <label>
                    开启视频
                    <input type="checkbox">
                </label>
            </div>
            <div class="item">
                <label>
                    开启音频
                    <input type="checkbox">
                </label>
            </div>
        </div>

        <div class="action-button">
            加入会议
        </div>
    </div>
</template>

<script>
export default {
    name: "ConferenceInfoView",
    data() {
        return {
            conferenceInfo: null,
            muteVideo: false,
            muteAudio: false,
        }
    }
}
</script>

<style scoped>

.conference-info-container {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    background: #f8f8f8;
}

.conference-info-container h2 {
    justify-content: center;
    font-weight: normal;
    font-style: normal;
    font-size: 18px;
    background: white;
    text-align: center;
    padding: 20px 0;
}

.item-container {
    background: white;
    margin-bottom: 20px;
}

.item {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    padding: 15px 20px;
    border-spacing: 20px;
}


/*.item:active {*/
/*    background: #d6d6d6;*/
/*}*/

.item:not(:last-of-type) {
    border-bottom: 1px solid #f1f1f1;
}

.item .desc {
    color: gray;
}

.item label {
    width: 100%;
    display: flex;
    justify-content: space-between;
}

.action-button {
    background: white;
    width: 100%;
    text-align: center;
    vertical-align: middle;
    height: 50px;
    line-height: 50px;
}

.action-button:active {
    background: lightgrey;
}

</style>
