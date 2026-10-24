import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import { QLayout, QPage, QPageContainer } from 'quasar'
import customPlugin from '@/plugins/custom'
import quasarPlugin from '@/plugins/quasar'
import { i18n } from '@/plugins/i18n'
import AdminRoleManagementEdit from '@/pages/AdminRoleManagement/AdminRoleManagementEdit.vue'
import type { AdminRolePermissionMatrixResponse, AdminRolePermissionNodeResponse, UpdateAdminRoleRequest } from '@/services/admin/adminRoleService'
import type { ResponseStructure, UpdatedResponse } from '@/services/axiosService'

const getAdminRolePermissionMatrix = vi.fn<(roleId: string) => Promise<ResponseStructure<AdminRolePermissionMatrixResponse>>>()
const updateAdminRole = vi.fn<(roleId: string, data: UpdateAdminRoleRequest) => Promise<ResponseStructure<UpdatedResponse>>>()
const showWarning = vi.fn<(message: string, title?: string) => void>()

vi.mock('@/services/admin/adminRoleService', () => ({
  getAdminRolePermissionMatrix: (roleId: string) => getAdminRolePermissionMatrix(roleId),
  updateAdminRole: (roleId: string, data: UpdateAdminRoleRequest) => updateAdminRole(roleId, data),
}))

vi.mock('@/composables/useDialog', () => ({
  useDialog: () => ({
    showConfirm: () => ({ onOk: (callback: () => void) => callback() }),
    showError: vi.fn<(message: string, title?: string) => void>(),
    showWarning: (message: string, title?: string) => showWarning(message, title),
  }),
}))

// 權限矩陣只拿路由表對應選單圖示，換成空路由表就好，不必載入真正的路由與守衛
vi.mock('@/router', () => ({
  default: { options: { routes: [] } },
}))

/**
 * 組出權限樹節點，四種操作都可授權
 * @param resourceId 資源唯一編號
 * @param resourceName 完整資源名稱
 * @param canAccess 檢視權限
 * @param children 子節點
 */
function buildNode(
  resourceId: string,
  resourceName: string,
  canAccess: boolean,
  children: AdminRolePermissionNodeResponse[] = []
): AdminRolePermissionNodeResponse {
  return {
    resourceId,
    parentId: null,
    resourceName,
    resourceCode: `code-${resourceId}`,
    level: resourceName.split('>').length,
    displayOrder: 0,
    isEnabled: true,
    canAccess,
    canCreate: false,
    canUpdate: false,
    canDelete: false,
    availableActions: ['access', 'create', 'update', 'delete'],
    children: children.map((child) => ({ ...child, parentId: resourceId })),
  }
}

/**
 * 包成 axiosService 的統一回應格式
 * @param data 回應資料
 */
function buildResponse<T>(data: T): ResponseStructure<T> {
  return { result: { data, error: null }, status: 200, statusText: 'OK', success: true, timestamp: Date.now() }
}

/**
 * 角色與權限矩陣：系統管理底下有用戶管理（可檢視）與角色管理（全部沒有）
 * @param isSystemDefault 是否為系統預設角色
 */
function buildMatrixResponse(isSystemDefault: boolean): ResponseStructure<AdminRolePermissionMatrixResponse> {
  return buildResponse({
    role: { id: 'role-1', name: '編輯者', isSystemDefault, version: 'v1', userCount: 2 },
    permissions: [buildNode('system', '系統管理', true, [buildNode('users', '系統管理>用戶管理', true), buildNode('roles', '系統管理>角色管理', false)])],
  })
}

/** 掛載編輯頁；固定操作列是 q-page-sticky，要放在 QLayout 裡才會渲染 */
async function mountPage() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/roles', name: 'roleManagementList', component: { render: () => null } },
      { path: '/roles/:roleId', name: 'roleManagementView', component: { render: () => null } },
      { path: '/roles/:roleId/edit', name: 'roleManagementEdit', component: AdminRoleManagementEdit },
      { path: '/', name: 'home', component: { render: () => null } },
    ],
  })
  await router.push('/roles/role-1/edit')

  const host = defineComponent({
    render: () => h(QLayout, { view: 'hHh lpR fFf' }, () => h(QPageContainer, () => h(QPage, () => h(RouterView)))),
  })
  const wrapper = mount(host, { global: { plugins: [quasarPlugin, i18n, customPlugin, router] } })

  return { wrapper, router }
}

