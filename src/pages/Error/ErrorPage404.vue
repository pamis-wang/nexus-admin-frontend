<template>
  <default-layout>
    <div class="text-center q-py-md">
      <q-icon name="mdi-compass-off-outline" size="64px" color="grey-6" />
      <div class="text-h5 text-primary q-mt-md">找不到頁面</div>
      <div class="text-body2 text-grey-7 q-mt-sm">網址可能輸入錯誤，或這個頁面已經被移除。</div>
      <q-btn unelevated color="primary" icon="mdi-home" label="返回首頁" class="q-mt-lg" :to="{ name: 'home' }" />
    </div>
  </default-layout>
</template>

<script setup lang="ts">
import DefaultLayout from '@/layouts/DefaultLayout.vue'
</script>
