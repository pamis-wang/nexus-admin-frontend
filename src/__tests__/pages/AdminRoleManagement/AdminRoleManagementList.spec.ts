import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import customPlugin from '@/plugins/custom'
import quasarPlugin from '@/plugins/quasar'
import { i18n } from '@/plugins/i18n'
import { useUserStore, type ResourcePermission } from '@/stores/useUser'
import AdminRoleManagementList from '@/pages/AdminRoleManagement/AdminRoleManagementList.vue'
import type { AdminRoleResponse } from '@/services/admin/adminRoleService'
import type { AuthorizationPermissionResponse } from '@/services/auth/authService'
import type { DeletedResponse, ResponseStructure } from '@/services/axiosService'

const getAdminRolesMock = vi.fn<() => Promise<ResponseStructure<AdminRoleResponse[]>>>()
const deleteAdminRoleByIdMock = vi.fn<(roleId: string) => Promise<ResponseStructure<DeletedResponse>>>()

vi.mock('@/services/admin/adminRoleService', () => ({
  getAdminRoles: () => getAdminRolesMock(),
  deleteAdminRoleById: (roleId: string) => deleteAdminRoleByIdMock(roleId),
}))

const showConfirmMock = vi.fn<(...args: unknown[]) => void>()

vi.mock('@/composables/useDialog', () => ({
  useDialog: () => ({
    // 測試一律當成使用者按了確認，直接執行後續動作
    showConfirm: (...args: unknown[]) => {
      showConfirmMock(...args)
      return { onOk: (callback: () => void) => callback() }
    },
    showError: vi.fn<(...args: unknown[]) => void>(),
  }),
}))

const FULL_PERMISSION: ResourcePermission = { canAccess: true, canCreate: true, canUpdate: true, canDelete: true }

/** 三種情境的角色：系統預設、仍有人使用、沒人使用 */
function buildRoles(): AdminRoleResponse[] {
  return [
    { id: 'role-1', name: '系統管理員', isSystemDefault: true, version: '2026-09-01T00:00:00+00:00', userCount: 2 },
    { id: 'role-2', name: '編輯者', isSystemDefault: false, version: '2026-09-01T00:00:00+00:00', userCount: 3 },
    { id: 'role-3', name: '訪客', isSystemDefault: false, version: '2026-09-01T00:00:00+00:00', userCount: 0 },
  ]
}

/**
 * 組出授權狀態的權限節點
 * @param resourceCode 資源代碼
 * @param permission 四種權限
 */
function buildPermissionNode(resourceCode: string, permission: ResourcePermission): AuthorizationPermissionResponse {
  return {
    resourceId: `resource-${resourceCode}`,
    parentId: null,
    resourceName: resourceCode,
    resourceCode,
    level: 2,
    displayOrder: 0,
    children: [],
    ...permission,
  }
}

/**
 * 準備登入者的權限
 * @param rolePermission 對角色管理的權限
 * @param canViewUsers 有沒有用戶管理的檢視權限
 */
function seedPermissions(rolePermission: ResourcePermission, canViewUsers = true): Pinia {
  const pinia = createPinia()
  setActivePinia(pinia)
  useUserStore().authorization = {
    permissionMode: 'audit',
    roles: [],
    activeRoles: [],
    permissions: [buildPermissionNode('admin_roles', rolePermission), buildPermissionNode('admin_users', { ...FULL_PERMISSION, canAccess: canViewUsers })],
  }
  return pinia
}

/** 掛載列表頁並等待資料載入 */
async function mountAdminRoleManagementList(pinia: Pinia) {
  const router = createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/', name: 'home', component: { render: () => null } },
      { path: '/users', name: 'userManagementList', component: { render: () => null } },
      { path: '/roles', name: 'roleManagementList', component: { render: () => null } },
      { path: '/roles/new', name: 'roleManagementAdd', component: { render: () => null } },
      { path: '/roles/:roleId', name: 'roleManagementView', component: { render: () => null } },
      { path: '/roles/:roleId/edit', name: 'roleManagementEdit', component: { render: () => null } },
    ],
  })
  await router.push({ name: 'roleManagementList' })

  const wrapper = mount(AdminRoleManagementList, { global: { plugins: [quasarPlugin, i18n, customPlugin, router, pinia] } })
  await vi.waitFor(() => expect(wrapper.text()).toContain('訪客'))

  return wrapper
}

