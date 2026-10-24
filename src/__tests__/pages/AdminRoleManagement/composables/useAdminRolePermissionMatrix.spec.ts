import { describe, expect, it, vi } from 'vitest'
import {
  AUTO_GRANT_ACCESS_HINT,
  AUTO_REVOKE_DEPENDENT_HINT,
  combineStates,
  useAdminRolePermissionMatrix,
} from '@/pages/AdminRoleManagement/composables/useAdminRolePermissionMatrix'
import type { AdminRolePermissionActionResponse, AdminRolePermissionNodeResponse } from '@/services/admin/adminRoleService'

// 權限矩陣只拿路由表對應選單圖示，給一筆就夠驗證對照與預設圖示
vi.mock('@/router', () => ({
  default: { getRoutes: () => [{ meta: { resourceName: '系統管理>角色管理', icon: 'mdi-account-group' } }] },
}))

interface NodeOptions {
  canAccess?: boolean
  canCreate?: boolean
  canUpdate?: boolean
  canDelete?: boolean
  isEnabled?: boolean
  availableActions?: AdminRolePermissionActionResponse[]
}

/**
 * 組出權限樹節點
 * @param resourceId 資源唯一編號
 * @param resourceName 完整資源名稱
 * @param options 旗標、啟用狀態與可授權的操作，沒給的旗標為 false、預設四種操作都可授權
 * @param children 子節點
 */
function buildNode(
  resourceId: string,
  resourceName: string,
  options: NodeOptions = {},
  children: AdminRolePermissionNodeResponse[] = []
): AdminRolePermissionNodeResponse {
  return {
    resourceId,
    parentId: null,
    resourceName,
    resourceCode: null,
    level: resourceName.split('>').length,
    displayOrder: 0,
    isEnabled: options.isEnabled ?? true,
    canAccess: options.canAccess ?? false,
    canCreate: options.canCreate ?? false,
    canUpdate: options.canUpdate ?? false,
    canDelete: options.canDelete ?? false,
    availableActions: options.availableActions ?? ['access', 'create', 'update', 'delete'],
    children: children.map((child) => ({ ...child, parentId: resourceId })),
  }
}

/**
 * 測試樹（可授權的操作比照後端依端點宣告推導的結果）：
 * 首頁（只有檢視；可檢視）
 * 系統管理（群組，後端給的旗標全開，載入時不採用）
 *   ├ 用戶管理（沒有刪除；可檢視、可修改）
 *   ├ 角色管理（四種都有；全部沒有）
 *   └ 資源管理（只有檢視與修改；選單已停用；全部沒有）
 */
function buildTree(): AdminRolePermissionNodeResponse[] {
  return [
    buildNode('home', '首頁', { canAccess: true, availableActions: ['access'] }),
    buildNode('system', '系統管理', { canAccess: true, canCreate: true, canUpdate: true, canDelete: true, availableActions: ['access'] }, [
      buildNode('users', '系統管理>用戶管理', { canAccess: true, canUpdate: true, availableActions: ['access', 'create', 'update'] }),
      buildNode('roles', '系統管理>角色管理'),
      buildNode('resources', '系統管理>資源管理', { isEnabled: false, availableActions: ['access', 'update'] }),
    ]),
  ]
}

function loadMatrix() {
  const matrix = useAdminRolePermissionMatrix()
  matrix.load(buildTree())
  return matrix
}

function rowOf(matrix: ReturnType<typeof useAdminRolePermissionMatrix>, resourceId: string) {
  const row = matrix.rows.value.find((candidate) => candidate.resourceId === resourceId)
  if (row === undefined) throw new Error(`找不到資源 ${resourceId}`)
  return row
}

