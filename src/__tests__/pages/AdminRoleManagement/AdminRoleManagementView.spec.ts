import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import customPlugin from '@/plugins/custom'
import quasarPlugin from '@/plugins/quasar'
import { i18n } from '@/plugins/i18n'
import { useUserStore, type ResourcePermission } from '@/stores/useUser'
import AdminRoleManagementView from '@/pages/AdminRoleManagement/AdminRoleManagementView.vue'
import type { AdminRolePermissionMatrixResponse, AdminRoleUserResponse } from '@/services/admin/adminRoleService'
import type { AuthorizationPermissionResponse } from '@/services/auth/authService'
import type { DeletedResponse, ResponseStructure } from '@/services/axiosService'

const getAdminRolePermissionMatrix = vi.fn<(roleId: string) => Promise<ResponseStructure<AdminRolePermissionMatrixResponse>>>()
const getAdminRoleUsers = vi.fn<(roleId: string) => Promise<ResponseStructure<AdminRoleUserResponse[]>>>()
const deleteAdminRoleById = vi.fn<(roleId: string) => Promise<ResponseStructure<DeletedResponse>>>()

vi.mock('@/services/admin/adminRoleService', () => ({
  getAdminRolePermissionMatrix: (roleId: string) => getAdminRolePermissionMatrix(roleId),
  getAdminRoleUsers: (roleId: string) => getAdminRoleUsers(roleId),
  deleteAdminRoleById: (roleId: string) => deleteAdminRoleById(roleId),
}))

vi.mock('@/composables/useDialog', () => ({
  useDialog: () => ({
    showConfirm: () => ({ onOk: (callback: () => void) => callback() }),
    showError: vi.fn<(message: string, title?: string) => void>(),
  }),
}))

// 權限矩陣只拿路由表對應選單圖示，換成空路由表就好，不必載入真正的路由與守衛
vi.mock('@/router', () => ({
  default: { getRoutes: () => [] },
}))

const FULL_PERMISSION: ResourcePermission = { canAccess: true, canCreate: true, canUpdate: true, canDelete: true }

/**
 * 包成 axiosService 的統一回應格式
 * @param data 回應資料
 */
function buildResponse<T>(data: T): ResponseStructure<T> {
  return { result: { data, error: null }, status: 200, statusText: 'OK', success: true, timestamp: Date.now() }
}

/**
 * 角色與權限矩陣：只有一個可檢視的功能
 * @param userCount 用戶人數
 * @param isSystemDefault 是否為系統預設角色
 */
function buildMatrixResponse(userCount: number, isSystemDefault = false): ResponseStructure<AdminRolePermissionMatrixResponse> {
  return buildResponse({
    role: { id: 'role-1', name: '編輯者', isSystemDefault, version: 'v1', userCount },
    permissions: [
      {
        resourceId: 'users',
        parentId: null,
        resourceName: '用戶管理',
        resourceCode: 'admin_users',
        level: 1,
        displayOrder: 0,
        isEnabled: true,
        canAccess: true,
        canCreate: false,
        canUpdate: false,
        canDelete: false,
        availableActions: ['access', 'create', 'update'],
        children: [],
      },
    ],
  })
}

/**
 * 組出授權狀態的權限節點
 * @param resourceName 資源完整路徑
 * @param permission 四種權限
 */
function buildPermissionNode(resourceName: string, permission: ResourcePermission): AuthorizationPermissionResponse {
  return { resourceId: `resource-${resourceName}`, parentId: null, resourceName, level: 2, displayOrder: 0, children: [], ...permission }
}

/** 準備有全部權限的登入者 */
function seedPermissions(): Pinia {
  const pinia = createPinia()
  setActivePinia(pinia)
  useUserStore().authorization = {
    permissionMode: 'audit',
    roles: [],
    activeRoles: [],
    permissions: [buildPermissionNode('系統管理>角色管理', FULL_PERMISSION), buildPermissionNode('系統管理>用戶管理', FULL_PERMISSION)],
  }
  return pinia
}

/** 掛載檢視頁並等待角色載入 */
async function mountPage(): Promise<{ wrapper: ReturnType<typeof mount>; router: Router }> {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: { render: () => null } },
      { path: '/users', name: 'userManagementList', component: { render: () => null } },
      { path: '/roles', name: 'roleManagementList', component: { render: () => null } },
      { path: '/roles/:roleId', name: 'roleManagementView', component: { render: () => null } },
      { path: '/roles/:roleId/edit', name: 'roleManagementEdit', component: { render: () => null } },
    ],
  })
  await router.push('/roles/role-1')

  const wrapper = mount(AdminRoleManagementView, { global: { plugins: [quasarPlugin, i18n, customPlugin, router, seedPermissions()] } })
  await vi.waitFor(() => expect(wrapper.text()).toContain('權限設定'))

  return { wrapper, router }
}

