<template>
  <svg :width="size" :height="size * 0.75" viewBox="0 0 80 60" class="layout-preview">
    <!-- 外框 -->
    <rect x="1" y="1" width="78" height="58" fill="white" :stroke="isSelected ? 'var(--q-primary)' : '#e0e0e0'" :stroke-width="isSelected ? 2 : 1" rx="4" />

    <!-- 側邊欄 -->
    <rect x="3" y="3" width="18" height="54" fill="#f5f5f5" stroke="#e0e0e0" stroke-width="0.5" />

    <!-- Logo 區域 -->
    <circle cx="12" cy="10" r="2" fill="#9e9e9e" />

    <!-- 選單項目 -->
    <rect x="6" y="16" width="12" height="2" fill="#bdbdbd" rx="1" />
    <rect x="6" y="20" width="12" height="2" fill="#bdbdbd" rx="1" />
    <rect x="6" y="24" width="12" height="2" fill="#bdbdbd" rx="1" />
    <rect x="6" y="28" width="12" height="2" fill="#bdbdbd" rx="1" />

    <!-- 內容區 -->
    <rect x="22" y="3" width="55" height="54" fill="white" />

    <!-- 頂部欄 -->
    <rect x="22" y="3" width="55" height="12" fill="#fafafa" stroke="#e0e0e0" stroke-width="0.5" />

    <!-- 頂部欄內容 -->
    <rect x="25" y="6" width="8" height="6" fill="#e0e0e0" rx="1" />
    <rect x="35" y="7" width="20" height="4" fill="#f0f0f0" rx="1" />

    <!-- 主要內容區域 -->
    <rect x="25" y="18" width="49" height="35" fill="#fafafa" rx="2" />

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
