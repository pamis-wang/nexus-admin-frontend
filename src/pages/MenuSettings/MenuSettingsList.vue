<template>
  <x-breadcrumb :items="[{ label: '首頁', icon: 'mdi-home', to: { name: 'home' } }, { label: '系統管理' }, { label: '選單設定' }]" />

  <q-card flat bordered class="q-mt-xs">
    <!-- 頁面標題 -->
    <q-card-section class="q-pa-sm row items-center q-gutter-sm">
      <q-icon name="mdi-file-tree" size="sm" color="primary" />
      <div class="text-h6 text-primary">選單設定</div>
    </q-card-section>

    <q-separator />

    <!-- 小提醒 -->
    <q-banner class="bg-info text-white q-mx-sm q-my-sm" rounded dense data-tour="menu-settings-notice">
      <template #avatar>
        <q-icon name="mdi-information-outline" />
      </template>
      <div class="text-caption">※ 儲存是整棵樹一次送出，新增、改名、顯示狀態與順序的變更會一併寫入。</div>
      <div class="text-caption">※ 拖曳只能調整同一層的順序；要換到別的層級請用該列的「移到其他層級」。</div>
      <div class="text-caption">※ 完整資源名稱由層級名稱自動組成，改名或搬移時底下子項目的名稱會一起重寫。</div>
      <div class="text-caption">※ 資源代碼由後端種子資料維護，畫面唯讀；本頁不提供刪除資源的功能。</div>
    </q-banner>

    <!-- 未儲存變更 -->
    <q-banner v-if="hasChanges" class="bg-warning text-dark q-mx-sm q-mb-sm" rounded dense>
      <template #avatar>
        <q-icon name="mdi-alert-outline" />
      </template>
      <div class="text-caption">
        有未儲存的變更：新增 {{ changeSummary.addedCount }} 筆、更新 {{ changeSummary.updatedCount }} 筆、位置變動 {{ changeSummary.movedCount }} 筆
      </div>
      <template #action>
        <q-btn flat dense color="dark" label="全部還原" icon="mdi-undo" @click="handleReset" />
      </template>
    </q-banner>

    <!-- 工具列 -->
    <div class="row items-center q-pa-sm q-gutter-sm" data-tour="menu-settings-toolbar">
      <q-input v-model="keyword" dense outlined clearable placeholder="搜尋選單名稱或資源代碼" style="min-width: 240px">
        <template #prepend>
          <q-icon name="mdi-magnify" />
        </template>
      </q-input>

      <q-btn outline color="primary" label="全部展開" icon="mdi-unfold-more-horizontal" :disable="isFiltering" @click="handleExpandAll" />
      <q-btn outline color="primary" label="全部收合" icon="mdi-unfold-less-horizontal" :disable="isFiltering" @click="handleCollapseAll" />

      <q-space />

      <q-btn label="新增第一層" color="primary" icon="mdi-plus" @click="handleAddRoot" />
      <q-btn
        label="儲存"
        color="primary"
        icon="mdi-content-save-outline"
        :disable="!hasChanges"
        :loading="isSaving"
        data-tour="menu-settings-save"
        @click="handleSave"
      />
    </div>

    <!-- 搜尋提示：全量替換的坑，送出一律用完整的樹 -->
    <div v-if="isFiltering" class="q-px-sm q-pb-sm text-caption text-grey-7">
      搜尋只影響畫面顯示，儲存時送出的仍是完整的樹（共 {{ rows.length }} 筆）；搜尋狀態下暫時無法拖曳排序。
    </div>

    <q-inner-loading :showing="isLoading">
      <q-spinner-oval size="50px" color="primary" />
    </q-inner-loading>

    <div v-show="!isLoading" class="q-mx-sm q-mb-md menu-settings-table" data-tour="menu-settings-tree">
      <MenuSettingsTreeTable
        :key="tableRenderKey"
        v-model:editing-name="editingName"
        :rows="tableRows"
        :editing-row-key="editingRowKey"
        :can-drag="!isFiltering"
        :show-indent="!isFiltering"
        @toggle-expand="handleToggleExpand"
        @start-edit="handleStartEdit"
        @commit-edit="handleCommitEdit"
        @cancel-edit="handleCancelEdit"
        @toggle-enabled="handleToggleEnabled"
        @nudge="handleNudge"
        @add-child="handleAddChild"
        @request-move="handleRequestMove"
        @drag-move="handleDragMove"
      />
    </div>
  </q-card>

  <MenuSettingsMoveDialog
    v-model="isMoveDialogVisible"
    :node-name="moveRow?.name"
    :node-full-path="moveRow === null ? '' : fullPathOf(moveRow)"
    :descendant-count="moveRow === null ? 0 : descendantsOf(moveRow.rowKey).length"
    :targets="moveTargets"
    @confirm="handleConfirmMove"
  />
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'

