import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useRolePermissionMatrix } from '@/pages/RoleManagement/composables/useRolePermissionMatrix'
import type { AdminResourceResponse } from '@/services/admin/adminResourceService'
import type { AdminRolePermissionResponse } from '@/services/admin/adminRoleService'
import type { ResponseStructure } from '@/services/axiosService'

const getAdminResourcesMock = vi.fn<() => Promise<ResponseStructure<AdminResourceResponse[]>>>()
const getAdminRolePermissionsByRoleIdMock = vi.fn<(roleId: string) => Promise<ResponseStructure<AdminRolePermissionResponse[]>>>()

vi.mock('@/services/admin/adminResourceService', () => ({
  getAdminResources: () => getAdminResourcesMock(),
}))

vi.mock('@/services/admin/adminRoleService', () => ({
  getAdminRolePermissionsByRoleId: (roleId: string) => getAdminRolePermissionsByRoleIdMock(roleId),
}))

vi.mock('@/router', () => ({
  default: {
    getRoutes: () => [{ meta: { resourceName: '系統管理', icon: 'mdi-cog' } }],
  },
}))

/** 組一筆資源，只有測試在意的欄位需要指定 */
function buildResource(
  id: string,
  resourceName: string,
  options: { parentId?: string | null; level?: number; isEnabled?: boolean; displayOrder?: number } = {},
): AdminResourceResponse {
  return {
    id,
    parentId: options.parentId ?? null,
    level: options.level ?? 1,
    resourceName,
    resourceCode: null,
    displayOrder: options.displayOrder ?? 0,
    isEnabled: options.isEnabled ?? true,
  }
}

/** 把資料包成 axiosService 的統一回應格式 */
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
 * 固定的測試資源：
 * 系統管理
 *   ├─ 角色管理（啟用）
 *   └─ 選單設定（停用）
 */
function buildSampleResources(): AdminResourceResponse[] {
  return [
    buildResource('id-system', '系統管理', { level: 1, displayOrder: 10000 }),
    buildResource('id-roles', '系統管理>角色管理', { parentId: 'id-system', level: 2, displayOrder: 10100 }),
    buildResource('id-menu', '系統管理>選單設定', { parentId: 'id-system', level: 2, displayOrder: 10200, isEnabled: false }),
  ]
}

/** 載入固定測試資源後回傳組合函式 */
async function mountMatrixWithSampleData() {
  getAdminResourcesMock.mockResolvedValue(buildResponse(buildSampleResources()))
  const matrix = useRolePermissionMatrix()
  await matrix.loadResources()

  return matrix
}

describe('useRolePermissionMatrix - 載入資源', () => {
  beforeEach(() => {
    getAdminResourcesMock.mockReset()
    getAdminRolePermissionsByRoleIdMock.mockReset()
  })

  it('把扁平資源組成樹，名稱只取完整路徑的最後一段', async () => {
    const matrix = await mountMatrixWithSampleData()

    expect(matrix.treeNodes.value).toHaveLength(1)

    const root = matrix.treeNodes.value[0]

    expect(root?.name).toBe('系統管理')
    expect(root?.fullPath).toBe('系統管理')
    expect(root?.icon).toBe('mdi-cog')
    expect(root?.children.map((child) => child.name)).toEqual(['角色管理', '選單設定'])
  })

  it('停用的資源照樣列出來，並標示啟用狀態', async () => {
    const matrix = await mountMatrixWithSampleData()
    const menuNode = matrix.treeNodes.value[0]?.children[1]

    expect(menuNode?.name).toBe('選單設定')
    expect(menuNode?.isEnabled).toBe(false)
  })

  it('載入後全部權限都是未勾選', async () => {
    const matrix = await mountMatrixWithSampleData()

    expect(matrix.hasPermission('id-system', 'canAccess')).toBe(false)
    expect(matrix.hasPermission('id-roles', 'canAccess')).toBe(false)
    expect(matrix.hasPermission('id-menu', 'canAccess')).toBe(false)
  })
})