describe('AdminRoleManagementView', () => {
  beforeEach(() => {
    localStorage.clear()
    getAdminRolePermissionMatrix.mockReset()
    getAdminRoleUsers.mockReset()
    deleteAdminRoleById.mockReset()
  })

  it('標題區顯示角色名稱、用戶人數與帶角色篩選的「查看用戶」，矩陣唯讀', async () => {
    getAdminRolePermissionMatrix.mockResolvedValue(buildMatrixResponse(2))
    getAdminRoleUsers.mockResolvedValue(buildResponse([]))
    const { wrapper } = await mountPage()

    expect(wrapper.text()).toContain('編輯者')
    expect(wrapper.text()).toContain('用戶人數 2')
    expect(wrapper.find('a[href*="roleName="]').text()).toBe('查看用戶')
    expect(wrapper.findAll('.q-checkbox')).toHaveLength(0)
  })

  it('列出使用此角色的用戶，沒填姓名時顯示帳號，停用的另外標示', async () => {
    getAdminRolePermissionMatrix.mockResolvedValue(buildMatrixResponse(2))
    getAdminRoleUsers.mockResolvedValue(
      buildResponse([
        { id: 'user-1', account: 'alice', fullName: '王小明', isDisabled: false },
        { id: 'user-2', account: 'bob', fullName: null, isDisabled: true },
      ])
    )
    const { wrapper } = await mountPage()

    await vi.waitFor(() => expect(wrapper.text()).toContain('使用此角色的用戶（2）'))
    const chipTexts = wrapper.findAll('.q-chip').map((chip) => chip.text())
    expect(chipTexts.some((text) => text.includes('王小明'))).toBe(true)
    expect(chipTexts.some((text) => text.includes('bob') && text.includes('已停用'))).toBe(true)
  })

  it('仍有用戶使用時刪除鈕停用', async () => {
    getAdminRolePermissionMatrix.mockResolvedValue(buildMatrixResponse(2))
    getAdminRoleUsers.mockResolvedValue(buildResponse([]))
    const { wrapper } = await mountPage()

    const deleteButton = wrapper.findAll('button').find((button) => button.text().includes('刪除'))
    expect(deleteButton?.attributes('disabled')).toBeDefined()
  })

  it('系統預設角色的刪除鈕停用', async () => {
    getAdminRolePermissionMatrix.mockResolvedValue(buildMatrixResponse(0, true))
    getAdminRoleUsers.mockResolvedValue(buildResponse([]))
    const { wrapper } = await mountPage()

    const deleteButton = wrapper.findAll('button').find((button) => button.text().includes('刪除'))
    expect(deleteButton?.attributes('disabled')).toBeDefined()
  })

  it('沒有人使用時可以刪除，刪除後回到列表', async () => {
    getAdminRolePermissionMatrix.mockResolvedValue(buildMatrixResponse(0))
    getAdminRoleUsers.mockResolvedValue(buildResponse([]))
    deleteAdminRoleById.mockResolvedValue(buildResponse({ success: true, record: 1 }))
    const { wrapper, router } = await mountPage()

    await vi.waitFor(() => expect(wrapper.text()).toContain('目前沒有用戶使用此角色'))
    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('刪除'))
      ?.trigger('click')

    await vi.waitFor(() => expect(deleteAdminRoleById).toHaveBeenCalledWith('role-1'))
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('roleManagementList'))
  })

  it('用戶名單載入失敗只影響那一塊，權限矩陣照樣顯示', async () => {
    getAdminRolePermissionMatrix.mockResolvedValue(buildMatrixResponse(2))
    getAdminRoleUsers.mockRejectedValue({
      result: { data: null, error: null },
      status: 500,
      statusText: 'Error',
      success: false,
      errorMessage: '伺服器錯誤',
      timestamp: Date.now(),
    })
    const { wrapper } = await mountPage()

    await vi.waitFor(() => expect(wrapper.text()).toContain('無法載入用戶名單：伺服器錯誤'))
    expect(wrapper.text()).toContain('用戶管理')
  })
})