import { useDialog } from '@/composables/useDialog'
import { useNotify } from '@/composables/useNotify'
import { useLogger } from '@/composables/useLogger'
import { useMenuSettingsTree } from '@/pages/MenuSettings/composables/useMenuSettingsTree'
import MenuSettingsMoveDialog from '@/pages/MenuSettings/components/MenuSettingsMoveDialog.vue'
import MenuSettingsTreeTable from '@/pages/MenuSettings/components/MenuSettingsTreeTable.vue'
import type { MenuSettingsDragMove, MenuSettingsRow, MenuSettingsTableRow } from '@/pages/MenuSettings/types'

const dialog = useDialog()
const notify = useNotify()
const logger = useLogger({ prefix: 'MenuSettings', enabled: import.meta.env.DEV })
const {
  rows,
  isLoading,
  isSaving,
  changeSummary,
  hasChanges,
  loadTree,
  saveTree,
  childrenOf,
  findRow,
  descendantsOf,
  fullPathOf,
  visibleRows,
  moveTargetsFor,
  validateTree,
  addRow,
  removeRow,
  renameRow,
  toggleRow,
  nudgeRow,
  reorderSiblings,
  moveRowTo,
  resetChanges,
} = useMenuSettingsTree()

const expandedRowKeys = ref<Set<string>>(new Set())
const editingRowKey = ref<string | null>(null)
const editingName = ref('')
const keyword = ref('')
const isMoveDialogVisible = ref(false)
const moveRowKey = ref<string | null>(null)
/**
 * 拖曳沒有造成順序變更時，資料層不會變、Vue 也就不會重繪，
 * 但 sortablejs 已經動過 DOM。改這個 key 強制重建表格，把畫面拉回資料的順序。
 */
const tableRenderKey = ref(0)

const isFiltering = computed(() => keyword.value !== null && keyword.value.trim().length > 0)

const moveRow = computed(() => (moveRowKey.value === null ? null : findRow(moveRowKey.value)))

const moveTargets = computed(() => (moveRowKey.value === null ? [] : moveTargetsFor(moveRowKey.value)))

const tableRows = computed<MenuSettingsTableRow[]>(() => {
  const source = isFiltering.value ? filteredRows() : visibleRows(expandedRowKeys.value)

  return source.map((row) => ({
    row,
    fullPath: fullPathOf(row),
    childCount: childrenOf(row.rowKey).length,
    isExpanded: expandedRowKeys.value.has(row.rowKey),
  }))
})

onMounted(async () => {
  window.addEventListener('beforeunload', handleBeforeUnload)
  await loadTree()
  handleExpandAll()
})

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', handleBeforeUnload)
})

onBeforeRouteLeave(() => {
  if (!hasChanges.value) {
    return true
  }
  return window.confirm('選單設定有未儲存的變更，離開後會遺失，確定要離開嗎？')
})

/** 送出整棵樹，先跑前端檢查再讓使用者確認影響範圍 */
async function handleSave() {
  const validation = validateTree()
  if (!validation.isValid) {
    dialog.showWarning(validation.message || '選單設定尚未通過檢查')
    return
  }

  const summary = changeSummary.value
  const message = `即將以整棵樹一次送出：新增 ${summary.addedCount} 筆、更新 ${summary.updatedCount} 筆、位置變動 ${summary.movedCount} 筆。確定要儲存嗎？`

  dialog.showConfirm(message, '儲存選單設定').onOk(async () => {
    const isSuccess = await saveTree()
    if (isSuccess) {
      editingRowKey.value = null
      editingName.value = ''
      handleExpandAll()
      notify.notifySuccess('選單設定已儲存')
    }
  })
}

/** 搜尋時改成平面清單，避免命中的項目被收合狀態藏起來 */
function filteredRows(): MenuSettingsRow[] {
  const text = keyword.value?.trim() ?? ''

  return visibleRows(null).filter(
    (row) => row.name.includes(text) || fullPathOf(row).includes(text) || (row.resourceCode !== null && row.resourceCode.includes(text)),
  )
}

/**
 * 切換單一節點的展開狀態
 * @param rowKey 要切換的節點
 */
function handleToggleExpand(rowKey: string) {
  if (expandedRowKeys.value.has(rowKey)) {
    expandedRowKeys.value.delete(rowKey)
  } else {
    expandedRowKeys.value.add(rowKey)
  }
}

function handleExpandAll() {
  expandedRowKeys.value = new Set(rows.value.map((row) => row.rowKey))
}

function handleCollapseAll() {
  expandedRowKeys.value = new Set()
}

