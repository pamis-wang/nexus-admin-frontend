/** 用於集中管理登入用戶狀態 */
import { computed } from 'vue'
import { defineStore } from 'pinia'
import { StorageSerializers, useStorage } from '@vueuse/core'
import type { AuthorizationPermissionResponse, CurrentAuthorizationResponse, LoginUserProfileResponse } from '@/services/auth/authService'
import type { PermissionAction } from '@/types/permission'

/**
 * localStorage 鍵的前綴
 *
 * localStorage 依來源（協定＋主機＋埠號）區分，同一個網域下的其他前端會共用同一份；
 * 鍵一律加這個前綴，避免互相覆蓋登入狀態
 */
export const STORAGE_KEY_PREFIX = 'nexus-admin:'

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
  const accessToken = useStorage<string | null>(`${STORAGE_KEY_PREFIX}accessToken`, null)

  /** 刷新權杖 */
  const refreshToken = useStorage<string | null>(`${STORAGE_KEY_PREFIX}refreshToken`, null)

  /** 是否已通過驗證 */
  const isAuthenticated = useStorage<boolean>(`${STORAGE_KEY_PREFIX}isAuthenticated`, false)

  // 預設值為 null 時 useStorage 會推斷成 any 序列化器（寫入用 String()，物件會變成 "[object Object]"），故明確指定 object
  /** 登入用戶資料 */
  const userProfile = useStorage<LoginUserProfileResponse | null>(`${STORAGE_KEY_PREFIX}userProfile`, null, localStorage, {
    serializer: StorageSerializers.object,
  })

  /**
   * 當前授權狀態：生效角色模式、角色、生效角色與權限樹
   *
   * 存進 localStorage：重新整理時沒有它就會是空選單、而且每個頁面都被守衛擋下。
   * 權限的最終判斷在後端，前端這份只影響畫面，過期的風險可以接受；App 掛載時會重新拉一次。
   */
  const authorization = useStorage<CurrentAuthorizationResponse | null>(`${STORAGE_KEY_PREFIX}authorization`, null, localStorage, {
    serializer: StorageSerializers.object,
  })

  /** 顯示用的名稱：姓名，沒有姓名（null 或空字串）時用帳號；未登入為空字串 */
  const displayName = computed<string>(() => {
    const profile = userProfile.value
    if (profile === null) return ''
    if (profile.fullName === null || profile.fullName === '') return profile.account

    return profile.fullName
  })

  /** 登入用戶的唯一編號；未登入或沒有編號時為 null */
  const userId = computed<string | null>(() => {
    const profile = userProfile.value
    if (profile === null || profile.id === '') return null

    return profile.id
  })

  /**
   * 權限查詢表：資源代碼 → 四種權限
   *
   * 後端回的是樹狀，授權狀態變動時才攤平一次，之後每次查詢都是 O(1)，不必反覆遞迴整棵樹。
   * resourceCode 在整棵資源樹內唯一，可以直接當鍵。
   */
  const resourcePermissions = computed<Record<string, ResourcePermission>>(() => flattenPermissions(authorization.value?.permissions ?? []))

  /** 登入成功時寫入用戶狀態 */
  async function storageUser(accessTokenValue: string, refreshTokenValue: string, userProfileValue: LoginUserProfileResponse) {
    isAuthenticated.value = true
    accessToken.value = accessTokenValue
    refreshToken.value = refreshTokenValue
    userProfile.value = userProfileValue
  }

  /** 寫入當前授權狀態 */
  async function storageAuthorization(authorizationValue: CurrentAuthorizationResponse) {
    authorization.value = authorizationValue
  }

  /** 換發權杖後更新 Token */
  async function updateTokens(newAccessToken: string, newRefreshToken: string) {
    accessToken.value = newAccessToken
    refreshToken.value = newRefreshToken
  }

  /** 變更生效角色後換上新的存取權杖；刷新權杖不會因此輪替 */
  async function updateAccessToken(newAccessToken: string) {
    accessToken.value = newAccessToken
  }

  /** 登出時清空用戶狀態 */
  async function clearUser() {
    isAuthenticated.value = false
    accessToken.value = null
    refreshToken.value = null
    userProfile.value = null
    authorization.value = null
  }

  /**
   * 是否具備指定資源的權限
   *
   * 全系統唯一的權限判斷入口，路由守衛與選單都走這裡，不要另外再寫一份。
   * 與後端端點的判斷一致：只看資源代碼與四個旗標，不看選單名稱或層級
   * @param resourceCode 資源代碼（例：admin_users）
   * @param action 操作，預設為訪問權限
   * @returns 是否具備該權限；查不到資源一律視為沒有權限
   */
  function hasPermission(resourceCode: string, action: PermissionAction = 'canAccess'): boolean {
    const permission = resourcePermissions.value[resourceCode]
    if (permission === undefined) {
      return false
    }
    return permission[action]
  }

  return {
    accessToken,
    refreshToken,
    isAuthenticated,
    userProfile,
    authorization,
    displayName,
    userId,
    storageUser,
    storageAuthorization,
    updateTokens,
    updateAccessToken,
    clearUser,
    hasPermission,
  }
})

/**
 * 把權限樹攤平成以資源代碼為鍵的查詢表
 * @param permissions 後端回傳的權限樹
 * @returns 資源代碼 → 四種權限
 */
function flattenPermissions(permissions: AuthorizationPermissionResponse[]): Record<string, ResourcePermission> {
  const table: Record<string, ResourcePermission> = {}

  function visit(nodes: AuthorizationPermissionResponse[]) {
    for (const node of nodes) {
      table[node.resourceCode] = {
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
