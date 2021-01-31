<template>
  <section class="fav-page">
    <FavCategoryListPanel class="fav-category-list-panel"/>
    <FavView class="fav-view"/>
  </section>
</template>

<script>
import FavCategoryListPanel from "@/ui/main/FavCategoryListPanel";
import FavView from "@/ui/main/FavView";

export default {
  name: "FavPage",
  destroyed() {
    console.log('conversation page destroyed')
  },

  methods: {
    showConversation(conversation) {
      this.currentConversation = conversation;
      console.log("show conversation", conversation);
    },
  },
  components: {
    FavView,
    FavCategoryListPanel,
  },
};
</script>

<style lang="css" scoped>
.fav-page {
  flex: 1;
  display: flex;
  height: 100%;
}

.fav-category-list-panel {
  width: 250px;
  height: 100%;
}

.fav-view {
  flex: 1;
}

</style>
