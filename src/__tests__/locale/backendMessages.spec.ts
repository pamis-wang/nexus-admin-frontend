import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveBackendMessage, translateBackendMessage } from '@/locale/backendMessages'
import { i18n } from '@/plugins/i18n'

// 對照表會隨第 2 階段逐步補齊，這裡換成固定內容，驗的是查表規則而不是當下翻了幾句
vi.mock('@/locale/backend-messages.en-US.json', () => ({
  default: {
    帳號已鎖定: 'Your account is locked.',
    '[用戶信箱] 為必填': '[User email] is required.',
  },
}))

describe('translateBackendMessage', () => {
  it('繁中直接回傳後端原文', () => {
    expect(translateBackendMessage('帳號已鎖定', 'zh-TW')).toBe('帳號已鎖定')
    expect(translateBackendMessage('對照表沒有的訊息', 'zh-TW')).toBe('對照表沒有的訊息')
  })

  it('英文依原文查對照表', () => {
    expect(translateBackendMessage('帳號已鎖定', 'en-US')).toBe('Your account is locked.')
  })

  it('原文含 vue-i18n 會解析的符號也查得到', () => {
    expect(translateBackendMessage('[用戶信箱] 為必填', 'en-US')).toBe('[User email] is required.')
  })

  it('忽略原文前後的空白', () => {
    expect(translateBackendMessage(' 帳號已鎖定\n', 'en-US')).toBe('Your account is locked.')
  })

  it('英文查不到時回傳 null，由呼叫端決定退回什麼', () => {
    expect(translateBackendMessage('對照表沒有的訊息', 'en-US')).toBeNull()
  })
})

describe('resolveBackendMessage', () => {
  afterEach(() => {
    i18n.global.locale.value = 'zh-TW'
  })

  it('沒有後端訊息時顯示預設文字', () => {
    expect(resolveBackendMessage(null, '預設')).toBe('預設')
    expect(resolveBackendMessage(undefined, '預設')).toBe('預設')
    expect(resolveBackendMessage('', '預設')).toBe('預設')
  })

  it('繁中顯示後端原文', () => {
    expect(resolveBackendMessage('對照表沒有的訊息', '預設')).toBe('對照表沒有的訊息')
  })

  it('英文顯示對照結果，查不到時顯示預設文字', () => {
    i18n.global.locale.value = 'en-US'

    expect(resolveBackendMessage('帳號已鎖定', 'Default')).toBe('Your account is locked.')
    expect(resolveBackendMessage('對照表沒有的訊息', 'Default')).toBe('Default')
  })
})
