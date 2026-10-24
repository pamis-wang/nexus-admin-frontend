<template>
  <div class="q-pa-md">
    <q-card flat bordered>
      <q-card-section>
        <div class="row items-center q-gutter-sm">
          <q-icon v-if="route.meta?.icon" :name="route.meta.icon" size="sm" color="primary" />
          <div class="text-h6">{{ pageTitle }}</div>
        </div>
        <div class="text-caption text-grey-6 q-mt-sm">{{ t('home.placeholder') }}</div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'

const route = useRoute()
const { t } = useI18n()

/** 頁面標題，取自路由 meta.title（menu 字典的 key）；沒有設定時為空字串 */
const pageTitle = computed(() => {
  const titleKey = route.meta.title
  if (titleKey === undefined || titleKey === '') return ''

  return t(`menu.${titleKey}`)
})
</script>
