import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import customPlugin from '@/plugins/custom'
import quasarPlugin from '@/plugins/quasar'
import AdminRoleManagementEdit from '@/pages/AdminRoleManagement/AdminRoleManagementEdit.vue'
import { RESOURCE_FORBIDDEN_MESSAGE } from '@/pages/AdminRoleManagement/composables/useAdminRolePermissionMatrix'
import type { AdminResourceResponse } from '@/services/admin/adminResourceService'
import type { AdminRolePermissionResponse, AdminRoleResponse, UpdateAdminRoleRequest } from '@/services/admin/adminRoleService'
import type { ResponseStructure, UpdatedResponse } from '@/services/axiosService'

const getAdminRoleByIdMock = vi.fn<(roleId: string) => Promise<ResponseStructure<AdminRoleResponse>>>()
const updateAdminRoleMock = vi.fn<(roleId: string, data: UpdateAdminRoleRequest) => Promise<ResponseStructure<UpdatedResponse>>>()
const getAdminRolePermissionsByRoleIdMock = vi.fn<(roleId: string) => Promise<ResponseStructure<AdminRolePermissionResponse[]>>>()
const getAdminResourcesMock = vi.fn<() => Promise<ResponseStructure<AdminResourceResponse[]>>>()

vi.mock('@/services/admin/adminRoleService', () => ({
  getAdminRoleById: (roleId: string) => getAdminRoleByIdMock(roleId),
  updateAdminRole: (roleId: string, data: UpdateAdminRoleRequest) => updateAdminRoleMock(roleId, data),
  getAdminRolePermissionsByRoleId: (roleId: string) => getAdminRolePermissionsByRoleIdMock(roleId),
}))

vi.mock('@/services/admin/adminResourceService', () => ({
  getAdminResources: () => getAdminResourcesMock(),
}))

// 權限矩陣只拿路由表對應選單圖示，換成空路由表就好，不必載入真正的路由與守衛
vi.mock('@/router', () => ({
  default: { getRoutes: () => [] },
}))

/**
 * 把資料包成 axiosService 的統一回應格式
 * @param data 回應資料
 */
function buildResponse<T>(data: T): ResponseStructure<T> {
  return {
    result: { data, error: null },
    status: 200,
    statusText: 'OK',
    success: true,
    timestamp: Date.now(),
  }
}

/**
 * 組一份 axiosService 失敗時 reject 的物件
 * @param status HTTP 狀態碼
 * @param errorMessage 統一的錯誤訊息
 */
function buildErrorResponse(status: number, errorMessage: string): ResponseStructure<null> {
  return {
    result: { data: null, error: { code: status, message: errorMessage } },
    status,
    statusText: 'Error',
    success: false,
    errorMessage,
    timestamp: Date.now(),
  }
}

/** 掛載編輯頁並等待角色資料載入 */
async function mountAdminRoleManagementEdit() {
  const router = createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/', name: 'home', component: { render: () => null } },
      { path: '/roles', name: 'roleManagementList', component: { render: () => null } },
      { path: '/roles/:roleId/edit', name: 'roleManagementEdit', component: { render: () => null } },
    ],
  })
  await router.push({ name: 'roleManagementEdit', params: { roleId: 'role-2' } })

  const wrapper = mount(AdminRoleManagementEdit, { global: { plugins: [quasarPlugin, customPlugin, router] } })
  await vi.waitFor(() => expect(wrapper.text()).toContain('權限設定'))

  return wrapper
}

/**
 * 取出儲存鈕
 * @param wrapper 已掛載的頁面
 */
function findSaveButton(wrapper: VueWrapper) {
  return wrapper.findAll('button').find((button) => button.text().includes('儲存'))
}

describe('AdminRoleManagementEdit - 資源清單讀不到', () => {
  beforeEach(() => {
    getAdminRoleByIdMock.mockReset()
    updateAdminRoleMock.mockReset()
    getAdminRolePermissionsByRoleIdMock.mockReset()
    getAdminResourcesMock.mockReset()

    getAdminRoleByIdMock.mockResolvedValue(
      buildResponse({ id: 'role-2', name: '編輯者', isSystemDefault: false, version: '2026-09-01T00:00:00+00:00', userCount: 3 }),
    )
    getAdminRolePermissionsByRoleIdMock.mockResolvedValue(buildResponse([]))
  })

  it('沒有「資源管理」權限時說明原因、停用儲存鈕，硬送出也不會清掉角色權限', async () => {
    getAdminResourcesMock.mockRejectedValue(buildErrorResponse(403, '權限不足'))

    const wrapper = await mountAdminRoleManagementEdit()
    await vi.waitFor(() => expect(wrapper.text()).toContain(RESOURCE_FORBIDDEN_MESSAGE))

    expect(findSaveButton(wrapper)?.attributes('disabled')).toBeDefined()
    expect(getAdminRolePermissionsByRoleIdMock).not.toHaveBeenCalled()

    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(updateAdminRoleMock).not.toHaveBeenCalled()
  })

  it('資源清單正常時可以儲存', async () => {
    getAdminResourcesMock.mockResolvedValue(
      buildResponse([{ id: 'id-system', parentId: null, level: 1, resourceName: '系統管理', resourceCode: null, displayOrder: 10000, isEnabled: true }]),
    )

    const wrapper = await mountAdminRoleManagementEdit()
    await vi.waitFor(() => expect(getAdminRolePermissionsByRoleIdMock).toHaveBeenCalledWith('role-2'))

    expect(wrapper.text()).not.toContain(RESOURCE_FORBIDDEN_MESSAGE)
    expect(findSaveButton(wrapper)?.attributes('disabled')).toBeUndefined()
  })
})
