import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAdminResourceTree } from '@/pages/AdminResourceManagement/composables/useAdminResourceTree'
import type { AdminResourceTreeNodeResponse, AdminResourceTreeResponse, ReplaceAdminResourceTreeRequest } from '@/services/admin/adminResourceService'
import type { ResponseStructure } from '@/services/axiosService'

const getAdminResourceTreeMock = vi.fn<() => Promise<ResponseStructure<AdminResourceTreeResponse>>>()
const replaceAdminResourceTreeMock = vi.fn<(data: ReplaceAdminResourceTreeRequest) => Promise<ResponseStructure<AdminResourceTreeResponse>>>()

vi.mock('@/services/admin/adminResourceService', () => ({
  getAdminResourceTree: () => getAdminResourceTreeMock(),
  replaceAdminResourceTree: (data: ReplaceAdminResourceTreeRequest) => replaceAdminResourceTreeMock(data),
}))

const showWarningMock = vi.fn<(...args: unknown[]) => void>()
const showErrorMock = vi.fn<(...args: unknown[]) => void>()
const notifyWarningMock = vi.fn<(...args: unknown[]) => void>()
const notifyErrorMock = vi.fn<(...args: unknown[]) => void>()

vi.mock('@/composables/useDialog', () => ({
  useDialog: () => ({
    showSuccess: vi.fn<(...args: unknown[]) => void>(),
    showConfirm: vi.fn<(...args: unknown[]) => void>(),
    showWarning: (...args: unknown[]) => showWarningMock(...args),
    showError: (...args: unknown[]) => showErrorMock(...args),
    showInfo: vi.fn<(...args: unknown[]) => void>(),
  }),
}))

vi.mock('@/composables/useNotify', () => ({
  useNotify: () => ({
    notifySuccess: vi.fn<(...args: unknown[]) => void>(),
    notifyWarning: (...args: unknown[]) => notifyWarningMock(...args),
    notifyError: (...args: unknown[]) => notifyErrorMock(...args),
    notifyInfo: vi.fn<(...args: unknown[]) => void>(),
  }),
}))

/** 組一個資源樹節點，只有測試在意的欄位需要指定 */
function buildNode(
  id: string,
  resourceName: string,
  options: { resourceCode?: string | null; children?: AdminResourceTreeNodeResponse[]; isEnabled?: boolean } = {},
): AdminResourceTreeNodeResponse {
  return {
    id,
    parentId: null,
    level: 1,
    resourceName,
    resourceCode: options.resourceCode ?? null,
    displayOrder: 0,
    isEnabled: options.isEnabled ?? true,
    children: options.children ?? [],
  }
}

/** 把資源樹包成 axiosService 的統一回應格式 */
function buildTreeResponse(version: string | null, items: AdminResourceTreeNodeResponse[]): ResponseStructure<AdminResourceTreeResponse> {
  return {
    result: { data: { version, items }, error: null },
    status: 200,
    statusText: 'OK',
    success: true,
    timestamp: Date.now(),
  }
}

/**
 * 固定的測試樹：
 * 系統管理（無代碼）
 *   ├─ 用戶管理（有代碼 admin_users）
 *   └─ 選單設定（無代碼）
 * 內容管理（無代碼）
 */
function buildSampleTree(): AdminResourceTreeNodeResponse[] {
  return [
    buildNode('id-system', '系統管理', {
      children: [buildNode('id-users', '系統管理>用戶管理', { resourceCode: 'admin_users' }), buildNode('id-menu', '系統管理>選單設定')],
    }),
    buildNode('id-content', '內容管理'),
  ]
}

/** 載入固定測試樹後回傳組合函式 */
async function mountTreeWithSampleData() {
  getAdminResourceTreeMock.mockResolvedValue(buildTreeResponse('2026-09-01T00:00:00+00:00', buildSampleTree()))
  const tree = useAdminResourceTree()
  await tree.loadTree()

  return tree
}

