import axios from "axios";
import Config from "../config";
import wfc from "../wfc/client/wfc";

export class CollectionApi {

    createCollection(groupId, title, desc, template, expireType, expireAt, maxParticipants) {
        return this._post('/api/collections', {
            groupId,
            title,
            description: desc,
            template,
            expireType,
            expireAt,
            maxParticipants
        })
    }

    getCollection(collectionId) {
        return this._post(`/api/collections/${collectionId}/detail`, {
            // Android sends groupId if available, but it seems optional or for permission check
        })
    }

    joinCollection(collectionId, content) {
        return this._post(`/api/collections/${collectionId}/join`, {
            content
        })
    }

    deleteCollectionEntry(collectionId, userId) {
        // Android calls this /delete, and doesn't seem to pass userId in body,
        // implying it deletes the current user's entry.
        return this._post(`/api/collections/${collectionId}/delete`, {})
    }

    closeCollection(collectionId) {
        return this._post(`/api/collections/${collectionId}/close`, {})
    }

    async _post(path, data = {}) {
        let baseUrl = Config.COLLECTION_SERVER;
        // extract host for auth code
        let host = baseUrl.replace(/^https?:\/\//, '').split('/')[0];

        return new Promise((resolve, reject) => {
            wfc.getAuthCode('collection', 2, host, async (authCode) => {
                try {
                    let response = await axios.post(baseUrl + path, data, {
                        headers: {
                            'authCode': authCode,
                        },
                        withCredentials: false,
                    });
                    if (response.data) {
                        if (response.data.code === 0) {
                            resolve(response.data.data); // Android returns data in 'data' field
                        } else {
                            reject(new Error(response.data.message));
                        }
                    } else {
                        reject(new Error('request error, status code: ' + response.status));
                    }
                } catch (e) {
                    reject(e);
                }
            }, (err) => {
                reject(new Error("Failed to get auth code: " + err));
            });
        });
    }
}

const collectionApi = new CollectionApi();
export default collectionApi;