/**
 * 進入行內編輯
 * @param rowKey 要改名的節點
 */
function handleStartEdit(rowKey: string) {
  const row = findRow(rowKey)
  if (row === null) {
    return
  }
  editingRowKey.value = rowKey
  editingName.value = row.name
}

/**
 * 套用行內編輯的名稱
 * @param rowKey 正在編輯的節點
 */
function handleCommitEdit(rowKey: string) {
  const name = editingName.value.trim()
  if (name.length === 0) {
    notify.notifyWarning('選單名稱不可空白')
    return
  }
  if (name.includes('>')) {
    notify.notifyWarning('選單名稱不可包含「>」，該符號是階層分隔用的')
    return
  }

  renameRow(rowKey, name)
  editingRowKey.value = null
  editingName.value = ''
}

/**
 * 取消行內編輯
 * @param rowKey 正在編輯的節點
 */
function handleCancelEdit(rowKey: string) {
  const row = findRow(rowKey)
  editingRowKey.value = null
  editingName.value = ''

  // 還沒命名就取消的新增列，直接收掉，不留一筆空白
  if (row !== null && row.id === null && row.name.length === 0) {
    removeRow(rowKey)
  }
}

/**
 * 切換顯示狀態
 * @param rowKey 要切換的節點
 * @param isEnabled 是否啟用
 */
function handleToggleEnabled(rowKey: string, isEnabled: boolean) {
  toggleRow(rowKey, isEnabled)
}

/**
 * 同層上下移動一位
 * @param rowKey 要搬移的節點
 * @param offset -1 上移、1 下移
 */
function handleNudge(rowKey: string, offset: number) {
  if (!nudgeRow(rowKey, offset)) {
    dialog.showInfo(offset < 0 ? '已經在同層的第一個位置' : '已經在同層的最後一個位置')
  }
}

function handleAddRoot() {
  const created = addRow(null)
  if (created !== null) {
    handleStartEdit(created.rowKey)
  }
}

/**
 * 在指定節點底下新增子節點
 * @param parentRowKey 父節點
 */
function handleAddChild(parentRowKey: string) {
  const created = addRow(parentRowKey)
  if (created !== null) {
    expandedRowKeys.value.add(parentRowKey)
    handleStartEdit(created.rowKey)
  }
}

/**
 * 開啟「移到其他層級」對話框
 * @param rowKey 要搬移的節點
 */
function handleRequestMove(rowKey: string) {
  moveRowKey.value = rowKey
  isMoveDialogVisible.value = true
}

/**
 * 套用搬移結果
 * @param parentRowKey 目標父節點；null 表示移到第一層
 */
function handleConfirmMove(parentRowKey: string | null) {
  const rowKey = moveRowKey.value
  if (rowKey === null) {
    return
  }

  if (moveRowTo(rowKey, parentRowKey)) {
    if (parentRowKey !== null) {
      expandedRowKeys.value.add(parentRowKey)
    }
    logger.info('節點已搬移', { rowKey, parentRowKey })
  }

  moveRowKey.value = null
}

/**
 * 拖曳結果：把節點放到同層某節點之後
 * @param payload 被拖曳的節點與落點
 */
function handleDragMove(payload: MenuSettingsDragMove) {
  const row = findRow(payload.rowKey)
  if (row === null) {
    return
  }

  const siblings = childrenOf(row.parentRowKey)
  const fromIndex = siblings.findIndex((item) => item.rowKey === payload.rowKey)
  let toIndex = 0

  if (payload.afterRowKey !== null) {
    const afterIndex = siblings.findIndex((item) => item.rowKey === payload.afterRowKey)
    if (afterIndex < 0) {
      tableRenderKey.value += 1
      return
    }
    toIndex = afterIndex < fromIndex ? afterIndex + 1 : afterIndex
  }

  if (!reorderSiblings(row.parentRowKey, fromIndex, toIndex)) {
    tableRenderKey.value += 1
  }
}

function handleReset() {
  dialog.showConfirm('未儲存的變更都會被丟棄，確定還原成上次載入的內容嗎？', '還原變更').onOk(() => {
    resetChanges()
    editingRowKey.value = null
    editingName.value = ''
    handleExpandAll()
  })
}

/**
 * 關閉或重新整理瀏覽器前的離開確認
 * @param event 瀏覽器離開事件
 */
function handleBeforeUnload(event: BeforeUnloadEvent) {
  if (!hasChanges.value) {
    return
  }
  // 現行規範是以 preventDefault 觸發離開確認；returnValue 已淘汰
  event.preventDefault()
}
</script>

<style scoped>
/* 欄位多，窄畫面讓表格自己橫向滾動，不要把整頁撐寬 */
.menu-settings-table {
  overflow-x: auto;
}
</style>
