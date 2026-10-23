/**
 * API路径常量
 * 
 * 定义了野火IM服务器所有管理接口的API路径。
 * 包括聊天室、敏感词、用户、好友、黑名单、消息、群组、会议、频道等模块的接口路径。
 */

const APIPath = {
    // ========== 聊天室相关 ==========
    Create_Chatroom: '/admin/chatroom/create',
    Chatroom_Destroy: '/admin/chatroom/del',
    Chatroom_Info: '/admin/chatroom/info',
    Chatroom_GetMembers: '/admin/chatroom/members',
    Chatroom_GetUserChatroom: '/admin/chatroom/user_chatroom',
    Chatroom_SetBlacklist: '/admin/chatroom/set_black_status',
    Chatroom_GetBlacklist: '/admin/chatroom/get_black_status',
    Chatroom_SetManager: '/admin/chatroom/set_manager',
    Chatroom_GetManagerList: '/admin/chatroom/get_manager_list',
    Chatroom_MuteAll: '/admin/chatroom/mute_all',

    // ========== 敏感词相关 ==========
    Sensitive_Add: '/admin/sensitive/add',
    Sensitive_Del: '/admin/sensitive/del',
    Sensitive_Query: '/admin/sensitive/query',

    // ========== 用户相关 ==========
    Create_User: '/admin/user/create',
    Update_User: '/admin/user/update',
    Destroy_User: '/admin/user/destroy',
    Search_User: '/admin/user/search_user',
    Create_Robot: '/admin/robot/create',
    CreateOrUpdate_Device: '/admin/device/create',
    Get_Device: '/admin/device/get',
    Get_User_Devices: '/admin/device/user_devices',
    User_Get_Token: '/admin/user/get_token',
    User_Update_Block_Status: '/admin/user/update_block_status',
    User_Get_Info: '/admin/user/get_info',
    User_Batch_Get_Infos: '/admin/user/batch_get_infos',
    User_Get_Email_Info: '/admin/user/get_info_by_email',
    User_Get_All: '/admin/user/all',
    User_Get_Robot_Info: '/admin/user/get_robot_info',
    User_Get_User_Robots: '/admin/user/get_user_robots',
    User_Get_Blocked_List: '/admin/user/get_blocked_list',
    User_Check_Block_Status: '/admin/user/check_block_status',
    User_Get_Online_Status: '/admin/user/onlinestatus',
    User_Put_Setting: '/admin/user/put_setting',
    User_Get_Setting: '/admin/user/get_setting',
    User_Kickoff_Client: '/admin/user/kickoff_client',
    User_Online_Count: '/admin/user/online_count',
    User_Online_List: '/admin/user/online_list',
    User_Session_List: '/admin/user/session_list',
    User_Application_Get_UserInfo: '/admin/user/app_get_user_info',

    // ========== 好友/黑名单相关 ==========
    Friend_Update_Status: '/admin/friend/status',
    Friend_Get_List: '/admin/friend/list',
    Blacklist_Update_Status: '/admin/blacklist/status',
    Blacklist_Get_List: '/admin/blacklist/list',
    Friend_Get_Alias: '/admin/friend/get_alias',
    Friend_Set_Alias: '/admin/friend/set_alias',
    Friend_Set_Extra: '/admin/friend/set_extra',
    Friend_Send_Request: '/admin/friend/send_request',
    Friend_Get_Requests: '/admin/friend/get_requests',
    Relation_Get: '/admin/relation/get',
    Handle_Friend_Send_Request: '/admin/friend/handle_send_request',

    // ========== 朋友圈相关 ==========
    Admin_Moments_Post_Feed: '/admin/moments/feed/post',

    // ========== 消息相关 ==========
    Msg_Send: '/admin/message/send',
    Msg_Publish: '/admin/message/publish',
    Msg_Recall: '/admin/message/recall',
    Msg_Delete: '/admin/message/delete',
    Msg_Update: '/admin/message/update',
    Msg_GetOne: '/admin/message/get_one',
    Msg_Broadcast: '/admin/message/broadcast',
    Msg_Multicast: '/admin/message/multicast',
    Msg_RecallBroadCast: '/admin/message/recall_broadcast',
    Msg_RecallMultiCast: '/admin/message/recall_multicast',
    Msg_DeleteBroadCast: '/admin/message/delete_broadcast',
    Msg_DeleteMultiCast: '/admin/message/delete_multicast',
    Msg_ConvRead: '/admin/message/conv_read',
    Msg_Delivery: '/admin/message/delivery',
    Conversation_Delete: '/admin/conversation/delete',
    Msg_Clear_By_User: '/admin/message/clear_by_user',

    // ========== 群组相关 ==========
    Create_Group: '/admin/group/create',
    Group_Dismiss: '/admin/group/del',
    Group_Transfer: '/admin/group/transfer',
    Group_Get_Info: '/admin/group/get_info',
    Group_Batch_Info: '/admin/group/batch_infos',
    Group_Modify_Info: '/admin/group/modify',
    Group_Member_List: '/admin/group/member/list',
    Group_Member_Get: '/admin/group/member/get',
    Group_Member_Add: '/admin/group/member/add',
    Group_Member_Kickoff: '/admin/group/member/del',
    Group_Member_Quit: '/admin/group/member/quit',
    Group_Set_Manager: '/admin/group/manager/set',
    Group_Mute_Member: '/admin/group/manager/mute',
    Group_Allow_Member: '/admin/group/manager/allow',
    Group_Join_Request_Add: '/admin/group/join_request/add',
    Get_User_Groups: '/admin/group/of_user',
    Get_User_Groups_By_Type: '/admin/group/of_user_by_type',
    Group_Set_Member_Alias: '/admin/group/member/set_alias',
    Group_Set_Member_Extra: '/admin/group/member/set_extra',
    Get_Common_Groups: '/admin/group/common_group',

    // ========== Mesh相关 ==========
    Sync_Group: '/admin/mesh/group_sync',
    Conference_User_Request: '/admin/conference/user_request',
    Conference_User_Event: '/admin/conference/user_event',

    // ========== 频道相关 ==========
    Create_Channel: '/admin/channel/create',
    Destroy_Channel: '/admin/channel/destroy',
    Get_Channel_Info: '/admin/channel/get',
    Subscribe_Channel: '/admin/channel/subscribe',
    Check_User_Subscribe_Channel: '/admin/channel/is_subscribed',

    // ========== 系统相关 ==========
    Get_System_Setting: '/admin/system/get_setting',
    Put_System_Setting: '/admin/system/put_setting',
    GET_CUSTOMER: '/admin/customer',
    Health: '/admin/health',

    // ========== 文件相关 ==========
    Get_Conversation_Files: '/admin/file/conversation_files',
    Get_User_Files: '/admin/file/user_files',
    Get_Message_File: '/admin/file/message_file',
    Get_Presigned_Upload_Url: '/admin/oss/get_upload_url',

    // ========== 会议相关 ==========
    Conference_List: '/admin/conference/list',
    Conference_Exist: '/admin/conference/exist',
    Conference_List_Participant: '/admin/conference/list_participant',
    Conference_Create: '/admin/conference/create',
    Conference_Destroy: '/admin/conference/destroy',
    Conference_Recording: '/admin/conference/recording',
    Conference_Rtp_Forward: '/admin/conference/rtp_forward',
    Conference_Stop_Rtp_Forward: '/admin/conference/stop_rtp_forward',
    Conference_List_Rtp_Forward: '/admin/conference/list_rtp_forward',

    // ========== 频道服务API ==========
    Channel_User_Info: '/channel/user_info',
    Channel_Update_Profile: '/channel/update_profile',
    Channel_Get_Profile: '/channel/get_profile',
    Channel_Message_Send: '/channel/message/send',
    Channel_Msg_Recall: '/channel/message/recall',
    Channel_Msg_Republish: '/channel/message/republish',
    Channel_Subscribe: '/channel/subscribe',
    Channel_Subscriber_List: '/channel/subscriber_list',
    Channel_Is_Subscriber: '/channel/is_subscriber',
    Channel_Application_Get_UserInfo: '/channel/application/get_user_info',

    // ========== 机器人服务API ==========
    Robot_User_Info: '/robot/user_info',
    Robot_User_Get_Email_Info: '/robot/user/get_info_by_email',
    Robot_User_Batch_Get_Infos: '/robot/user/batch_get_infos',
    Robot_Friend_Get_List: '/robot/friend/list',
    Robot_Search_User: '/robot/user/search',
    Robot_Get_User_Robots: '/robot/user/get_user_robots',
    Robot_Get_Profile: '/robot/profile',
    Robot_Message_Send: '/robot/message/send',
    Robot_Message_Reply: '/robot/message/reply',
    Robot_Message_Recall: '/robot/message/recall',
    Robot_Message_Update: '/robot/message/update',
    Robot_Set_Callback: '/robot/set_callback',
    Robot_Get_Callback: '/robot/get_callback',
    Robot_Delete_Callback: '/robot/delete_callback',
    Robot_Update_Profile: '/robot/update_profile',
    Robot_Application_Get_UserInfo: '/robot/application/get_user_info',
    Robot_Group_Member_Add: '/robot/group/member/add',
    Robot_Group_Allow_Member: '/robot/group/manager/allow',
    Robot_Create_Group: '/robot/group/create',
    Robot_Group_Dismiss: '/robot/group/del',
    Robot_Group_Get_Info: '/robot/group/get_info',
    Robot_Group_Member_List: '/robot/group/member/list',
    Robot_Group_Member_Get: '/robot/group/member/get',
    Robot_Group_Member_Kickoff: '/robot/group/member/del',
    Robot_Group_Modify_Info: '/robot/group/modify',
    Robot_Group_Set_Member_Alias: '/robot/group/member/set_alias',
    Robot_Group_Set_Member_Extra: '/robot/group/member/set_extra',
    Robot_Group_Mute_Member: '/robot/group/manager/mute',
    Robot_Group_Member_Quit: '/robot/group/member/quit',
    Robot_Group_Transfer: '/robot/group/transfer',
    Robot_Group_Set_Manager: '/robot/group/manager/set',

    // ========== 机器人朋友圈API ==========
    Robot_Moments_Post_Feed: '/robot/moments/feed/post',
    Robot_Moments_Pull_Feeds: '/robot/moments/feed/pull',
    Robot_Moments_Update_Feed: '/robot/moments/feed/update',
    Robot_Moments_Post_Comment: '/robot/moments/comment/post',
    Robot_Moments_Pull_Comment: '/robot/moments/comment/pull',
    Robot_Moments_Fetch_Feed: '/robot/moments/feed/pull_one',
    Robot_Moments_Fetch_Profiles: '/robot/moments/profiles/pull',
    Robot_Moments_Recall_Comment: '/robot/moments/comment/recall',
    Robot_Moments_Recall_Feed: '/robot/moments/feed/recall',
    Robot_Moments_Update_Profiles_List_Value: '/robot/moments/profiles/list/push',
    Robot_Moments_Update_Profiles_Value: '/robot/moments/profiles/value/push',

    // ========== 机器人会议API ==========
    Robot_Conference_Request: '/robot/conference/request',

    // ========== 机器人文件API ==========
    Robot_Get_Presigned_Upload_Url: '/robot/oss/get_upload_url',
};

export default APIPath;
export { APIPath };
