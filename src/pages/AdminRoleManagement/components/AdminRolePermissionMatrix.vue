<template>
  <!-- 工具列：搜尋、展開收合、授權摘要 -->
  <div class="row items-center q-gutter-sm q-mb-sm">
    <q-input v-model="keyword" dense outlined clearable placeholder="搜尋功能名稱" aria-label="搜尋功能名稱" style="min-width: 220px">
      <template #prepend>
        <q-icon name="mdi-magnify" />
      </template>
    </q-input>
    <q-btn flat color="grey" icon="mdi-unfold-more-horizontal" label="全部展開" :disable="isSearching" @click="expandAll" />
    <q-btn flat color="grey" icon="mdi-unfold-less-horizontal" label="全部收合" :disable="isSearching" @click="collapseAll" />
    <q-space />
    <div class="text-body2" aria-live="polite">
      已授權
      <span class="text-weight-bold">{{ grantedCount }}／{{ leafRows.length }}</span>
      個功能
      <q-badge v-if="!props.isReadonly && changedCount > 0" color="warning" text-color="dark" class="q-ml-xs">變更 {{ changedCount }} 項</q-badge>
    </div>
  </div>

  <q-markup-table flat bordered dense separator="horizontal" class="permission-matrix">
    <thead>
      <tr>
        <th class="bg-primary text-white text-left" style="min-width: 240px">功能</th>
        <th v-for="column in ACTION_COLUMNS" :key="column.action" class="bg-primary text-white text-center">
          <div class="column items-center">
            <span>{{ column.label }}</span>
            <q-checkbox
              v-if="!props.isReadonly && columnStates[column.action] !== 'na'"
              :model-value="toCheckboxValue(columnStates[column.action])"
              dense
              dark
              size="sm"
              color="accent"
              :aria-label="`整欄${column.label}`"
              @update:model-value="handleToggleColumn(column.action)"
            >
              <q-tooltip>整欄{{ column.label }}（有搜尋時只套用到搜尋結果）</q-tooltip>
            </q-checkbox>
          </div>
        </th>
        <th class="bg-primary text-white text-center">
          <div class="column items-center">
            <span>全部</span>
            <span v-if="!props.isReadonly" class="text-caption">整列</span>
          </div>
        </th>
      </tr>
    </thead>

    <tbody>
      <tr v-for="row in visibleRows" :key="row.resourceId" :class="{ 'permission-matrix__group': row.hasChildren }">
        <!-- 功能名稱：依層級縮排，群組列可以收合 -->
        <td>
          <div class="row items-center no-wrap" :style="{ paddingLeft: `${(row.level - 1) * 22}px` }">
            <q-btn
              v-if="row.hasChildren"
              flat
              dense
              round
              size="sm"
              color="grey"
              :icon="isCollapsed(row.resourceId) && !isSearching ? 'mdi-chevron-right' : 'mdi-chevron-down'"
              :aria-label="`${isCollapsed(row.resourceId) ? '展開' : '收合'}${row.name}`"
              :aria-expanded="!isCollapsed(row.resourceId)"
              :disable="isSearching"
              @click="toggleCollapsed(row.resourceId)"
            />
            <span v-else class="permission-matrix__caret-space" />
            <q-icon :name="row.icon" :color="levelColor(row.level)" size="xs" class="q-mx-xs" />
            <span :class="{ 'text-weight-medium': row.hasChildren }">
              {{ row.name }}
              <q-tooltip>{{ row.fullPath }}</q-tooltip>
            </span>
            <q-badge v-if="!row.isEnabled" color="grey" text-color="dark" class="q-ml-sm">
              <q-icon name="mdi-eye-off-outline" size="12px" class="q-mr-xs" />
              選單已停用
              <q-tooltip>選單暫時關閉；這裡的權限會原樣保留，選單重新啟用後立即生效</q-tooltip>
            </q-badge>
          </div>
        </td>

        <!-- 四種操作 -->
        <td
          v-for="column in ACTION_COLUMNS"
          :key="column.action"
          class="text-center"
          :class="{
            'permission-matrix__cell--changed': !props.isReadonly && row.changedActions.includes(column.action),
            'permission-matrix__cell--na': row.cells[column.action] === 'na',
          }"
        >
          <span v-if="row.cells[column.action] === 'na'" class="text-caption">
            不適用
            <q-tooltip>「{{ row.name }}」沒有{{ column.label }}操作</q-tooltip>
          </span>
          <template v-else-if="props.isReadonly">
            <q-icon v-if="row.cells[column.action] === 'all'" name="mdi-check-bold" color="primary" size="sm" aria-label="已授權" />
            <span v-else-if="row.cells[column.action] === 'some'" class="text-caption text-weight-bold text-secondary">部分</span>
            <span v-else class="text-grey" aria-label="未授權">—</span>
          </template>
          <q-checkbox
            v-else
            :model-value="toCheckboxValue(row.cells[column.action])"
            dense
            :aria-label="`${row.name}：${column.label}`"
            @update:model-value="(value: boolean | null) => emit('setCell', row.resourceId, column.action, value === true)"
          />
        </td>

        <!-- 整列 -->
        <td class="text-center">
          <template v-if="props.isReadonly">
            <span v-if="row.rowState === 'all'" class="text-caption text-weight-bold text-primary">全部</span>
            <span v-else-if="row.rowState === 'some'" class="text-caption text-weight-bold text-secondary">部分</span>
            <span v-else class="text-grey">—</span>
          </template>
          <q-checkbox
            v-else
            :model-value="toCheckboxValue(row.rowState)"
            dense
            :aria-label="`${row.name}：全部權限`"
            @update:model-value="emit('toggleRow', row.resourceId)"
          />
        </td>
      </tr>

      <tr v-if="visibleRows.length === 0">
        <td :colspan="ACTION_COLUMNS.length + 2" class="text-center q-pa-md">{{ isSearching ? '找不到符合的功能' : '沒有可設定的功能' }}</td>
      </tr>
    </tbody>
  </q-markup-table>

  <!-- 圖例 -->
  <div class="row q-gutter-md text-caption q-mt-sm">
    <template v-if="!props.isReadonly">
      <span class="row items-center no-wrap">
        <span class="permission-matrix__legend-swatch permission-matrix__cell--changed q-mr-xs" />
        與載入時不同（尚未儲存）
      </span>
      <span class="row items-center no-wrap">
        <q-checkbox :model-value="null" dense size="xs" disable class="q-mr-xs" />
        部分授權（底下的功能有勾有沒勾）
      </span>
    </template>
    <span v-else>
      <span class="text-weight-bold text-secondary">部分</span>
      ：底下的功能有些有授權、有些沒有
    </span>
    <span>
      <span class="text-weight-bold">不適用</span>
      ：這個功能沒有該項操作
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import type { AdminRolePermissionAction, AdminRolePermissionCheckState, AdminRolePermissionRow } from '@/pages/AdminRoleManagement/types'

