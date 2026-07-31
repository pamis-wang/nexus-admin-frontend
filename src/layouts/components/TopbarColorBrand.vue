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

    <!-- 頂部欄 (品牌色) -->
    <rect x="22" y="3" width="55" height="12" fill="var(--q-primary)" stroke="var(--q-primary)" stroke-width="0.5" />

    <!-- 頂部欄內容 (品牌色主題) -->
    <rect x="25" y="6" width="8" height="6" fill="#1565c0" rx="1" opacity="0.6" />
    <rect x="35" y="7" width="20" height="4" fill="#ffffff" rx="1" opacity="0.5" />

    <!-- 頂部欄右側按鈕 (品牌色) -->
    <circle cx="65" cy="9" r="1.5" fill="#ffffff" opacity="0.6" />
    <circle cx="69" cy="9" r="1.5" fill="#ffffff" opacity="0.6" />
    <circle cx="73" cy="9" r="1.5" fill="#ffffff" opacity="0.6" />

    <!-- 主要內容區域 -->
    <rect x="25" y="18" width="49" height="35" fill="#fafafa" rx="2" />

    <!-- 內容元素 -->
    <rect x="28" y="22" width="43" height="3" fill="#f8f9fa" rx="1" />
    <rect x="28" y="27" width="20" height="2" fill="#e9ecef" rx="1" />
    <rect x="28" y="31" width="30" height="2" fill="#e9ecef" rx="1" />

    <!-- 品牌色特色元素 -->
    <rect x="28" y="36" width="15" height="8" fill="#e3f2fd" stroke="var(--q-primary)" stroke-width="0.5" rx="1" />
    <rect x="46" y="36" width="25" height="8" fill="#e3f2fd" stroke="var(--q-primary)" stroke-width="0.5" rx="1" />

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
