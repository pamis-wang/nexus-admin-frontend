<template>
  <div class="q-pa-md">
    <q-card flat bordered>
      <q-card-section>
        <div class="row items-center q-gutter-sm">
          <q-icon v-if="route.meta?.icon" :name="route.meta.icon" size="sm" color="primary" />
          <div class="text-h6">{{ route.meta?.title }}</div>
        </div>
        <div class="text-caption text-grey-6 q-mt-sm">此頁面尚未實作，僅供版面配置與選單展示使用。</div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()
</script>
