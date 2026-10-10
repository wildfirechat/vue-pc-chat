import Config from "../../config";
import todoAssistantPortrait from "../../assets/images/todo_assistant.png";

// 应用服务生成头像（名字头像、群九宫格）的样式版本，拼在请求地址上。
// 服务端改了画法会给生成的文件换名，但客户端按地址缓存图片，地址不变就一直显示旧图；服务端样式版本升级时这里跟着加一。
// 与 wf-enterprise-chat 的 kGeneratedAvatarVersion 一致
export const GENERATED_AVATAR_VERSION = 3;

// 待办助手：应用服务建的机器人，ID 与服务端 todo.robot.user_id 一致。
// 服务端不给它设头像，没头像时用随包的这张；管理后台给它设了头像就以设的为准
export const TODO_ASSISTANT_ID = 'todo_assistant';
export const TODO_ASSISTANT_PORTRAIT = todoAssistantPortrait;

/** 名字头像地址，名字要转义：带 & 或 # 的名字原样拼进去，后半截会被当成别的参数或锚点丢掉 */
export function generatedAvatarUrl(name) {
    return `${Config.getAppServer()}/avatar?name=${encodeURIComponent(name || '')}&v=${GENERATED_AVATAR_VERSION}`;
}

/** 群九宫格头像地址，request 是 {"members":[{avatarUrl}|{name}]} 的 JSON */
export function generatedGroupAvatarUrl(request) {
    return `${Config.getAppServer()}/avatar/group?request=${encodeURIComponent(request)}&v=${GENERATED_AVATAR_VERSION}`;
}

/** 是不是应用服务生成的头像（主备两个地址都认） */
export function isGeneratedAvatarUrl(url) {
    return !!url && [Config.APP_SERVER, Config.APP_BACKUP_SERVER].some(server => server && url.startsWith(server + '/avatar'));
}
