<template>
  <q-table
    table-header-class="bg-primary text-white"
    v-bind:rows="props.rows"
    v-bind:columns="processedColumns"
    v-bind:visible-columns="props.visibleColumns"
    v-bind:row-key="props.rowKey"
    v-bind:loading="props.loading"
    v-bind:dense="isDense"
    v-model:pagination="pagination"
    hide-pagination
    separator="cell"
    flat
    bordered
    v-bind="$attrs"
  >
    <template v-slot:loading>
      <q-inner-loading showing color="primary" />
    </template>

    <template v-slot:no-data>
      <div class="full-width row flex-center q-gutter-sm">
        <span>查無資料</span>
      </div>
    </template>

    <template v-slot:[`body-cell-${column.name}`]="cellProps" v-for="column in processedColumns" v-bind:key="column.name">
      <q-td v-bind:props="cellProps">
        <slot v-if="$slots[`body-cell-${column.name}`]" v-bind:name="`body-cell-${column.name}`" v-bind="{ ...cellProps, isDense }"></slot>
        <template v-else>{{ cellProps.value }}</template>
      </q-td>
    </template>

    <template v-slot:header-selection="scope" v-if="$slots['header-selection']">
      <slot name="header-selection" v-bind="scope"></slot>
    </template>

    <template v-slot:body-selection="scope" v-if="$slots['body-selection']">
      <slot name="body-selection" v-bind="scope"></slot>
    </template>

    <template v-slot:bottom-row v-if="props.rows.length > 0">
      <!-- 自定義分頁控制區 -->
      <q-tr>
        <q-td colspan="100%" v-bind:class="isDense ? 'q-pa-lg' : 'q-pa-md'">
          <div class="row justify-between items-center full-width">
            <!-- 左側：每頁顯示選擇器與緊湊開關 -->
            <div class="row items-center" :class="isDense ? 'q-gutter-xs' : 'q-gutter-sm'">
              <span :class="isDense ? 'text-body2' : 'text-body1'">每頁顯示:</span>
              <q-select
                v-model="selectedRowsPerPage"
                :options="rowsPerPageOptions"
                :dense="isDense"
                :options-dense="isDense"
                borderless
                map-options
                v-on:update:model-value="onRowsPerPageChange"
              />

              <q-toggle v-model="isDense" />
            </div>

            <!-- 中間：分頁導航 -->
            <div class="flex justify-center">
              <q-pagination
                v-bind:model-value="pagination.page"
                v-bind:max="pagesNumber"
                v-bind:size="isDense ? 'sm' : 'md'"
                v-on:update:model-value="onPageChange"
                direction-links
                boundary-links
                outline
                color="secondary"
                active-color="secondary"
                active-text-color="primary"
                active-design="unelevated"
              />
            </div>

            <!-- 右側：顯示資料範圍資訊 -->
            <div :class="isDense ? 'text-body2 text-grey-7' : 'text-body1 text-grey-7'">
              第 {{ startRecord }} - {{ endRecord }} 筆 / 共 {{ totalRecords }} 筆
            </div>
          </div>
        </q-td>
      </q-tr>
    </template>
  </q-table>
</template>

<script setup lang="ts">
import type { QTableColumn } from 'quasar'
import { computed, ref } from 'vue'

/** 分頁 */
export interface Pagination {
  /** 排序列名稱（來自列定義） */
  sortBy?: string | null
  /** 是否遞減排序 */
  descending?: boolean
  /** 頁碼（從 1 開始） */
  page: number
  /** 每頁顯示列數（0 表示無限） */
  rowsPerPage?: number
  /** 後端資料總筆數，如果有成功從API獲取用戶列表才會新增這個欄位*/
  rowsCount?: number
  /** 用於伺服器端查詢，有指定數字代表分頁資料是外部自己處理 */
  rowsNumber?: number
}

/** 表格的參數 */
export interface XTableProps {
  /** 要顯示的資料陣列 */
  rows: unknown[]
  /** 欄位設定 */
  columns: QTableColumn[]
  /** 定義每列的唯一索引，預設值為 id */
  rowKey?: string | ((row: unknown) => unknown) | undefined
  /** 是否讀取狀態 */
  loading?: boolean
  /** 定義可見欄位名稱的字串陣列（來自 'columns' 屬性定義的每列的 'name' 屬性） */
  visibleColumns?: string[]
  /** 預設啟用緊湊模式 */
  dense?: boolean
}