/** 四種操作的欄位；檢視是其他三種的前提，固定排第一個 */
const ACTION_COLUMNS: ActionColumn[] = [
  { action: 'canAccess', label: '檢視' },
  { action: 'canCreate', label: '新增' },
  { action: 'canUpdate', label: '修改' },
  { action: 'canDelete', label: '刪除' },
]

const props = withDefaults(defineProps<Props>(), {
  isReadonly: false,
})

const emit = defineEmits<{
  setCell: [resourceId: string, action: AdminRolePermissionAction, value: boolean]
  toggleRow: [resourceId: string]
  toggleColumn: [action: AdminRolePermissionAction, leafIds: string[]]
}>()

/** 搜尋關鍵字 */
const keyword = ref<string | null>(null)
/** 收合起來的群組 */
const collapsedIds = ref<Set<string>>(new Set())

const normalizedKeyword = computed<string>(() => keyword.value?.trim().toLowerCase() ?? '')
const isSearching = computed<boolean>(() => normalizedKeyword.value !== '')
const rowById = computed<Map<string, AdminRolePermissionRow>>(() => new Map(props.rows.map((row) => [row.resourceId, row])))
/** 葉節點（實際存放權限的功能） */
const leafRows = computed<AdminRolePermissionRow[]>(() => props.rows.filter((row) => !row.hasChildren))
/** 有檢視權限的功能數 */
const grantedCount = computed<number>(() => leafRows.value.filter((row) => row.cells.canAccess === 'all').length)
/** 與載入時不同的格數 */
const changedCount = computed<number>(() => leafRows.value.reduce((total, row) => total + row.changedActions.length, 0))
/** 符合搜尋的列（含祖先與子孫，才看得出在哪一層） */
const searchedRows = computed<AdminRolePermissionRow[]>(() => props.rows.filter((row) => matchesSearch(row)))
/** 畫面上要顯示的列：搜尋時只看搜尋結果，否則排除收合群組底下的列 */
const visibleRows = computed<AdminRolePermissionRow[]>(() => (isSearching.value ? searchedRows.value : props.rows.filter((row) => !isUnderCollapsed(row))))
/** 整欄勾選的對象：只看搜尋、不看收合，收起來的群組照樣套用；沒有該操作的功能由組合函式略過 */
const searchedLeafIds = computed<string[]>(() => searchedRows.value.filter((row) => !row.hasChildren).map((row) => row.resourceId))
/** 各欄的勾選狀態，依整欄勾選的對象計算 */
const columnStates = computed<Record<AdminRolePermissionAction, AdminRolePermissionCheckState>>(() => ({
  canAccess: columnStateOf('canAccess'),
  canCreate: columnStateOf('canCreate'),
  canUpdate: columnStateOf('canUpdate'),
  canDelete: columnStateOf('canDelete'),
}))

