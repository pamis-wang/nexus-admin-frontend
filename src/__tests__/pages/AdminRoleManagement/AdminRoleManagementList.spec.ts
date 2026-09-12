import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import customPlugin from '@/plugins/custom'
import quasarPlugin from '@/plugins/quasar'
import AdminRoleManagementList from '@/pages/AdminRoleManagement/AdminRoleManagementList.vue'
import type { AdminRoleResponse } from '@/services/admin/adminRoleService'
import type { DeletedResponse, ResponseStructure } from '@/services/axiosService'

const getAdminRolesMock = vi.fn<() => Promise<ResponseStructure<AdminRoleResponse[]>>>()
const deleteAdminRoleByIdMock = vi.fn<(roleId: string) => Promise<ResponseStructure<DeletedResponse>>>()

vi.mock('@/services/admin/adminRoleService', () => ({
  getAdminRoles: () => getAdminRolesMock(),
  deleteAdminRoleById: (roleId: string) => deleteAdminRoleByIdMock(roleId),
}))

const showWarningMock = vi.fn<(...args: unknown[]) => void>()
const showConfirmMock = vi.fn<(...args: unknown[]) => void>()

vi.mock('@/composables/useDialog', () => ({
  useDialog: () => ({
    showSuccess: vi.fn<(...args: unknown[]) => void>(),
    // 測試一律當成使用者按了確認，直接執行後續動作
    showConfirm: (...args: unknown[]) => {
      showConfirmMock(...args)
      return {
        onOk: (callback: () => void) => {
          callback()
          return { onCancel: vi.fn<() => void>() }
        },
      }
    },
    showWarning: (...args: unknown[]) => showWarningMock(...args),
    showError: vi.fn<(...args: unknown[]) => void>(),
    showInfo: vi.fn<(...args: unknown[]) => void>(),
  }),
}))

/** 三種情境的角色：系統預設、仍有人使用、沒人使用 */
function buildRoles(): AdminRoleResponse[] {
  return [
    { id: 'role-1', name: '系統管理員', isSystemDefault: true, version: '2026-09-01T00:00:00+00:00', userCount: 2 },
    { id: 'role-2', name: '編輯者', isSystemDefault: false, version: '2026-09-01T00:00:00+00:00', userCount: 3 },
    { id: 'role-3', name: '訪客', isSystemDefault: false, version: '2026-09-01T00:00:00+00:00', userCount: 0 },
  ]
}

/** 掛載列表頁並等待資料載入 */
async function mountAdminRoleManagementList() {
  const router = createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/', name: 'home', component: { render: () => null } },
      { path: '/roles', name: 'roleManagementList', component: { render: () => null } },
      { path: '/roles/new', name: 'roleManagementAdd', component: { render: () => null } },
      { path: '/roles/:roleId', name: 'roleManagementView', component: { render: () => null } },
      { path: '/roles/:roleId/edit', name: 'roleManagementEdit', component: { render: () => null } },
    ],
  })
  await router.push({ name: 'roleManagementList' })

  const wrapper = mount(AdminRoleManagementList, { global: { plugins: [quasarPlugin, customPlugin, router] } })
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
    getAdminRolesMock.mockReset()
    deleteAdminRoleByIdMock.mockReset()
    showWarningMock.mockReset()
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
    const wrapper = await mountAdminRoleManagementList()

    expect(findRowByName(wrapper, '系統管理員')?.text()).toContain('系統預設')
    expect(findRowByName(wrapper, '編輯者')?.text()).not.toContain('系統預設')
    expect(findRowByName(wrapper, '編輯者')?.text()).toContain('3')
  })

  it('系統預設角色不提供刪除，其餘角色有三個操作按鈕', async () => {
    const wrapper = await mountAdminRoleManagementList()

    // 檢視與編輯帶 to，Quasar 會渲染成 <a>；只有刪除是真正的 <button>
    expect(findRowByName(wrapper, '系統管理員')?.findAll('.q-btn')).toHaveLength(2)
    expect(findRowByName(wrapper, '系統管理員')?.findAll('button')).toHaveLength(0)
    expect(findRowByName(wrapper, '訪客')?.findAll('.q-btn')).toHaveLength(3)
    expect(findRowByName(wrapper, '訪客')?.findAll('button')).toHaveLength(1)
  })

  it('角色仍有用戶使用時擋下刪除，不呼叫 API', async () => {
    const wrapper = await mountAdminRoleManagementList()
    await findRowByName(wrapper, '編輯者')?.find('button').trigger('click')

    expect(showWarningMock).toHaveBeenCalledWith('「編輯者」目前有 3 位用戶在使用，請先調整這些用戶的角色再刪除。', '無法刪除')
    expect(showConfirmMock).not.toHaveBeenCalled()
    expect(deleteAdminRoleByIdMock).not.toHaveBeenCalled()
  })

  it('沒有用戶使用時確認後才刪除', async () => {
    deleteAdminRoleByIdMock.mockResolvedValue({
      result: { data: { success: true, record: 1 }, error: null },
      status: 200,
      statusText: 'OK',
      success: true,
      timestamp: Date.now(),
    })
    const wrapper = await mountAdminRoleManagementList()
    await findRowByName(wrapper, '訪客')?.find('button').trigger('click')

    expect(showConfirmMock).toHaveBeenCalled()
    await vi.waitFor(() => expect(deleteAdminRoleByIdMock).toHaveBeenCalledWith('role-3'))
  })
})
