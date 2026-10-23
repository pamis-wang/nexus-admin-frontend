import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useDialog } from '@/composables/useDialog'

const dialogMock = vi.fn<(options: Record<string, unknown>) => void>()

vi.mock('quasar', () => ({
  useQuasar: () => ({ dialog: (options: Record<string, unknown>) => dialogMock(options) }),
}))

describe('useDialog', () => {
  beforeEach(() => {
    dialogMock.mockReset()
  })

  it('確認對話框的預設焦點在「取消」，一打開就按 Enter 不會直接執行', () => {
    useDialog().showConfirm('確定要刪除角色「稽核人員」嗎？')

    expect(dialogMock).toHaveBeenCalledWith(expect.objectContaining({ focus: 'cancel' }))
  })
})