describe('useAdminResourceTree - 載入', () => {
  beforeEach(() => {
    getAdminResourceTreeMock.mockReset()
    replaceAdminResourceTreeMock.mockReset()
    showWarningMock.mockReset()
    showErrorMock.mockReset()
    notifyWarningMock.mockReset()
    notifyErrorMock.mockReset()
  })

  it('把嵌套樹攤平成扁平陣列，並保留版本戳記與資源代碼', async () => {
    const tree = await mountTreeWithSampleData()

    expect(tree.version.value).toBe('2026-09-01T00:00:00+00:00')
    expect(tree.rows.value).toHaveLength(4)

    const userRow = tree.findRow('id-users')

    expect(userRow?.name).toBe('用戶管理')
    expect(userRow?.resourceCode).toBe('admin_users')
    expect(userRow?.level).toBe(2)
    expect(userRow?.parentRowKey).toBe('id-system')
    expect(tree.hasChanges.value).toBe(false)
  })

  it('資源名稱取完整路徑的最後一段當顯示名稱，完整路徑由前端重組回來', async () => {
    const tree = await mountTreeWithSampleData()
    const menuRow = tree.findRow('id-menu')

    expect(menuRow?.name).toBe('選單設定')
    expect(menuRow === null ? '' : tree.fullPathOf(menuRow)).toBe('系統管理>選單設定')
  })

  it('載入失敗時顯示錯誤訊息，不拋出例外', async () => {
    const failure: ResponseStructure<null> = {
      result: { data: null, error: { code: 500, message: '資料庫連線失敗' } },
      status: 500,
      statusText: 'Internal Server Error',
      success: false,
      errorMessage: '資料庫連線失敗',
      timestamp: Date.now(),
    }
    getAdminResourceTreeMock.mockRejectedValue(failure)
    const tree = useAdminResourceTree()

    await tree.loadTree()

    expect(notifyErrorMock).toHaveBeenCalledWith('資料庫連線失敗', 0)
    expect(tree.isLoading.value).toBe(false)
  })
})

describe('useAdminResourceTree - 丟棄未送出的新增列', () => {
  beforeEach(() => {
    getAdminResourceTreeMock.mockReset()
    replaceAdminResourceTreeMock.mockReset()
    showWarningMock.mockReset()
    showErrorMock.mockReset()
    notifyWarningMock.mockReset()
    notifyErrorMock.mockReset()
  })

  it('移除節點時連同子孫一起移除，並重編同層順序', async () => {
    getAdminResourceTreeMock.mockResolvedValue(
      buildTreeResponse('v1', [
        buildNode('id-a', 'A', { children: [buildNode('id-a1', 'A>A1', { children: [buildNode('id-a1x', 'A>A1>A1X')] })] }),
        buildNode('id-b', 'B'),
        buildNode('id-c', 'C'),
      ]),
    )
    const tree = useAdminResourceTree()
    await tree.loadTree()

    tree.removeRow('id-a')

    expect(tree.rows.value.map((row) => row.rowKey)).toEqual(['id-b', 'id-c'])
    expect(tree.childrenOf(null).map((row) => row.position)).toEqual([1, 2])
  })

  it('丟棄還沒命名的新增列不算變更，也不會被擋下', async () => {
    const tree = await mountTreeWithSampleData()
    const created = tree.addRow(null)
    if (created !== null) {
      tree.removeRow(created.rowKey)
    }

    expect(tree.validateTree()).toEqual({ isValid: true, message: null })
    expect(tree.hasChanges.value).toBe(false)
  })
})