describe('useAdminRolePermissionMatrix - 載入', () => {
  it('攤平成父在前、子在後的列，名稱只取最後一段', () => {
    const matrix = loadMatrix()

    expect(matrix.rows.value.map((row) => row.name)).toEqual(['首頁', '系統管理', '用戶管理', '角色管理', '資源管理'])
    expect(rowOf(matrix, 'users').fullPath).toBe('系統管理>用戶管理')
    expect(rowOf(matrix, 'system').hasChildren).toBe(true)
    expect(rowOf(matrix, 'users').hasChildren).toBe(false)
  })

  it('停用的資源照樣列出並帶著停用狀態', () => {
    const matrix = loadMatrix()

    expect(rowOf(matrix, 'resources').isEnabled).toBe(false)
    expect(rowOf(matrix, 'roles').isEnabled).toBe(true)
  })

  it('可授權的操作轉成矩陣的旗標欄位，依欄位順序排列', () => {
    const matrix = loadMatrix()

    expect(rowOf(matrix, 'users').availableActions).toEqual(['canAccess', 'canCreate', 'canUpdate'])
    expect(rowOf(matrix, 'home').availableActions).toEqual(['canAccess'])
  })

  it('沒有的操作是不適用；群組列只看底下有這種操作的功能', () => {
    const matrix = loadMatrix()

    expect(rowOf(matrix, 'home').cells).toEqual({ canAccess: 'all', canCreate: 'na', canUpdate: 'na', canDelete: 'na' })
    expect(rowOf(matrix, 'users').cells.canDelete).toBe('na')
    // 刪除只有角色管理有，而它沒勾，所以群組是 none 而不是 na
    expect(rowOf(matrix, 'system').cells).toEqual({ canAccess: 'some', canCreate: 'none', canUpdate: 'some', canDelete: 'none' })
  })

  it('整列狀態不計不適用的格子', () => {
    const matrix = loadMatrix()

    expect(rowOf(matrix, 'home').rowState).toBe('all')
    expect(rowOf(matrix, 'system').rowState).toBe('some')
  })

  it('群組資源本身的旗標不採用，一律看底下的功能', () => {
    const matrix = loadMatrix()

    expect(rowOf(matrix, 'system').cells.canDelete).toBe('none')
  })

  it('圖示依完整資源名稱取自路由 meta；路由沒有的依層級給預設圖示', () => {
    const matrix = loadMatrix()

    expect(rowOf(matrix, 'roles').icon).toBe('mdi-account-group')
    expect(rowOf(matrix, 'system').icon).toBe('mdi-folder')
    expect(rowOf(matrix, 'users').icon).toBe('mdi-folder-outline')
  })

  it('剛載入時沒有任何變更，已授權數只算功能列', () => {
    const matrix = loadMatrix()

    expect(matrix.changedCount.value).toBe(0)
    expect(matrix.grantedCount.value).toBe(2)
    expect(matrix.leafResources.value).toHaveLength(4)
  })

  it('loadBlank 只取資源當骨架，權限全部不勾且不算變更', () => {
    const matrix = useAdminRolePermissionMatrix()

    matrix.loadBlank(buildTree())

    expect(matrix.grantedCount.value).toBe(0)
    expect(matrix.changedCount.value).toBe(0)
    expect(matrix.rows.value).toHaveLength(5)
  })
})

describe('useAdminRolePermissionMatrix - 勾選連動', () => {
  it('勾新增時自動勾上檢視，並回傳說明', () => {
    const matrix = loadMatrix()

    const hint = matrix.setCell('roles', 'canCreate', true)

    expect(hint).toBe(AUTO_GRANT_ACCESS_HINT)
    expect(rowOf(matrix, 'roles').cells).toEqual({ canAccess: 'all', canCreate: 'all', canUpdate: 'none', canDelete: 'none' })
  })

  it('取消檢視時一併取消其他操作，並回傳說明', () => {
    const matrix = loadMatrix()

    const hint = matrix.setCell('users', 'canAccess', false)

    expect(hint).toBe(AUTO_REVOKE_DEPENDENT_HINT)
    expect(rowOf(matrix, 'users').rowState).toBe('none')
  })

  it('不適用的格子勾了也不會改變任何東西', () => {
    const matrix = loadMatrix()

    expect(matrix.setCell('home', 'canCreate', true)).toBeNull()
    expect(rowOf(matrix, 'home').cells.canCreate).toBe('na')
    expect(matrix.changedCount.value).toBe(0)
  })

  it('勾群組列的格子只套用到底下有這種操作的功能', () => {
    const matrix = loadMatrix()

    matrix.setCell('system', 'canDelete', true)

    expect(rowOf(matrix, 'roles').cells.canDelete).toBe('all')
    expect(rowOf(matrix, 'users').cells.canDelete).toBe('na')
    expect(rowOf(matrix, 'system').cells.canDelete).toBe('all')
  })
})

