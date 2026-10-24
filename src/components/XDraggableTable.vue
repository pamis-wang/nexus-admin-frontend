<template>
  <q-markup-table
    v-bind:rows="props.rows"
    v-bind:loading="props.loading"
    v-bind:row-key="props.rowKey"
    v-bind:separator="props.separator"
    v-bind:dense="props.dense"
    flat
    bordered
    v-bind="$attrs"
  >
    <thead class="bg-primary text-white">
      <q-tr>
        <q-th class="text-center" style="width: 40px">
          <q-icon name="mdi-drag-vertical" size="xs" />
        </q-th>
        <q-th v-for="column in visibleColumnsList" :key="column.name" :class="[column.headerClasses]" :style="getHeaderStyle(column)">
          {{ column.label }}
        </q-th>
      </q-tr>
    </thead>
    <VueDraggable
      v-model="rowsProxy"
      v-bind:animation="200"
      v-bind:handle="'.drag-handle'"
      v-on:update="handleDragUpdate"
      ghost-class="bg-brand-soft"
      chosen-class="bg-brand-soft"
      drag-class="bg-brand-soft"
      tag="tbody"
    >
      <q-tr v-for="row in props.rows" :key="getRowKey(row)" :class="{ 'q-tr--dense': props.dense }">
        <q-td class="text-center" :class="{ 'q-td--dense': props.dense }">
          <q-icon name="mdi-drag-vertical" size="xs" class="text-grey-6 drag-handle" />
        </q-td>
        <q-td
          v-for="column in visibleColumnsList"
          :key="column.name"
          :class="[...getCellClasses(column), { 'q-td--dense': props.dense }]"
          :style="column.style"
        >
          <!-- 自定義 slot -->
          <slot v-if="$slots[`body-cell-${column.name}`]" v-bind:name="`body-cell-${column.name}`" v-bind="getCellProps(row, column)"></slot>
          <!-- 可編輯欄位 -->
          <template v-else-if="column.editable">
            <q-input
              v-if="editingRowKey === getRowKey(row)"
              v-bind:model-value="getFieldValue(row, column)"
              v-on:update:model-value="updateFieldValue(row, column, $event)"
              dense
              outlined
            ></q-input>
            <span v-else>{{ getFieldValue(row, column) }}</span>
          </template>
          <!-- 預設文字欄位 -->
          <span v-else>{{ getFieldValue(row, column) }}</span>
        </q-td>
      </q-tr>
    </VueDraggable>
  </q-markup-table>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

import type { QTableColumn } from 'quasar'
import { VueDraggable, type DraggableEvent } from 'vue-draggable-plus'

/** 定義 props 的預設值 */
const props = withDefaults(defineProps<DraggableTableProps>(), {
  rowKey: 'id',
  loading: false,
  separator: 'horizontal',
  dense: false,
})

// 編輯狀態管理
const editingRowKey = ref<string | number | null>(null)
/** 定義事件 */
const emit = defineEmits<{
  'drag-change': [event: DragChangeEvent<unknown>]
  'update:rows': [rows: unknown[]]
  'row-edit': [row: unknown]
  'row-save': [row: unknown]
  'row-cancel': [row: unknown]
}>()

const rowsProxy = computed<unknown[]>({
  get: () => props.rows,
  set: (newRows) => {
    /** 處理資料更新 自動更新項次 */
    updateOrderFields(newRows)
    emit('update:rows', newRows)
  },
})
// 計算可見的欄位列表
const visibleColumnsList = computed(() => {
  if (!props.visibleColumns) {
    return props.columns
  }
  return props.columns.filter((column) => props.visibleColumns!.includes(column.name))
})

/** 擴展的表格欄位定義 */
export interface DraggableTableColumn extends QTableColumn {
  /** 是否可編輯 */
  editable?: boolean
  /** 是否為項次欄位，設為 true 時拖曳後會自動更新此欄位的數字排序 */
  isOrderField?: boolean
}

/** Slot 傳遞的 CellProps 型別 */
export interface CellProps {
  row: unknown
  column: DraggableTableColumn
  value: unknown
  rowIndex: number
  key: string | number
  isEditing?: boolean
}

/**
 * 可拖曳排序的表格組件
 *
 * @example
 * // 基本使用
 * <XDraggableTable
 *   v-bind:rows="data"
 *   v-bind:columns="columns"
 *   v-on:update:rows="updateData"
 * />
 *
 * @example
 * // 使用 slot 自定義欄位內容
 * <XDraggableTable :rows="data" :columns="columns" @row-edit="handleEdit" @row-save="handleSave">
 *   <template #body-cell-status="{ row, value }">
 *     <x-switch :model-value="value" @update:model-value="updateStatus(row, $event)" />
 *   </template>
 *   <template #body-cell-actions="{ row, isEditing }">
 *     <q-btn v-if="!isEditing" icon="mdi-pencil-outline" @click="startEdit(row)" />
 *     <template v-else>
 *       <q-btn icon="mdi-check" @click="saveEdit(row)" />
 *       <q-btn icon="mdi-close" @click="cancelEdit(row)" />
 *     </template>
 *   </template>
 * </XDraggableTable>
 *
 * @example
 * // 使用 editable 屬性自動編輯欄位和項次自動排序
 * const columns: DraggableTableColumn[] = [
 *   { name: 'order', label: '項次', field: 'order', isOrderField: true },
 *   { name: 'name', label: '名稱', field: 'name', editable: true },
 *   { name: 'email', label: '信箱', field: 'email', editable: true }
 * ]
 */

