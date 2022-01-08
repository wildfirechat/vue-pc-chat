/*
 * Copyright (c) 2021 Panda DB Chat. All rights reserved.
 */

import UserSettingScope from "../client/userSettingScope";

export default class UserSettingEntry {
    scope = UserSettingScope.kUserSettingCustomBegin;
    key = '';
    value = '';
    updateDt = 0;
}
