/*
 * Copyright (c) 2020 WildFireChat. All rights reserved.
 */

import DomainInfo from "./domainInfo.js";

export default class NullDomainInfo extends DomainInfo {
    constructor(domainId) {
        super();
        this.domainId = domainId;
        this.name = '<Domain>';
    }
}
