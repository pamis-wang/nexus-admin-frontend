import { useQuasar } from 'quasar'

/**
 * 共用對話框組合函式
 *
 * 統一全專案的訊息呈現樣式，頁面不必各自組 $q.dialog 的設定。
 * 回傳值是 Quasar 的 DialogChainObject，確認類的對話框可接 `.onOk()`／`.onCancel()`。
 */
export function useDialog() {
  const $q = useQuasar()

  /**
   * 顯示成功訊息
   * @param message 訊息內容
   * @param title 標題，預設為「成功」
   */
  function showSuccess(message: string, title = '成功') {
    return $q.dialog({
      title,
      message,
      color: 'positive',
      ok: { label: '確認', color: 'positive', flat: true },
      persistent: true,
    })
  }

  /**
   * 顯示確認訊息，以 `.onOk()` 接續使用者按下確認後的動作
   *
   * 預設焦點放在「取消」：Quasar 預設停在「確認」，對話框一打開就按 Enter、空白鍵或簡報筆的按鍵會直接執行，
   * 刪除這類無法復原的動作不該這麼容易誤觸。
   * @param message 訊息內容
   * @param title 標題，預設為「確認」
   */
  function showConfirm(message: string, title = '確認') {
    return $q.dialog({
      title,
      message,
      color: 'primary',
      ok: { label: '確認', color: 'primary', flat: true },
      cancel: { label: '取消', color: 'grey', flat: true },
      focus: 'cancel',
      persistent: true,
    })
  }

  /**
   * 顯示警告訊息
   * @param message 訊息內容
   * @param title 標題，預設為「警告」
   */
  function showWarning(message: string, title = '警告') {
    return $q.dialog({
      title,
      message,
      color: 'warning',
      ok: { label: '確認', color: 'warning', flat: true },
      persistent: true,
    })
  }

  /**
   * 顯示錯誤訊息
   * @param message 訊息內容
   * @param title 標題，預設為「錯誤」
   */
  function showError(message: string, title = '錯誤') {
    return $q.dialog({
      title,
      message,
      color: 'negative',
      ok: { label: '確認', color: 'negative', flat: true },
      persistent: true,
    })
  }

  /**
   * 顯示一般資訊
   * @param message 訊息內容
   * @param title 標題，預設為「資訊」
   */
  function showInfo(message: string, title = '資訊') {
    return $q.dialog({
      title,
      message,
      color: 'info',
      ok: { label: '確認', color: 'info', flat: true },
      persistent: true,
    })
  }

  return {
    showSuccess,
    showConfirm,
    showWarning,
    showError,
    showInfo,
  }
}
