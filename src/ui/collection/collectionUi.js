import Config from "../../config";
import {showFeatureDialog} from "../util/featureDialog";
import CollectionCreate from "./CollectionCreate.vue";
import CollectionDetail from "./CollectionDetail.vue";

// 弹窗宽度与 wf-enterprise-chat 一致，高度随内容、最高不超过它的高度

function collectionServiceReady(vm) {
    if (!Config.getCollectionServer()) {
        vm.$notify({text: vm.$t('collection.collection_service_not_configured'), type: 'error'});
        return false;
    }
    return true;
}

export function showCollectionCreate(vm, groupId) {
    if (!collectionServiceReady(vm)) {
        return;
    }
    showFeatureDialog(vm, {
        component: CollectionCreate, route: '/collection/create', query: {groupId},
        name: 'collection-create-modal', width: 460, height: 560, clickToClose: false,
    });
}

export function showCollectionDetail(vm, {collectionId, groupId}) {
    if (!collectionServiceReady(vm)) {
        return;
    }
    showFeatureDialog(vm, {
        component: CollectionDetail, route: '/collection/detail', query: {collectionId: String(collectionId), groupId: groupId || ''},
        name: 'collection-detail-modal', width: 460, height: 620,
    });
}
