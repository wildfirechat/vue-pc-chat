<template>
  <section class="fav-category-list-panel-container">
    <SearchView :show-add-button="false" :search-type="'fav'"/>
    <div class="panel">
      <SearchResultView v-bind:query="sharedSearchState.query"
                        v-if="sharedSearchState.show"
                        class="search-result-container"/>
      <div>
        Dummy Fav Category
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
    };
  },

  methods: {},
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


</style>
