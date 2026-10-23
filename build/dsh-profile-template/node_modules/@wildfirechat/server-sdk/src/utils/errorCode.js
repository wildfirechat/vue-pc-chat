/**
 * 错误码枚举
 * 
 * 定义了野火IM服务器API返回的所有错误码。
 */

const ErrorCode = {
    // 成功
    ERROR_CODE_SUCCESS: 0,

    // 一般错误
    ERROR_CODE_INTERNAL_ERROR: 1,
    ERROR_CODE_FUNCTION_NOT_IMPLEMENTED: 2,

    // 用户相关错误
    ERROR_CODE_USER_NOT_EXIST: 3,
    ERROR_CODE_USER_ALREADY_EXIST: 4,
    ERROR_CODE_USER_PASSWORD_ERROR: 5,
    ERROR_CODE_USER_BLOCKED: 6,
    ERROR_CODE_USER_FORBIDDEN: 7,
    ERROR_CODE_USER_NOT_ACTIVE: 8,
    ERROR_CODE_USER_NAME_ALREADY_EXIST: 9,
    ERROR_CODE_USER_PHONE_ALREADY_EXIST: 10,
    ERROR_CODE_USER_EMAIL_ALREADY_EXIST: 11,

    // 群组相关错误
    ERROR_CODE_GROUP_NOT_EXIST: 12,
    ERROR_CODE_GROUP_ALREADY_EXIST: 13,
    ERROR_CODE_GROUP_MEMBER_FULL: 14,
    ERROR_CODE_GROUP_MEMBER_ALREADY_EXIST: 15,
    ERROR_CODE_GROUP_MEMBER_NOT_EXIST: 16,
    ERROR_CODE_NOT_IN_GROUP: 17,
    ERROR_CODE_INVALID_PARAMETER: 18,
    ERROR_CODE_GROUP_TOO_MANY: 19,

    // 消息相关错误
    ERROR_CODE_MESSAGE_NOT_EXIST: 20,
    ERROR_CODE_MESSAGE_CONTENT_INVALID: 21,

    // 权限相关错误
    ERROR_CODE_NOT_AUTHORIZED: 22,
    ERROR_CODE_INVALID_AUTH_TOKEN: 23,
    ERROR_CODE_AUTH_TOKEN_EXPIRED: 24,
    ERROR_CODE_NOT_ADMIN: 25,
    ERROR_CODE_GROUP_MEMBER_FORBIDDEN: 26,
    ERROR_CODE_GROUP_OWNER_CANNOT_QUIT: 27,

    // 好友相关错误
    ERROR_CODE_FRIEND_NOT_EXIST: 28,
    ERROR_CODE_FRIEND_ALREADY_EXIST: 29,
    ERROR_CODE_FRIEND_REQUEST_NOT_EXIST: 30,

    // 其他错误
    ERROR_CODE_CONVERSATION_NOT_EXIST: 31,
    ERROR_CODE_DEVICE_NOT_EXIST: 32,
    ERROR_CODE_ROBOT_NOT_EXIST: 33,
    ERROR_CODE_CHANNEL_NOT_EXIST: 34,
    ERROR_CODE_CHANNEL_ALREADY_EXIST: 35,
    ERROR_CODE_CHANNEL_NOT_SUBSCRIBED: 36,
    ERROR_CODE_CHATROOM_NOT_EXIST: 37,
    ERROR_CODE_CHATROOM_MEMBER_ALREADY_EXIST: 38,
    ERROR_CODE_CHATROOM_MEMBER_NOT_EXIST: 39,
    ERROR_CODE_USER_IN_CHATROOM: 40,
    ERROR_CODE_USER_NOT_IN_CHATROOM: 41,

    // 认证相关
    ERROR_CODE_AUTH_FAILURE: 238,
    ERROR_CODE_SIGN_EXPIRED: 239,

    // 根据错误码获取错误信息
    getErrorMessage(code) {
        const messages = {
            0: '成功',
            1: '内部错误',
            2: '功能未实现',
            3: '用户不存在',
            4: '用户已存在',
            5: '密码错误',
            6: '用户被封禁',
            7: '用户被禁止',
            8: '用户未激活',
            9: '用户名已存在',
            10: '手机号已存在',
            11: '邮箱已存在',
            12: '群组不存在',
            13: '群组已存在',
            14: '群成员已满',
            15: '群成员已存在',
            16: '群成员不存在',
            17: '不在群组中',
            18: '无效参数',
            19: '群组数量过多',
            20: '消息不存在',
            21: '消息内容无效',
            22: '未授权',
            23: '无效的认证令牌',
            24: '认证令牌已过期',
            25: '不是管理员',
            26: '群成员被禁止',
            27: '群主不能退出群组',
            28: '好友不存在',
            29: '好友已存在',
            30: '好友请求不存在',
            31: '会话不存在',
            32: '设备不存在',
            33: '机器人不存在',
            34: '频道不存在',
            35: '频道已存在',
            36: '未订阅频道',
            37: '聊天室不存在',
            38: '聊天室成员已存在',
            39: '聊天室成员不存在',
            40: '用户已在聊天室中',
            41: '用户不在聊天室中',
            238: '认证失败',
            239: '签名过期',
        };
        return messages[code] || `未知错误(${code})`;
    },

    // 根据错误码获取错误码常量名
    fromCode(code) {
        const codes = {
            0: 'ERROR_CODE_SUCCESS',
            1: 'ERROR_CODE_INTERNAL_ERROR',
            2: 'ERROR_CODE_FUNCTION_NOT_IMPLEMENTED',
            3: 'ERROR_CODE_USER_NOT_EXIST',
            4: 'ERROR_CODE_USER_ALREADY_EXIST',
            5: 'ERROR_CODE_USER_PASSWORD_ERROR',
            6: 'ERROR_CODE_USER_BLOCKED',
            7: 'ERROR_CODE_USER_FORBIDDEN',
            8: 'ERROR_CODE_USER_NOT_ACTIVE',
            9: 'ERROR_CODE_USER_NAME_ALREADY_EXIST',
            10: 'ERROR_CODE_USER_PHONE_ALREADY_EXIST',
            11: 'ERROR_CODE_USER_EMAIL_ALREADY_EXIST',
            12: 'ERROR_CODE_GROUP_NOT_EXIST',
            13: 'ERROR_CODE_GROUP_ALREADY_EXIST',
            14: 'ERROR_CODE_GROUP_MEMBER_FULL',
            15: 'ERROR_CODE_GROUP_MEMBER_ALREADY_EXIST',
            16: 'ERROR_CODE_GROUP_MEMBER_NOT_EXIST',
            17: 'ERROR_CODE_NOT_IN_GROUP',
            18: 'ERROR_CODE_INVALID_PARAMETER',
            19: 'ERROR_CODE_GROUP_TOO_MANY',
            20: 'ERROR_CODE_MESSAGE_NOT_EXIST',
            21: 'ERROR_CODE_MESSAGE_CONTENT_INVALID',
            22: 'ERROR_CODE_NOT_AUTHORIZED',
            23: 'ERROR_CODE_INVALID_AUTH_TOKEN',
            24: 'ERROR_CODE_AUTH_TOKEN_EXPIRED',
            25: 'ERROR_CODE_NOT_ADMIN',
            26: 'ERROR_CODE_GROUP_MEMBER_FORBIDDEN',
            27: 'ERROR_CODE_GROUP_OWNER_CANNOT_QUIT',
            28: 'ERROR_CODE_FRIEND_NOT_EXIST',
            29: 'ERROR_CODE_FRIEND_ALREADY_EXIST',
            30: 'ERROR_CODE_FRIEND_REQUEST_NOT_EXIST',
            31: 'ERROR_CODE_CONVERSATION_NOT_EXIST',
            32: 'ERROR_CODE_DEVICE_NOT_EXIST',
            33: 'ERROR_CODE_ROBOT_NOT_EXIST',
            34: 'ERROR_CODE_CHANNEL_NOT_EXIST',
            35: 'ERROR_CODE_CHANNEL_ALREADY_EXIST',
            36: 'ERROR_CODE_CHANNEL_NOT_SUBSCRIBED',
            37: 'ERROR_CODE_CHATROOM_NOT_EXIST',
            38: 'ERROR_CODE_CHATROOM_MEMBER_ALREADY_EXIST',
            39: 'ERROR_CODE_CHATROOM_MEMBER_NOT_EXIST',
            40: 'ERROR_CODE_USER_IN_CHATROOM',
            41: 'ERROR_CODE_USER_NOT_IN_CHATROOM',
            238: 'ERROR_CODE_AUTH_FAILURE',
            239: 'ERROR_CODE_SIGN_EXPIRED',
        };
        return codes[code] || 'ERROR_CODE_UNKNOWN';
    }
};

export default ErrorCode;
export { ErrorCode };
