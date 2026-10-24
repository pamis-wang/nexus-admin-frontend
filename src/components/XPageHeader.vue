<template>
  <q-card flat bordered class="q-mt-xs">
    <q-card-section class="q-pa-sm">
      <div class="row justify-between items-center">
        <!-- 標題區 -->
        <div>
          <!-- 標題上方的小字（編輯、檢視頁標示頁型，標題放物件名稱） -->
          <div v-if="overline" class="text-caption">{{ overline }}</div>
          <div class="text-h6 text-primary">
            <q-icon v-if="icon" :name="icon" class="q-mr-sm" />
            {{ title }}
            <!-- 標題旁的狀態標籤（系統預設、已停用…） -->
            <slot name="badges"></slot>
          </div>
          <!-- 標題下方的摘要（人數、相關連結…） -->
          <div v-if="$slots.meta" class="text-body2">
            <slot name="meta"></slot>
          </div>
        </div>

        <!-- 操作按鈕區 (使用 slot) -->
        <div v-if="$slots.actions" class="row q-gutter-sm">
          <slot name="actions"></slot>
        </div>
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
/**
 * 頁面標題與功能列
 *
 * 版面三段（麵包屑 → 標題區 → 內容區）的第二段，四種頁型（列表／新增／編輯／檢視）都用它。
 * 功能按鈕放 #actions，由左至右依次要 → 主要 → 低調排列；狀態標籤放 #badges，接在標題後面。
 * 編輯、檢視頁的標題放物件名稱，頁型放 overline；人數、相關連結這類摘要放 #meta。
 *
 * @example
 * <x-page-header overline="編輯角色" :title="role.name" icon="mdi-shield-edit-outline">
 *   <template #badges>
 *     <q-badge v-if="isSystemDefault" color="warning" text-color="dark" class="q-ml-sm">系統預設</q-badge>
 *   </template>
 *   <template #meta>用戶人數 3</template>
 * </x-page-header>
 */
defineProps<Props>()

interface Props {
  /** 頁面標題 */
  title: string
  /** 標題圖示 (Material Design Icons) */
  icon?: string
  /** 標題上方的小字，例如編輯頁的「編輯角色」 */
  overline?: string
}
</script>
