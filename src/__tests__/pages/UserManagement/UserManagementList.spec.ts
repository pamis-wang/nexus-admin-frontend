import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import customPlugin from '@/plugins/custom'
import quasarPlugin from '@/plugins/quasar'
import UserManagementList from '@/pages/UserManagement/UserManagementList.vue'
import { useUserStore } from '@/stores/useUser'
import type { AdminUserResponse, UpdateAdminUserDisabledStateRequest } from '@/services/admin/adminUserService'
import type { ResponseStructure, UpdatedResponse } from '@/services/axiosService'

const getAdminUsersMock = vi.fn<() => Promise<ResponseStructure<AdminUserResponse[]>>>()
const updateAdminUserDisabledStateMock = vi.fn<(userId: string, data: UpdateAdminUserDisabledStateRequest) => Promise<ResponseStructure<UpdatedResponse>>>()

vi.mock('@/services/admin/adminUserService', () => ({
  getAdminUsers: () => getAdminUsersMock(),
  updateAdminUserDisabledState: (userId: string, data: UpdateAdminUserDisabledStateRequest) => updateAdminUserDisabledStateMock(userId, data),
}))

const showConfirmMock = vi.fn<(...args: unknown[]) => void>()

vi.mock('@/composables/useDialog', () => ({
  useDialog: () => ({
    showSuccess: vi.fn<(...args: unknown[]) => void>(),
    // 測試一律當成使用者按了確認
    showConfirm: (...args: unknown[]) => {
      showConfirmMock(...args)
      return {
        onOk: (callback: () => void) => {
          callback()
          return { onCancel: vi.fn<() => void>() }
        },
      }
    },
    showWarning: vi.fn<(...args: unknown[]) => void>(),
    showError: vi.fn<(...args: unknown[]) => void>(),
    showInfo: vi.fn<(...args: unknown[]) => void>(),
  }),
}))

/** 目前登入者 */
const CURRENT_USER_ID = 'user-self'

/** 組一筆用戶，只有測試在意的欄位需要指定 */
function buildUser(id: string, account: string, options: Partial<AdminUserResponse> = {}): AdminUserResponse {
  return {
    id,
    account,
    email: `${account}@example.com`,
    fullName: null,
    isSystemDefault: false,
    isDisabled: false,
    activateAt: null,
    lastLoginAt: null,
    roleMappings: [],
    logins: [],
    ...options,
  }
}

/**
 * 測試用戶：
 * - nexus_system：系統預設、啟用中（不可停用）
 * - self：目前登入者（不可停用）
 * - editor：一般用戶，有角色、登入方式鎖定中
 * - newcomer：一般用戶，尚未綁定登入方式
 * - retired：系統預設但已停用（可以啟用回來）
 */
function buildUsers(): AdminUserResponse[] {
  return [
    buildUser('user-system', 'nexus_system', { isSystemDefault: true }),
    buildUser(CURRENT_USER_ID, 'nexus_admin'),
    buildUser('user-editor', 'editor', {
      roleMappings: [{ adminId: 'user-editor', adminName: 'editor', roleId: 'role-1', roleName: '編輯者' }],
      logins: [
        {
          id: 'login-1',
          provider: 'password',
          providerName: '密碼',
          providerEmail: 'editor@example.com',
          verifiedAt: '2026-09-01T00:00:00+00:00',
          isUsable: true,
          requiresReset: false,
          failedCount: 5,
          lockedUntil: '2099-01-01T00:00:00+00:00',
          lastUsedAt: null,
        },
      ],
    }),
    buildUser('user-newcomer', 'newcomer'),
    buildUser('user-retired', 'retired', { isSystemDefault: true, isDisabled: true }),
  ]
}

/** 掛載列表頁並等待資料載入 */
async function mountUserManagementList() {
  setActivePinia(createPinia())
  await useUserStore().storageUser('access-token', 'refresh-token', {
    id: CURRENT_USER_ID,
    account: 'nexus_admin',
    email: 'admin@example.com',
    fullName: null,
    roles: [],
  })

  const router = createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/', name: 'home', component: { render: () => null } },
      { path: '/users', name: 'userManagementList', component: { render: () => null } },
      { path: '/users/new', name: 'userManagementAdd', component: { render: () => null } },
      { path: '/users/:userId', name: 'userManagementView', component: { render: () => null } },
      { path: '/users/:userId/edit', name: 'userManagementEdit', component: { render: () => null } },
    ],
  })
  await router.push({ name: 'userManagementList' })

  const wrapper = mount(UserManagementList, { global: { plugins: [quasarPlugin, customPlugin, router] } })
  await vi.waitFor(() => expect(wrapper.text()).toContain('newcomer'))

  return wrapper
}

/**
 * 依帳號取出表格列
 * @param wrapper 已掛載的頁面
 * @param account 帳號
 */
function findRowByAccount(wrapper: VueWrapper, account: string) {
  return wrapper.findAll('tbody tr').find((row) => row.text().includes(account))
}

describe('UserManagementList', () => {
  beforeEach(() => {
    getAdminUsersMock.mockReset()
    updateAdminUserDisabledStateMock.mockReset()
    showConfirmMock.mockReset()
    getAdminUsersMock.mockResolvedValue({
      result: { data: buildUsers(), error: null },
      status: 200,
      statusText: 'OK',
      success: true,
      timestamp: Date.now(),
    })
  })

  it('列出角色、登入狀態與系統預設標記', async () => {
    const wrapper = await mountUserManagementList()

    expect(findRowByAccount(wrapper, 'editor')?.text()).toContain('編輯者')
    expect(findRowByAccount(wrapper, 'editor')?.text()).toContain('鎖定中')
    expect(findRowByAccount(wrapper, 'newcomer')?.text()).toContain('尚未綁定登入方式')
    expect(findRowByAccount(wrapper, 'newcomer')?.text()).toContain('未指派角色')
    expect(findRowByAccount(wrapper, 'nexus_system')?.text()).toContain('系統預設')
  })

  it('系統預設帳號與自己的帳號不給停用', async () => {
    const wrapper = await mountUserManagementList()

    expect(findRowByAccount(wrapper, 'nexus_system')?.find('.x-switch').classes()).toContain('disabled')
    expect(findRowByAccount(wrapper, 'nexus_admin')?.find('.x-switch').classes()).toContain('disabled')
    expect(findRowByAccount(wrapper, 'editor')?.find('.x-switch').classes()).not.toContain('disabled')
  })

  it('已停用的系統預設帳號仍可以啟用回來', async () => {
    const wrapper = await mountUserManagementList()

    expect(findRowByAccount(wrapper, 'retired')?.find('.x-switch').classes()).not.toContain('disabled')
  })

  it('切換停用會先確認，確認後以 disabled-state 端點送出', async () => {
    updateAdminUserDisabledStateMock.mockResolvedValue({
      result: { data: { id: 'user-editor', updatedAt: '2026-09-11T00:00:00+00:00' }, error: null },
      status: 200,
      statusText: 'OK',
      success: true,
      timestamp: Date.now(),
    })
    const wrapper = await mountUserManagementList()

    await findRowByAccount(wrapper, 'editor')?.find('.x-switch').trigger('click')

    expect(showConfirmMock).toHaveBeenCalled()
    await vi.waitFor(() => expect(updateAdminUserDisabledStateMock).toHaveBeenCalledWith('user-editor', { isDisabled: true }))
  })
})
