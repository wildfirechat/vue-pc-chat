<template>
    <div class="conference-container">
        <p class="title">在线会议</p>
        <div class="action-container">
            <div class="action">
                <img :src="require(`@/assets/images/icon.png`)" alt="">
                <p>加入会议</p>
            </div>
            <div class="action">
                <img :src="require(`@/assets/images/icon.png`)" alt="">
                <p>发起会议</p>
            </div>
            <div class="action">
                <img :src="require(`@/assets/images/icon.png`)" alt="">
                <p>预约会议</p>
            </div>
        </div>
        <div class="history-container">
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
export default {
    name: "ConferencePortalPage"
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
    margin-top: 40px;
    font-size: 20px;
}

.action-container {
    display: flex;
    height: 200px;
    justify-content: center;
    padding: 0 80px;
}

.action {
    width: 200px;
    height: 200px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 10px;
}

.action:hover {
    background: lightgrey;
}

.action img {
    width: 80px;
    height: 80px;
}

.history-container {
    width: calc(100% - 200px);
    border-top: 1px red solid;
}

</style>
