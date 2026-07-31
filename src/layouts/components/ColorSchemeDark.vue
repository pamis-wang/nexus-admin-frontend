<template>
  <svg :width="size" :height="size * 0.75" viewBox="0 0 80 60" class="layout-preview">
    <!-- 外框 -->
    <rect x="1" y="1" width="78" height="58" fill="#1e1e1e" :stroke="isSelected ? 'var(--q-primary)' : '#424242'" :stroke-width="isSelected ? 2 : 1" rx="4" />

    <!-- 側邊欄 (暗色) -->
    <rect x="3" y="3" width="18" height="54" fill="#2d2d2d" stroke="#424242" stroke-width="0.5" />

    <!-- Logo 區域 -->
    <circle cx="12" cy="10" r="2" fill="#9e9e9e" />

    <!-- 選單項目 (暗色主題) -->
    <rect x="6" y="16" width="12" height="2" fill="#616161" rx="1" />
    <rect x="6" y="20" width="12" height="2" fill="#616161" rx="1" />
    <rect x="6" y="24" width="12" height="2" fill="#616161" rx="1" />
    <rect x="6" y="28" width="12" height="2" fill="#616161" rx="1" />

    <!-- 內容區 (暗色) -->
    <rect x="22" y="3" width="55" height="54" fill="#1e1e1e" />

    <!-- 頂部欄 (暗色) -->
    <rect x="22" y="3" width="55" height="12" fill="#2d2d2d" stroke="#424242" stroke-width="0.5" />

    <!-- 頂部欄內容 -->
    <rect x="25" y="6" width="8" height="6" fill="#424242" rx="1" />
    <rect x="35" y="7" width="20" height="4" fill="#616161" rx="1" />

    <!-- 主要內容區域 (暗色背景) -->
    <rect x="25" y="18" width="49" height="35" fill="#2d2d2d" stroke="#424242" stroke-width="0.5" rx="2" />

    <!-- 內容元素 -->
    <rect x="28" y="22" width="43" height="3" fill="#424242" rx="1" />
    <rect x="28" y="27" width="20" height="2" fill="#616161" rx="1" />
    <rect x="28" y="31" width="30" height="2" fill="#616161" rx="1" />

    <!-- 暗色主題特有的黑色區塊 -->
    <rect x="28" y="36" width="43" height="12" fill="#000000" rx="1" />

    <!-- 選中狀態的藍點 -->
    <circle v-if="isSelected" cx="70" cy="50" r="3" fill="var(--q-primary)" />
  </svg>
</template>

<script setup lang="ts">
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
