import wfc from "../client/wfc";
import ConversationType from "../model/conversationType";
import Conversation from "../model/conversation";
import FileMessageContent from "../messages/fileMessageContent";
import Config from "../../config";

const _log = console.log
const _warn = console.warn
const _error = console.error

let logs = []
const MAX_CACHE_LOG_COUNT = 1024;
const ENABLE_AUTO_FLUSH = false;

console.log = (message, ...optionalParams) => {
    let msg = new Date().toLocaleString() + ' '
    msg += JSON.stringify(message)
    if (optionalParams) {
        for (const p of optionalParams) {
            try {
                msg += ' ' + JSON.stringify(p)
            } catch (e) {
                _error(e);
            }
        }
    }

    logs.push(msg)
    if (logs.length > MAX_CACHE_LOG_COUNT) {
        if (ENABLE_AUTO_FLUSH) {
            flush();
        } else {
            logs.shift()
        }
    }
    _log(message, ...optionalParams)
}

console.error = console.log
console.warn = console.log

export function flush() {
    let conversation = new Conversation(ConversationType.Single, Config.FILE_HELPER_ID, 0);
    sendLogFile(conversation);
}

function sendLogFile(conversation) {
    if (!logs.length) {
        return
    }

    let message = ''
    for (const log of logs) {
        message += log
        message += '\n'
    }
    logs.length = 0

    let blob = new Blob([message], {type: 'text/plain'});
    let file = new File([blob], wfc.getUserId() + '-' + new Date().getTime() + ".log", {type: "text/plain"});

    let fileMsg = new FileMessageContent(file, '', file.name, file.size)
    wfc.sendConversationMessage(conversation, fileMsg);
}
