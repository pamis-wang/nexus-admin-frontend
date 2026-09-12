import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import { QSelect } from 'quasar'
import customPlugin from '@/plugins/custom'
import quasarPlugin from '@/plugins/quasar'
import AdminUserManagementList from '@/pages/AdminUserManagement/AdminUserManagementList.vue'
import type { AdminUserResponse } from '@/services/admin/adminUserService'
import type { ResponseStructure } from '@/services/axiosService'

const getAdminUsersMock = vi.fn<() => Promise<ResponseStructure<AdminUserResponse[]>>>()

vi.mock('@/services/admin/adminUserService', () => ({
  getAdminUsers: () => getAdminUsersMock(),
}))

vi.mock('@/composables/useDialog', () => ({
  useDialog: () => ({
    showSuccess: vi.fn<(...args: unknown[]) => void>(),
    showWarning: vi.fn<(...args: unknown[]) => void>(),
    showError: vi.fn<(...args: unknown[]) => void>(),
    showInfo: vi.fn<(...args: unknown[]) => void>(),
  }),
}))

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
 * - nexus_system：系統預設、啟用中
 * - nexus_admin：一般用戶，沒有姓名也沒有角色
 * - editor：一般用戶，有姓名與角色、登入方式鎖定中
 * - newcomer：一般用戶，尚未綁定登入方式
 * - retired：系統預設且已停用，角色與 editor 不同
 */
