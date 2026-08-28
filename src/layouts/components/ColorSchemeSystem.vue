<template>
  <svg :width="size" :height="size * 0.75" viewBox="0 0 80 60" class="layout-preview">
    <defs>
      <!-- 右半邊裁切區：用來疊上暗色版面，呈現「跟隨系統」的雙色示意 -->
      <clipPath :id="darkClipId">
        <rect x="40" y="0" width="40" height="60" />
      </clipPath>
    </defs>

    <!-- 亮色底層 -->
    <g>
      <rect x="1" y="1" width="78" height="58" fill="white" rx="4" />
      <rect x="3" y="3" width="18" height="54" fill="#f8f9fa" stroke="#e0e0e0" stroke-width="0.5" />
      <circle cx="12" cy="10" r="2" fill="#6c757d" />
      <rect x="6" y="16" width="12" height="2" fill="#adb5bd" rx="1" />
      <rect x="6" y="20" width="12" height="2" fill="#adb5bd" rx="1" />
      <rect x="6" y="24" width="12" height="2" fill="#adb5bd" rx="1" />
      <rect x="6" y="28" width="12" height="2" fill="#adb5bd" rx="1" />
      <rect x="22" y="3" width="55" height="54" fill="#ffffff" />
      <rect x="22" y="3" width="55" height="12" fill="#f8f9fa" stroke="#e0e0e0" stroke-width="0.5" />
      <rect x="25" y="6" width="8" height="6" fill="#dee2e6" rx="1" />
      <rect x="35" y="7" width="20" height="4" fill="#e9ecef" rx="1" />
      <rect x="25" y="18" width="49" height="35" fill="#ffffff" stroke="#e0e0e0" stroke-width="0.5" rx="2" />
      <rect x="28" y="22" width="43" height="3" fill="#f8f9fa" rx="1" />
      <rect x="28" y="27" width="20" height="2" fill="#e9ecef" rx="1" />
      <rect x="28" y="31" width="30" height="2" fill="#e9ecef" rx="1" />
    </g>

    <!-- 暗色上層：僅顯示右半邊 -->
    <g :clip-path="`url(#${darkClipId})`">
      <rect x="1" y="1" width="78" height="58" fill="#1e1e1e" rx="4" />
      <rect x="22" y="3" width="55" height="54" fill="#1e1e1e" />
      <rect x="22" y="3" width="55" height="12" fill="#2d2d2d" stroke="#424242" stroke-width="0.5" />
      <rect x="25" y="6" width="8" height="6" fill="#424242" rx="1" />
      <rect x="35" y="7" width="20" height="4" fill="#616161" rx="1" />
      <rect x="25" y="18" width="49" height="35" fill="#2d2d2d" stroke="#424242" stroke-width="0.5" rx="2" />
      <rect x="28" y="22" width="43" height="3" fill="#424242" rx="1" />
      <rect x="28" y="27" width="20" height="2" fill="#616161" rx="1" />
      <rect x="28" y="31" width="30" height="2" fill="#616161" rx="1" />
    </g>

    <!-- 外框：最後繪製以免被上層色塊覆蓋 -->
    <rect x="1" y="1" width="78" height="58" fill="none" :stroke="isSelected ? 'var(--q-primary)' : '#e0e0e0'" :stroke-width="isSelected ? 2 : 1" rx="4" />

    <!-- 選中狀態的藍點 -->
    <circle v-if="isSelected" cx="70" cy="50" r="3" fill="var(--q-primary)" />
  </svg>
</template>

<script setup lang="ts">
import { useId } from 'vue'

// 同頁面可能存在多個實例，clipPath 的 id 必須唯一
const darkClipId = useId()

interface Props {
  isSelected?: boolean
  size?: number
}

withDefaults(defineProps<Props>(), {
  isSelected: false,
  size: 80,
})
</script>

<style scoped>
.layout-preview {
  transition: all 0.2s ease;
}

.layout-preview:hover {
  transform: scale(1.05);
}
</style>
