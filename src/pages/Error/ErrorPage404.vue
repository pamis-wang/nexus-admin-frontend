<template>
  <default-layout>
    <div class="text-center q-py-md">
      <q-icon name="mdi-compass-off-outline" size="64px" color="grey-6" />
      <div class="text-h5 text-primary q-mt-md">{{ t('error.notFound.title') }}</div>
      <div class="text-body2 text-grey-7 q-mt-sm">{{ t('error.notFound.description') }}</div>
      <q-btn unelevated color="primary" icon="mdi-home" :label="t('error.backHome')" class="q-mt-lg" :to="{ name: 'home' }" />
    </div>
  </default-layout>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import DefaultLayout from '@/layouts/DefaultLayout.vue'

const { t } = useI18n()
</script>
