<template>
  <div class="text-subtitle1 text-primary q-mb-md">
    <q-icon name="mdi-shield-account" class="q-mr-sm" />
    權限設定
  </div>

  <x-loading-state :loading="isLoading" message="載入權限設定中..." />

  <div v-if="!isLoading && treeNodes.length === 0" class="q-pa-md text-center text-grey-6">
    <q-icon name="mdi-information-outline" size="2em" />
    <div class="q-mt-sm">沒有可設定的資源，請先到選單設定建立資源</div>
  </div>

  <q-tree v-if="!isLoading && treeNodes.length > 0" :nodes="treeNodes" node-key="resourceId" default-expand-all no-connectors dense>
    <template #default-header="{ node }">
      <div class="full-width row items-center justify-between q-py-xs">
        <!-- 資源名稱 -->
        <div class="row items-center no-wrap">
          <q-icon :name="node.icon" class="q-mr-sm" :color="levelColor(node.level)" />
          <span class="text-weight-medium" :class="node.isEnabled ? '' : 'text-grey-6'">{{ node.name }}</span>
          <q-badge v-if="!node.isEnabled" color="grey-5" class="q-ml-sm">選單已停用</q-badge>
          <q-tooltip>{{ node.fullPath }}</q-tooltip>
        </div>

        <!-- 四種權限 -->
        <div class="row q-gutter-sm items-center no-wrap">
          <q-checkbox
            v-for="option in PERMISSION_OPTIONS"
            :key="option.type"
            :model-value="hasPermission(node.resourceId, option.type)"
            :label="option.label"
            :color="option.color"
            :disable="isReadonly || (option.type !== 'canAccess' && !hasPermission(node.resourceId, 'canAccess'))"
            size="sm"
            @update:model-value="(value: boolean) => emit('update', node.resourceId, option.type, value)"
          />
        </div>
      </div>
    </template>
  </q-tree>
</template>

<script setup lang="ts">
import type { RolePermissionTreeNode, RolePermissionType } from '@/pages/RoleManagement/types'

withDefaults(defineProps<Props>(), {
  isLoading: false,
  isReadonly: false,
})

const emit = defineEmits<{
  update: [resourceId: string, permissionType: RolePermissionType, value: boolean]
}>()

/** 訪問是其他三種的前提，固定排在第一個 */
const PERMISSION_OPTIONS: PermissionOption[] = [
  { type: 'canAccess', label: '檢視', color: 'primary' },
  { type: 'canCreate', label: '新增', color: 'positive' },
  { type: 'canUpdate', label: '修改', color: 'warning' },
  { type: 'canDelete', label: '刪除', color: 'negative' },
]

/** 元件參數 */
interface Props {
  /** 巢狀的資源節點 */
  treeNodes: RolePermissionTreeNode[]
  /** 查詢某個資源的權限 */
  hasPermission: (resourceId: string, permissionType: RolePermissionType) => boolean
  /** 是否載入中 */
  isLoading?: boolean
  /** 是否唯讀（檢視頁用） */
  isReadonly?: boolean
}

/** 一個資源可設定的四種權限 */
interface PermissionOption {
  /** 權限種類 */
  type: RolePermissionType
  /** 顯示文字 */
  label: string
  /** 勾選框顏色，走 Quasar 語意色 token */
  color: string
}

/**
 * 依層級給資源圖示顏色
 * @param level 資源層級
 */
function levelColor(level: number): string {
  if (level === 1) {
    return 'primary'
  }
  return level === 2 ? 'secondary' : 'grey-7'
}
</script>
