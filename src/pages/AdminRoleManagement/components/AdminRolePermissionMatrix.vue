<template>
  <!-- 工具列：搜尋、展開收合、授權摘要 -->
  <div class="row items-center q-gutter-sm q-mb-sm">
    <q-input
      v-model="keyword"
      dense
      outlined
      clearable
      :placeholder="t('role.placeholder.searchFeature')"
      :aria-label="t('role.placeholder.searchFeature')"
      style="min-width: 220px"
    >
      <template #prepend>
        <q-icon name="mdi-magnify" />
      </template>
    </q-input>
    <q-btn flat color="grey" icon="mdi-unfold-more-horizontal" :label="t('role.action.expandAll')" :disable="isSearching" @click="expandAll" />
    <q-btn flat color="grey" icon="mdi-unfold-less-horizontal" :label="t('role.action.collapseAll')" :disable="isSearching" @click="collapseAll" />
    <q-space />
    <div class="text-body2" aria-live="polite">
      <i18n-t keypath="role.matrix.grantedSummary" :plural="leafRows.length" scope="global">
        <template #ratio>
          <span class="text-weight-bold">{{ t('role.matrix.ratio', { granted: grantedCount, total: leafRows.length }) }}</span>
        </template>
      </i18n-t>
      <q-badge v-if="!props.isReadonly && changedCount > 0" color="warning" text-color="dark" class="q-ml-xs">
        {{ t('role.matrix.changedCount', changedCount) }}
      </q-badge>
    </div>
  </div>

  <q-markup-table flat bordered dense separator="horizontal" class="permission-matrix">
    <thead>
      <tr>
        <th class="bg-primary text-white text-left" style="min-width: 240px">{{ t('role.column.feature') }}</th>
        <th v-for="column in actionColumns" :key="column.action" class="bg-primary text-white text-center">
          <div class="column items-center">
            <span>{{ column.label }}</span>
            <q-checkbox
              v-if="!props.isReadonly && columnStates[column.action] !== 'na'"
              :model-value="toCheckboxValue(columnStates[column.action])"
              dense
              dark
              size="sm"
              color="accent"
              :aria-label="t('role.matrix.columnAria', { action: column.label })"
              @update:model-value="handleToggleColumn(column.action)"
            >
              <q-tooltip>{{ t('role.matrix.columnTooltip', { action: column.label }) }}</q-tooltip>
            </q-checkbox>
          </div>
        </th>
        <th class="bg-primary text-white text-center">
          <div class="column items-center">
            <span>{{ t('table.all') }}</span>
            <span v-if="!props.isReadonly" class="text-caption">{{ t('role.matrix.wholeRow') }}</span>
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
              :aria-label="isCollapsed(row.resourceId) ? t('role.matrix.expandAria', { name: row.name }) : t('role.matrix.collapseAria', { name: row.name })"
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
              {{ t('role.status.menuDisabled') }}
              <q-tooltip>{{ t('role.hint.menuDisabled') }}</q-tooltip>
            </q-badge>
          </div>
        </td>

        <!-- 四種操作 -->
        <td
          v-for="column in actionColumns"
          :key="column.action"
          class="text-center"
          :class="{
            'permission-matrix__cell--changed': !props.isReadonly && row.changedActions.includes(column.action),
            'permission-matrix__cell--na': row.cells[column.action] === 'na',
          }"
        >
          <span v-if="row.cells[column.action] === 'na'" class="text-caption">
            {{ t('role.status.notApplicable') }}
            <q-tooltip>{{ t('role.hint.notApplicable', { name: row.name, action: column.label }) }}</q-tooltip>
          </span>
          <template v-else-if="props.isReadonly">
            <q-icon v-if="row.cells[column.action] === 'all'" name="mdi-check-bold" color="primary" size="sm" :aria-label="t('role.status.granted')" />
            <span v-else-if="row.cells[column.action] === 'some'" class="text-caption text-weight-bold text-secondary">{{ t('role.status.partial') }}</span>
            <span v-else class="text-grey" :aria-label="t('role.status.notGranted')">—</span>
          </template>
          <q-checkbox
            v-else
            :model-value="toCheckboxValue(row.cells[column.action])"
            dense
            :aria-label="t('role.matrix.cellAria', { name: row.name, action: column.label })"
            @update:model-value="(value: boolean | null) => emit('setCell', row.resourceId, column.action, value === true)"
          />
        </td>

        <!-- 整列 -->
        <td class="text-center">
          <template v-if="props.isReadonly">
            <span v-if="row.rowState === 'all'" class="text-caption text-weight-bold text-primary">{{ t('table.all') }}</span>
            <span v-else-if="row.rowState === 'some'" class="text-caption text-weight-bold text-secondary">{{ t('role.status.partial') }}</span>
            <span v-else class="text-grey">—</span>
          </template>
          <q-checkbox
            v-else
            :model-value="toCheckboxValue(row.rowState)"
            dense
            :aria-label="t('role.matrix.rowAria', { name: row.name })"
            @update:model-value="emit('toggleRow', row.resourceId)"
          />
        </td>
      </tr>

      <tr v-if="visibleRows.length === 0">
        <td :colspan="actionColumns.length + 2" class="text-center q-pa-md">
          {{ isSearching ? t('role.empty.noMatchingFeatures') : t('role.empty.noFeatures') }}
        </td>
      </tr>
    </tbody>
  </q-markup-table>

  <!-- 圖例 -->
  <div class="row q-gutter-md text-caption q-mt-sm">
    <template v-if="!props.isReadonly">
      <span class="row items-center no-wrap">
        <span class="permission-matrix__legend-swatch permission-matrix__cell--changed q-mr-xs" />
        {{ t('role.matrix.legendChanged') }}
      </span>
      <span class="row items-center no-wrap">
        <q-checkbox :model-value="null" dense size="xs" disable class="q-mr-xs" />
        {{ t('role.matrix.legendPartial') }}
      </span>
    </template>
    <i18n-t v-else keypath="role.matrix.legendPartialReadonly" tag="span" scope="global">
      <template #term>
        <span class="text-weight-bold text-secondary">{{ t('role.status.partial') }}</span>
      </template>
    </i18n-t>
    <i18n-t keypath="role.matrix.legendNotApplicable" tag="span" scope="global">
      <template #term>
        <span class="text-weight-bold">{{ t('role.status.notApplicable') }}</span>
      </template>
    </i18n-t>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type { AdminRolePermissionAction, AdminRolePermissionCheckState, AdminRolePermissionRow } from '@/pages/AdminRoleManagement/types'

const { t } = useI18n()

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

/** 四種操作的欄位；檢視是其他三種的前提，固定排第一個。欄位名稱隨語系切換 */
const actionColumns = computed<ActionColumn[]>(() => [
  { action: 'canAccess', label: t('role.action.view') },
  { action: 'canCreate', label: t('common.action.add') },
  { action: 'canUpdate', label: t('role.action.update') },
  { action: 'canDelete', label: t('role.action.delete') },
])
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
