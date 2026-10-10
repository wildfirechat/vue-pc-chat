import Config from "../config";
import OrganizationServerError from "./organizationServerError";
import AppServerError from "./appServerError";
import {ensureAuthToken, postWithAuthToken} from "./appServiceAuth";
import {generatedAvatarUrl} from "../wfc/util/generatedAvatar";
import UserInfo from "../wfc/model/userInfo";

export class OrganizationServerApi {
    isServiceAvailable = true;
    serviceUnavailbelError = new OrganizationServerError(-1, '未登录或服务不可用');

    constructor() {
        // do nothing
    }

    /**
     * 连上 IM 后调用：确保拿到应用服务（合并服务）的 authToken。组织通讯录与应用服务共用一个 authToken，
     * 账号密码 / 扫码登录时已经下发过的话直接复用，没有就用 IM 的 authCode 换一个（见 appServiceAuth）
     */
    login() {
        let server = Config.getOrganizationServer();
        if (!server) {
            this.isServiceAvailable = false;
            return Promise.reject(this.serviceUnavailbelError);
        }
        return ensureAuthToken(server)
            .then(() => {
                this.isServiceAvailable = true;
            })
            .catch(error => {
                this.isServiceAvailable = false;
                console.error('org login error', error);
                throw error;
            });
    }

    /**
     * 更新当前登录用户的头像：组织通讯录统一维护头像，服务端同步到 IM 后由 UserInfosUpdate 推送刷新界面
     * @param {string} portraitUrl 上传后的头像地址
     */
    updateMyPortrait(portraitUrl) {
        return this._post('/employee/update_portrait', {portraitUrl});
    }

    getRootOrganization() {
        return this._post('/organization/root');
    }

    getRelationShip(employeeId) {
        return this._post('/relationship/employee', {employeeId});
    }

    getOrganizationEx(orgId) {
        return this._post('/organization/query_ex', {id: orgId});
    }

    getOrganizations(orgIds) {
        return this._post('/organization/query_list', {ids: orgIds});
    }

    async getOrganizationEmployees(orgIds) {
        let employeeIds = await this._post('/organization/batch_employees', {ids: orgIds});
        return this.getEmployeeList(employeeIds);
    }

    getOrgEmployees(orgId) {
        return this._post('/organization/employees', {ids: orgId});
    }

    getEmployee(employeeId) {
        return this._post('/employee/query', {employeeId});
    }

    getEmployeeEx(employeeId) {
        return this._post('/employee/query_ex', {employeeId});
    }

    getEmployeeList(employeeIds) {
        return this._post('/employee/query_list', {employeeIds: employeeIds})
    }

    async searchEmployee(orgId, keyword) {
        let pageResponse = await this._post('/employee/search', {organizationId: orgId, keyword: keyword});
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
        userInfo.name = employee.name;
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
        return employee.portrait ? employee.portrait : generatedAvatarUrl(employee.name);
    }

    async _getOrganizationSync(orgId) {
        let orgs = await this.getOrganizations([orgId])
        return orgs && orgs.length > 0 ? orgs[0] : null;
    }

    // 合并服务的 /api/org 下，带 authToken 鉴权，会话失效时自动重新登录（见 appServiceAuth）
    async _post(path, data = {}) {
        if (!this.isServiceAvailable) {
            throw new Error("service not available");
        }
        try {
            return await postWithAuthToken(Config.getOrganizationServer() + path, data);
        } catch (e) {
            if (e instanceof AppServerError) {
                throw new OrganizationServerError(e.errorCode, e.message);
            }
            throw e;
        }
    }
}

const organizationServerApi = new OrganizationServerApi();
export default organizationServerApi;
