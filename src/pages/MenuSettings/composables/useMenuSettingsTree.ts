import { computed, ref } from 'vue'

import { useDialog } from '@/composables/useDialog'
import { useLogger } from '@/composables/useLogger'
import { getAdminResourceTree, replaceAdminResourceTree } from '@/services/admin/adminResourceService'
import type { AdminResourceTreeNodeRequest, AdminResourceTreeNodeResponse } from '@/services/admin/adminResourceService'
import type { ResponseStructure } from '@/services/axiosService'
import type { MenuSettingsChangeSummary, MenuSettingsMoveTarget, MenuSettingsRow, MenuSettingsTreeValidation } from '@/pages/MenuSettings/types'

/** 資源層級上限，對齊後端 AdminResourceService.MaxResourceLevel */
const MAX_LEVEL = 3
/** 同層筆數上限，對齊後端 AdminResourceService.MaxResourcesPerLevel */
const MAX_SIBLINGS = 99
/** 完整資源名稱的層級分隔符號 */
const PATH_SEPARATOR = '>'

/**
 * 選單設定的資源樹狀態管理
 *
 * 後端是嵌套樹 ＋ 版本戳記的全量替換（PUT /api/admin-resources/tree）：
 * 不在樹中的既有資源會被刪除，parentId／level／displayOrder 由嵌套位置重算，
 * 但 resourceName 不會重算 —— 所以改名或搬移後，本層與所有子孫的完整路徑都由前端重寫。
 *
 * 這個版本的 admin_resources 沒有軟刪除欄位，因此整頁不提供刪除資源的功能，送出的樹一律含全部既有節點：
 * removeRow 只用在「新增了一列但取消命名」這種丟棄未送出資料的情況，changeSummary 也因此只算
 * 新增／更新／位置變動。
 */
