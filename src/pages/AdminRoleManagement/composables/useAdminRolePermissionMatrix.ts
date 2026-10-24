import { computed, ref } from 'vue'

import router from '@/router'
import type { AdminRolePermissionActionResponse, AdminRolePermissionItemRequest, AdminRolePermissionNodeResponse } from '@/services/admin/adminRoleService'
import type {
  AdminRolePermissionAction,
  AdminRolePermissionCells,
  AdminRolePermissionCheckState,
  AdminRolePermissionResource,
  AdminRolePermissionRow,
  AdminRolePermissionState,
} from '@/pages/AdminRoleManagement/types'

/** 四種操作；檢視是其他三種的前提，固定排第一個 */
export const PERMISSION_ACTIONS: AdminRolePermissionAction[] = ['canAccess', 'canCreate', 'canUpdate', 'canDelete']

/** 勾新增／修改／刪除時一併勾上檢視的說明（翻譯鍵，由頁面依目前語系翻譯） */
export const AUTO_GRANT_ACCESS_HINT = 'role.hint.autoGrantAccess'

/** 取消檢視時一併取消其他三種的說明（翻譯鍵，由頁面依目前語系翻譯） */
export const AUTO_REVOKE_DEPENDENT_HINT = 'role.hint.autoRevokeDependent'

/** 後端的權限動作對到矩陣的旗標欄位 */
const ACTION_BY_RESPONSE: Record<AdminRolePermissionActionResponse, AdminRolePermissionAction> = {
  access: 'canAccess',
  create: 'canCreate',
  update: 'canUpdate',
  delete: 'canDelete',
}

/** 完整資源名稱的層級分隔符號 */
const PATH_SEPARATOR = '>'

/** 路由沒有對應圖示時，依層級給的預設圖示 */
const DEFAULT_LEVEL_ICONS: Record<number, string> = {
  1: 'mdi-folder',
  2: 'mdi-folder-outline',
  3: 'mdi-file-outline',
}

/**
 * 角色的權限矩陣（v2）
 *
 * 權限只存在葉節點（沒有子資源的功能）上；群組列的勾選狀態一律由底下的功能聚合，
 * 勾群組等於勾底下全部功能。送出時群組資源的旗標取底下功能的聯集，讓授權狀態的權限樹仍保有群組節點。
 *
 * 每個資源只能勾後端標示為可授權（availableActions）的操作，其餘格子是「不適用」：
 * 那些操作沒有任何端點會檢查，勾了也不會多出權限。
 *
 * 後端的更新是全量替換，送出時一律帶上全部資源（含沒勾的、停用的），少送就等於取消那筆權限
 */
