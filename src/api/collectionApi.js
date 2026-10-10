import Config from "../config";
import {postWithAuthToken} from "./appServiceAuth";

export class CollectionApi {

    _groupIdPayload(groupId) {
        return groupId ? {groupId} : {};
    }

    createCollection(groupId, title, desc, template, expireType, expireAt, maxParticipants) {
        return this._post('', {
            groupId,
            title,
            description: desc,
            template,
            expireType,
            expireAt,
            maxParticipants
        })
    }

    getCollection(collectionId, groupId) {
        return this._post(`/${collectionId}/detail`, this._groupIdPayload(groupId))
    }

    joinCollection(collectionId, groupId, content) {
        return this._post(`/${collectionId}/join`, {
            ...this._groupIdPayload(groupId),
            content
        })
    }

    deleteCollectionEntry(collectionId, groupId) {
        return this._post(`/${collectionId}/delete`, this._groupIdPayload(groupId))
    }

    closeCollection(collectionId, groupId) {
        return this._post(`/${collectionId}/close`, this._groupIdPayload(groupId))
    }

    // 合并服务的 /api/collection 下，带 authToken 鉴权（见 appServiceAuth），响应体取 result
    async _post(path, data = {}) {
        let baseUrl = Config.getCollectionServer();
        if (!baseUrl) {
            throw new Error('未配置接龙服务');
        }
        return postWithAuthToken(baseUrl + path, data);
    }
}

const collectionApi = new CollectionApi();
export default collectionApi;
