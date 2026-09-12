<template>
  <q-markup-table flat bordered dense separator="horizontal">
    <thead class="bg-primary text-white">
      <q-tr>
        <q-th class="text-center" style="width: 40px">
          <q-icon name="mdi-drag" size="xs" />
        </q-th>
        <q-th class="text-left">選單名稱</q-th>
        <q-th class="text-center" style="width: 90px">層級</q-th>
        <q-th class="text-left" style="width: 220px">完整資源名稱</q-th>
        <q-th class="text-left" style="width: 180px">
          資源代碼
          <div class="text-caption text-weight-regular">唯讀</div>
        </q-th>
        <q-th class="text-center" style="width: 130px">
          順序
          <div class="text-caption text-weight-regular">displayOrder</div>
        </q-th>
        <q-th class="text-center" style="width: 110px">顯示狀態</q-th>
        <q-th class="text-center" style="width: 170px">操作</q-th>
      </q-tr>
    </thead>

    <VueDraggable
      :model-value="rows"
      handle=".drag-handle"
      :animation="200"
      :disabled="!canDrag"
      ghost-class="menu-row-dragging"
      chosen-class="menu-row-dragging"
      drag-class="menu-row-dragging"
      tag="tbody"
      @move="handleMove"
      @update="handleUpdate"
    >
      <q-tr v-for="element in rows" :key="element.row.rowKey" :data-row-key="element.row.rowKey" :class="rowClass(element)">
        <!-- 拖曳把手 -->
        <q-td class="text-center">
          <q-icon name="mdi-drag" size="xs" :class="canDrag ? 'text-grey-6 drag-handle cursor-pointer' : 'text-grey-4'">
            <q-tooltip>{{ canDrag ? '拖曳可調整同一層的順序，跨層請用「移到其他層級」' : '搜尋中無法拖曳排序' }}</q-tooltip>
          </q-icon>
        </q-td>

        <!-- 選單名稱：縮排 ＋ 展開 ＋ 行內編輯 -->
        <q-td>
          <div class="row items-center no-wrap">
            <div :style="{ width: showIndent ? `${(element.row.level - 1) * 24}px` : '0px' }"></div>

            <q-btn
              v-if="element.childCount > 0"
              flat
              dense
              round
              size="sm"
              :icon="element.isExpanded ? 'expand_more' : 'chevron_right'"
              @click="emit('toggleExpand', element.row.rowKey)"
            />
            <div v-else style="width: 28px"></div>

            <q-input
              v-if="editingRowKey === element.row.rowKey"
              v-model="editingName"
              dense
              outlined
              autofocus
              maxlength="50"
              placeholder="輸入這一層的名稱"
              class="q-mr-sm"
              style="min-width: 220px"
              @keyup="(event: KeyboardEvent) => handleEditKeyup(event, element.row.rowKey)"
            />
            <template v-else>
              <span :class="element.row.isEnabled ? '' : 'text-grey-6'">{{ element.row.name || '（未命名）' }}</span>
              <q-badge v-if="element.row.id === null" color="positive" class="q-ml-sm">新增</q-badge>
              <q-badge v-if="element.childCount > 0 && !element.isExpanded" color="grey-5" class="q-ml-sm">含 {{ element.childCount }} 項</q-badge>
            </template>
          </div>
        </q-td>

        <!-- 層級 -->
        <q-td class="text-center">
          <q-badge :color="levelColor(element.row.level)" outline>第 {{ element.row.level }} 層</q-badge>
        </q-td>

        <!-- 完整資源名稱（送出給後端的 resourceName） -->
        <q-td>
          <span class="text-caption text-grey-8">{{ editingRowKey === element.row.rowKey ? previewPath(element) : element.fullPath }}</span>
        </q-td>

        <!-- 資源代碼：後端種子資料維護的端點權限判斷鍵，畫面唯讀 -->
        <q-td>
          <template v-if="element.row.resourceCode === null">
            <span class="text-caption text-grey-5">-</span>
          </template>
          <template v-else>
            <q-badge color="grey-3" text-color="dark" class="text-caption">
              <q-icon name="mdi-lock-outline" size="xs" class="q-mr-xs" />
              {{ element.row.resourceCode }}
              <q-tooltip>已綁定端點權限，由後端種子資料維護，畫面不可修改</q-tooltip>
            </q-badge>
          </template>
        </q-td>

        <!-- displayOrder -->
        <q-td class="text-center">
          <div class="row items-center justify-center no-wrap">
            <q-btn flat dense round size="sm" icon="mdi-chevron-up" @click="emit('nudge', element.row.rowKey, -1)">
              <q-tooltip>上移</q-tooltip>
            </q-btn>
            <span class="text-caption text-grey-7">{{ element.row.displayOrder || '-' }}</span>
            <q-btn flat dense round size="sm" icon="mdi-chevron-down" @click="emit('nudge', element.row.rowKey, 1)">
              <q-tooltip>下移</q-tooltip>
            </q-btn>
          </div>
        </q-td>

        <!-- 顯示狀態 -->
        <q-td class="text-center">
          <x-switch
            :model-value="element.row.isEnabled"
            size="sm"
            active-text="顯示"
            inactive-text="隱藏"
            active-color="positive"
            inactive-color="grey"
            @update:model-value="(value: boolean) => emit('toggleEnabled', element.row.rowKey, value)"
          />
        </q-td>

        <!-- 操作 -->
        <q-td class="text-center">
          <template v-if="editingRowKey === element.row.rowKey">
            <q-btn flat dense round color="positive" icon="mdi-check" @click="emit('commitEdit', element.row.rowKey)">
              <q-tooltip>完成</q-tooltip>
            </q-btn>
            <q-btn flat dense round color="negative" icon="mdi-close" @click="emit('cancelEdit', element.row.rowKey)">
              <q-tooltip>取消</q-tooltip>
            </q-btn>
          </template>
          <template v-else>
            <q-btn flat dense round color="primary" icon="mdi-file-document-edit-outline" @click="emit('startEdit', element.row.rowKey)">
              <q-tooltip>改名</q-tooltip>
            </q-btn>
            <q-btn v-if="element.row.level < maxLevel" flat dense round color="primary" icon="mdi-plus" @click="emit('addChild', element.row.rowKey)">
              <q-tooltip>新增第 {{ element.row.level + 1 }} 層</q-tooltip>
            </q-btn>
            <q-btn flat dense round color="primary" icon="mdi-folder-move-outline" @click="emit('requestMove', element.row.rowKey)">
              <q-tooltip>移到其他層級</q-tooltip>
            </q-btn>
          </template>
        </q-td>
      </q-tr>
    </VueDraggable>
  </q-markup-table>

  <div v-if="rows.length === 0" class="q-pa-lg text-center text-grey-6">沒有符合條件的選單項目</div>