describe('useAdminResourceTree - 編輯與搬移', () => {
  beforeEach(() => {
    getAdminResourceTreeMock.mockReset()
    replaceAdminResourceTreeMock.mockReset()
    showWarningMock.mockReset()
    showErrorMock.mockReset()
    notifyWarningMock.mockReset()
    notifyErrorMock.mockReset()
  })

  it('新增的節點沒有 id，並排在同層最後', async () => {
    const tree = await mountTreeWithSampleData()

    const created = tree.addRow('id-system')

    expect(created?.id).toBeNull()
    expect(created?.level).toBe(2)
    expect(created?.position).toBe(3)
    expect(tree.changeSummary.value.addedCount).toBe(1)
  })

  it('超過三層時不新增，並顯示層級上限警告', async () => {
    const tree = await mountTreeWithSampleData()
    const thirdLevel = tree.addRow('id-menu')

    const fourthLevel = thirdLevel === null ? null : tree.addRow(thirdLevel.rowKey)

    expect(fourthLevel).toBeNull()
    expect(notifyWarningMock).toHaveBeenCalledWith('資源層級最多 3 層')
  })

  it('同層上移會交換 position，已在第一個位置時回 false', async () => {
    const tree = await mountTreeWithSampleData()

    expect(tree.nudgeRow('id-menu', -1)).toBe(true)
    expect(tree.childrenOf('id-system').map((row) => row.rowKey)).toEqual(['id-menu', 'id-users'])
    expect(tree.nudgeRow('id-menu', -1)).toBe(false)
  })

  it('跨層搬移會重算層級，並把節點放到目標層最後', async () => {
    const tree = await mountTreeWithSampleData()

    expect(tree.moveRowTo('id-menu', null)).toBe(true)

    const menuRow = tree.findRow('id-menu')

    expect(menuRow?.level).toBe(1)
    expect(menuRow?.parentRowKey).toBeNull()
    expect(menuRow === null ? '' : tree.fullPathOf(menuRow)).toBe('選單設定')
    expect(tree.changeSummary.value.movedCount).toBeGreaterThan(0)
  })

  it('搬移後會超過三層時拒絕，並顯示警告', async () => {
    getAdminResourceTreeMock.mockResolvedValue(
      buildTreeResponse('v1', [
        buildNode('id-a', 'A', { children: [buildNode('id-a1', 'A>A1', { children: [buildNode('id-a1x', 'A>A1>A1X')] })] }),
        buildNode('id-b', 'B', { children: [buildNode('id-b1', 'B>B1')] }),
      ]),
    )
    const tree = useAdminResourceTree()
    await tree.loadTree()

    expect(tree.moveRowTo('id-a1', 'id-b1')).toBe(false)
    expect(notifyWarningMock).toHaveBeenCalledWith('搬移後會超過 3 層')
  })

  it('還原變更會回到上次載入的狀態', async () => {
    const tree = await mountTreeWithSampleData()
    tree.renameRow('id-menu', '選單管理')
    tree.addRow(null)

    tree.resetChanges()

    expect(tree.findRow('id-menu')?.name).toBe('選單設定')
    expect(tree.hasChanges.value).toBe(false)
  })
})

describe('useAdminResourceTree - 送出前驗證', () => {
  beforeEach(() => {
    getAdminResourceTreeMock.mockReset()
    replaceAdminResourceTreeMock.mockReset()
    showWarningMock.mockReset()
    showErrorMock.mockReset()
    notifyWarningMock.mockReset()
    notifyErrorMock.mockReset()
  })

  it('名稱空白時不通過', async () => {
    const tree = await mountTreeWithSampleData()
    tree.addRow(null)

    const validation = tree.validateTree()

    expect(validation.isValid).toBe(false)
    expect(validation.message).toBe('有選單名稱是空白的，請先填寫；未命名的新增列可在編輯狀態按取消收掉。')
  })

  it('完整資源名稱重複時不通過', async () => {
    const tree = await mountTreeWithSampleData()
    const created = tree.addRow('id-system')
    if (created !== null) {
      tree.renameRow(created.rowKey, '選單設定')
    }

    const validation = tree.validateTree()

    expect(validation.isValid).toBe(false)
    expect(validation.message).toBe('資源名稱「系統管理>選單設定」重複，整棵樹內的完整名稱必須唯一。')
  })

  it('名稱含階層分隔符號時不通過', async () => {
    const tree = await mountTreeWithSampleData()
    tree.renameRow('id-menu', '選單>設定')

    const validation = tree.validateTree()

    expect(validation.isValid).toBe(false)
    expect(validation.message).toBe('選單名稱不可包含「>」，該符號是階層分隔用的。')
  })

  it('整棵樹都合法時通過', async () => {
    const tree = await mountTreeWithSampleData()

    expect(tree.validateTree()).toEqual({ isValid: true, message: null })
  })
})

