import APIPath from './utils/apiPath.js';
import httpUtils from './utils/httpUtils.js';

/**
 * 会议管理类
 * 
 * 提供音视频会议管理相关的功能，包括：
 * - 会议列表查询
 * - 会议创建和销毁
 * - 会议参与者管理
 * - 会议录制控制
 * - RTP转发管理
 */
class ConferenceAdmin {
    /**
     * 获取会议列表（分页）
     * @param {number} count - 每页数量
     * @param {number} offset - 偏移量
     * @returns {Promise<IMResult>}
     */
    static async listConferences(count, offset) {
        const input = {
            count: count,
            offset: offset
        };
        return httpUtils.httpJsonPost(APIPath.Conference_List, input);
    }

    /**
     * 检查会议是否存在
     * @param {string} conferenceId - 会议ID
     * @returns {Promise<IMResult>}
     */
    static async existsConferences(conferenceId) {
        const data = {
            roomId: conferenceId,
            advance: false
        };
        return httpUtils.httpJsonPost(APIPath.Conference_Exist, data);
    }

    /**
     * 获取会议参与者列表
     * @param {string} roomId - 房间ID
     * @param {boolean} [advance=false] - 是否使用高级模式
     * @returns {Promise<IMResult>}
     */
    static async listParticipants(roomId, advance = false) {
        const data = {
            roomId: roomId,
            advance: advance
        };
        return httpUtils.httpJsonPost(APIPath.Conference_List_Participant, data);
    }

    /**
     * 创建会议房间
     * @param {string} roomId - 房间ID
     * @param {string} [description] - 描述
     * @param {string} [pin] - 房间密码
     * @param {number} [maxPublisher] - 最大推流数
     * @param {boolean} [advance=false] - 是否使用高级模式
     * @param {number} [bitrate] - 比特率
     * @param {boolean} [recording=false] - 是否录制
     * @param {boolean} [permanent=false] - 是否永久房间
     * @returns {Promise<IMResult>}
     */
    static async createRoom(roomId, description = null, pin = null, maxPublisher = 0, 
                            advance = false, bitrate = 0, recording = false, permanent = false) {
        const create = {
            roomId: roomId,
            description: description,
            pin: pin,
            max_publishers: maxPublisher,
            advance: advance,
            bitrate: bitrate,
            recording: recording,
            permanent: permanent
        };
        return httpUtils.httpJsonPost(APIPath.Conference_Create, create);
    }

    /**
     * 启用或禁用会议录制
     * @param {string} roomId - 房间ID
     * @param {boolean} [advance=false] - 是否使用高级模式
     * @param {boolean} [recording=false] - true-启用录制，false-禁用录制
     * @returns {Promise<IMResult>}
     */
    static async enableRecording(roomId, advance = false, recording = false) {
        const create = {
            roomId: roomId,
            recording: recording,
            advance: advance
        };
        return httpUtils.httpJsonPost(APIPath.Conference_Recording, create);
    }

    /**
     * 销毁会议房间
     * @param {string} roomId - 房间ID
     * @param {boolean} [advance=false] - 是否使用高级模式
     * @returns {Promise<IMResult>}
     */
    static async destroy(roomId, advance = false) {
        const conferenceRoomId = {
            roomId: roomId,
            advance: advance
        };
        return httpUtils.httpJsonPost(APIPath.Conference_Destroy, conferenceRoomId);
    }

    /**
     * RTP转发
     * @param {string} roomId - 房间ID
     * @param {string} userId - 用户ID
     * @param {string} rtpHost - RTP主机地址
     * @param {number} audioPort - 音频端口
     * @param {number} audioPt - 音频Payload类型
     * @param {number} audioSSRC - 音频SSRC
     * @param {number} videoPort - 视频端口
     * @param {number} videoPt - 视频Payload类型
     * @param {number} videoSSRC - 视频SSRC
     * @returns {Promise<IMResult>}
     */
    static async rtpForward(roomId, userId, rtpHost, audioPort, audioPt, audioSSRC, 
                            videoPort, videoPt, videoSSRC) {
        const req = {
            roomId: roomId,
            userId: userId,
            rtpHost: rtpHost,
            audioPort: audioPort,
            audioPt: audioPt,
            audioSSRC: audioSSRC,
            videoPort: videoPort,
            videoPt: videoPt,
            videoSSRC: videoSSRC
        };
        return httpUtils.httpJsonPost(APIPath.Conference_Rtp_Forward, req);
    }

    /**
     * 停止RTP转发
     * @param {string} roomId - 房间ID
     * @param {string} userId - 用户ID
     * @param {number} streamId - 流ID
     * @returns {Promise<IMResult>}
     */
    static async stopRtpForward(roomId, userId, streamId) {
        const req = {
            roomId: roomId,
            userId: userId,
            streamId: streamId
        };
        return httpUtils.httpJsonPost(APIPath.Conference_Stop_Rtp_Forward, req);
    }

    /**
     * 获取RTP转发列表
     * @param {string} roomId - 房间ID
     * @returns {Promise<IMResult>}
     */
    static async listRtpForwarders(roomId) {
        const req = {
            roomId: roomId
        };
        return httpUtils.httpJsonPost(APIPath.Conference_List_Rtp_Forward, req);
    }
}

export default ConferenceAdmin;