</template>

<script setup lang="ts">
import { VueDraggable, type DraggableEvent } from 'vue-draggable-plus'

import type { AdminResourceDragMove, AdminResourceTableRow } from '@/pages/AdminResourceManagement/types'

const props = withDefaults(defineProps<Props>(), {
  editingRowKey: null,
  canDrag: true,
  showIndent: true,
  maxLevel: 3,
})

/** 行內編輯中的名稱，由上層頁面持有 */
const editingName = defineModel<string>('editingName', { default: '' })

const emit = defineEmits<{
  toggleExpand: [rowKey: string]
  startEdit: [rowKey: string]
  commitEdit: [rowKey: string]
  cancelEdit: [rowKey: string]
  toggleEnabled: [rowKey: string, isEnabled: boolean]
  nudge: [rowKey: string, offset: number]
  addChild: [rowKey: string]
  requestMove: [rowKey: string]
  dragMove: [payload: AdminResourceDragMove]
}>()

/** 表格參數 */
interface Props {
  /** 目前可見的列（已依展開狀態與搜尋條件過濾） */
  rows: AdminResourceTableRow[]
  /** 正在行內編輯的列 */
  editingRowKey?: string | null
  /** 是否允許拖曳（搜尋中要關掉） */
  canDrag?: boolean
  /** 是否依層級縮排；搜尋成平面清單時關掉，避免父節點不在畫面上還留一段空白 */
  showIndent?: boolean
  /** 資源層級上限 */
  maxLevel?: number
}