function buildUsers(): AdminUserResponse[] {
  return [
    buildUser('user-system', 'nexus_system', { isSystemDefault: true }),
    buildUser('user-admin', 'nexus_admin'),
    buildUser('user-editor', 'editor', {
      fullName: '王小明',
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
    buildUser('user-retired', 'retired', {
      isSystemDefault: true,
      isDisabled: true,
      roleMappings: [{ adminId: 'user-retired', adminName: 'retired', roleId: 'role-2', roleName: '檢視者' }],
    }),
  ]
}

/** 掛載列表頁並等待資料載入 */
async function mountAdminUserManagementList() {
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

  const wrapper = mount(AdminUserManagementList, { global: { plugins: [quasarPlugin, customPlugin, router] } })
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

/**
 * 依標籤取出篩選用的下拉
 * @param wrapper 已掛載的頁面
 * @param label 下拉的標籤文字
 */
function findSelectByLabel(wrapper: VueWrapper, label: string) {
  return wrapper.findAllComponents(QSelect).find((select) => select.props('label') === label)
}

/**
 * 取出「清除篩選」按鈕
 * @param wrapper 已掛載的頁面
 */
function findClearFilterButton(wrapper: VueWrapper) {
  return wrapper.findAll('button').find((button) => button.text().includes('清除篩選'))
}

describe('AdminUserManagementList', () => {
  beforeEach(() => {
    getAdminUsersMock.mockReset()
    getAdminUsersMock.mockResolvedValue({
      result: { data: buildUsers(), error: null },
      status: 200,
      statusText: 'OK',
      success: true,
      timestamp: Date.now(),
    })
  })

  it('列出角色、登入狀態與系統預設標記', async () => {
    const wrapper = await mountAdminUserManagementList()

    expect(findRowByAccount(wrapper, 'editor')?.text()).toContain('編輯者')
    expect(findRowByAccount(wrapper, 'editor')?.text()).toContain('鎖定中')
    expect(findRowByAccount(wrapper, 'newcomer')?.text()).toContain('尚未綁定登入方式')
    expect(findRowByAccount(wrapper, 'newcomer')?.text()).toContain('未指派角色')
    expect(findRowByAccount(wrapper, 'nexus_system')?.text()).toContain('系統預設')
  })

  it('帳號狀態只以標籤顯示，不提供切換', async () => {
    const wrapper = await mountAdminUserManagementList()

    expect(findRowByAccount(wrapper, 'editor')?.text()).toContain('啟用中')
    expect(findRowByAccount(wrapper, 'retired')?.text()).toContain('已停用')
    expect(wrapper.find('.x-switch').exists()).toBe(false)
  })

  it('沒有任何條件時不顯示筆數與清除篩選', async () => {
    const wrapper = await mountAdminUserManagementList()

    expect(findClearFilterButton(wrapper)).toBeUndefined()
    expect(wrapper.text()).not.toContain('找到')
  })

  it('依帳號關鍵字篩選，並顯示篩選後與總筆數', async () => {
    const wrapper = await mountAdminUserManagementList()

    await wrapper.find('input[placeholder="搜尋帳號"]').setValue('edit')

    await vi.waitFor(() => expect(findRowByAccount(wrapper, 'newcomer')).toBeUndefined())
    expect(findRowByAccount(wrapper, 'editor')).toBeTruthy()
    expect(wrapper.text()).toContain('找到 1 筆／共 5 筆')
  })

  it('姓名關鍵字不會選中沒填姓名的用戶', async () => {
    const wrapper = await mountAdminUserManagementList()

    await wrapper.find('input[placeholder="搜尋姓名"]').setValue('小明')

    await vi.waitFor(() => expect(findRowByAccount(wrapper, 'nexus_admin')).toBeUndefined())
    expect(findRowByAccount(wrapper, 'editor')).toBeTruthy()
    expect(wrapper.text()).toContain('找到 1 筆／共 5 筆')
  })

  it('依電子信箱關鍵字篩選', async () => {
    const wrapper = await mountAdminUserManagementList()

    await wrapper.find('input[placeholder="搜尋電子信箱"]').setValue('retired@')

    await vi.waitFor(() => expect(findRowByAccount(wrapper, 'editor')).toBeUndefined())
    expect(findRowByAccount(wrapper, 'retired')).toBeTruthy()
  })

  it('角色下拉只列出目前用戶身上有的角色，選取後只留該角色的用戶', async () => {
    const wrapper = await mountAdminUserManagementList()
    const roleSelect = findSelectByLabel(wrapper, '角色')

    // 依 zh-Hant 讀音排序：編（biān）在 檢（jiǎn）之前
    expect(roleSelect?.props('options')).toEqual(['編輯者', '檢視者'])

    await roleSelect?.setValue('編輯者')

    await vi.waitFor(() => expect(findRowByAccount(wrapper, 'retired')).toBeUndefined())
    expect(findRowByAccount(wrapper, 'editor')).toBeTruthy()
  })

  it('依帳號狀態篩選出已停用的帳號', async () => {
    const wrapper = await mountAdminUserManagementList()

    await findSelectByLabel(wrapper, '帳號狀態')?.setValue('disabled')

    await vi.waitFor(() => expect(findRowByAccount(wrapper, 'editor')).toBeUndefined())
    expect(findRowByAccount(wrapper, 'retired')).toBeTruthy()
    expect(wrapper.text()).toContain('找到 1 筆／共 5 筆')
  })

  it('多個條件之間是 AND', async () => {
    const wrapper = await mountAdminUserManagementList()

    await wrapper.find('input[placeholder="搜尋帳號"]').setValue('edit')
    await findSelectByLabel(wrapper, '帳號狀態')?.setValue('disabled')

    await vi.waitFor(() => expect(findRowByAccount(wrapper, 'editor')).toBeUndefined())
    expect(wrapper.text()).toContain('找到 0 筆／共 5 筆')
  })

  it('清除篩選後列表回到全部用戶', async () => {
    const wrapper = await mountAdminUserManagementList()

    await wrapper.find('input[placeholder="搜尋帳號"]').setValue('edit')
    await vi.waitFor(() => expect(findRowByAccount(wrapper, 'newcomer')).toBeUndefined())

    await findClearFilterButton(wrapper)?.trigger('click')

    await vi.waitFor(() => expect(findRowByAccount(wrapper, 'newcomer')).toBeTruthy())
    expect(findClearFilterButton(wrapper)).toBeUndefined()
  })
})
