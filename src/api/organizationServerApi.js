import axios from "axios";
import Config from "../config";
import {getItem, setItem} from "../ui/util/storageHelper";
import wfc from "../wfc/client/wfc";
import OrganizationServerError from "./organizationServerError";
import UserInfo from "../wfc/model/userInfo";

const RELATIONSHIP_CACHE_MS = 5 * 60 * 1000;

export class OrganizationServerApi {
    isServiceAvailable = true;
    serviceUnavailbelError = new OrganizationServerError(-1, '未登录或服务不可用');
    // 部门内容（子部门 + 本级成员）缓存，切换部门时先拿它显示（对齐 wf-enterprise-chat OrganizationCache）；重新登录时清掉
    _organizationExCache = new Map();
    // 组织关系按人短时缓存：资料卡（同组织判断、所属部门）、单聊副标题都要用，避免重复请求。
    // 只缓存成功的结果，且 5 分钟后重新取（组织调整后不会一直用旧的）；重新登录时清掉
    _relationshipCache = new Map();

    constructor() {
        // do nothing
    }

    login() {
        this._organizationExCache.clear();
        this._relationshipCache.clear();
        return new Promise((resolve, reject) => {
            //        int ApplicationType_Robot = 0;
//        int ApplicationType_Channel = 1;
//        int ApplicationType_Admin = 2;
            if (!Config.getOrganizationServer()) {
                this.isServiceAvailable = false;
                reject(this.serviceUnavailbelError)
                return
            }
            wfc.getAuthCode('admin', 2, '', code => {
                let path = '/api/user_login';
                this._post(path, {
                    authCode: code
                }, true)
                    .then(response => {
                        if (response.data.code === 0) {
                            let appAuthToken = response.headers['authtoken'];
                            if (!appAuthToken) {
                                appAuthToken = response.headers['authToken'];
                            }

                            if (appAuthToken) {
                                // 主备地址对应的是同一个组织结构服务，token 通用，主备地址都保存，切换网络后不用重新登录
                                [Config.ORGANIZATION_SERVER, Config.ORGANIZATION_BACKUP_SERVER].forEach(server => {
                                    if (server) {
                                        setItem(this._authTokenKey(server), appAuthToken);
                                    }
                                });
                            }
                            this.isServiceAvailable = true;
                            resolve(response.data.result);
                        } else {
                            reject(new OrganizationServerError(response.data.code, response.data.message));
                        }
                    })
                    .catch(error => {
                        this.isServiceAvailable = false;
                        console.error('org login error', error);
                        reject(error);
                    })

            }, error => {
                console.error('getAuthCode error', error);
                this.isServiceAvailable = false;
                reject(this.serviceUnavailbelError)
            })
        })
    }

    getRootOrganization() {
        return this._post('/api/organization/root');
    }

    getRelationShip(employeeId) {
        return this._post('/api/relationship/employee', {employeeId});
    }

    getRelationshipCached(employeeId) {
        const cached = this._relationshipCache.get(employeeId);
        if (cached && Date.now() - cached.at < RELATIONSHIP_CACHE_MS) {
            return cached.promise;
        }
        const promise = this.getRelationShip(employeeId).then(list => list || []);
        this._relationshipCache.set(employeeId, {at: Date.now(), promise});
        promise.catch(() => this._relationshipCache.delete(employeeId));
        return promise;
    }

    /**
     * 对方是否和我同组织：取双方组织关系，有共同节点即同组织同事（对齐 wf-enterprise-chat 624d0210）。
     * 同组织同事之间不需要加好友：资料卡不显示「添加好友」，单聊副标题不提示「你们还不是好友」。
     * 服务不可用或查询失败时按非同组织处理，退回加好友
     * @param {string} userId
     * @return {Promise<boolean>}
     */
    async isSameOrganization(userId) {
        const myId = wfc.getUserId();
        if (!myId || !userId || userId === myId || !this.isServiceAvailable) {
            return false;
        }
        try {
            const [mine, theirs] = await Promise.all([
                this.getRelationshipCached(myId),
                this.getRelationshipCached(userId),
            ]);
            const mineOrgs = new Set(mine.map(r => r.organizationId));
            return theirs.some(r => mineOrgs.has(r.organizationId));
        } catch (e) {
            return false;
        }
    }

