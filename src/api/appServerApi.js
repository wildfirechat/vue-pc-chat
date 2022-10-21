import axios from "axios";
import {getItem, setItem} from "../ui/util/storageHelper";
import Config from "../config";
import FavItem from "../wfc/model/favItem";
import {stringValue} from "../wfc/util/longUtil";
import AppServerError from "./appServerError";
import wfc from "../wfc/client/wfc";

class AppServerApi {
    constructor() {
        axios.defaults.baseURL = Config.APP_SERVER;

        axios.defaults.headers.common['authToken'] = getItem('authToken');
        axios.defaults.withCredentials = true;
    }

    requestAuthCode(mobile) {
        return this._post('/send_code', {mobile})
    }

    loinWithPassword(mobile, password) {
        return new Promise((resolve, reject) => {
            this._interceptLoginResponse(this._post('/login_pwd', {
                mobile,
                password,
                platform: Config.getWFCPlatform(),
                clientId: wfc.getClientId()
            }, true), resolve, reject)
        })
    }

    loginWithAuthCode(mobile, authCode) {
        return new Promise((resolve, reject) => {
            this._interceptLoginResponse(this._post('/login', {
                mobile,
                code: authCode,
                platform: Config.getWFCPlatform(),
                clientId: wfc.getClientId()
            }, true), resolve, reject)
        })
    }

    getGroupAnnouncement(groupId) {
        return this._post('/get_group_announcement', {groupId: groupId})
    }

    updateGroupAnnouncement(author, groupId, announcement) {
        return this._post('/put_group_announcement', {
            author,
            groupId,
            text: announcement
        })
    }

    favMessage(message) {
        let favItem = FavItem.fromMessage(message);
        return this._post('/fav/add', {
            messageUid: stringValue(favItem.messageUid),
            type: favItem.favType,
            convType: favItem.conversation.type,
            convTarget: favItem.conversation.target,
            convLine: favItem.conversation.line,
            origin: favItem.origin,
            sender: favItem.sender,
            title: favItem.title,
            url: favItem.url,
            thumbUrl: favItem.thumbUrl,
            data: favItem.data,
        });
    }

    getFavList(startId, count = 20) {
        return this._post('/fav/list', {id: startId, count: count}, false, true)
    }

    _interceptLoginResponse(requestPromise, resolve, reject) {
        requestPromise
            .then(response => {
                let appAuthToken = response.headers['authtoken'];
                if (!appAuthToken) {
                    appAuthToken = response.headers['authToken'];
                }

                if (appAuthToken) {
                    setItem('authToken', appAuthToken);
                    axios.defaults.headers.common['authToken'] = appAuthToken;
                }
                resolve(response.data);
            })
            .catch(err => {
                reject(err);
            })
    }

    async _post(path, data, rawResponse = false, rawResponseData = false) {
        let response;
        response = await axios.post(path, data, {transformResponse: rawResponseData ? [data => data] : axios.defaults.transformResponse})
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
                throw new AppServerError(response.data.code, response.data.message)
            }
        } else {
            throw new Error('request error, status code: ' + response.status)
        }
    }
}

let appServerApi = new AppServerApi();
export default appServerApi;
