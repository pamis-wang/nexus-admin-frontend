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
}
