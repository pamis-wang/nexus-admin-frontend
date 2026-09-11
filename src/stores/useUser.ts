/** 用於集中管理登入用戶狀態 */
import { defineStore } from 'pinia'
import { StorageSerializers, useStorage } from '@vueuse/core'
import type {
  AuthorizationPermissionResponse,
  AuthorizationRoleResponse,
  CurrentAuthorizationResponse,
  LoginUserProfileResponse,
  PermissionMode,
  PermissionType,
} from '@/services/auth/authService'

/** 單一資源的四種權限，權限查詢表的值 */
export interface ResourcePermission {
  /** 訪問權限 */
  canAccess: boolean
  /** 新增權限 */
  canCreate: boolean
  /** 修改權限 */
  canUpdate: boolean
  /** 刪除權限 */
  canDelete: boolean
}

export const useUserStore = defineStore('userStore', () => {
  /** 存取權杖 */
  const accessToken = useStorage<string | null>('accessToken', null)

  /** 刷新權杖 */
  const refreshToken = useStorage<string | null>('refreshToken', null)

  /** 是否已通過驗證 */
  const isAuthenticated = useStorage<boolean>('isAuthenticated', false)

  // 預設值為 null 時 useStorage 會推斷成 any 序列化器（寫入用 String()，物件會變成 "[object Object]"），故明確指定 object
  /** 登入用戶資料 */
  const userProfile = useStorage<LoginUserProfileResponse | null>('userProfile', null, localStorage, { serializer: StorageSerializers.object })

  /** 生效角色的模式，由後端決定，前端只能讀 */
  const permissionMode = useStorage<PermissionMode>('permissionMode', 'unknown')

  /** 該用戶被指派的全部角色，角色切換選單的來源 */
  const assignedRoles = useStorage<AuthorizationRoleResponse[]>('assignedRoles', [])

  /** 目前生效的角色，權限依這些角色判斷 */
  const activeRoles = useStorage<AuthorizationRoleResponse[]>('activeRoles', [])

  /**
   * 權限查詢表：資源完整路徑 → 四種權限
   *
   * 後端回的是樹狀，寫入時就攤平，之後每次查詢都是 O(1)，不必反覆遞迴整棵樹。
   * resourceName 在整棵資源樹內唯一，可以直接當鍵。
   *
   * 這份資料會寫進 localStorage：重新整理時沒有它就會是空選單、而且每個頁面都被守衛擋下。
   * 權限的最終判斷在後端，前端這份只影響畫面，過期的風險可以接受；App 掛載時會重新拉一次。
   */
  const resourcePermissions = useStorage<Record<string, ResourcePermission>>('resourcePermissions', {})

  /** 登入成功時寫入用戶狀態 */
  async function storageUser(accessTokenValue: string, refreshTokenValue: string, userProfileValue: LoginUserProfileResponse) {
    isAuthenticated.value = true
    accessToken.value = accessTokenValue
    refreshToken.value = refreshTokenValue
    userProfile.value = userProfileValue
  }

  /** 寫入授權狀態：模式、可選角色、生效角色與權限 */
  async function storageAuthorization(authorization: CurrentAuthorizationResponse) {
    permissionMode.value = authorization.permissionMode
    assignedRoles.value = authorization.roles
    activeRoles.value = authorization.activeRoles
    resourcePermissions.value = flattenPermissions(authorization.permissions)
  }

  /** 換發權杖後更新 Token */
  async function updateTokens(newAccessToken: string, newRefreshToken: string) {
    accessToken.value = newAccessToken
    refreshToken.value = newRefreshToken
  }

  /** 只更新存取權杖；變更生效角色會換發存取權杖，但不輪替刷新權杖 */
  function updateAccessToken(newAccessToken: string) {
    accessToken.value = newAccessToken
  }

  /** 登出時清空用戶狀態 */
  async function clearUser() {
    isAuthenticated.value = false
    accessToken.value = null
    refreshToken.value = null
    userProfile.value = null
    permissionMode.value = 'unknown'
    assignedRoles.value = []
    activeRoles.value = []
    resourcePermissions.value = {}
  }

  /**
   * 是否具備指定資源的權限
   *
   * 全系統唯一的權限判斷入口，路由守衛與選單都走這裡，不要另外再寫一份。
   * @param resourceName 資源完整路徑（例：系統管理>用戶管理）
   * @param type 權限種類，預設為訪問權限
   * @returns 是否具備該權限；查不到資源一律視為沒有權限
   */
  function hasPermission(resourceName: string, type: PermissionType = 'canAccess'): boolean {
    const permission = resourcePermissions.value[resourceName]
    if (permission === undefined) {
      return false
    }
    return permission[type]
  }

  return {
    accessToken,
    refreshToken,
    isAuthenticated,
    userProfile,
    permissionMode,
    assignedRoles,
    activeRoles,
    resourcePermissions,
    storageUser,
    storageAuthorization,
    updateTokens,
    updateAccessToken,
    clearUser,
    hasPermission,
  }
})

/**
 * 把權限樹攤平成以資源完整路徑為鍵的查詢表
 * @param permissions 後端回傳的權限樹
 * @returns 資源完整路徑 → 四種權限
 */
function flattenPermissions(permissions: AuthorizationPermissionResponse[]): Record<string, ResourcePermission> {
  const table: Record<string, ResourcePermission> = {}

  function visit(nodes: AuthorizationPermissionResponse[]) {
    for (const node of nodes) {
      table[node.resourceName] = {
        canAccess: node.canAccess,
        canCreate: node.canCreate,
        canUpdate: node.canUpdate,
        canDelete: node.canDelete,
      }
      visit(node.children)
    }
  }

  visit(permissions)

  return table
}
