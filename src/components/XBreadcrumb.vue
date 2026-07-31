<template>
  <!-- Breadcrumb wrapper with consistent styling -->
  <q-card flat bordered class="q-mt-xs" v-bind="$attrs">
    <q-card-section class="q-pa-sm">
      <q-breadcrumbs :align="align">
        <q-breadcrumbs-el v-for="(item, index) in items" :key="index" :label="item.label" :icon="item.icon" :to="item.to" />
      </q-breadcrumbs>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'

/**
 * 統一麵包屑 component
 * 提供一致的導航路徑顯示，支援多層級導航結構
 *
 * @example
 * <XBreadcrumb :items="[
 *   { label: '首頁', icon: 'home', to: { name: 'home' } },
 *   { label: '系統管理' },
 *   { label: '用戶管理', to: { name: 'userManagementList' } },
 *   { label: '新增使用者' }
 * ]" />
 */

/** Breadcrumb item interface */
export interface BreadcrumbItem {
  /** 顯示文字 */
  label: string
  /** 圖示名稱（主要用於首頁 home icon） */
  icon?: string
  /** 路由導航目標（可選，有則可點擊） */
  to?: RouteLocationRaw
}

/** Component props */
interface Props {
  /** 麵包屑項目陣列 */
  items: BreadcrumbItem[]
  /** 對齊方式 */
  align?: 'left' | 'center' | 'right'
}

withDefaults(defineProps<Props>(), {
  align: 'right',
})
</script>