    getOrganizationEx(orgId) {
        return this._post('/api/organization/query_ex', {id: orgId})
            .then(res => {
                this._organizationExCache.set(orgId, res);
                return res;
            });
    }

    getCachedOrganizationEx(orgId) {
        return this._organizationExCache.get(orgId);
    }

    getOrganizations(orgIds) {
        return this._post('/api/organization/query_list', {ids: orgIds});
    }

    async getOrganizationEmployees(orgIds) {
        let employeeIds = await this._post('/api/organization/batch_employees', {ids: orgIds});
        return this.getEmployeeList(employeeIds);
    }

    getOrgEmployees(orgId) {
        return this._post('/api/organization/employees', {ids: orgId});
    }

    getEmployee(employeeId) {
        return this._post('/api/employee/query', {employeeId});
    }

    getEmployeeEx(employeeId) {
        return this._post('/api/employee/query_ex', {employeeId});
    }

    getEmployeeList(employeeIds) {
        return this._post('/api/employee/query_list', {employeeIds: employeeIds})
    }

    async searchEmployee(orgId, keyword) {
        let pageResponse = await this._post('/api/employee/search', {organizationId: orgId, keyword: keyword});
        return pageResponse.contents || [];
    }

    async getOrganizationPath(organizationId) {
        let pathList = [];
        let org = await this._getOrganizationSync(organizationId);
        if (org) {
            pathList.push(org)
            if (org.parentId) {
                pathList.push(...await this.getOrganizationPath(org.parentId));
            }
        }
        return pathList;
    }

    employeeToUserInfo(employee) {
        let userInfo = new UserInfo();
        userInfo.uid = employee.employeeId;
        userInfo.name = employee.employeeId;
        userInfo.displayName = employee.name;
        userInfo.portrait = this.employeePortraitUrl(employee);
        userInfo.gender = employee.gender;
        userInfo.mobile = employee.mobile;
        userInfo.email = employee.email;
        userInfo.updateDt = employee.updateDt;
        //0 normal; 1 robot; 2 thing;
        userInfo.type = 0;
        userInfo.deleted = 0;
        return userInfo;
    }

    employeePortraitUrl(employee) {
        return employee.portrait ? employee.portrait : Config.getAppServer() + '/avatar?name=' + encodeURIComponent(employee.name);
    }

    // 加上服务前缀，与其他服务（如 app-server）区分开，host 相同时 token 不会互相覆盖
    _authTokenKey(url) {
        return 'orgAuthToken-' + new URL(url).host;
    }

    async _getOrganizationSync(orgId) {
        let orgs = await this.getOrganizations([orgId])
        return orgs && orgs.length > 0 ? orgs[0] : null;
    }

    /**
     *
     * @param path
     * @param data
     * @param rawResponse
     * @param rawResponseData
     * @return {Promise<string | AxiosResponse<any>|*|T>}
     * @private
     */
    async _post(path, data = {}, rawResponse = false, rawResponseData = false) {
        if(!this.isServiceAvailable){
            throw new Error("service not available");
        }

        let response;
        path = Config.getOrganizationServer() + path;
        response = await axios.post(path, data, {
            transformResponse: rawResponseData ? [data => data] : axios.defaults.transformResponse, headers: {
                'authToken': getItem(this._authTokenKey(path)),
            },
            withCredentials: false,
        })
        if (rawResponse) {
            return response;
        }
        if (response.data) {
            if (rawResponseData) {
                return response.data;
            }
            if (response.data.code === 0) {
                return response.data.result
            } else {
                throw new OrganizationServerError(response.data.code, response.data.message)
            }
        } else {
            throw new Error('request error, status code: ' + response.status)
        }
    }
}

const organizationServerApi = new OrganizationServerApi();
export default organizationServerApi;
