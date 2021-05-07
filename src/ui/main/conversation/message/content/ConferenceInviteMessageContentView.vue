<template>
    <div class="conference-invite-message-container"
         v-bind:class="{out:message.direction === 0}">
        <p class="text" v-html="this.textContent"></p>
    </div>
</template>

<script>
import Message from "@/wfc/messages/message";
import {parser as emojiParse} from "@/ui/util/emoji";

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

    computed: {
        textContent() {
            let conferenceInviteMessageContent = this.message.messageContent;
            return emojiParse(this.message.messageContent.digest(this.message))
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
