/** 用戶列表的顯示列 */
export interface UserManagementRow {
  /** 用戶唯一編號 */
  id: string
  /** 登入帳號 */
  account: string
  /** 電子信箱 */
  email: string
  /** 姓名 */
  fullName: string | null
  /** 是否為系統預設帳號 */
  isSystemDefault: boolean
  /** 是否已停用 */
  isDisabled: boolean
  /** 角色名稱，依後端回傳順序 */
  roleNames: string[]
  /** 是否尚未綁定任何登入方式；這種帳號還不能登入 */
  hasNoLogin: boolean
  /** 是否有任何一種登入方式正被鎖定 */
  isLocked: boolean
}

/** 新增用戶的表單 */
export interface UserManagementCreateFormData {
  /** 登入帳號 */
  account: string
  /** 電子信箱 */
  email: string
  /** 姓名 */
  fullName: string
  /** 指派的角色唯一編號 */
  roleIds: string[]
}

/** 編輯用戶的表單；帳號唯讀，停用狀態另走專用端點 */
export interface UserManagementEditFormData {
  /** 用戶唯一編號 */
  id: string
  /** 登入帳號，唯讀 */
  account: string
  /** 電子信箱 */
  email: string
  /** 姓名 */
  fullName: string
  /** 指派的角色唯一編號 */
  roleIds: string[]
  /** 載入當下的停用狀態，更新基本資料時原樣帶回 */
  isDisabled: boolean
}

/** 角色下拉選單的選項 */
export interface UserManagementRoleOption {
  /** 角色唯一編號 */
  value: string
  /** 角色名稱 */
  label: string
  /** 是否為系統預設角色；選項上會標記，與列表、檢視頁的標籤同一套語彙 */
  isSystemDefault: boolean
}

/** 帳號狀態的篩選值 */
export type UserManagementAccountStatus = 'enabled' | 'disabled'

/**
 * 用戶列表的篩選條件
 *
 * 文字欄位一律可空：q-input 的 clearable 清空時會把值設成 null，不是空字串。
 */
export interface UserManagementFilter {
  /** 帳號關鍵字 */
  account: string | null
  /** 姓名關鍵字 */
  fullName: string | null
  /** 電子信箱關鍵字 */
  email: string | null
  /** 角色名稱；null 表示不限 */
  roleName: string | null
  /** 帳號狀態；null 表示不限 */
  accountStatus: UserManagementAccountStatus | null
}

/** 帳號狀態的下拉選項 */
export interface UserManagementAccountStatusOption {
  /** 篩選值 */
  value: UserManagementAccountStatus
  /** 顯示文字 */
  label: string
}