export function useMenuSettingsTree() {
  const logger = useLogger({ prefix: 'MenuSettingsTree', enabled: import.meta.env.DEV })
  const dialog = useDialog()

  /** 扁平化後的全部節點，畫面操作都以這份為準 */
  const rows = ref<MenuSettingsRow[]>([])
  /** 上次讀取時的快照，用來算出未儲存變更 */
  const originalRows = ref<MenuSettingsRow[]>([])
  /** 讀取時取得的版本戳記，整批替換時原封不動帶回 */
  const version = ref<string | null>(null)
  const isLoading = ref(false)
  const isSaving = ref(false)

  let newRowSeq = 1

  const changeSummary = computed<MenuSettingsChangeSummary>(() => {
    const originalMap = new Map(originalRows.value.map((row) => [row.id, row]))

    let addedCount = 0
    let updatedCount = 0
    let movedCount = 0

    rows.value.forEach((row) => {
      if (row.id === null) {
        addedCount += 1
        return
      }

      const before = originalMap.get(row.id)
      if (before === undefined) {
        addedCount += 1
        return
      }
      if (before.name !== row.name || before.isEnabled !== row.isEnabled) {
        updatedCount += 1
      }
      if (before.parentRowKey !== row.parentRowKey || before.position !== row.position) {
        movedCount += 1
      }
    })

    return {
      addedCount,
      updatedCount,
      movedCount,
      hasChanges: addedCount > 0 || updatedCount > 0 || movedCount > 0,
    }
  })

  const hasChanges = computed(() => changeSummary.value.hasChanges)

  /** 讀取整棵樹並攤平成畫面用的扁平陣列 */
  async function loadTree() {
    isLoading.value = true
    try {
      logger.info('開始載入資源樹')

      const response = await getAdminResourceTree()

      if (response.status === 200 && response.result.data) {
        applyTreeResponse(response.result.data.version, response.result.data.items)
        logger.info('資源樹載入成功', { count: rows.value.length, version: version.value })
      } else if (response.result.error) {
        dialog.showWarning(response.result.error.message, '載入失敗')
      }
    } catch (error) {
      const errorMessage = (error as ResponseStructure<null>).errorMessage || '未知錯誤'
      logger.error('載入資源樹失敗', errorMessage)
      dialog.showError(errorMessage, '載入選單設定失敗')
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 整批替換整棵樹
   * @returns 是否儲存成功
   */
  async function saveTree(): Promise<boolean> {
    const validation = validateTree()
    if (!validation.isValid) {
      dialog.showWarning(validation.message || '選單設定尚未通過檢查')
      return false
    }

    isSaving.value = true
    try {
      logger.info('開始整批替換資源樹', { version: version.value })

      const response = await replaceAdminResourceTree({
        version: version.value,
        items: buildRequestItems(null),
      })

      if (response.status === 200 && response.result.data) {
        applyTreeResponse(response.result.data.version, response.result.data.items)
        logger.info('資源樹儲存成功', { version: version.value })
        return true
      }

      dialog.showError(response.result.error?.message || '儲存選單設定失敗')
      return false
    } catch (error) {
      const failure = error as ResponseStructure<null>
      const errorMessage = failure.errorMessage || '未知錯誤'
      logger.error('資源樹儲存失敗', { status: failure.status, errorMessage })

      if (failure.status === 409) {
        dialog.showWarning('這份選單設定在你編輯期間已被其他人修改，請重新載入後再調整。', '版本衝突')
      } else if (failure.status === 403) {
        dialog.showWarning(errorMessage, '不允許的變更')
      } else {
        dialog.showError(errorMessage, '儲存選單設定失敗')
      }

      return false
    } finally {
      isSaving.value = false
    }
  }

  /** 以後端回應重建畫面狀態與比對用快照 */
  function applyTreeResponse(newVersion: string | null, items: AdminResourceTreeNodeResponse[]) {
    version.value = newVersion
    newRowSeq = 1
    rows.value = flattenNodes(items, null, 1)
    originalRows.value = rows.value.map((row) => ({ ...row }))
  }

  /** 把後端的嵌套樹攤平成扁平陣列 */
  function flattenNodes(nodes: AdminResourceTreeNodeResponse[], parentRowKey: string | null, level: number): MenuSettingsRow[] {
    const result: MenuSettingsRow[] = []

    nodes.forEach((node, index) => {
      result.push({
        rowKey: node.id,
        id: node.id,
        parentRowKey,
        level,
        name: lastSegmentOf(node.resourceName),
        resourceCode: node.resourceCode,
        isEnabled: node.isEnabled,
        displayOrder: node.displayOrder,
        position: index + 1,
      })
      result.push(...flattenNodes(node.children, node.id, level + 1))
    })

    return result
  }

  /** 取出完整路徑的最後一段作為本層顯示名稱 */
  function lastSegmentOf(resourceName: string): string {
    const segments = resourceName.split(PATH_SEPARATOR)
    return segments[segments.length - 1]?.trim() || resourceName
  }

  /** 依同層順序取出子節點 */
  function childrenOf(parentRowKey: string | null): MenuSettingsRow[] {
    return rows.value.filter((row) => row.parentRowKey === parentRowKey).sort((a, b) => a.position - b.position)
  }

  /** 以前端識別碼查節點 */
  function findRow(rowKey: string): MenuSettingsRow | null {
    return rows.value.find((row) => row.rowKey === rowKey) ?? null
  }

  /** 全部子孫（不含自己） */
  function descendantsOf(rowKey: string): MenuSettingsRow[] {
    const result: MenuSettingsRow[] = []

    function walk(parentRowKey: string) {
      childrenOf(parentRowKey).forEach((child) => {
        result.push(child)
        walk(child.rowKey)
      })
    }

    walk(rowKey)
    return result
  }

  /** 完整資源名稱（含父路徑），送出與顯示共用 */
  function fullPathOf(row: MenuSettingsRow): string {
    const segments = [row.name]
    let current = row

    while (current.parentRowKey !== null) {
      const parent = findRow(current.parentRowKey)
      if (parent === null) {
        break
      }
      segments.unshift(parent.name)
      current = parent
    }

    return segments.join(PATH_SEPARATOR)
  }

  /**
   * 依畫面展開狀態攤平成表格列
   * @param expandedRowKeys 已展開的節點；null 表示全部展開
   */
  function visibleRows(expandedRowKeys: Set<string> | null): MenuSettingsRow[] {
    const result: MenuSettingsRow[] = []

    function walk(parentRowKey: string | null) {
      childrenOf(parentRowKey).forEach((row) => {
        result.push(row)
        if (expandedRowKeys === null || expandedRowKeys.has(row.rowKey)) {
          walk(row.rowKey)
        }
      })
    }

    walk(null)
    return result
  }

  /** 子樹高度，自己算一層 */
  function subtreeHeightOf(rowKey: string): number {
    const children = childrenOf(rowKey)
    if (children.length === 0) {
      return 1
    }
    return 1 + Math.max(...children.map((child) => subtreeHeightOf(child.rowKey)))
  }

  /** 重編同層的 position */
  function renumber(parentRowKey: string | null) {
    childrenOf(parentRowKey).forEach((row, index) => {
      row.position = index + 1
    })
  }

  /** 重算某節點及其子孫的 level */
  function relevel(rowKey: string, level: number) {
    const row = findRow(rowKey)
    if (row === null) {
      return
    }
    row.level = level
    childrenOf(rowKey).forEach((child) => relevel(child.rowKey, level + 1))
  }

  /**
   * 新增節點
   * @param parentRowKey 父節點識別碼；null 表示新增第一層
   * @returns 新增的節點；已達層級或筆數上限時回 null
   */
  function addRow(parentRowKey: string | null): MenuSettingsRow | null {
    const parent = parentRowKey === null ? null : findRow(parentRowKey)
    const level = parent === null ? 1 : parent.level + 1

    if (level > MAX_LEVEL) {
      dialog.showWarning(`資源層級最多 ${MAX_LEVEL} 層`)
      return null
    }

    const siblings = childrenOf(parentRowKey)
    if (siblings.length >= MAX_SIBLINGS) {
      dialog.showWarning(`同一層最多 ${MAX_SIBLINGS} 筆`)
      return null
    }

    const row: MenuSettingsRow = {
      rowKey: `new-${newRowSeq++}`,
      id: null,
      parentRowKey,
      level,
      name: '',
      resourceCode: null,
      isEnabled: true,
      displayOrder: 0,
      position: siblings.length + 1,
    }

    rows.value.push(row)
    logger.info('新增節點', { rowKey: row.rowKey, level })
    return row
  }

  /**
   * 把節點連同子孫移出畫面上的樹
   *
   * 頁面唯一的使用時機是「新增了一列但取消命名」，用來丟棄還沒送出的空白列——
   * 這個版本沒有刪除既有資源的功能，既有節點不會走到這裡。
   * @param rowKey 要移除的節點
   */
  function removeRow(rowKey: string) {
    const row = findRow(rowKey)
    if (row === null) {
      return
    }

    const removedKeys = new Set([rowKey, ...descendantsOf(rowKey).map((child) => child.rowKey)])
    const parentRowKey = row.parentRowKey

    rows.value = rows.value.filter((item) => !removedKeys.has(item.rowKey))
    renumber(parentRowKey)
    logger.info('移除節點', { rowKey, removedCount: removedKeys.size })
  }

  /**
   * 改名
   * @param rowKey 要改名的節點
   * @param name 這一層的新名稱（不含父路徑）
   */
  function renameRow(rowKey: string, name: string) {
    const row = findRow(rowKey)
    if (row === null) {
      return
    }
    row.name = name.trim()
  }

  /**
   * 切換顯示狀態
   * @param rowKey 要切換的節點
   * @param isEnabled 是否啟用
   */
  function toggleRow(rowKey: string, isEnabled: boolean) {
    const row = findRow(rowKey)
    if (row === null) {
      return
    }
    row.isEnabled = isEnabled
  }

  /**
   * 同層搬移一位
   * @param rowKey 要搬移的節點
   * @param offset -1 上移、1 下移
   * @returns 是否真的移動了
   */
  function nudgeRow(rowKey: string, offset: number): boolean {
    const row = findRow(rowKey)
    if (row === null) {
      return false
    }

    const siblings = childrenOf(row.parentRowKey)
    const currentIndex = siblings.findIndex((item) => item.rowKey === rowKey)
    const targetIndex = currentIndex + offset

    if (targetIndex < 0 || targetIndex >= siblings.length) {
      return false
    }

    return reorderSiblings(row.parentRowKey, currentIndex, targetIndex)
  }

  /**
   * 同層重新排序（拖曳結果）
   * @param parentRowKey 該群組的父節點
   * @param fromIndex 原本的索引 (0-based)
   * @param toIndex 新的索引 (0-based)
   * @returns 是否真的移動了
   */
  function reorderSiblings(parentRowKey: string | null, fromIndex: number, toIndex: number): boolean {
    const siblings = childrenOf(parentRowKey)
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= siblings.length || toIndex >= siblings.length) {
      return false
    }

    const moved = siblings.splice(fromIndex, 1)[0]
    if (moved === undefined) {
      return false
    }

    siblings.splice(toIndex, 0, moved)
    siblings.forEach((row, index) => {
      row.position = index + 1
    })

    logger.info('同層排序變更', { parentRowKey, fromIndex, toIndex })
    return true
  }

  /**
   * 跨層搬移到新的父節點底下
   * @param rowKey 要搬移的節點
   * @param targetParentRowKey 目標父節點；null 表示移到第一層
   * @returns 是否搬移成功
   */
  function moveRowTo(rowKey: string, targetParentRowKey: string | null): boolean {
    const row = findRow(rowKey)
    if (row === null || row.parentRowKey === targetParentRowKey) {
      return false
    }

    const target = targetParentRowKey === null ? null : findRow(targetParentRowKey)
    if (targetParentRowKey !== null && target === null) {
      return false
    }

    const targetLevel = target === null ? 1 : target.level + 1
    if (targetLevel + subtreeHeightOf(rowKey) - 1 > MAX_LEVEL) {
      dialog.showWarning(`搬移後會超過 ${MAX_LEVEL} 層`)
      return false
    }

    const siblings = childrenOf(targetParentRowKey)
    if (siblings.length >= MAX_SIBLINGS) {
      dialog.showWarning(`目標層級已有 ${siblings.length} 筆，同一層最多 ${MAX_SIBLINGS} 筆`)
      return false
    }

    const previousParentRowKey = row.parentRowKey
    row.parentRowKey = targetParentRowKey
    row.position = siblings.length + 1
    relevel(rowKey, targetLevel)
    renumber(previousParentRowKey)
    renumber(targetParentRowKey)

    logger.info('跨層搬移', { rowKey, from: previousParentRowKey, to: targetParentRowKey })
    return true
  }

  /**
   * 「移到其他層級」的候選父節點清單
   * @param rowKey 要搬移的節點
   */
  function moveTargetsFor(rowKey: string): MenuSettingsMoveTarget[] {
    const row = findRow(rowKey)
    if (row === null) {
      return []
    }

    const excludedRowKeys = new Set([rowKey, ...descendantsOf(rowKey).map((child) => child.rowKey)])
    const height = subtreeHeightOf(rowKey)
    const targets: MenuSettingsMoveTarget[] = []

    const isRootFull = row.parentRowKey !== null && childrenOf(null).length >= MAX_SIBLINGS
    targets.push({
      parentRowKey: null,
      label: '（移到第一層）',
      level: 1,
      disabled: row.parentRowKey === null || isRootFull || height > MAX_LEVEL,
      disabledReason: buildDisabledReason(row.parentRowKey === null, isRootFull, height > MAX_LEVEL),
    })

    visibleRows(null)
      .filter((candidate) => !excludedRowKeys.has(candidate.rowKey))
      .forEach((candidate) => {
        const level = candidate.level + 1
        const isCurrentParent = candidate.rowKey === row.parentRowKey
        const isTooDeep = level + height - 1 > MAX_LEVEL
        const isFull = !isCurrentParent && childrenOf(candidate.rowKey).length >= MAX_SIBLINGS

        targets.push({
          parentRowKey: candidate.rowKey,
          label: fullPathOf(candidate),
          level,
          disabled: isCurrentParent || isTooDeep || isFull,
          disabledReason: buildDisabledReason(isCurrentParent, isFull, isTooDeep),
        })
      })

    return targets
  }

  /** 組出候選父節點不可選的原因 */
  function buildDisabledReason(isCurrentParent: boolean, isFull: boolean, isTooDeep: boolean): string | null {
    if (isCurrentParent) {
      return '目前所在位置'
    }
    if (isTooDeep) {
      return `搬移後會超過 ${MAX_LEVEL} 層`
    }
    if (isFull) {
      return `已達同層上限 ${MAX_SIBLINGS} 筆`
    }
    return null
  }

  /** 送出前的整棵樹檢查，先擋掉後端會回 400／403 的情況 */
  function validateTree(): MenuSettingsTreeValidation {
    if (rows.value.length === 0) {
      return { isValid: false, message: '整批替換是全量語意，空的樹會刪除全部資源，請至少保留一筆第一層選單。' }
    }

    const blankRow = rows.value.find((row) => row.name.trim().length === 0)
    if (blankRow !== undefined) {
      return { isValid: false, message: '有選單名稱是空白的，請先填寫；未命名的新增列可在編輯狀態按取消收掉。' }
    }

    const separatorRow = rows.value.find((row) => row.name.includes(PATH_SEPARATOR))
    if (separatorRow !== undefined) {
      return { isValid: false, message: `選單名稱不可包含「${PATH_SEPARATOR}」，該符號是階層分隔用的。` }
    }

    const overLevelRow = rows.value.find((row) => row.level > MAX_LEVEL)
    if (overLevelRow !== undefined) {
      return { isValid: false, message: `資源層級最多 ${MAX_LEVEL} 層。` }
    }

    const parentRowKeys = new Set<string | null>([null, ...rows.value.map((row) => row.parentRowKey)])
    for (const parentRowKey of parentRowKeys) {
      const siblings = childrenOf(parentRowKey)
      if (siblings.length > MAX_SIBLINGS) {
        const parent = parentRowKey === null ? null : findRow(parentRowKey)
        const scope = parent === null ? '第一層' : `「${fullPathOf(parent)}」底下`
        return { isValid: false, message: `${scope}有 ${siblings.length} 筆，同一層最多 ${MAX_SIBLINGS} 筆。` }
      }
    }

    const seenPaths = new Set<string>()
    for (const row of rows.value) {
      const path = fullPathOf(row)
      if (seenPaths.has(path)) {
        return { isValid: false, message: `資源名稱「${path}」重複，整棵樹內的完整名稱必須唯一。` }
      }
      seenPaths.add(path)
    }

    return { isValid: true, message: null }
  }

  /**
   * 組出送出用的嵌套樹
   *
   * 一律從完整的內部資料組樹，不受畫面搜尋影響 ——
   * 全量語意下，送出畫面篩選後的清單等於刪掉其餘資源。
   * @param parentRowKey 要組樹的父節點；null 表示從第一層開始
   */
  function buildRequestItems(parentRowKey: string | null): AdminResourceTreeNodeRequest[] {
    return childrenOf(parentRowKey).map((row) => ({
      id: row.id,
      resourceName: fullPathOf(row),
      isEnabled: row.isEnabled,
      children: buildRequestItems(row.rowKey),
    }))
  }

  /** 丟棄未儲存變更，回到上次讀取的狀態 */
  function resetChanges() {
    rows.value = originalRows.value.map((row) => ({ ...row }))
    logger.info('已還原未儲存變更')
  }

  return {
    // 狀態
    rows,
    version,
    isLoading,
    isSaving,

    // 計算屬性
    changeSummary,
    hasChanges,

    // 非同步方法
    loadTree,
    saveTree,

    // 樹狀查詢
    childrenOf,
    findRow,
    descendantsOf,
    fullPathOf,
    visibleRows,
    moveTargetsFor,
    validateTree,
    buildRequestItems,

    // 編輯操作
    addRow,
    removeRow,
    renameRow,
    toggleRow,
    nudgeRow,
    reorderSiblings,
    moveRowTo,
    resetChanges,
  }
}