/** 定義 props 的預設值 */
const props = withDefaults(defineProps<XTableProps>(), {
  rowKey: 'id',
  loading: false,
})

/** 綁定為官方原生的 pagination */
const pagination = defineModel<Pagination>('pagination', { required: true })

const emit = defineEmits(['change:page', 'change:rows-per-page'])

/** 緊湊模式開關 */
const isDense = ref(true)

/** 計算處理後的 columns，根據緊湊模式動態調整字體大小 */
const processedColumns = computed(() => {
  // 根據緊湊模式設定字體大小
  // 字體大小對應樣式 text-body2 => 0.875rem，否則為 text-body1 => 1rem
  const fontSize = isDense.value ? '0.875rem' : '1rem'

  return props.columns.map((column) => {
    // 如果原本有 style 且是字串，保留其他樣式但覆蓋 font-size
    let newStyle = ''

    // 處理 body style
    if (typeof column.style === 'string') {
      newStyle = column.style || ''
      // 移除原有的 font-size 設定（如果有的話）
      newStyle = newStyle.replace(/font-size\s*:\s*[^;]+;?/gi, '')
      // 添加新的 font-size
      newStyle = newStyle ? `${newStyle}; font-size: ${fontSize}` : `font-size: ${fontSize}`
    } else {
      // 如果 style 是函數或其他類型，只設定 font-size
      newStyle = `font-size: ${fontSize}`
    }

    // 處理 header style
    let newHeaderStyle = ''
    if (typeof column.headerStyle === 'string') {
      newHeaderStyle = column.headerStyle || ''
      newHeaderStyle = newHeaderStyle.replace(/font-size\s*:\s*[^;]+;?/gi, '')
      newHeaderStyle = newHeaderStyle ? `${newHeaderStyle}; font-size: ${fontSize}` : `font-size: ${fontSize}`
    } else {
      newHeaderStyle = `font-size: ${fontSize}`
    }

    return {
      ...column,
      style: newStyle,
      headerStyle: newHeaderStyle,
    }
  })
})

/** 每頁顯示選項 */
const rowsPerPageOptions = [
  { label: '5', value: 5 },
  { label: '10', value: 10 },
  { label: '25', value: 25 },
  { label: '50', value: 50 },
  { label: '全部', value: 0 },
]

/** 選中的每頁顯示選項（用於顯示 label） */
const selectedRowsPerPage = ref(rowsPerPageOptions.find((option) => option.value === pagination.value.rowsPerPage) || rowsPerPageOptions[4])

/** 計算總頁數 */
const pagesNumber = computed(() => {
  if ((pagination.value.rowsPerPage ?? 0) === 0) return 1
  return Math.ceil((pagination.value.rowsCount || 0) / (pagination.value.rowsPerPage ?? 0))
})

/** 計算顯示的資料起始範圍 */
const startRecord = computed(() => {
  // 如果每頁顯示為 0，表示顯示全部，起始筆數為 1
  if ((pagination.value.rowsPerPage ?? 0) === 0) return 1
  return (pagination.value.page - 1) * (pagination.value.rowsPerPage ?? 0) + 1
})

/** 計算顯示的資料結束範圍 */
const endRecord = computed(() => {
  if ((pagination.value.rowsPerPage ?? 0) === 0) return pagination.value.rowsCount || 0
  const end = pagination.value.page * (pagination.value.rowsPerPage ?? 0)
  return Math.min(end, pagination.value.rowsCount || 0)
})

const totalRecords = computed(() => pagination.value.rowsCount || 0)

/** 處理頁碼變化 */
function onPageChange(newPage: number) {
  pagination.value = { ...pagination.value, page: newPage }
  emit('change:page')
}

/** 處理每頁筆數變化 */
function onRowsPerPageChange() {
  if (selectedRowsPerPage.value) {
    pagination.value = { ...pagination.value, rowsPerPage: selectedRowsPerPage.value.value, page: 1 }
  }
  emit('change:rows-per-page')
  emit('change:page')
}
</script>

<style lang="scss" scoped>
/* 表格樣式可以在這裡自定義 */
</style>
