import type { QTableColumn } from 'quasar'
import type { Pagination } from '@/components/XTable.vue'

declare global {
  type XTableColumn = QTableColumn
  type XPagination = Pagination
}

export {}
