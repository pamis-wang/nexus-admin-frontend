import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'

/**
 * 基礎對話談窗 Composable
 * 提供常用的對話談窗功能
 */
export const useDialog = () => {
  const $q = useQuasar()
  const { t } = useI18n()

  /**
   * 顯示成功對話談窗
   * @param message 訊息內容
   * @param title 標題，預設為「成功」
   */
  const showSuccess = (message: string, title = t('common.dialog.success')) => {
    return $q.dialog({
      title,
      message,
      color: 'positive',
      ok: {
        label: t('common.action.ok'),
        color: 'positive',
        flat: true,
      },
      persistent: true,
    })
  }

  /**
   * 顯示確認對話談窗，以 `.onOk()` 接續使用者按下確認後的動作
   *
   * 預設焦點放在「取消」：Quasar 預設停在「確認」，對話框一打開就按 Enter、空白鍵或簡報筆的按鍵會直接執行，
   * 刪除這類無法復原的動作不該這麼容易誤觸。
   * @param message 訊息內容
   * @param title 標題，預設為「確認」
   */
  const showConfirm = (message: string, title = t('common.dialog.confirm')) => {
    return $q.dialog({
      title,
      message,
      color: 'primary',
      ok: {
        label: t('common.action.ok'),
        color: 'primary',
        flat: true,
      },
      cancel: {
        label: t('common.action.cancel'),
        color: 'grey',
        flat: true,
      },
      focus: 'cancel',
      persistent: true,
    })
  }

  /**
   * 顯示警告對話談窗
   * @param message 訊息內容
   * @param title 標題，預設為「警告」
   */
  const showWarning = (message: string, title = t('common.dialog.warning')) => {
    return $q.dialog({
      title,
      message,
      color: 'warning',
      ok: {
        label: t('common.action.ok'),
        color: 'warning',
        flat: true,
      },
      persistent: true,
    })
  }

  /**
   * 顯示錯誤對話談窗
   * @param message 訊息內容
   * @param title 標題，預設為「錯誤」
   */
  const showError = (message: string, title = t('common.dialog.error')) => {
    return $q.dialog({
      title,
      message,
      color: 'negative',
      ok: {
        label: t('common.action.ok'),
        color: 'negative',
        flat: true,
      },
      persistent: true,
      style: 'width: 600px; max-width: 90vw;',
      class: 'break-word-dialog',
    })
  }

  /**
   * 顯示資訊對話談窗
   * @param message 訊息內容
   * @param title 標題，預設為「資訊」
   */
  const showInfo = (message: string, title = t('common.dialog.info')) => {
    return $q.dialog({
      title,
      message,
      color: 'info',
      ok: {
        label: t('common.action.ok'),
        color: 'info',
        flat: true,
      },
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
