import { computed, reactive, ref } from 'vue'

import { useLogger } from '@/composables/useLogger'
import router from '@/router'
import { getAdminResources } from '@/services/admin/adminResourceService'
import { getAdminRolePermissionsByRoleId, type AdminRolePermissionItemRequest } from '@/services/admin/adminRoleService'
import type {
  AdminRolePermissionResource,
  AdminRolePermissionState,
  AdminRolePermissionTreeNode,
  AdminRolePermissionType,
} from '@/pages/AdminRoleManagement/types'

/** 完整資源名稱的層級分隔符號 */
const PATH_SEPARATOR = '>'

/** 路由沒有對應圖示時，依層級給的預設圖示 */
const DEFAULT_LEVEL_ICONS: Record<number, string> = {
  1: 'mdi-folder',
  2: 'mdi-folder-outline',
  3: 'mdi-file-outline',
}

/**
 * 角色權限矩陣
 *
 * 資源清單取的是「全部資源」而不是已啟用的那份：更新角色時權限是全量替換，
 * 只送已啟用資源的話，停用資源上的既有權限會在儲存時被一併洗掉。停用的資源照樣列出來，
 * 由畫面標示狀態，權限則原封不動帶回去。
 */
export function useAdminRolePermissionMatrix() {
  const logger = useLogger({ prefix: 'AdminRolePermissionMatrix', enabled: import.meta.env.DEV })

  /** 扁平的全部資源，依 displayOrder 排序 */
  const resources = ref<AdminRolePermissionResource[]>([])
  /** 每個資源目前的權限狀態，key 為 resourceId */
  const permissions = reactive<Record<string, AdminRolePermissionState>>({})
  /** 載入當下的權限快照，供「重設」還原 */
  const originalPermissions = ref<Record<string, AdminRolePermissionState>>({})
  const isLoadingResources = ref(false)
  const isLoadingPermissions = ref(false)

  const isLoading = computed(() => isLoadingResources.value || isLoadingPermissions.value)

  const treeNodes = computed<AdminRolePermissionTreeNode[]>(() => buildTreeNodes(null))

  /**
   * 載入全部資源並把權限狀態初始化為未勾選
   * @returns 是否載入成功
   */
  async function loadResources(): Promise<boolean> {
    isLoadingResources.value = true
    try {
      const response = await getAdminResources()

      if (response.status === 200 && response.result.data) {
        const iconMap = buildRouteIconMap()

        resources.value = response.result.data
          .map((resource) => ({
            resourceId: resource.id,
            parentResourceId: resource.parentId,
            level: resource.level,
            name: lastSegmentOf(resource.resourceName),
            fullPath: resource.resourceName,
            isEnabled: resource.isEnabled,
            displayOrder: resource.displayOrder,
            icon: iconMap.get(resource.resourceName) ?? DEFAULT_LEVEL_ICONS[resource.level] ?? 'mdi-circle-small',
          }))
          .sort((a, b) => a.displayOrder - b.displayOrder)

        clearAllPermissions()
        originalPermissions.value = snapshotPermissions()
        logger.info('資源清單載入成功', { count: resources.value.length })
        return true
      }

      logger.warn('資源清單載入失敗', response.result.error?.message)
      return false
    } finally {
      isLoadingResources.value = false
    }
  }

  /**
   * 載入指定角色的權限並套用到矩陣上
   * @param roleId 角色唯一編號
   * @returns 是否載入成功
   */
  async function loadRolePermissions(roleId: string): Promise<boolean> {
    isLoadingPermissions.value = true
    try {
      const response = await getAdminRolePermissionsByRoleId(roleId)

      if (response.status === 200 && response.result.data) {
        clearAllPermissions()

        response.result.data.forEach((permission) => {
          // 資源可能在設定權限之後被刪掉，對不到資源的權限直接略過
          if (permissions[permission.resourceId] === undefined) {
            return
          }
          permissions[permission.resourceId] = {
            canAccess: permission.canAccess,
            canCreate: permission.canCreate,
            canUpdate: permission.canUpdate,
            canDelete: permission.canDelete,
          }
        })

        originalPermissions.value = snapshotPermissions()
        logger.info('角色權限載入成功', { roleId, count: response.result.data.length })
        return true
      }

      logger.warn('角色權限載入失敗', response.result.error?.message)
      return false
    } finally {
      isLoadingPermissions.value = false
    }
  }

  /** 從路由 meta 建立「完整資源名稱 → 圖示」的對照表 */
  function buildRouteIconMap(): Map<string, string> {
    const iconMap = new Map<string, string>()

    router.getRoutes().forEach((route) => {
      const resourceName = route.meta.resourceName
      const icon = route.meta.icon
      if (resourceName !== undefined && icon !== undefined) {
        iconMap.set(resourceName, icon)
      }
    })

    return iconMap
  }

  /** 取出完整路徑的最後一段作為這一層的顯示名稱 */
  function lastSegmentOf(resourceName: string): string {
    const segments = resourceName.split(PATH_SEPARATOR)
    return segments[segments.length - 1]?.trim() || resourceName
  }

  /** 依 parentResourceId 組出巢狀節點 */
  function buildTreeNodes(parentResourceId: string | null): AdminRolePermissionTreeNode[] {
    return resources.value
      .filter((resource) => resource.parentResourceId === parentResourceId)
      .map((resource) => ({ ...resource, children: buildTreeNodes(resource.resourceId) }))
  }

  /** 直接子資源 */
  function childrenOf(resourceId: string): AdminRolePermissionResource[] {
    return resources.value.filter((resource) => resource.parentResourceId === resourceId)
  }

  /** 全部子孫的資源編號（不含自己） */
  function descendantIdsOf(resourceId: string): string[] {
    return childrenOf(resourceId).flatMap((child) => [child.resourceId, ...descendantIdsOf(child.resourceId)])
  }

  /** 父資源編號；第一層為 null */
  function parentIdOf(resourceId: string): string | null {
    return resources.value.find((resource) => resource.resourceId === resourceId)?.parentResourceId ?? null
  }

  /** 同層的其他資源 */
  function siblingsOf(resourceId: string): AdminRolePermissionResource[] {
    const parentResourceId = parentIdOf(resourceId)
    return resources.value.filter((resource) => resource.parentResourceId === parentResourceId)
  }

  /**
   * 查詢某個資源的權限
   * @param resourceId 資源唯一編號
   * @param permissionType 權限種類
   */
  function hasPermission(resourceId: string, permissionType: AdminRolePermissionType): boolean {
    return permissions[resourceId]?.[permissionType] ?? false
  }

  /**
   * 勾選或取消某個資源的權限，並連動父子節點
   *
   * 勾選：子孫一併勾選；同層全部都有時，父節點也跟著勾選。
   * 取消：子孫一併取消；同層都沒有了，父節點也跟著取消。
   * 另外「訪問」是其他三種權限的前提，取消訪問時一併清掉同一個節點的新增／修改／刪除。
   * @param resourceId 資源唯一編號
   * @param permissionType 權限種類
   * @param value 勾選或取消
   */
  function updatePermission(resourceId: string, permissionType: AdminRolePermissionType, value: boolean) {
    const state = permissions[resourceId]
    if (state === undefined) {
      return
    }

    state[permissionType] = value
    if (permissionType === 'canAccess' && !value) {
      clearDependentPermissions(state)
    }

    descendantIdsOf(resourceId).forEach((descendantId) => {
      const descendantState = permissions[descendantId]
      if (descendantState === undefined) {
        return
      }
      descendantState[permissionType] = value
      if (permissionType === 'canAccess' && !value) {
        clearDependentPermissions(descendantState)
      }
    })

    syncParentPermission(resourceId, permissionType, value)
  }

  /** 訪問權限被取消時，同一個節點的其他三種權限也失去前提 */
  function clearDependentPermissions(state: AdminRolePermissionState) {
    state.canCreate = false
    state.canUpdate = false
    state.canDelete = false
  }

  /** 依同層的勾選結果回頭調整父節點 */
  function syncParentPermission(resourceId: string, permissionType: AdminRolePermissionType, value: boolean) {
    const parentResourceId = parentIdOf(resourceId)
    if (parentResourceId === null) {
      return
    }

    const parentState = permissions[parentResourceId]
    if (parentState === undefined) {
      return
    }

    const siblings = siblingsOf(resourceId)

    if (value) {
      const isEverySiblingChecked = siblings.every((sibling) => hasPermission(sibling.resourceId, permissionType))
      if (!isEverySiblingChecked || parentState[permissionType]) {
        return
      }
      parentState[permissionType] = true
    } else {
      const isAnySiblingChecked = siblings.some((sibling) => hasPermission(sibling.resourceId, permissionType))
      if (isAnySiblingChecked || !parentState[permissionType]) {
        return
      }
      parentState[permissionType] = false
      if (permissionType === 'canAccess') {
        clearDependentPermissions(parentState)
      }
    }

    syncParentPermission(parentResourceId, permissionType, value)
  }

  /** 全部權限設為未勾選；資源清單換了也會重建 key */
  function clearAllPermissions() {
    Object.keys(permissions).forEach((resourceId) => {
      delete permissions[resourceId]
    })
    resources.value.forEach((resource) => {
      permissions[resource.resourceId] = { canAccess: false, canCreate: false, canUpdate: false, canDelete: false }
    })
  }

  /** 還原成載入當下的權限 */
  function resetPermissions() {
    const snapshot = originalPermissions.value
    Object.keys(permissions).forEach((resourceId) => {
      permissions[resourceId] = { ...(snapshot[resourceId] ?? { canAccess: false, canCreate: false, canUpdate: false, canDelete: false }) }
    })
  }

  /** 目前權限狀態的深層複製 */
  function snapshotPermissions(): Record<string, AdminRolePermissionState> {
    const snapshot: Record<string, AdminRolePermissionState> = {}
    Object.entries(permissions).forEach(([resourceId, state]) => {
      snapshot[resourceId] = { ...state }
    })
    return snapshot
  }

  /**
   * 組出送出用的權限矩陣
   *
   * 一律帶上全部資源（含未勾選與已停用的），因為後端是全量替換，少送就等於取消那筆權限。
   */
  function buildPermissionItems(): AdminRolePermissionItemRequest[] {
    return resources.value.map((resource) => ({
      resourceId: resource.resourceId,
      canAccess: hasPermission(resource.resourceId, 'canAccess'),
      canCreate: hasPermission(resource.resourceId, 'canCreate'),
      canUpdate: hasPermission(resource.resourceId, 'canUpdate'),
      canDelete: hasPermission(resource.resourceId, 'canDelete'),
    }))
  }

  return {
    // 狀態
    resources,
    permissions,
    isLoadingResources,
    isLoadingPermissions,

    // 計算屬性
    isLoading,
    treeNodes,

    // 非同步方法
    loadResources,
    loadRolePermissions,

    // 權限操作
    hasPermission,
    updatePermission,
    resetPermissions,
    clearAllPermissions,
    buildPermissionItems,
  }
}
