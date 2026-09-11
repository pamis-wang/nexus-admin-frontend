import { describe, it, expect, vi, beforeEach } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import { useUserStore } from '@/stores/useUser'
import { useAuthentication } from '@/composables/useAuthentication'
import type {
  CurrentAuthorizationResponse,
  LoginRequest,
  LoginResponse,
  LogoutResponse,
  SetActiveRolesRequest,
  SetActiveRolesResponse,
} from '@/services/auth/authService'
import type { ResponseStructure } from '@/services/axiosService'

const logoutRequestMock = vi.fn<() => Promise<ResponseStructure<LogoutResponse>>>()
const getCurrentAuthorizationMock = vi.fn<() => Promise<ResponseStructure<CurrentAuthorizationResponse>>>()
const setActiveRolesMock = vi.fn<(data: SetActiveRolesRequest) => Promise<ResponseStructure<SetActiveRolesResponse>>>()

vi.mock('@/services/auth/authService', () => ({
  login: vi.fn<(data: LoginRequest) => Promise<LoginResponse>>(),
  logout: (...args: unknown[]) => logoutRequestMock(...args),
  getCurrentAuthorization: () => getCurrentAuthorizationMock(),
  setActiveRoles: (data: SetActiveRolesRequest) => setActiveRolesMock(data),
}))

/**
 * 組一份授權狀態回應
 * @param resourceName 有訪問權限的資源
 * @param activeRoleName 目前生效的角色名稱
 */
function buildAuthorizationResponse(resourceName: string, activeRoleName: string): ResponseStructure<CurrentAuthorizationResponse> {
  return {
    result: {
      data: {
        permissionMode: 'audit',
        roles: [
          { id: 'role-1', name: '管理員' },
          { id: 'role-2', name: '檢視者' },
        ],
        activeRoles: [{ id: activeRoleName === '管理員' ? 'role-1' : 'role-2', name: activeRoleName }],
        permissions: [
          {
            resourceId: 'resource-0',
            parentId: null,
            resourceName,
            level: 1,
            displayOrder: 0,
            canAccess: true,
            canCreate: false,
            canUpdate: false,
            canDelete: false,
            children: [],
          },
        ],
      },
      error: null,
    },
    status: 200,
    statusText: 'OK',
    success: true,
    timestamp: Date.now(),
  }
}

const mockUserProfile = {
  id: '1',
  account: 'admin',
  email: 'admin@example.com',
  fullName: null,
  roles: [],
}

async function mountAuthentication() {
  const router = createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/', name: 'home', component: { template: '<div />' } },
      { path: '/login', name: 'login', component: { template: '<div />' } },
    ],
  })

  let authentication!: ReturnType<typeof useAuthentication>
  mount(
    defineComponent({
      setup() {
        authentication = useAuthentication()
        return () => h('div')
      },
    }),
    { global: { plugins: [router] } },
  )
  await router.push({ name: 'home' })

  return { authentication, router }
}

describe('useAuthentication - logout', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    logoutRequestMock.mockReset()
  })

  it('撤銷成功時，清空使用者狀態並導向登入頁', async () => {
    logoutRequestMock.mockResolvedValue(undefined)
    const { authentication, router } = await mountAuthentication()
    const userStore = useUserStore()
    await userStore.storageUser('access-token', 'refresh-token', mockUserProfile)

    await authentication.logout()

    expect(userStore.isAuthenticated).toBe(false)
    expect(userStore.accessToken).toBeNull()
    expect(router.currentRoute.value.name).toBe('login')
  })

  it('撤銷失敗時，不拋出例外，仍清空使用者狀態並導向登入頁', async () => {
    logoutRequestMock.mockRejectedValue(new Error('network error'))
    const { authentication, router } = await mountAuthentication()
    const userStore = useUserStore()
    await userStore.storageUser('access-token', 'refresh-token', mockUserProfile)

    await expect(authentication.logout()).resolves.toBeUndefined()

    expect(userStore.isAuthenticated).toBe(false)
    expect(userStore.accessToken).toBeNull()
    expect(router.currentRoute.value.name).toBe('login')
  })
})

describe('useAuthentication - 生效角色', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    getCurrentAuthorizationMock.mockReset()
    setActiveRolesMock.mockReset()
    await useUserStore().clearUser()
  })

  it('切換成功時，用回應的存取權杖取代原有的並重新取回授權狀態', async () => {
    setActiveRolesMock.mockResolvedValue({
      result: {
        data: {
          authStatus: 'success',
          message: null,
          tokenType: 'Bearer',
          accessToken: 'new-access-token',
          activeRoles: [{ id: 'role-2', name: '檢視者' }],
        },
        error: null,
      },
      status: 200,
      statusText: 'OK',
      success: true,
      timestamp: Date.now(),
    })
    getCurrentAuthorizationMock.mockResolvedValue(buildAuthorizationResponse('系統管理>角色管理', '檢視者'))
    const { authentication } = await mountAuthentication()
    const userStore = useUserStore()
    await userStore.storageUser('old-access-token', 'refresh-token', mockUserProfile)

    const result = await authentication.switchActiveRoles(['role-2'])

    expect(result.success).toBe(true)
    expect(setActiveRolesMock).toHaveBeenCalledWith({ roleIds: ['role-2'] })
    // 沒換掉存取權杖的話，後端仍會以舊的生效角色判斷權限
    expect(userStore.accessToken).toBe('new-access-token')
    // 刷新權杖不隨之輪替
    expect(userStore.refreshToken).toBe('refresh-token')
    expect(getCurrentAuthorizationMock).toHaveBeenCalled()
    expect(userStore.hasPermission('系統管理>角色管理')).toBe(true)
    expect(userStore.activeRoles.map((role) => role.name)).toEqual(['檢視者'])
  })

  it('後端回 403 時不動存取權杖，並帶回錯誤訊息', async () => {
    setActiveRolesMock.mockRejectedValue({
      result: { data: null, error: { code: 403, message: '稽核模式下一次只能有一個角色生效' } },
      status: 403,
      statusText: 'Forbidden',
      success: false,
      errorMessage: '稽核模式下一次只能有一個角色生效',
      timestamp: Date.now(),
    })
    const { authentication } = await mountAuthentication()
    const userStore = useUserStore()
    await userStore.storageUser('old-access-token', 'refresh-token', mockUserProfile)

    const result = await authentication.switchActiveRoles(['role-1', 'role-2'])

    expect(result.success).toBe(false)
    expect(result.message).toBe('稽核模式下一次只能有一個角色生效')
    expect(userStore.accessToken).toBe('old-access-token')
    expect(getCurrentAuthorizationMock).not.toHaveBeenCalled()
  })

  it('載入授權狀態失敗時不拋出，沿用 store 裡既有的權限', async () => {
    getCurrentAuthorizationMock.mockRejectedValue(new Error('network error'))
    const { authentication } = await mountAuthentication()
    const userStore = useUserStore()
    await userStore.storageAuthorization(buildAuthorizationResponse('首頁', '管理員').result.data!)

    await expect(authentication.loadAuthorization()).resolves.toBe(false)

    expect(userStore.hasPermission('首頁')).toBe(true)
  })
})
