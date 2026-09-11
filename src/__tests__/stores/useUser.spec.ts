import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useUserStore } from '@/stores/useUser'
import type { AuthorizationPermissionResponse, CurrentAuthorizationResponse } from '@/services/auth/authService'

/**
 * 組一個權限節點，只有測試在意的欄位需要指定
 * @param resourceName 資源完整路徑
 * @param options 要覆寫的欄位
 */
function buildPermission(resourceName: string, options: Partial<AuthorizationPermissionResponse> = {}): AuthorizationPermissionResponse {
  return {
    resourceId: `resource-${resourceName}`,
    parentId: null,
    resourceName,
    level: 1,
    displayOrder: 0,
    canAccess: true,
    canCreate: false,
    canUpdate: false,
    canDelete: false,
    children: [],
    ...options,
  }
}

/**
 * 組一份授權狀態
 * @param permissions 權限樹
 */
function buildAuthorization(permissions: AuthorizationPermissionResponse[]): CurrentAuthorizationResponse {
  return {
    permissionMode: 'audit',
    roles: [
      { id: 'role-1', name: '管理員' },
      { id: 'role-2', name: '檢視者' },
    ],
    activeRoles: [{ id: 'role-1', name: '管理員' }],
    permissions,
  }
}

describe('useUserStore 的權限判斷', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    await useUserStore().clearUser()
  })

  it('把巢狀的權限樹攤平，第三層資源也查得到', async () => {
    const userStore = useUserStore()
    await userStore.storageAuthorization(
      buildAuthorization([
        buildPermission('內容管理', {
          children: [
            buildPermission('內容管理>進階設定', {
              level: 2,
              children: [buildPermission('內容管理>進階設定>分類設定', { level: 3 })],
            }),
          ],
        }),
      ]),
    )

    expect(userStore.hasPermission('內容管理')).toBe(true)
    expect(userStore.hasPermission('內容管理>進階設定')).toBe(true)
    expect(userStore.hasPermission('內容管理>進階設定>分類設定')).toBe(true)
  })

  it('四種權限各自獨立，預設查的是訪問權限', async () => {
    const userStore = useUserStore()
    await userStore.storageAuthorization(
      buildAuthorization([buildPermission('系統管理>用戶管理', { canAccess: true, canCreate: true, canUpdate: false, canDelete: false })]),
    )

    expect(userStore.hasPermission('系統管理>用戶管理')).toBe(true)
    expect(userStore.hasPermission('系統管理>用戶管理', 'canAccess')).toBe(true)
    expect(userStore.hasPermission('系統管理>用戶管理', 'canCreate')).toBe(true)
    expect(userStore.hasPermission('系統管理>用戶管理', 'canUpdate')).toBe(false)
    expect(userStore.hasPermission('系統管理>用戶管理', 'canDelete')).toBe(false)
  })

  it('查不到的資源一律視為沒有權限', async () => {
    const userStore = useUserStore()
    await userStore.storageAuthorization(buildAuthorization([buildPermission('系統管理>角色管理')]))

    expect(userStore.hasPermission('系統管理>用戶管理')).toBe(false)
    expect(userStore.hasPermission('')).toBe(false)
  })

  it('寫入授權狀態時一併保存模式與角色', async () => {
    const userStore = useUserStore()
    await userStore.storageAuthorization(buildAuthorization([buildPermission('首頁')]))

    expect(userStore.permissionMode).toBe('audit')
    expect(userStore.assignedRoles.map((role) => role.name)).toEqual(['管理員', '檢視者'])
    expect(userStore.activeRoles.map((role) => role.name)).toEqual(['管理員'])
  })

  it('登出後權限一併清空，避免下一個人沿用前一個人的選單', async () => {
    const userStore = useUserStore()
    await userStore.storageAuthorization(buildAuthorization([buildPermission('首頁')]))

    await userStore.clearUser()

    expect(userStore.hasPermission('首頁')).toBe(false)
    expect(userStore.permissionMode).toBe('unknown')
    expect(userStore.assignedRoles).toEqual([])
    expect(userStore.activeRoles).toEqual([])
  })

  it('變更生效角色只換存取權杖，不動刷新權杖', async () => {
    const userStore = useUserStore()
    await userStore.storageUser('old-access', 'refresh-token', { id: '1', account: 'admin', email: 'a@b.c', fullName: null, roles: [] })

    userStore.updateAccessToken('new-access')

    expect(userStore.accessToken).toBe('new-access')
    expect(userStore.refreshToken).toBe('refresh-token')
  })
})
