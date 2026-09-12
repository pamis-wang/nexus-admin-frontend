import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { QSelect } from 'quasar'
import quasarPlugin from '@/plugins/quasar'
import AdminUserRoleSelector from '@/pages/AdminUserManagement/components/AdminUserRoleSelector.vue'
import type { AdminRoleResponse } from '@/services/admin/adminRoleService'
import type { ResponseStructure } from '@/services/axiosService'

const getAdminRolesMock = vi.fn<() => Promise<ResponseStructure<AdminRoleResponse[]>>>()

vi.mock('@/services/admin/adminRoleService', () => ({
  getAdminRoles: () => getAdminRolesMock(),
}))

/**
 * 組一筆角色
 * @param id 角色唯一編號
 * @param name 角色名稱
 * @param isSystemDefault 是否為系統預設角色
 */
function buildRole(id: string, name: string, isSystemDefault: boolean): AdminRoleResponse {
  return { id, name, isSystemDefault, version: null, userCount: 0 }
}

/**
 * 讓 getAdminRoles 回傳指定角色
 * @param roles 角色清單
 */
function mockRoles(roles: AdminRoleResponse[]) {
  getAdminRolesMock.mockResolvedValue({
    result: { data: roles, error: null },
    status: 200,
    statusText: 'OK',
    success: true,
    timestamp: Date.now(),
  })
}

/** 掛載元件並等待角色清單載入完成 */
async function mountAdminUserRoleSelector() {
  const wrapper = mount(AdminUserRoleSelector, {
    props: { modelValue: [] },
    global: { plugins: [quasarPlugin] },
  })
  await vi.waitFor(() => expect(getAdminRolesMock).toHaveBeenCalled())
  await wrapper.vm.$nextTick()

  return wrapper
}

describe('AdminUserRoleSelector', () => {
  beforeEach(() => {
    getAdminRolesMock.mockReset()
    mockRoles([buildRole('role-1', '系統管理員', true), buildRole('role-2', '編輯者', false)])
  })

  afterEach(() => {
    // 選單開在 body 上的 portal，不清掉會影響下一個測試的查詢
    document.body.innerHTML = ''
  })

  it('選項上標出系統預設角色', async () => {
    const wrapper = await mountAdminUserRoleSelector()

    wrapper.findComponent(QSelect).vm.showPopup()

    await vi.waitFor(() => expect(document.querySelector('.q-menu')?.textContent).toContain('編輯者'))
    const menuText = document.querySelector('.q-menu')?.textContent ?? ''
    expect(menuText).toContain('系統管理員')
    expect(menuText).toContain('系統預設')
    // 標記只掛在系統預設那一筆，不是整份清單都有
    expect(menuText.match(/系統預設/g)).toHaveLength(1)
  })

  it('有角色可指派時提示指派規則', async () => {
    const wrapper = await mountAdminUserRoleSelector()

    expect(wrapper.text()).toContain('可指派多個角色')
  })

  it('一個角色都沒有時，欄位提示改為請先建立角色', async () => {
    mockRoles([])
    const wrapper = await mountAdminUserRoleSelector()

    expect(wrapper.text()).toContain('目前沒有可指派的角色，請先到角色管理建立')
  })

  it('一個角色都沒有時，展開選單也看得到同一句說明', async () => {
    mockRoles([])
    const wrapper = await mountAdminUserRoleSelector()

    wrapper.findComponent(QSelect).vm.showPopup()

    await vi.waitFor(() => expect(document.querySelector('.q-menu')?.textContent).toContain('目前沒有可指派的角色'))
  })

  it('載入失敗時發出 loadFailed，不自行跳對話框', async () => {
    getAdminRolesMock.mockRejectedValue(new Error('network down'))
    const wrapper = await mountAdminUserRoleSelector()

    await vi.waitFor(() => expect(wrapper.emitted('loadFailed')).toBeTruthy())
    expect(wrapper.emitted('loadFailed')?.[0]).toEqual(['載入角色清單失敗，請稍後再試'])
  })
})