describe('useRolePermissionMatrix - 權限連動', () => {
  beforeEach(() => {
    getAdminResourcesMock.mockReset()
    getAdminRolePermissionsByRoleIdMock.mockReset()
  })

  it('勾選父節點時，子孫一併勾選', async () => {
    const matrix = await mountMatrixWithSampleData()

    matrix.updatePermission('id-system', 'canAccess', true)

    expect(matrix.hasPermission('id-roles', 'canAccess')).toBe(true)
    expect(matrix.hasPermission('id-menu', 'canAccess')).toBe(true)
  })

  it('取消父節點時，子孫一併取消', async () => {
    const matrix = await mountMatrixWithSampleData()
    matrix.updatePermission('id-system', 'canAccess', true)

    matrix.updatePermission('id-system', 'canAccess', false)

    expect(matrix.hasPermission('id-roles', 'canAccess')).toBe(false)
    expect(matrix.hasPermission('id-menu', 'canAccess')).toBe(false)
  })

  it('取消訪問權限時，同一節點的新增、修改、刪除一併清掉', async () => {
    const matrix = await mountMatrixWithSampleData()
    matrix.updatePermission('id-roles', 'canAccess', true)
    matrix.updatePermission('id-roles', 'canCreate', true)
    matrix.updatePermission('id-roles', 'canDelete', true)

    matrix.updatePermission('id-roles', 'canAccess', false)

    expect(matrix.hasPermission('id-roles', 'canCreate')).toBe(false)
    expect(matrix.hasPermission('id-roles', 'canDelete')).toBe(false)
  })

  it('同層全部勾選時，父節點自動跟著勾選', async () => {
    const matrix = await mountMatrixWithSampleData()

    matrix.updatePermission('id-roles', 'canAccess', true)

    expect(matrix.hasPermission('id-system', 'canAccess')).toBe(false)

    matrix.updatePermission('id-menu', 'canAccess', true)

    expect(matrix.hasPermission('id-system', 'canAccess')).toBe(true)
  })

  it('同層最後一個被取消時，父節點也跟著取消', async () => {
    const matrix = await mountMatrixWithSampleData()
    matrix.updatePermission('id-system', 'canAccess', true)

    matrix.updatePermission('id-roles', 'canAccess', false)

    expect(matrix.hasPermission('id-system', 'canAccess')).toBe(true)

    matrix.updatePermission('id-menu', 'canAccess', false)

    expect(matrix.hasPermission('id-system', 'canAccess')).toBe(false)
  })
})

describe('useRolePermissionMatrix - 角色權限與送出', () => {
  beforeEach(() => {
    getAdminResourcesMock.mockReset()
    getAdminRolePermissionsByRoleIdMock.mockReset()
  })

  it('載入角色權限後套用到對應資源上', async () => {
    const matrix = await mountMatrixWithSampleData()
    getAdminRolePermissionsByRoleIdMock.mockResolvedValue(
      buildResponse([
        {
          id: 'perm-1',
          roleId: 'role-1',
          roleName: '管理員',
          resourceId: 'id-roles',
          resourceName: '系統管理>角色管理',
          canAccess: true,
          canCreate: true,
          canUpdate: false,
          canDelete: false,
        },
      ]),
    )

    await matrix.loadRolePermissions('role-1')

    expect(matrix.hasPermission('id-roles', 'canAccess')).toBe(true)
    expect(matrix.hasPermission('id-roles', 'canCreate')).toBe(true)
    expect(matrix.hasPermission('id-roles', 'canUpdate')).toBe(false)
    expect(matrix.hasPermission('id-menu', 'canAccess')).toBe(false)
  })

  it('重設會還原成載入當下的權限', async () => {
    const matrix = await mountMatrixWithSampleData()
    getAdminRolePermissionsByRoleIdMock.mockResolvedValue(
      buildResponse([
        {
          id: 'perm-1',
          roleId: 'role-1',
          roleName: '管理員',
          resourceId: 'id-roles',
          resourceName: '系統管理>角色管理',
          canAccess: true,
          canCreate: false,
          canUpdate: false,
          canDelete: false,
        },
      ]),
    )
    await matrix.loadRolePermissions('role-1')
    matrix.updatePermission('id-roles', 'canAccess', false)
    matrix.updatePermission('id-menu', 'canAccess', true)

    matrix.resetPermissions()

    expect(matrix.hasPermission('id-roles', 'canAccess')).toBe(true)
    expect(matrix.hasPermission('id-menu', 'canAccess')).toBe(false)
  })

  it('送出的權限矩陣涵蓋全部資源，含未勾選與已停用的', async () => {
    const matrix = await mountMatrixWithSampleData()
    matrix.updatePermission('id-roles', 'canAccess', true)

    const items = matrix.buildPermissionItems()

    expect(items).toHaveLength(3)
    expect(items.map((item) => item.resourceId)).toEqual(['id-system', 'id-roles', 'id-menu'])
    expect(items.find((item) => item.resourceId === 'id-roles')?.canAccess).toBe(true)
    // 停用的資源也要送，否則全量替換會把它既有的權限一起洗掉
    expect(items.find((item) => item.resourceId === 'id-menu')).toEqual({
      resourceId: 'id-menu',
      canAccess: false,
      canCreate: false,
      canUpdate: false,
      canDelete: false,
    })
  })
})
