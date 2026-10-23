/*
 * Copyright (c) 2020 WildFireChat. All rights reserved.
 */

export default class JoinGroupRequest {
    groupId;
    memberId;
    requestUserId;
    acceptUserId;
    reason;
    extra;
    //    RequestStatus_Sent = 0,
    //    RequestStatus_Accepted = 1,
    //    RequestStatus_Rejected = 2
    status;
    readStatus;
    timestamp;
}
