import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import customPlugin from '@/plugins/custom'
import quasarPlugin from '@/plugins/quasar'
import MenuSettingsList from '@/pages/MenuSettings/MenuSettingsList.vue'
import type { AdminResourceTreeResponse, ReplaceAdminResourceTreeRequest } from '@/services/admin/adminResourceService'
import type { ResponseStructure } from '@/services/axiosService'

const getAdminResourceTreeMock = vi.fn<() => Promise<ResponseStructure<AdminResourceTreeResponse>>>()
const replaceAdminResourceTreeMock = vi.fn<(data: ReplaceAdminResourceTreeRequest) => Promise<ResponseStructure<AdminResourceTreeResponse>>>()

vi.mock('@/services/admin/adminResourceService', () => ({
  getAdminResourceTree: () => getAdminResourceTreeMock(),
  replaceAdminResourceTree: (data: ReplaceAdminResourceTreeRequest) => replaceAdminResourceTreeMock(data),
}))

/** 測試樹：系統管理底下有綁定資源代碼的「用戶管理」與沒有代碼的「選單設定」 */
function buildTreeResponse(): ResponseStructure<AdminResourceTreeResponse> {
  return {
    result: {
      data: {
        version: '2026-09-01T00:00:00+00:00',
        items: [
          {
            id: 'id-system',
            parentId: null,
            level: 1,
            resourceName: '系統管理',
            resourceCode: null,
            displayOrder: 10000,
            isEnabled: true,
            children: [
              {
                id: 'id-users',
                parentId: 'id-system',
                level: 2,
                resourceName: '系統管理>用戶管理',
                resourceCode: 'admin_users',
                displayOrder: 10100,
                isEnabled: true,
                children: [],
              },
              {
                id: 'id-menu',
                parentId: 'id-system',
                level: 2,
                resourceName: '系統管理>選單設定',
                resourceCode: null,
                displayOrder: 10200,
                isEnabled: false,
                children: [],
              },
            ],
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

/** 掛載頁面並等待資源樹載入完成 */
async function mountMenuSettingsList() {
  const wrapper = mount(MenuSettingsList, {
    global: { plugins: [quasarPlugin, customPlugin] },
  })
  await vi.waitFor(() => expect(wrapper.findAll('tbody tr').length).toBeGreaterThan(0))

  return wrapper
}

/**
 * 依顯示文字找出表格列
 * @param wrapper 已掛載的頁面
 * @param text 該列會出現的文字
 */
function findRowByText(wrapper: VueWrapper, text: string) {
  return wrapper.findAll('tbody tr').find((row) => row.text().includes(text))
}

/**
 * 依按鈕文字找出按鈕
 * @param wrapper 已掛載的頁面
 * @param label 按鈕文字
 */
function findButtonByLabel(wrapper: VueWrapper, label: string) {
  return wrapper.findAll('button').find((button) => button.text().includes(label))
}

describe('MenuSettingsList', () => {
  beforeEach(() => {
    getAdminResourceTreeMock.mockReset()
    replaceAdminResourceTreeMock.mockReset()
    getAdminResourceTreeMock.mockResolvedValue(buildTreeResponse())
  })

  it('載入後把整棵樹渲染成表格列，並顯示資源代碼與完整資源名稱', async () => {
    const wrapper = await mountMenuSettingsList()

    expect(wrapper.findAll('tbody tr')).toHaveLength(3)

    const userRow = findRowByText(wrapper, '用戶管理')

    expect(userRow?.text()).toContain('admin_users')
    expect(userRow?.text()).toContain('系統管理>用戶管理')
    expect(userRow?.text()).toContain('第 2 層')
  })

  it('沒有任何列提供刪除入口，其餘操作照常提供', async () => {
    const wrapper = await mountMenuSettingsList()

    // admin_resources 沒有軟刪除欄位，刪掉救不回來，所以整頁都不該出現垃圾桶
    const iconNames = wrapper.findAll('tbody tr').flatMap((row) => row.findAll('i.q-icon').map((icon) => icon.text()))

    expect(iconNames).not.toContain('delete')
    expect(iconNames).toContain('edit')
    expect(iconNames).toContain('drive_file_move')
    expect(wrapper.findAll('tbody tr button.disabled')).toHaveLength(0)
  })

  it('尚未變更時儲存按鈕停用，也不顯示未儲存提示', async () => {
    const wrapper = await mountMenuSettingsList()

    expect(findButtonByLabel(wrapper, '儲存')?.classes()).toContain('disabled')
    expect(wrapper.text()).not.toContain('有未儲存的變更')
  })

  it('新增第一層會多一列並顯示未儲存變更提示', async () => {
    const wrapper = await mountMenuSettingsList()

    await findButtonByLabel(wrapper, '新增第一層')?.trigger('click')
    await vi.waitFor(() => expect(wrapper.findAll('tbody tr')).toHaveLength(4))

    expect(wrapper.text()).toContain('有未儲存的變更')
    expect(wrapper.text()).toContain('新增 1 筆')
    expect(findButtonByLabel(wrapper, '儲存')?.classes()).not.toContain('disabled')
  })
})
