/**
 * 鍵盤工具函式
 * 提供鍵盤事件處理相關的工具函式
 */

/** 可能包含原生事件的事件介面 */
interface EventWithNative extends Event {
  /** 原生鍵盤事件，Quasar 元件包裝過的事件會透過此欄位提供 */
  nativeEvent?: KeyboardEvent
}

/**
 * 只允許輸入數字和 Enter
 * @param e - 鍵盤事件
 * @example
 * import { allowNumbersAndEnter } from '@/composables/useKeyboard'
 * <q-input @keydown="allowNumbersAndEnter" />
 */
export function allowNumbersAndEnter(e: KeyboardEvent) {
  const isNumber = /^\d$/.test(e.key)
  const isEnter = e.key === 'Enter'

  if (!isNumber && !isEnter) {
    e.preventDefault()
  }
}

/**
 * 只允許輸入數字和英文字母
 * @param e - 鍵盤事件
 * @example
 * import { allowNumbersAndLetters } from '@/composables/useKeyboard'
 * <q-input @keydown="allowNumbersAndLetters" />
 */
export function allowNumbersAndLetters(e: KeyboardEvent) {
  const isNumber = /^\d$/.test(e.key)
  const isLetter = /^[a-zA-Z]$/.test(e.key)
  const isEnter = e.key === 'Enter'
  const isBackspace = e.key === 'Backspace'
  const isDelete = e.key === 'Delete'
  const isTab = e.key === 'Tab'

  if (!isNumber && !isLetter && !isEnter && !isBackspace && !isDelete && !isTab) {
    e.preventDefault()
  }
}

/**
 * 檢查 Caps Lock 狀態
 * @param event - 鍵盤事件
 * @returns 是否開啟 Caps Lock
 * @example
 * import { checkCapsLock } from '@/composables/useKeyboard'
 * const isCapsOn = checkCapsLock(event)
 */
export function checkCapsLock(event: KeyboardEvent | EventWithNative): boolean {
  // 檢查是否為 KeyboardEvent 且有 getModifierState 方法
  if ('getModifierState' in event && typeof event.getModifierState === 'function') {
    return event.getModifierState('CapsLock')
  }

  // 嘗試從 event 中找到原生的 KeyboardEvent
  const eventWithNative = event as EventWithNative
  if (eventWithNative.nativeEvent && 'getModifierState' in eventWithNative.nativeEvent) {
    return eventWithNative.nativeEvent.getModifierState('CapsLock')
  }

  return false
}
