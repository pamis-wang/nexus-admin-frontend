import type { ResponseStructure } from '@/services/axiosService'
import type { QTableColumn } from 'quasar'
import type { Pagination } from '@/components/XTable.vue'

declare global {
  /**
   * API 錯誤型別
   * @description 用於 catch 區塊的型別斷言,避免每次都要 import ResponseStructure
   * @example
   * try {
   *   await getCurrentAuthorization()
   * } catch (error) {
   *   const errorMessage = (error as ErrorResponseStructure).errorMessage
   * }
   */
  type ErrorResponseStructure = ResponseStructure<null>
  type XTableColumn = QTableColumn
  type XPagination = Pagination
}

export {}