export function useAdminRolePermissionMatrix() {
  /** 扁平的全部資源，依權限樹的深度優先順序（父在前、子在後、同層依顯示順序） */
  const resources = ref<AdminRolePermissionResource[]>([])
  /** 葉節點目前的權限，key 為資源唯一編號 */
  const permissions = ref<Record<string, AdminRolePermissionState>>({})
  /** 載入當下的權限，供「重設」還原與標示未儲存的格子 */
  const baseline = ref<Record<string, AdminRolePermissionState>>({})

  /** 各資源的直接子資源唯一編號 */
  const childIdsByParentId = computed<Map<string, string[]>>(() => buildChildIdsByParentId())
  /** 依唯一編號查資源 */
  const resourceById = computed<Map<string, AdminRolePermissionResource>>(() => new Map(resources.value.map((resource) => [resource.resourceId, resource])))
  /** 葉節點（沒有子資源的功能） */
  const leafResources = computed<AdminRolePermissionResource[]>(() => resources.value.filter((resource) => !hasChildren(resource.resourceId)))
  /** 畫面上的每一列，含聚合後的勾選狀態 */
  const rows = computed<AdminRolePermissionRow[]>(() => resources.value.map((resource) => buildRow(resource)))
  /** 與載入時不同的格數（以葉節點每一種可授權的操作計） */
  const changedCount = computed<number>(() => countChanges())
  /** 有檢視權限的功能數 */
  const grantedCount = computed<number>(() => leafResources.value.filter((resource) => permissions.value[resource.resourceId]?.canAccess === true).length)

  /**
   * 載入權限樹，同時當成「載入時」的基準
   * @param tree 以全部資源為底的權限樹
   */
  function load(tree: AdminRolePermissionNodeResponse[]) {
    const iconMap = buildRouteIconMap()
    resources.value = flattenTree(tree).map((node) => ({
      resourceId: node.resourceId,
      parentResourceId: node.parentId,
      level: node.level,
      name: lastSegmentOf(node.resourceName),
      fullPath: node.resourceName,
      isEnabled: node.isEnabled,
      availableActions: PERMISSION_ACTIONS.filter((action) => node.availableActions.some((available) => ACTION_BY_RESPONSE[available] === action)),
      icon: iconMap.get(node.resourceName) ?? DEFAULT_LEVEL_ICONS[node.level] ?? 'mdi-circle-small',
    }))
    permissions.value = extractLeafPermissions(tree)
    baseline.value = clonePermissions(permissions.value)
  }

  /**
   * 只取權限樹的資源當骨架，權限全部不勾（新增頁）
   * @param tree 任一角色的權限樹；後端一律以全部資源為底回傳，哪個角色都一樣
   */
  function loadBlank(tree: AdminRolePermissionNodeResponse[]) {
    load(tree)
    clear()
    baseline.value = clonePermissions(permissions.value)
  }

  /**
   * 以另一個角色的權限為起點（新增頁的範本）；基準不變，套用的權限會標成未儲存
   * @param tree 範本角色的權限樹
   */
  function applyTemplate(tree: AdminRolePermissionNodeResponse[]) {
    const templatePermissions = extractLeafPermissions(tree)
    permissions.value = Object.fromEntries(
      Object.keys(permissions.value).map((resourceId) => [resourceId, { ...(templatePermissions[resourceId] ?? emptyState()) }])
    )
  }

  /** 全部取消勾選；基準不變 */
  function clear() {
    permissions.value = Object.fromEntries(Object.keys(permissions.value).map((resourceId) => [resourceId, emptyState()]))
  }

  /** 還原成載入時的權限 */
  function reset() {
    permissions.value = clonePermissions(baseline.value)
  }

  /**
   * 勾選或取消一格；群組列套用到底下全部有這種操作的功能
   * @param resourceId 資源唯一編號
   * @param action 操作
   * @param value 勾選或取消
   * @returns 連動了其他操作時的說明（翻譯鍵）；沒有連動為 null
   */
  function setCell(resourceId: string, action: AdminRolePermissionAction, value: boolean): string | null {
    return firstHint(leafIdsUnder(resourceId).map((leafId) => applyToLeaf(leafId, action, value)))
  }

  /**
   * 整列切換：還沒全勾就全部勾上，已經全勾就全部取消；不適用的操作略過
   *
   * 取消時從刪除往檢視倒著做，才不會在中途觸發「取消檢視連帶取消其他操作」的說明
   * @param resourceId 資源唯一編號
   * @returns 連動了其他操作時的說明（翻譯鍵）；沒有連動為 null
   */
  function toggleRow(resourceId: string): string | null {
    const value = rowStateOf(resourceId) !== 'all'
    const actions = value ? PERMISSION_ACTIONS : [...PERMISSION_ACTIONS].reverse()

    return firstHint(leafIdsUnder(resourceId).flatMap((leafId) => actions.map((action) => applyToLeaf(leafId, action, value))))
  }

  /**
   * 整欄切換：指定的功能還沒全勾就全部勾上，已經全勾就全部取消；沒有這種操作的功能略過
   * @param action 操作
   * @param leafIds 要套用的功能（有搜尋時只有搜尋結果，收合起來的群組照樣套用）
   * @returns 連動了其他操作時的說明（翻譯鍵）；沒有連動為 null
   */
  function toggleColumn(action: AdminRolePermissionAction, leafIds: string[]): string | null {
    const applicableLeafIds = leafIds.filter((leafId) => isApplicable(leafId, action))
    const value = !applicableLeafIds.every((leafId) => permissions.value[leafId]?.[action] === true)

    return firstHint(applicableLeafIds.map((leafId) => applyToLeaf(leafId, action, value)))
  }

  /**
   * 組出送出用的權限矩陣：全部資源各一筆，群組資源的旗標取底下功能的聯集
   * @returns 權限矩陣
   */
  function buildPermissionItems(): AdminRolePermissionItemRequest[] {
    return resources.value.map((resource) => {
      const leafStates = leafIdsUnder(resource.resourceId).map((leafId) => permissions.value[leafId] ?? emptyState())

      return {
        resourceId: resource.resourceId,
        canAccess: leafStates.some((state) => state.canAccess),
        canCreate: leafStates.some((state) => state.canCreate),
        canUpdate: leafStates.some((state) => state.canUpdate),
        canDelete: leafStates.some((state) => state.canDelete),
      }
    })
  }

  /**
   * 套用到單一葉節點，並處理「檢視是其他操作前提」的連動；這個功能沒有該操作時不做事
   * @returns 連動了其他操作時的說明（翻譯鍵）；沒有連動為 null
   */
  function applyToLeaf(leafId: string, action: AdminRolePermissionAction, value: boolean): string | null {
    const state = permissions.value[leafId]
    if (state === undefined || !isApplicable(leafId, action)) return null

    state[action] = value

    if (value && action !== 'canAccess' && !state.canAccess) {
      state.canAccess = true
      return AUTO_GRANT_ACCESS_HINT
    }

    if (!value && action === 'canAccess' && (state.canCreate || state.canUpdate || state.canDelete)) {
      state.canCreate = false
      state.canUpdate = false
      state.canDelete = false
      return AUTO_REVOKE_DEPENDENT_HINT
    }

    return null
  }

  /** 一列在畫面上的樣子 */
  function buildRow(resource: AdminRolePermissionResource): AdminRolePermissionRow {
    const cells: AdminRolePermissionCells = {
      canAccess: aggregateOf(resource.resourceId, 'canAccess'),
      canCreate: aggregateOf(resource.resourceId, 'canCreate'),
      canUpdate: aggregateOf(resource.resourceId, 'canUpdate'),
      canDelete: aggregateOf(resource.resourceId, 'canDelete'),
    }

    return {
      ...resource,
      hasChildren: hasChildren(resource.resourceId),
      cells,
      rowState: combineStates(PERMISSION_ACTIONS.map((action) => cells[action])),
      changedActions: PERMISSION_ACTIONS.filter((action) => isChanged(resource.resourceId, action)),
    }
  }

  /** 某個資源的某種操作，底下有這種操作的功能勾了多少；一個都沒有這種操作時是不適用 */
  function aggregateOf(resourceId: string, action: AdminRolePermissionAction): AdminRolePermissionCheckState {
    const leafIds = leafIdsUnder(resourceId).filter((leafId) => isApplicable(leafId, action))
    if (leafIds.length === 0) return 'na'

    const grantedLeafCount = leafIds.filter((leafId) => permissions.value[leafId]?.[action] === true).length
    if (grantedLeafCount === 0) return 'none'

    return grantedLeafCount === leafIds.length ? 'all' : 'some'
  }

  /** 整列的勾選狀態 */
  function rowStateOf(resourceId: string): AdminRolePermissionCheckState {
    return combineStates(PERMISSION_ACTIONS.map((action) => aggregateOf(resourceId, action)))
  }

  /** 底下的功能有沒有任何一個跟載入時不同 */
  function isChanged(resourceId: string, action: AdminRolePermissionAction): boolean {
    return leafIdsUnder(resourceId).some((leafId) => (permissions.value[leafId]?.[action] ?? false) !== (baseline.value[leafId]?.[action] ?? false))
  }

  function countChanges(): number {
    return leafResources.value.reduce((total, resource) => total + PERMISSION_ACTIONS.filter((action) => isChanged(resource.resourceId, action)).length, 0)
  }

  /** 這個功能有沒有這種操作可以授權 */
  function isApplicable(resourceId: string, action: AdminRolePermissionAction): boolean {
    return resourceById.value.get(resourceId)?.availableActions.includes(action) ?? false
  }

  /** 自己沒有子資源就是自己，否則是底下全部的葉節點 */
  function leafIdsUnder(resourceId: string): string[] {
    const childIds = childIdsByParentId.value.get(resourceId) ?? []
    if (childIds.length === 0) return [resourceId]

    return childIds.flatMap((childId) => leafIdsUnder(childId))
  }

  function hasChildren(resourceId: string): boolean {
    return (childIdsByParentId.value.get(resourceId) ?? []).length > 0
  }

  function buildChildIdsByParentId(): Map<string, string[]> {
    const childIds = new Map<string, string[]>()
    resources.value.forEach((resource) => {
      if (resource.parentResourceId === null) return

      childIds.set(resource.parentResourceId, [...(childIds.get(resource.parentResourceId) ?? []), resource.resourceId])
    })
    return childIds
  }

  return {
    resources,
    permissions,
    rows,
    changedCount,
    grantedCount,
    leafResources,
    load,
    loadBlank,
    applyTemplate,
    clear,
    reset,
    setCell,
    toggleRow,
    toggleColumn,
    buildPermissionItems,
  }
}

