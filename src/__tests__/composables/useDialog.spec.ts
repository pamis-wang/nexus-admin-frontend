import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useDialog } from '@/composables/useDialog'

const dialogMock = vi.fn<(options: Record<string, unknown>) => void>()

vi.mock('quasar', () => ({
  useQuasar: () => ({ dialog: (options: Record<string, unknown>) => dialogMock(options) }),
}))

// useDialog 在元件外呼叫拿不到 useI18n，按鈕與標題文字直接回傳 key
vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

describe('useDialog', () => {
  beforeEach(() => {
    dialogMock.mockReset()
  })

  it('確認對話框的預設焦點在「取消」，一打開就按 Enter 不會直接執行', () => {
    useDialog().showConfirm('確定要刪除角色「稽核人員」嗎？')

    expect(dialogMock).toHaveBeenCalledWith(expect.objectContaining({ focus: 'cancel' }))
  })

  it('錯誤對話框不把訊息當 HTML 解析，後端回傳的文字原樣顯示', () => {
    useDialog().showError('<img src=x onerror=alert(1)>')

    expect(dialogMock).toHaveBeenCalledWith(expect.not.objectContaining({ html: true }))
  })
})