/**
 * 依角色名稱取出表格列
 * @param wrapper 已掛載的頁面
 * @param name 角色名稱
 */
function findRowByName(wrapper: VueWrapper, name: string) {
  return wrapper.findAll('tbody tr').find((row) => row.text().includes(name))
}

describe('AdminRoleManagementList', () => {
  beforeEach(() => {
    localStorage.clear()
    getAdminRolesMock.mockReset()
    deleteAdminRoleByIdMock.mockReset()
    showConfirmMock.mockReset()
    getAdminRolesMock.mockResolvedValue({
      result: { data: buildRoles(), error: null },
      status: 200,
      statusText: 'OK',
      success: true,
      timestamp: Date.now(),
    })
  })

  it('載入後渲染角色列，系統預設角色標上徽章', async () => {
    const wrapper = await mountAdminRoleManagementList(seedPermissions(FULL_PERMISSION))

    expect(findRowByName(wrapper, '系統管理員')?.text()).toContain('系統預設')
    expect(findRowByName(wrapper, '編輯者')?.text()).not.toContain('系統預設')
    expect(findRowByName(wrapper, '編輯者')?.text()).toContain('3')
  })

  it('不能刪除的角色，刪除鈕停用而不是藏起來；可以刪除的才能按', async () => {
    const wrapper = await mountAdminRoleManagementList(seedPermissions(FULL_PERMISSION))

    // 檢視與編輯帶 to，Quasar 會渲染成 <a>；刪除是 <button>
    expect(findRowByName(wrapper, '系統管理員')?.find('button').attributes('disabled')).toBeDefined()
    expect(findRowByName(wrapper, '編輯者')?.find('button').attributes('disabled')).toBeDefined()
    expect(findRowByName(wrapper, '訪客')?.find('button').attributes('disabled')).toBeUndefined()
  })

  it('沒有用戶使用時確認後才刪除', async () => {
    deleteAdminRoleByIdMock.mockResolvedValue({
      result: { data: { success: true, record: 1 }, error: null },
      status: 200,
      statusText: 'OK',
      success: true,
      timestamp: Date.now(),
    })
    const wrapper = await mountAdminRoleManagementList(seedPermissions(FULL_PERMISSION))
    await findRowByName(wrapper, '訪客')?.find('button').trigger('click')

    expect(showConfirmMock).toHaveBeenCalled()
    await vi.waitFor(() => expect(deleteAdminRoleByIdMock).toHaveBeenCalledWith('role-3'))
  })

  it('沒有新增、修改、刪除權限時不顯示對應按鈕，只留檢視', async () => {
    const wrapper = await mountAdminRoleManagementList(seedPermissions({ canAccess: true, canCreate: false, canUpdate: false, canDelete: false }))

    expect(wrapper.text()).not.toContain('新增角色')
    expect(findRowByName(wrapper, '訪客')?.findAll('.q-btn')).toHaveLength(1)
  })

  it('關鍵字篩選角色名稱', async () => {
    const wrapper = await mountAdminRoleManagementList(seedPermissions(FULL_PERMISSION))

    await wrapper.find('input[placeholder="搜尋角色名稱"]').setValue('編輯')

    expect(findRowByName(wrapper, '編輯者')).toBeDefined()
    expect(findRowByName(wrapper, '訪客')).toBeUndefined()
  })

  it('有用戶管理權限時，用戶人數連到帶角色篩選的用戶列表', async () => {
    const wrapper = await mountAdminRoleManagementList(seedPermissions(FULL_PERMISSION))

    expect(findRowByName(wrapper, '編輯者')?.find('a[href*="roleName"]').exists()).toBe(true)
    // 沒有人使用的角色沒什麼好看，不給連結
    expect(findRowByName(wrapper, '訪客')?.find('a[href*="roleName"]').exists()).toBe(false)
  })

  it('沒有用戶管理權限時，用戶人數只顯示數字', async () => {
    const wrapper = await mountAdminRoleManagementList(seedPermissions(FULL_PERMISSION, false))

    expect(findRowByName(wrapper, '編輯者')?.find('a[href*="roleName"]').exists()).toBe(false)
  })
})