/**
 * 合併多個勾選狀態；不適用的不算：其餘全部是 all 才是 all、全部是 none 才是 none，混雜為 some，全部不適用才是 na
 * @param states 勾選狀態
 * @returns 合併後的勾選狀態
 */
export function combineStates(states: AdminRolePermissionCheckState[]): AdminRolePermissionCheckState {
  const applicableStates = states.filter((state) => state !== 'na')
  if (applicableStates.length === 0) return 'na'
  if (applicableStates.every((state) => state === 'all')) return 'all'
  if (applicableStates.every((state) => state === 'none')) return 'none'

  return 'some'
}

/** 深度優先攤平權限樹，父節點排在子節點前面 */
function flattenTree(nodes: AdminRolePermissionNodeResponse[]): AdminRolePermissionNodeResponse[] {
  return nodes.flatMap((node) => [node, ...flattenTree(node.children)])
}

/** 取出葉節點的四個旗標；群組節點的旗標由底下功能聚合，載入時不採用 */
function extractLeafPermissions(tree: AdminRolePermissionNodeResponse[]): Record<string, AdminRolePermissionState> {
  return Object.fromEntries(
    flattenTree(tree)
      .filter((node) => node.children.length === 0)
      .map((node) => [node.resourceId, { canAccess: node.canAccess, canCreate: node.canCreate, canUpdate: node.canUpdate, canDelete: node.canDelete }])
  )
}

