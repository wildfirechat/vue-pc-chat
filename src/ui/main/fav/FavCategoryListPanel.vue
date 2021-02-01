<template>
  <section class="fav-category-list-panel-container">
    <SearchView :show-add-button="false" :search-type="'fav'"/>
    <div class="panel">
      <SearchResultView v-bind:query="sharedSearchState.query"
                        v-if="sharedSearchState.show"
                        class="search-result-container"/>
      <div class="category-container">
        <ul>
          <li>
            <div class="category-item" v-bind:class="{active: category === CATEGORY_ALL}"
                 @click="showAllFav">
              <i class="icon-ion-android-cloud"></i>
              <p>全部收藏</p>
            </div>
          </li>
          <li>
            <div class="category-item" v-bind:class="{active:category === CATEGORY_MEDIA}"
                 @click="showMediaFav">
              <i class="icon-ion-image"></i>
              <p>相册</p>
            </div>
          </li>
          <li>
            <div class="category-item" v-bind:class="{active: category === CATEGORY_COMPOSITE}"
                 @click="showCompositeFav">
              <i class="icon-ion-ios-chatboxes"></i>
              <!--              组合消息-->
              <p>聊天记录</p>
            </div>
          </li>
        </ul>
      </div>
    </div>

  </section>
</template>

<script>
import SearchView from "@/ui/main/search/SearchView";
import store from "@/store";
import SearchResultView from "@/ui/main/search/SearchResultView";

export default {
  name: 'FavCategoryListPanel',
  data() {
    return {
      sharedSearchState: store.state.search,
      category: 'all',

      CATEGORY_ALL: 'all',
      CATEGORY_MEDIA: 'media',
      CATEGORY_COMPOSITE: 'composite',
    };
  },

  methods: {
    showAllFav() {
      // TODO
      if (this.category === this.CATEGORY_ALL) {
        return;
      }
      this.category = this.CATEGORY_ALL;

    },
    showMediaFav() {
      // TODO
      if (this.category === this.CATEGORY_MEDIA) {
        return;
      }
      this.category = this.CATEGORY_MEDIA;

    },
    showCompositeFav() {
      // TODO
      if (this.category === this.CATEGORY_COMPOSITE) {
        return;
      }
      this.category = this.CATEGORY_COMPOSITE;
    }
  },

  computed: {
    title() {
      let str = ''
      switch (this.category) {
        case this.CATEGORY_ALL:
          str = '全部收藏';
          break;
        case this.CATEGORY_MEDIA:
          str = '相册';
          break;
        case this.CATEGORY_COMPOSITE:
          str = '聊天记录';
          break
        default:
          break;
      }
      return str;
    }
  },

  components: {
    SearchResultView,
    SearchView,
  },
};
</script>

<style lang="css" scoped>

.fav-category-list-panel-container {
  display: flex;
  flex-direction: column;
  border-right: 1px solid #e5e5e5;
}

.panel {
  height: calc(100% - 60px);
  position: relative;
  background-color: #fafafa;
  flex: 1;
}

.search-result-container {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  width: 100%;
}

.category-container {
  width: 100%;
  height: 100%;
}

.category-item {
  display: flex;
  flex-direction: row;
  padding: 5px 0 5px 20px;
  height: 50px;
  align-items: center;
}

.category-item:active {
  background-color: #dedede;
}

.category-item.active {
  background-color: #dedede;
}

.category-item p {
  margin-left: 10px;
  font-size: 14px;
  flex: 1;
}


</style>