describe('useAdminResourceTree - 整批替換', () => {
  beforeEach(() => {
    getAdminResourceTreeMock.mockReset()
    replaceAdminResourceTreeMock.mockReset()
    showWarningMock.mockReset()
    showErrorMock.mockReset()
    notifyWarningMock.mockReset()
    notifyErrorMock.mockReset()
  })

  it('送出的是完整的嵌套樹，resourceName 為完整路徑且不含 resourceCode', async () => {
    const tree = await mountTreeWithSampleData()

    const items = tree.buildRequestItems(null)

    expect(items).toEqual([
      {
        id: 'id-system',
        resourceName: '系統管理',
        isEnabled: true,
        children: [
          { id: 'id-users', resourceName: '系統管理>用戶管理', isEnabled: true, children: [] },
          { id: 'id-menu', resourceName: '系統管理>選單設定', isEnabled: true, children: [] },
        ],
      },
      { id: 'id-content', resourceName: '內容管理', isEnabled: true, children: [] },
    ])
  })

  it('儲存成功時帶上讀取到的版本戳記，並以回應重建畫面狀態', async () => {
    const tree = await mountTreeWithSampleData()
    tree.renameRow('id-menu', '選單管理')
    replaceAdminResourceTreeMock.mockResolvedValue(
      buildTreeResponse('2026-09-02T00:00:00+00:00', [
        buildNode('id-system', '系統管理', {
          children: [buildNode('id-users', '系統管理>用戶管理', { resourceCode: 'admin_users' }), buildNode('id-menu', '系統管理>選單管理')],
        }),
        buildNode('id-content', '內容管理'),
      ]),
    )

    const isSuccess = await tree.saveTree()

    expect(isSuccess).toBe(true)
    expect(replaceAdminResourceTreeMock).toHaveBeenCalledWith(expect.objectContaining({ version: '2026-09-01T00:00:00+00:00' }))
    expect(tree.version.value).toBe('2026-09-02T00:00:00+00:00')
    expect(tree.findRow('id-menu')?.name).toBe('選單管理')
    expect(tree.hasChanges.value).toBe(false)
  })

  it('未通過前端驗證時不呼叫 API', async () => {
    const tree = await mountTreeWithSampleData()
    tree.addRow(null)

    const isSuccess = await tree.saveTree()

    expect(isSuccess).toBe(false)
    expect(replaceAdminResourceTreeMock).not.toHaveBeenCalled()
  })

  it('版本衝突（409）時提示重新載入', async () => {
    const tree = await mountTreeWithSampleData()
    tree.renameRow('id-menu', '選單管理')
    const conflict: ResponseStructure<null> = {
      result: { data: null, error: { code: 409, message: '版本不符' } },
      status: 409,
      statusText: 'Conflict',
      success: false,
      errorMessage: '版本不符',
      timestamp: Date.now(),
    }
    replaceAdminResourceTreeMock.mockRejectedValue(conflict)

    const isSuccess = await tree.saveTree()

    expect(isSuccess).toBe(false)
    expect(showWarningMock).toHaveBeenCalledWith('這份選單設定在你編輯期間已被其他人修改，請重新載入後再調整。', '版本衝突')
    expect(tree.isSaving.value).toBe(false)
  })

  it('後端回 403 時提示不允許的變更', async () => {
    const tree = await mountTreeWithSampleData()
    tree.renameRow('id-menu', '選單管理')
    const forbidden: ResponseStructure<null> = {
      result: { data: null, error: { code: 403, message: '沒有權限修改後台資源' } },
      status: 403,
      statusText: 'Forbidden',
      success: false,
      errorMessage: '沒有權限修改後台資源',
      timestamp: Date.now(),
    }
    replaceAdminResourceTreeMock.mockRejectedValue(forbidden)

    const isSuccess = await tree.saveTree()

    expect(isSuccess).toBe(false)
    expect(notifyErrorMock).toHaveBeenCalledWith('沒有權限修改後台資源', 0)
  })
})