/** 表格的參數 */
export interface DraggableTableProps {
  /** 要顯示的資料陣列 */
  rows: unknown[]
  /** 欄位設定 */
  columns: DraggableTableColumn[]
  /** 定義每列的唯一索引，預設值為 id */
  rowKey?: string | ((row: unknown) => unknown) | undefined
  /** 是否讀取狀態 */
  loading?: boolean
  /** 定義可見欄位名稱的字串陣列（來自 'columns' 屬性定義的每列的 'name' 屬性） */
  visibleColumns?: string[]
  /** 分隔樣式 */
  separator?: 'horizontal' | 'vertical' | 'cell' | 'none'
  /** 緊湊模式 */
  dense?: boolean
}

/** 拖曳變更事件類型 */
export interface DragChangeEvent<T = unknown> {
  added?: { element: T; newIndex: number }
  removed?: { element: T; oldIndex: number }
  moved?: { element: T; newIndex: number; oldIndex: number }
}

/** 取得表頭樣式 */
function getHeaderStyle(column: DraggableTableColumn) {
  // 直接返回 column.style，讓 Vue 處理樣式綁定
  return column.style || {}
}

/** 取得資料列的唯一鍵值 */
function getRowKey(row: unknown): string | number {
  if (typeof props.rowKey === 'string') {
    return (row as Record<string, unknown>)[props.rowKey] as string | number
  } else if (typeof props.rowKey === 'function') {
    return props.rowKey(row) as string | number
  }
  return (row as Record<string, unknown>).id as string | number
}

/** 取得欄位值 */
function getFieldValue(row: unknown, column: DraggableTableColumn): string | number | FileList | null | undefined {
  if (typeof column.field === 'string') {
    return (row as Record<string, unknown>)[column.field] as string | number | FileList | null | undefined
  } else if (typeof column.field === 'function') {
    return column.field(row) as string | number | FileList | null | undefined
  }
  return ''
}

/** 取得儲存格樣式類別 */
function getCellClasses(column: DraggableTableColumn): string[] {
  const classes: string[] = []

  // 可以根據 column 的設定來決定樣式
  if (column.align === 'center') {
    classes.push('text-center')
  } else if (column.align === 'right') {
    classes.push('text-right')
  } else {
    classes.push('text-left')
  }

  if (typeof column.classes === 'string') {
    classes.push(column.classes)
  }

  return classes
}

/** 取得傳遞給 slot 的 cellProps */
function getCellProps(row: unknown, column: DraggableTableColumn): CellProps {
  const rowKey = getRowKey(row)
  return {
    row,
    column,
    value: getFieldValue(row, column),
    rowIndex: props.rows.indexOf(row),
    key: rowKey,
    isEditing: editingRowKey.value === rowKey,
  }
}

/** 開始編輯行 */
function startEdit(row: unknown) {
  const rowKey = getRowKey(row)
  editingRowKey.value = rowKey
  emit('row-edit', row)
}

/** 儲存編輯 */
function saveEdit(row: unknown) {
  editingRowKey.value = null
  emit('row-save', row)
}

/** 取消編輯 */
function cancelEdit(row: unknown) {
  editingRowKey.value = null
  emit('row-cancel', row)
}

/** 更新欄位值 */
function updateFieldValue(row: unknown, column: DraggableTableColumn, value: unknown) {
  if (typeof column.field === 'string') {
    ;(row as Record<string, unknown>)[column.field] = value
  }
}

/** 更新項次排序 */
function updateOrderFields(rows: unknown[]) {
  // 找到有 isOrderField 設定的欄位
  const orderColumns = props.columns.filter((column) => column.isOrderField && column.field)

  if (orderColumns.length > 0) {
    rows.forEach((row, index) => {
      orderColumns.forEach((column) => {
        if (column.field && typeof column.field === 'string') {
          ;(row as Record<string, unknown>)[column.field] = index + 1
        }
      })
    })
  }
}

/**
 * 處理拖曳排序結束事件
 *
 * vue-draggable-plus 透傳的是 sortablejs 原生的 onUpdate（只有索引），
 * 這裡換算回原本對外的 DragChangeEvent 形狀，避免使用端要跟著改。
 */
function handleDragUpdate(event: DraggableEvent<unknown>) {
  const oldIndex = event.oldIndex
  const newIndex = event.newIndex
  if (oldIndex === undefined || newIndex === undefined) {
    return
  }
  emit('drag-change', { moved: { element: event.data, newIndex, oldIndex } })
}

// 暴露編輯函式給外部使用
defineExpose({
  startEdit,
  saveEdit,
  cancelEdit,
})
</script>

<style lang="scss" scoped>
/* 拖曳效果樣式 */
.drag-handle {
  cursor: grab;
}
</style>