function findButtonByLabel(wrapper: VueWrapper, label: string) {
  return wrapper.findAll('button').find((button) => button.text().includes(label))
}

describe('AdminRoleManagementEdit', () => {
  beforeEach(() => {
    getAdminRolePermissionMatrix.mockReset()
    updateAdminRole.mockReset()
    showWarning.mockReset()
  })

  it('載入後顯示角色名稱與權限矩陣，沒有變更時不能儲存', async () => {
    getAdminRolePermissionMatrix.mockResolvedValue(buildMatrixResponse(false))
    const { wrapper } = await mountPage()

    await vi.waitFor(() => expect(wrapper.text()).toContain('用戶管理'))

    expect(wrapper.find('input[maxlength="50"]').element).toHaveProperty('value', '編輯者')
    expect(wrapper.text()).toContain('用戶人數 2')
    expect(wrapper.text()).toContain('沒有未儲存的變更')
    expect(findButtonByLabel(wrapper, '儲存')?.classes()).toContain('disabled')
  })

  it('勾選後顯示變更數，儲存送出名稱、版本與全部資源的權限，再回到檢視頁', async () => {
    getAdminRolePermissionMatrix.mockResolvedValue(buildMatrixResponse(false))
    updateAdminRole.mockResolvedValue(buildResponse({ id: 'role-1', updatedAt: '' }))
    const { wrapper, router } = await mountPage()
    await vi.waitFor(() => expect(wrapper.text()).toContain('角色管理'))

    await wrapper.find('[aria-label="角色管理：新增"]').trigger('click')
    expect(wrapper.text()).toContain('有 2 項未儲存的變更')

    await findButtonByLabel(wrapper, '儲存')?.trigger('click')

    await vi.waitFor(() => expect(updateAdminRole).toHaveBeenCalled())
    expect(updateAdminRole).toHaveBeenCalledWith('role-1', {
      name: '編輯者',
      version: 'v1',
      permissions: [
        { resourceId: 'system', canAccess: true, canCreate: true, canUpdate: false, canDelete: false },
        { resourceId: 'users', canAccess: true, canCreate: false, canUpdate: false, canDelete: false },
        { resourceId: 'roles', canAccess: true, canCreate: true, canUpdate: false, canDelete: false },
      ],
    })
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('roleManagementView'))
  })

  it('改名也算一項變更，重設後還原', async () => {
    getAdminRolePermissionMatrix.mockResolvedValue(buildMatrixResponse(false))
    const { wrapper } = await mountPage()
    await vi.waitFor(() => expect(wrapper.text()).toContain('用戶管理'))

    await wrapper.find('input[maxlength="50"]').setValue('編輯組')
    expect(wrapper.text()).toContain('有 1 項未儲存的變更')

    await findButtonByLabel(wrapper, '重設')?.trigger('click')
    expect(wrapper.find('input[maxlength="50"]').element).toHaveProperty('value', '編輯者')
    expect(wrapper.text()).toContain('沒有未儲存的變更')
  })

  it('系統預設角色照樣可以調整權限，標題旁標示系統預設', async () => {
    getAdminRolePermissionMatrix.mockResolvedValue(buildMatrixResponse(true))
    const { wrapper, router } = await mountPage()

    await vi.waitFor(() => expect(wrapper.text()).toContain('用戶管理'))

    expect(router.currentRoute.value.name).toBe('roleManagementEdit')
    expect(wrapper.text()).toContain('系統預設')
    expect(wrapper.find('[aria-label="角色管理：新增"]').exists()).toBe(true)
  })

  it('版本衝突時說明原因並留在原頁', async () => {
    getAdminRolePermissionMatrix.mockResolvedValue(buildMatrixResponse(false))
    updateAdminRole.mockRejectedValue({
      result: { data: null, error: { code: 409, message: '版本不符' } },
      status: 409,
      statusText: 'Conflict',
      success: false,
      errorMessage: '版本不符',
      timestamp: Date.now(),
    })
    const { wrapper, router } = await mountPage()
    await vi.waitFor(() => expect(wrapper.text()).toContain('角色管理'))

    await wrapper.find('[aria-label="角色管理：檢視"]').trigger('click')
    await findButtonByLabel(wrapper, '儲存')?.trigger('click')

    await vi.waitFor(() => expect(showWarning).toHaveBeenCalledWith(expect.stringContaining('已被其他人修改'), '版本衝突'))
    expect(router.currentRoute.value.name).toBe('roleManagementEdit')
  })
})
