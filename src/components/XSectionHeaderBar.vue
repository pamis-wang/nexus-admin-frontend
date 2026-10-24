<template>
  <div class="x-section-header-bar q-pa-sm">
    {{ title }}
    <span v-if="hint" class="x-section-header-bar__hint">{{ hint }}</span>
  </div>
</template>

<script setup lang="ts">
/**
 * 表單分區標題
 *
 * 元件本身不帶上下間距：第一個分區不加，後續分區由頁面加 `class="q-mt-md"`（ui-conventions.md〈表單〉的寫法）。
 *
 * @example
 * <x-section-header-bar title="基本資料" />
 * <x-section-header-bar title="權限設定" class="q-mt-md" />
 */
defineProps<Props>()

interface Props {
  /** 分區標題，只放名詞短語、不加標點 */
  title: string
  /** 額外提示文字 */
  hint?: string
}
</script>

<style lang="scss" scoped>
.x-section-header-bar {
  /* 讀 CSS 變數而不是 SCSS 變數，暗色模式才會換成 styles.scss 裡的暗色版本 */
  background-color: var(--q-brand-soft);
  color: var(--q-primary);
  font-size: 1.1rem;
  font-weight: 400;
  border-radius: 4px;
}

.x-section-header-bar__hint {
  margin-left: 0.5rem;
  font-size: 0.875rem;
  color: $negative;
}
</style>
