<template>
  <transition name="layout-fade" mode="out-in">
    <component :is="currentLayout" :key="layoutStore.layoutConfig.layout">
      <slot></slot>
    </component>
  </transition>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useLayoutStore } from '@/stores/useLayout'
import VerticalLayout from '@/layouts/VerticalLayout.vue'
import HorizontalLayout from '@/layouts/HorizontalLayout.vue'

const layoutStore = useLayoutStore()

const currentLayout = computed(() => {
  return layoutStore.layoutConfig.layout === 'horizontal' ? HorizontalLayout : VerticalLayout
})
</script>

<style scoped>
/* 佈局切換過渡動畫 */
.layout-fade-enter-active,
.layout-fade-leave-active {
  transition: opacity 0.5s ease-in-out;
}

.layout-fade-enter-from,
.layout-fade-leave-to {
  opacity: 0;
}

.layout-fade-enter-to,
.layout-fade-leave-from {
  opacity: 1;
}
</style>
