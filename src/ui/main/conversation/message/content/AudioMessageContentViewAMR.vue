<template>
    <div :style="{display: 'flex', flexDirection: 'column', alignItems: message.direction === 0 ?  'end' : 'start'}">
        <div ref="container" class="audio-message-container" :style="widthStyle" @click="playVoice">
            <p v-if="message.direction === 0" class="duration">{{ duration }}"</p>
            <div class="volume-container">
                <i v-show="!message._isPlaying" class="icon-ion-android-volume-up"></i>
                <ScaleLoader v-if="message._isPlaying" :color="'#d2d2d2'" :height="'15px'" :width="'3px'"/>
            </div>
            <!--        <div class="dot"></div>-->
            <p v-if="message.direction === 1" class="duration">{{ duration }}"</p>
        </div>
        <ScaleLoader v-if="!message.messageContent._speechText && message.messageContent._speechToTextInProgress" :color="'#d2d2d2'" :height="'15px'" :width="'3px'" style="margin: 8px 10px"/>
        <p v-if="message.messageContent._speechText" class="speechText">{{ message.messageContent._speechText }}</p>
    </div>
</template>

<script>
import Message from "../../../../../wfc/messages/message";
import ScaleLoader from 'vue-spinner/src/ScaleLoader'
import store from "../../../../../store";

export default {
    name: "AudioMessageContentView",
    props: {
        message: {
            type: Message,
            required: true,
        },

        data() {
            return {}
        },

        widthStyle() {
            return {
                width: '10px',
            }
        },
    },
    mounted() {
        if (this.duration) {
            let width = Math.ceil(this.duration / 60 * 300);
            width = width < 70 ? 70 : width;
            this.$refs.container.style.setProperty('--voice-width', width + 'px')
        }
    },
    methods: {
        playVoice() {
            if (this.message._isPlaying) {
                store.playVoice(null)
            } else {
                // make message._isPlaying reactive
                this.$set(this.message, '_isPlaying', true)
                store.playVoice(this.message)
            }
        },
    },

    computed: {
        duration() {
            let voice = this.message.messageContent;
            let times = voice.duration * 1000;
            let seconds = 0;

            if (times <= 60 * 1000) {
                seconds = Math.ceil(times / 1000);
            } else {
                seconds = 60;
            }
            return seconds;
        },
    },
    components: {
        ScaleLoader
    }
}
</script>

<style lang="css" scoped>

.audio-message-container {
    margin: 0 10px;
    display: flex;
    align-items: center;
    --voice-width: 200px;
    justify-content: flex-start;
}

.audio-message-container audio {
    outline: none;
    filter: sepia(20%) saturate(70%) grayscale(1) contrast(99%) invert(12%);
}

.volume-container {
    display: flex;
    height: 40px;
    width: var(--voice-width);
    min-width: 55px;
    background: white;
    border-radius: 5px;
    padding: 5px 10px;
    align-items: center;
}

.volume-container i {
    color: #888888;
}

.volume-container div {
    margin-top: 5px;
}

.duration {
    color: #b2b2b2;
    padding: 8px;
}

.speechText {
    color: #888888;
    margin: 8px 10px;
    padding: 8px 4px 8px 8px;
    font-size: 13px;
    background-color: #e9e9e9;
    border-radius: 5px;
}

</style>
