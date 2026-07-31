<template>
  <svg :width="size" :height="size * 0.75" viewBox="0 0 80 60" class="layout-preview">
    <!-- 外框 -->
    <rect x="1" y="1" width="78" height="58" fill="white" :stroke="isSelected ? 'var(--q-primary)' : '#e0e0e0'" :stroke-width="isSelected ? 2 : 1" rx="4" />

    <!-- 頂部欄 -->
    <rect x="3" y="3" width="74" height="15" fill="#f5f5f5" stroke="#e0e0e0" stroke-width="0.5" />

    <!-- Logo 區域 -->
    <circle cx="10" cy="10" r="2" fill="#9e9e9e" />

    <!-- 選單項目 -->
    <rect x="16" y="8" width="8" height="4" fill="#bdbdbd" rx="1" />
    <rect x="26" y="8" width="8" height="4" fill="#bdbdbd" rx="1" />
    <rect x="36" y="8" width="8" height="4" fill="#bdbdbd" rx="1" />
    <rect x="46" y="8" width="8" height="4" fill="#bdbdbd" rx="1" />

    <!-- 頂部欄右側按鈕 -->
    <circle cx="65" cy="10" r="1.5" fill="#e0e0e0" />
    <circle cx="69" cy="10" r="1.5" fill="#e0e0e0" />
    <circle cx="73" cy="10" r="1.5" fill="#e0e0e0" />

    <!-- 主要內容區域 -->
    <rect x="3" y="19" width="74" height="38" fill="#fafafa" rx="2" />

    <!-- 內容區塊 -->
    <rect x="6" y="22" width="68" height="8" fill="#f0f0f0" rx="1" />
    <rect x="6" y="32" width="32" height="20" fill="#ffffff" stroke="#e0e0e0" stroke-width="0.5" rx="1" />
    <rect x="42" y="32" width="32" height="20" fill="#ffffff" stroke="#e0e0e0" stroke-width="0.5" rx="1" />

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