/** sortablejs onMove 事件，只列這裡會用到的欄位 */
interface AdminResourceMoveEvent {
  /** 被拖曳的列 */
  dragged: HTMLElement | null
  /** 滑鼠目前所在的列 */
  related: HTMLElement | null
}

/**
 * 從 tr 的 data-row-key 反查資料列
 *
 * 拖曳過程中 sortablejs 會即時搬動 DOM，索引不可靠，只能用 key 對回來。
 * @param element 事件帶出的列元素
 */
function rowByElement(element: HTMLElement | null): AdminResourceTableRow | null {
  const rowKey = element?.dataset.rowKey
  if (rowKey === undefined) {
    return null
  }
  return props.rows.find((item) => item.row.rowKey === rowKey) ?? null
}

/**
 * 只允許同一個父節點底下的列互相調整順序，跨層一律走「移到其他層級」
 * @param event sortablejs 的 move 事件
 */
function handleMove(event: AdminResourceMoveEvent): boolean {
  const dragged = rowByElement(event.dragged)
  const related = rowByElement(event.related)
  if (dragged === null || related === null) {
    return false
  }
  return dragged.row.parentRowKey === related.row.parentRowKey
}

/**
 * 把 sortablejs 的可見列索引換算成「放在哪個同層節點之後」
 *
 * 套件內部會把被搬動的 DOM 還原回原位，rows 沒變畫面就不會亂跳，
 * 等上層依這個事件重算樹資料後再重新渲染。
 * @param event sortablejs 的 update 事件
 */
function handleUpdate(event: DraggableEvent<AdminResourceTableRow>) {
  const { oldIndex, newIndex } = event
  if (oldIndex === undefined || newIndex === undefined || oldIndex === newIndex) {
    return
  }

  const list = [...props.rows]
  const moved = list.splice(oldIndex, 1)[0]
  if (moved === undefined) {
    return
  }
  list.splice(newIndex, 0, moved)

  let afterRowKey: string | null = null
  for (let index = newIndex - 1; index >= 0; index -= 1) {
    const candidate = list[index]
    if (candidate !== undefined && candidate.row.parentRowKey === moved.row.parentRowKey) {
      afterRowKey = candidate.row.rowKey
      break
    }
  }

  emit('dragMove', { rowKey: moved.row.rowKey, afterRowKey })
}

/**
 * 行內編輯的鍵盤操作
 *
 * 同名事件無法在模板上寫兩次，Enter 與 Esc 併在同一個 keyup 處理。
 * @param event 鍵盤事件
 * @param rowKey 正在編輯的列
 */
function handleEditKeyup(event: KeyboardEvent, rowKey: string) {
  if (event.key === 'Enter') {
    emit('commitEdit', rowKey)
    return
  }
  if (event.key === 'Escape') {
    emit('cancelEdit', rowKey)
  }
}

/**
 * 列的底色：第一層加強區隔，停用的列調淡
 * @param element 表格列
 */
function rowClass(element: AdminResourceTableRow): string {
  if (element.row.level === 1) {
    return 'menu-row-root'
  }
  return element.row.isEnabled ? '' : 'menu-row-disabled'
}

/**
 * 層級徽章顏色
 * @param level 資源層級
 */
function levelColor(level: number): string {
  if (level === 1) {
    return 'primary'
  }
  return level === 2 ? 'secondary' : 'grey'
}

/**
 * 編輯中即時預覽這一筆的完整資源名稱
 * @param element 表格列
 */
function previewPath(element: AdminResourceTableRow): string {
  const segments = element.fullPath.split('>')
  segments[segments.length - 1] = editingName.value || '？'
  return segments.join('>')
}
</script>

<style scoped>
/* 底色一律由語意色 token 調色，不寫死 bg-blue-1 這類調色盤色階 */
.menu-row-root {
  background: color-mix(in srgb, var(--q-primary) 8%, transparent);
}

.menu-row-disabled {
  background: color-mix(in srgb, var(--q-dark) 6%, transparent);
}

.menu-row-dragging {
  background: color-mix(in srgb, var(--q-primary) 16%, transparent);
}
</style>
