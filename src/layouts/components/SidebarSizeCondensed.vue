<template>
  <svg :width="size" :height="size * 0.75" viewBox="0 0 80 60" class="layout-preview">
    <!-- 外框 -->
    <rect x="1" y="1" width="78" height="58" fill="white" :stroke="isSelected ? 'var(--q-primary)' : '#e0e0e0'" :stroke-width="isSelected ? 2 : 1" rx="4" />

    <!-- 側邊欄 (常駐收合，只顯示圖示) -->
    <rect x="3" y="3" width="9" height="54" fill="#f5f5f5" stroke="#e0e0e0" stroke-width="0.5" />

    <!-- Logo 區域 -->
    <circle cx="7.5" cy="10" r="2" fill="#9e9e9e" />

    <!-- 選單圖示 -->
    <rect x="5.5" y="16" width="4" height="4" fill="#bdbdbd" rx="1" />
    <rect x="5.5" y="23" width="4" height="4" fill="#bdbdbd" rx="1" />
    <rect x="5.5" y="30" width="4" height="4" fill="#bdbdbd" rx="1" />

    <!-- 內容區 -->
    <rect x="13" y="3" width="64" height="54" fill="white" />

    <!-- 頂部欄 -->
    <rect x="13" y="3" width="64" height="12" fill="#fafafa" stroke="#e0e0e0" stroke-width="0.5" />
    <rect x="16" y="6" width="8" height="6" fill="#e0e0e0" rx="1" />

    <!-- 主要內容區域 -->
    <rect x="16" y="18" width="58" height="35" fill="#fafafa" rx="2" />

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
