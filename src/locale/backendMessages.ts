/**
 * 後端錯誤訊息的英文對照
 *
 * 後端目前只回傳中文錯誤訊息、沒有錯誤碼。過渡期以中文原文當 key 查英文，等後端補上錯誤碼後改用錯誤碼查。
 * 對照表同時是「需要哪些錯誤碼」的清單，屆時可直接交給後端當規格。
 *
 * 用一般物件查表而不放進 vue-i18n：後端訊息含 [ ] { } . 等字元，當成 vue-i18n 的 key 會被解析成路徑或訊息語法。
 * 繁中直接顯示後端原文，所以只有英文需要對照表。
 *
 * 本檔各站共用；對照表 backend-messages.en-US.json 各站一份，因為各站接的後端不同、訊息也不同。
 * 還沒整理對照的站給空物件 {}，英文介面一律顯示 http 字典的通用訊息，查不到的原文會記在 axiosService 的 log。
 */
import backendMessagesEnUS from '@/locale/backend-messages.en-US.json'
import { getLocale } from '@/plugins/i18n'
import type { SupportedLocale } from '@/locale'

/** 後端中文錯誤訊息 → 英文 */
const BACKEND_MESSAGES_EN_US: Record<string, string> = backendMessagesEnUS

/**
 * 把後端錯誤訊息轉成指定語系的文字
 * @param message 後端回傳的錯誤訊息原文
 * @param locale 要顯示的語系
 * @returns 轉換後的文字；對照表查不到時為 null，由呼叫端決定退回什麼
 */
export function translateBackendMessage(message: string, locale: SupportedLocale): string | null {
  if (locale === 'zh-TW') return message

  return BACKEND_MESSAGES_EN_US[message.trim()] ?? null
}

/**
 * 取得後端訊息在目前語系要顯示的文字
 *
 * 給頁面直接讀後端訊息的地方用：HTTP 2xx 卻帶著錯誤、或顯示後端回傳的成功訊息。
 * 非 2xx 的錯誤訊息 axiosService 已經轉好，放在 errorMessage，不必再轉。
 * @param message 後端回傳的訊息原文；可能沒有
 * @param fallback 沒有訊息、或英文介面查不到對照時顯示的文字
 * @returns 要顯示的文字
 */
export function resolveBackendMessage(message: string | null | undefined, fallback: string): string {
  if (!message) return fallback

  return translateBackendMessage(message, getLocale()) ?? fallback
}