/** 元件參數 */
interface Props {
  /** 權限矩陣的每一列，由 useAdminRolePermissionMatrix 算好聚合狀態 */
  rows: AdminRolePermissionRow[]
  /** 是否唯讀（檢視頁） */
  isReadonly?: boolean
}

/** 一種操作的欄位 */
interface ActionColumn {
  /** 操作 */
  action: AdminRolePermissionAction
  /** 欄位名稱 */
  label: string
}

/**
 * 勾選狀態轉成 q-checkbox 的值：部分授權為 null，畫面顯示半勾
 * @param state 勾選狀態
 */
function toCheckboxValue(state: AdminRolePermissionCheckState): boolean | null {
  if (state === 'some') return null

  return state === 'all'
}

function handleToggleColumn(action: AdminRolePermissionAction) {
  emit('toggleColumn', action, searchedLeafIds.value)
}

/** 某一欄在整欄勾選範圍內的狀態；範圍內沒有任何功能有這種操作時是不適用 */
function columnStateOf(action: AdminRolePermissionAction): AdminRolePermissionCheckState {
  const applicableLeafRows = searchedRows.value.filter((row) => !row.hasChildren && row.cells[action] !== 'na')
  if (applicableLeafRows.length === 0) return 'na'

  const grantedLeafCount = applicableLeafRows.filter((row) => row.cells[action] === 'all').length
  if (grantedLeafCount === 0) return 'none'

  return grantedLeafCount === applicableLeafRows.length ? 'all' : 'some'
}

function nameMatches(row: AdminRolePermissionRow): boolean {
  return row.name.toLowerCase().includes(normalizedKeyword.value)
}

/** 搜尋時：自己、子孫或祖先符合就顯示 */
function matchesSearch(row: AdminRolePermissionRow): boolean {
  if (!isSearching.value) return true
  if (nameMatches(row)) return true
  if (props.rows.some((candidate) => candidate.parentResourceId === row.resourceId && matchesSearch(candidate))) return true

  return ancestorsOf(row).some((ancestor) => nameMatches(ancestor))
}

function isUnderCollapsed(row: AdminRolePermissionRow): boolean {
  return ancestorsOf(row).some((ancestor) => collapsedIds.value.has(ancestor.resourceId))
}

function ancestorsOf(row: AdminRolePermissionRow): AdminRolePermissionRow[] {
  const ancestors: AdminRolePermissionRow[] = []
  let parent = row.parentResourceId === null ? undefined : rowById.value.get(row.parentResourceId)
  while (parent !== undefined) {
    ancestors.push(parent)
    parent = parent.parentResourceId === null ? undefined : rowById.value.get(parent.parentResourceId)
  }
  return ancestors
}

function isCollapsed(resourceId: string): boolean {
  return collapsedIds.value.has(resourceId)
}

function toggleCollapsed(resourceId: string) {
  const next = new Set(collapsedIds.value)
  if (next.has(resourceId)) {
    next.delete(resourceId)
  } else {
    next.add(resourceId)
  }
  collapsedIds.value = next
}

function expandAll() {
  collapsedIds.value = new Set()
}

function collapseAll() {
  collapsedIds.value = new Set(props.rows.filter((row) => row.hasChildren).map((row) => row.resourceId))
}

/** 依層級給資源圖示顏色 */
function levelColor(level: number): string {
  if (level === 1) return 'primary'

  return level === 2 ? 'secondary' : 'accent'
}
</script>

<style scoped>
/* 項目多時表格內捲動，表頭固定在上方 */
.permission-matrix {
  max-height: 520px;
}

.permission-matrix thead th {
  position: sticky;
  top: 0;
  z-index: 1;
}

.permission-matrix__caret-space {
  display: inline-block;
  width: 28px;
}

/* 未儲存的格子：用語意色 warning 疊淡色底與左側色條，亮色與暗色主題都看得出來 */
.permission-matrix__cell--changed {
  background: color-mix(in srgb, var(--q-warning) 20%, transparent);
  box-shadow: inset 3px 0 0 var(--q-warning);
}

/* 不適用的格子：淡化，與「未授權」的「—」區分 */
.permission-matrix__cell--na {
  opacity: 0.6;
}

.permission-matrix__legend-swatch {
  display: inline-block;
  width: 14px;
  height: 14px;
  border-radius: 3px;
}
</style>
