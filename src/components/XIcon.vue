<template>
  <q-btn v-bind:padding="padding" v-bind:icon="icon" v-bind:color="color" v-bind:size="size" v-bind:flat="flat" v-bind:outline="outline" v-bind="$attrs">
    <q-tooltip v-if="tooltip">{{ tooltip }}</q-tooltip>
  </q-btn>
</template>

<script setup lang="ts">
export interface XIconProps {
  /** 內距 */
  padding?: string
  /** Icon圖示 */
  icon?: string
  /** 按鈕顏色 */
  color?: string
  /** 按鈕大小 */
  size?: string
  /** 扁平樣式 */
  flat?: boolean
  /** 空心樣式 */
  outline?: boolean
  /** Tooltip 文字 */
  tooltip?: string
}

withDefaults(defineProps<XIconProps>(), {
  padding: 'none', // 預設無內距
  icon: '',
  tooltip: '',
  color: 'primary', // 預設主色
  size: 'md', // 預設中等大小
  flat: false, // 預設無框樣式
  outline: false, // 預設非空心
})
</script>
