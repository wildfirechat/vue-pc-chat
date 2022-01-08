/*
 * Copyright (c) 2021 Panda DB Chat. All rights reserved.
 */

import WfcAVEngineKit from "./avenginekit";

export default class PeerConnectionClient {
    isInitiator = false;
    userId;
    status;
    joinTime = 0;
    acceptTime = 0;
    videoMuted;
    stream;

    audience = false;
    useMainVideo = WfcAVEngineKit.DEFAULT_USE_MAIN_VIDEO;

    setUseMainVideo(useMainVideo) {
        // will be override

    }
}