function clonePermissions(source: Record<string, AdminRolePermissionState>): Record<string, AdminRolePermissionState> {
  return Object.fromEntries(Object.entries(source).map(([resourceId, state]) => [resourceId, { ...state }]))
}

function emptyState(): AdminRolePermissionState {
  return { canAccess: false, canCreate: false, canUpdate: false, canDelete: false }
}

function firstHint(hints: Array<string | null>): string | null {
  return hints.find((hint) => hint !== null) ?? null
}

/** 取出完整路徑的最後一段作為這一層的顯示名稱 */
function lastSegmentOf(resourceName: string): string {
  const segments = resourceName.split(PATH_SEPARATOR)
  return segments[segments.length - 1]?.trim() || resourceName
}

/**
 * 從路由 meta 建立「完整資源名稱 → 圖示」的對照表，讓矩陣的圖示與左側選單一致
 *
 * 同一個資源掛在列表、新增、編輯好幾個路由上，只有出現在選單的列表頁帶圖示
 */
function buildRouteIconMap(): Map<string, string> {
  const iconMap = new Map<string, string>()

  router.getRoutes().forEach((route) => {
    const resourceName = route.meta.resourceName
    const icon = route.meta.icon
    if (resourceName !== undefined && icon !== undefined && !iconMap.has(resourceName)) {
      iconMap.set(resourceName, icon)
    }
  })

  return iconMap
}
