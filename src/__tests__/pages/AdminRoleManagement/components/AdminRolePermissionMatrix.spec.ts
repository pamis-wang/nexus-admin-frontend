import { describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import quasarPlugin from '@/plugins/quasar'
import AdminRolePermissionMatrix from '@/pages/AdminRoleManagement/components/AdminRolePermissionMatrix.vue'
import type { AdminRolePermissionCells, AdminRolePermissionCheckState, AdminRolePermissionRow } from '@/pages/AdminRoleManagement/types'

/**
 * 組出一列
 * @param resourceId 資源唯一編號
 * @param name 顯示名稱
 * @param parentResourceId 父資源唯一編號
 * @param state 可授權操作共用的勾選狀態
 * @param overrides 要覆寫的欄位（停用、個別格子）
 */
function buildRow(
  resourceId: string,
  name: string,
  parentResourceId: string | null,
  state: AdminRolePermissionCheckState,
  overrides: { isEnabled?: boolean; cells?: Partial<AdminRolePermissionCells> } = {},
): AdminRolePermissionRow {
  const cells: AdminRolePermissionCells = { canAccess: state, canCreate: state, canUpdate: state, canDelete: state, ...overrides.cells }
  return {
    resourceId,
    parentResourceId,
    level: parentResourceId === null ? 1 : 2,
    name,
    fullPath: parentResourceId === null ? name : `系統管理>${name}`,
    isEnabled: overrides.isEnabled ?? true,
    availableActions: ['canAccess', 'canCreate', 'canUpdate', 'canDelete'],
    icon: 'mdi-folder',
    hasChildren: parentResourceId === null,
    cells,
    rowState: state,
    changedActions: [],
  }
}

/** 系統管理（部分）底下有角色管理（全有）與用戶管理（全無、沒有刪除） */
function buildRows(): AdminRolePermissionRow[] {
  return [
    buildRow('system', '系統管理', null, 'some'),
    buildRow('roles', '角色管理', 'system', 'all'),
    buildRow('users', '用戶管理', 'system', 'none', { cells: { canDelete: 'na' } }),
  ]
}

function mountMatrix(rows: AdminRolePermissionRow[], isReadonly = false) {
  return mount(AdminRolePermissionMatrix, {
    props: { rows, isReadonly },
    global: { plugins: [quasarPlugin] },
  })
}

function bodyRowTexts(wrapper: VueWrapper): string[] {
  return wrapper.findAll('tbody tr').map((row) => row.find('td').text())
}

function findButtonByLabel(wrapper: VueWrapper, label: string) {
  return wrapper.findAll('button').find((button) => button.text().includes(label))
}

describe('AdminRolePermissionMatrix', () => {
  it('依序顯示每一列，摘要只算功能列', () => {
    const wrapper = mountMatrix(buildRows())

    expect(bodyRowTexts(wrapper)).toEqual(['系統管理', '角色管理', '用戶管理'])
    expect(wrapper.text()).toContain('已授權 1／2 個功能')
  })

  it('勾選一格時往上 emit 資源、操作與新的值', async () => {
    const wrapper = mountMatrix(buildRows())

    await wrapper.find('[aria-label="用戶管理：新增"]').trigger('click')

    expect(wrapper.emitted('setCell')).toEqual([['users', 'canCreate', true]])
  })

  it('不適用的格子顯示「不適用」，不出現勾選框', () => {
    const wrapper = mountMatrix(buildRows())

    expect(wrapper.find('[aria-label="用戶管理：刪除"]').exists()).toBe(false)
    expect(wrapper.findAll('tbody tr')[2]!.text()).toContain('不適用')
  })

  it('整欄範圍內沒有任何功能有這種操作時，表頭不給整欄勾選', () => {
    const rows = [buildRow('home', '首頁', null, 'all', { cells: { canCreate: 'na', canUpdate: 'na', canDelete: 'na' } })]
    rows[0] = { ...rows[0]!, hasChildren: false }

    const wrapper = mountMatrix(rows)

    expect(wrapper.find('[aria-label="整欄檢視"]').exists()).toBe(true)
    expect(wrapper.find('[aria-label="整欄刪除"]').exists()).toBe(false)
  })

  it('停用的資源標示「選單已停用」', () => {
    const rows = buildRows()
    rows[2] = { ...rows[2]!, isEnabled: false }

    const wrapper = mountMatrix(rows)

    expect(wrapper.findAll('tbody tr')[2]!.text()).toContain('選單已停用')
    expect(wrapper.findAll('tbody tr')[1]!.text()).not.toContain('選單已停用')
  })

  it('整列勾選 emit 資源唯一編號', async () => {
    const wrapper = mountMatrix(buildRows())

    await wrapper.find('[aria-label="系統管理：全部權限"]').trigger('click')

    expect(wrapper.emitted('toggleRow')).toEqual([['system']])
  })

  it('整欄勾選帶上搜尋結果裡的功能；群組本身不算', async () => {
    const wrapper = mountMatrix(buildRows())
    await wrapper.find('input[aria-label="搜尋功能名稱"]').setValue('角色')

    await wrapper.find('[aria-label="整欄檢視"]').trigger('click')

    expect(wrapper.emitted('toggleColumn')).toEqual([['canAccess', ['roles']]])
  })

  it('搜尋時保留祖先列，才看得出在哪一層', async () => {
    const wrapper = mountMatrix(buildRows())

    await wrapper.find('input[aria-label="搜尋功能名稱"]').setValue('用戶')

    expect(bodyRowTexts(wrapper)).toEqual(['系統管理', '用戶管理'])
  })

  it('收合群組會藏起底下的列，全部展開再顯示回來', async () => {
    const wrapper = mountMatrix(buildRows())

    await wrapper.find('[aria-label="收合系統管理"]').trigger('click')
    expect(bodyRowTexts(wrapper)).toEqual(['系統管理'])

    await findButtonByLabel(wrapper, '全部展開')?.trigger('click')
    expect(bodyRowTexts(wrapper)).toEqual(['系統管理', '角色管理', '用戶管理'])
  })

  it('有未儲存的格子時標示出來並顯示變更數', () => {
    const rows = buildRows()
    rows[2] = { ...rows[2]!, changedActions: ['canAccess'] }

    const wrapper = mountMatrix(rows)

    expect(wrapper.findAll('td.permission-matrix__cell--changed')).toHaveLength(1)
    expect(wrapper.text()).toContain('變更 1 項')
  })

  it('唯讀時不出現任何勾選框，以文字與圖示表示', () => {
    const wrapper = mountMatrix(buildRows(), true)

    expect(wrapper.findAll('.q-checkbox')).toHaveLength(0)
    expect(wrapper.find('tbody tr').text()).toContain('部分')
    expect(wrapper.findAll('[aria-label="已授權"]')).toHaveLength(4)
  })
})
