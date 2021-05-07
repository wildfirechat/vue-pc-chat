<template>
    <div class="conference-invite-message-container"
         @click="joinConference"
         v-bind:class="{out:message.direction === 0}">
        <p class="text" v-html="this.textContent"></p>
    </div>
</template>

<script>
import Message from "@/wfc/messages/message";
import avenginekitproxy from "../../../../../wfc/av/engine/avenginekitproxy";

export default {
    name: "ConferenceInviteMessageContentView",
    props: {
        message: {
            type: Message,
            required: true,
        }
    },
    mounted() {
    },

    methods: {
        joinConference() {
            let cmc = this.message.messageContent;
            avenginekitproxy.joinConference(cmc.callId, cmc.audioOnly, cmc.pin, cmc.host, cmc.title, cmc.desc, cmc.audience, cmc.advance)
        }
    },

    computed: {
        textContent() {
            let conferenceInviteMessageContent = this.message.messageContent;
            return '会议邀请' + ' ' + conferenceInviteMessageContent.title + ' ' + conferenceInviteMessageContent.desc;
        }
    }
}
</script>

<style lang="css" scoped>
.conference-invite-message-container {
    margin: 0 10px;
    padding: 10px;
    background-color: white;
    position: relative;
    border-radius: 5px;
}

.conference-invite-message-container p {
    user-select: text;
    white-space: pre-line;
}

.conference-invite-message-container.out {
    background-color: #98ea70;
}


.conference-invite-message-container .text {
    color: #050505;
    font-size: 16px;
}

</style>
