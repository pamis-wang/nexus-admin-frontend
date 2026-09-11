<template>
  <q-card flat bordered class="q-mt-xs">
    <q-card-section class="text-center q-py-xl">
      <q-icon name="mdi-lock-outline" size="64px" color="warning" />
      <div class="text-h5 text-primary q-mt-md">沒有這個頁面的權限</div>
      <div class="text-body2 text-grey-7 q-mt-sm">目前生效的角色沒有被授予這個功能的訪問權限。</div>
      <div class="text-body2 text-grey-7">若確定需要，請聯絡系統管理員調整角色權限。</div>

      <div class="row q-gutter-sm justify-center q-mt-lg">
        <q-btn flat color="grey" icon="mdi-arrow-left" label="返回上一頁" @click="handleBack" />
        <q-btn unelevated color="primary" icon="mdi-home" label="返回首頁" :to="{ name: 'home' }" />
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

/** 回到上一頁；沒有歷史紀錄（直接打網址進來）時退回首頁 */
function handleBack() {
  if (window.history.state?.back) {
    router.back()
    return
  }
  router.push({ name: 'home' })
}
</script>
