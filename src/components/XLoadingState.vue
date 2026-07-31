<template>
  <div v-if="loading" class="q-pa-md text-center" v-bind="$attrs">
    <q-spinner :color="color" :size="size" />
    <div v-if="message" class="q-mt-sm">{{ message }}</div>
  </div>
</template>

<script setup lang="ts">
/**
 * 統一載入狀態元件
 * 用於顯示載入中的狀態，包含 spinner 和可選的載入訊息
 *
 * @example
 * <XLoadingState :loading="isLoading" message="載入資料中..." />
 * <XLoadingState :loading="isLoading" color="secondary" size="2em" />
 */

/** 元件 Props */
interface Props {
  /** 是否顯示載入狀態 */
  loading: boolean
  /** 載入訊息文字（可選） */
  message?: string
  /** Spinner 顏色 */
  color?: string
  /** Spinner 大小 */
  size?: string
}

withDefaults(defineProps<Props>(), {
  color: 'primary',
  size: '3em',
})
</script>
