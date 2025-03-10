<template>
  <div class="moment-wrapper">
    <router-view></router-view>
  </div>
</template>

<script>
export default {
  name: "Moment"
}
</script>

<style scoped>
.moment-wrapper {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
</style>