describe('useAdminRolePermissionMatrix - 整列與整欄', () => {
  it('整列：還沒全勾就把可授權的操作全部勾上，不會觸發自動勾檢視的說明', () => {
    const matrix = loadMatrix()

    const hint = matrix.toggleRow('system')

    expect(hint).toBeNull()
    expect(rowOf(matrix, 'system').rowState).toBe('all')
    expect(rowOf(matrix, 'resources').cells).toEqual({ canAccess: 'all', canCreate: 'na', canUpdate: 'all', canDelete: 'na' })
  })

  it('整列：已經全勾就全部取消，不會觸發連帶取消的說明', () => {
    const matrix = loadMatrix()
    matrix.toggleRow('roles')

    const hint = matrix.toggleRow('roles')

    expect(hint).toBeNull()
    expect(rowOf(matrix, 'roles').rowState).toBe('none')
  })

  it('整欄只套用到指定且有這種操作的功能', () => {
    const matrix = loadMatrix()

    matrix.toggleColumn('canDelete', ['home', 'users', 'roles', 'resources'])

    expect(rowOf(matrix, 'roles').cells.canDelete).toBe('all')
    expect(
      matrix
        .buildPermissionItems()
        .filter((item) => item.canDelete)
        .map((item) => item.resourceId)
    ).toEqual(['system', 'roles'])
  })

  it('整欄：指定的功能都已勾選時改為全部取消', () => {
    const matrix = loadMatrix()
    matrix.toggleColumn('canUpdate', ['users', 'roles', 'resources'])

    const hint = matrix.toggleColumn('canUpdate', ['users', 'roles', 'resources'])

    expect(hint).toBeNull()
    expect(rowOf(matrix, 'system').cells.canUpdate).toBe('none')
    // 勾修改時自動勾上的檢視不會跟著取消
    expect(rowOf(matrix, 'system').cells.canAccess).toBe('all')
  })
})

describe('useAdminRolePermissionMatrix - 變更、重設與範本', () => {
  it('變更數以功能的每一種操作計，群組列標出底下有變動的操作', () => {
    const matrix = loadMatrix()

    matrix.setCell('roles', 'canCreate', true)

    expect(matrix.changedCount.value).toBe(2)
    expect(rowOf(matrix, 'roles').changedActions).toEqual(['canAccess', 'canCreate'])
    expect(rowOf(matrix, 'system').changedActions).toEqual(['canAccess', 'canCreate'])
    expect(rowOf(matrix, 'home').changedActions).toEqual([])
  })

  it('改回原狀就不算變更', () => {
    const matrix = loadMatrix()
    matrix.setCell('users', 'canCreate', true)

    matrix.setCell('users', 'canCreate', false)

    expect(matrix.changedCount.value).toBe(0)
  })

  it('重設還原成載入時的權限', () => {
    const matrix = loadMatrix()
    matrix.toggleRow('system')

    matrix.reset()

    expect(matrix.changedCount.value).toBe(0)
    expect(rowOf(matrix, 'users').cells.canUpdate).toBe('all')
  })

  it('套用範本只換權限，基準不變，所以會標成未儲存', () => {
    const matrix = useAdminRolePermissionMatrix()
    matrix.loadBlank(buildTree())

    matrix.applyTemplate(buildTree())

    expect(rowOf(matrix, 'users').cells).toEqual({ canAccess: 'all', canCreate: 'none', canUpdate: 'all', canDelete: 'na' })
    expect(matrix.changedCount.value).toBe(3)
  })

  it('清空把全部功能取消勾選', () => {
    const matrix = loadMatrix()

    matrix.clear()

    expect(matrix.grantedCount.value).toBe(0)
  })
})

describe('useAdminRolePermissionMatrix - 送出內容', () => {
  it('全部資源各一筆，含沒勾的、停用的功能與群組', () => {
    const matrix = loadMatrix()

    const items = matrix.buildPermissionItems()

    expect(items.map((item) => item.resourceId)).toEqual(['home', 'system', 'users', 'roles', 'resources'])
    expect(items.find((item) => item.resourceId === 'resources')).toEqual({
      resourceId: 'resources',
      canAccess: false,
      canCreate: false,
      canUpdate: false,
      canDelete: false,
    })
  })

  it('群組資源的旗標取底下功能的聯集', () => {
    const matrix = loadMatrix()

    const items = matrix.buildPermissionItems()

    expect(items.find((item) => item.resourceId === 'system')).toEqual({
      resourceId: 'system',
      canAccess: true,
      canCreate: false,
      canUpdate: true,
      canDelete: false,
    })
  })
})

describe('combineStates', () => {
  it('不適用的狀態不參與合併；全部不適用才是不適用', () => {
    expect(combineStates(['all', 'na', 'all'])).toBe('all')
    expect(combineStates(['none', 'na'])).toBe('none')
    expect(combineStates(['all', 'none', 'na'])).toBe('some')
    expect(combineStates(['na', 'na'])).toBe('na')
  })
})
