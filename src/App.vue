<script setup lang="ts">
import { onMounted } from 'vue'
import { useAuthentication } from '@/composables/useAuthentication'
import { useUserStore } from '@/stores/useUser'

const userStore = useUserStore()
const { loadAuthorization } = useAuthentication()

onMounted(() => {
  // localStorage 裡的權限是上次登入或切換角色時留下的，重新整理後補拉一次。
  // 不 await：選單先用舊資料畫出來，拉到新的再自動更新；失敗就沿用舊的。
  if (userStore.isAuthenticated) {
    loadAuthorization()
  }
})
</script>

<template>
  <router-view></router-view>
</template>

<style scoped></style>
