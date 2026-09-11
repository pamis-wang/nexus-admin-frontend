import { useQuasar } from 'quasar'

/**
 * 共用通知組合函式
 *
 * 與 `useDialog` 的分工看**阻斷性**：使用者必須先處理完才能繼續的用 dialog，
 * 能一邊看訊息一邊繼續操作的用 notify。列表載入失敗、新增／編輯／刪除的成功與失敗都屬後者。
 *
 * 回傳值是 Quasar 的通知控制函數，可再呼叫一次來更新或關閉該則通知。
 */
export function useNotify() {
  const $q = useQuasar()

  /**
   * 顯示成功通知
   * @param message 訊息內容
   * @param timeout 顯示時間（毫秒），預設 2000ms
   */
  function notifySuccess(message: string, timeout = 2000) {
    return $q.notify({
      type: 'positive',
      message,
      position: 'top',
      timeout,
      actions: [{ icon: 'mdi-close', color: 'white', round: true, handler: () => {} }],
    })
  }

  /**
   * 顯示錯誤通知
   * @param message 訊息內容
   * @param timeout 顯示時間（毫秒），預設 3000ms；可重試的失敗傳 0 不自動關閉
   */
  function notifyError(message: string, timeout = 3000) {
    return $q.notify({
      type: 'negative',
      message,
      position: 'top',
      timeout,
      actions: [{ icon: 'mdi-close', color: 'white', round: true, handler: () => {} }],
    })
  }

  /**
   * 顯示警告通知
   * @param message 訊息內容
   * @param timeout 顯示時間（毫秒），預設 2500ms
   */
  function notifyWarning(message: string, timeout = 2500) {
    return $q.notify({
      type: 'warning',
      message,
      position: 'top',
      timeout,
      actions: [{ icon: 'mdi-close', color: 'white', round: true, handler: () => {} }],
    })
  }

  /**
   * 顯示資訊通知
   * @param message 訊息內容
   * @param timeout 顯示時間（毫秒），預設 2000ms
   */
  function notifyInfo(message: string, timeout = 2000) {
    return $q.notify({
      type: 'info',
      message,
      position: 'top',
      timeout,
      actions: [{ icon: 'mdi-close', color: 'white', round: true, handler: () => {} }],
    })
  }

  return {
    notifySuccess,
    notifyError,
    notifyWarning,
    notifyInfo,
  }
}
