/** 選單設定的樹節點（頁面內部以扁平陣列操作，送出前才組回嵌套樹） */
export interface MenuSettingsRow {
  /** 前端穩定識別碼；新增列還沒有後端 id，表格 rowKey 與父子指向都靠這個 */
  rowKey: string
  /** 資源唯一編號；null 表示新增，由後端配號 */
  id: string | null
  /** 父節點的前端識別碼；第一層為 null */
  parentRowKey: string | null
  /** 資源層級 (1:一層, 2:二層, 3:三層) */
  level: number
  /** 這一層的顯示名稱（不含父路徑） */
  name: string
  /** 資源代碼，唯讀；有值代表綁定端點權限，只能由後端種子資料維護 */
  resourceCode: string | null
  /** 是否啟用 */
  isEnabled: boolean
  /** 顯示順序，格式 1AA2BB3CC；由後端依樹狀位置重算，畫面唯讀 */
  displayOrder: number
  /** 同層排序位置 (1-based)，決定送出時的陣列順序 */
  position: number
}

/** 表格顯示用的列，含呈現需要的衍生資訊 */
export interface MenuSettingsTableRow {
  /** 對應的樹節點 */
  row: MenuSettingsRow
  /** 完整資源名稱（含父路徑） */
  fullPath: string
  /** 直接子節點數 */
  childCount: number
  /** 是否已展開 */
  isExpanded: boolean
}

/** 拖曳結果：把某節點放到同層某節點之後 */
export interface MenuSettingsDragMove {
  /** 被拖曳的節點 */
  rowKey: string
  /** 要放在這個同層節點之後；null 表示放到該群組的最前面 */
  afterRowKey: string | null
}

/** 儲存前的整棵樹驗證結果 */
export interface MenuSettingsTreeValidation {
  /** 是否通過驗證 */
  isValid: boolean
  /** 未通過時的第一個錯誤訊息 */
  message: string | null
}

/** 未儲存變更摘要 */
export interface MenuSettingsChangeSummary {
  /** 新增筆數 */
  addedCount: number
  /** 改名或啟用狀態變動的筆數 */
  updatedCount: number
  /** 位置變動筆數（同層排序或跨層搬移） */
  movedCount: number
  /** 是否有任何未儲存變更 */
  hasChanges: boolean
}

/** 「移到其他層級」對話框的候選父節點 */
export interface MenuSettingsMoveTarget {
  /** 目標父節點的前端識別碼；null 表示移到第一層 */
  parentRowKey: string | null
  /** 顯示用的完整路徑；移到第一層時為「（移到第一層）」 */
  label: string
  /** 搬移後該節點會變成第幾層 */
  level: number
  /** 是否不可選 */
  disabled: boolean
  /** 不可選的原因；可選時為 null */
  disabledReason: string | null
}
