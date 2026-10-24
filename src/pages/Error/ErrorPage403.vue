<template>
  <q-card flat bordered class="q-mt-xs">
    <q-card-section class="text-center q-py-xl">
      <q-icon name="mdi-lock-outline" size="64px" color="warning" />
      <div class="text-h5 text-primary q-mt-md">{{ t('error.forbidden.title') }}</div>
      <div class="text-body2 text-grey-7 q-mt-sm">{{ t('error.forbidden.description') }}</div>
      <div class="text-body2 text-grey-7">{{ t('error.forbidden.contact') }}</div>

      <div class="row q-gutter-sm justify-center q-mt-lg">
        <q-btn flat color="grey" icon="mdi-arrow-left" :label="t('error.back')" @click="handleBack" />
        <q-btn unelevated color="primary" icon="mdi-home" :label="t('error.backHome')" :to="{ name: 'home' }" />
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

const router = useRouter()
const { t } = useI18n()

/** 回到上一頁；沒有歷史紀錄（直接打網址進來）時退回首頁 */
function handleBack() {
  if (window.history.state?.back) {
    router.back()
    return
  }
  router.push({ name: 'home' })
}
</script>
