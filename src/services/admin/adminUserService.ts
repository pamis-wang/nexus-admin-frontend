import { request, type CreatedResponse, type ResponseStructure, type UpdatedResponse } from '@/services/axiosService'

/** 呼叫 API 路徑 */
const BASE_API_URL = `${import.meta.env.VITE_API_URL}/api/admin-users`

/** 用戶與角色的對應 */
export interface AdminUserRoleMappingResponse {
  /** 用戶唯一編號 */
  adminId: string
  /** 用戶名稱 */
  adminName: string | null
  /** 角色唯一編號 */
  roleId: string
  /** 角色名稱 */
  roleName: string | null
}

/**
 * 用戶已綁定的登入方式
 *
 * 全部欄位唯讀：Admin API 沒有解鎖、清除失敗次數或重設密碼的端點，
 * 這些狀態只能看，不能在後台介面上處理。
 */
export interface AdminUserLoginResponse {
  /** 唯一編號 */
  id: string
  /** 登入方式代碼 */
  provider: string
  /** 登入方式顯示名稱 */
  providerName: string
  /** 該登入方式綁定的電子信箱 */
  providerEmail: string | null
  /** 驗證完成時間 - ISO 8601；null 表示尚未驗證 */
  verifiedAt: string | null
  /** 目前是否可用 */
  isUsable: boolean
  /** 是否要求下次登入時重設密碼 */
  requiresReset: boolean
  /** 連續登入失敗次數 */
  failedCount: number
  /** 鎖定到期時間 - ISO 8601；null 表示未鎖定 */
  lockedUntil: string | null
  /** 最後一次使用時間 - ISO 8601 */
  lastUsedAt: string | null
}

/** 後台用戶 */
export interface AdminUserResponse {
  /** 唯一編號 */
  id: string
  /** 登入帳號，整個系統內不可重複 */
  account: string
  /** 電子信箱 */
  email: string
  /** 姓名 */
  fullName: string | null
  /** 是否為系統預設帳號；系統預設帳號不允許停用 */
  isSystemDefault: boolean
  /** 是否已停用 */
  isDisabled: boolean
  /** 帳號啟用時間 - ISO 8601；null 表示尚未啟用 */
  activateAt: string | null
  /** 最後登入時間 - ISO 8601 */
  lastLoginAt: string | null
  /** 角色對應 */
  roleMappings: AdminUserRoleMappingResponse[]
  /** 已綁定的登入方式 */
  logins: AdminUserLoginResponse[]
}

/** 新增用戶請求 */
export interface CreateAdminUserRequest {
  /** 登入帳號 */
  account: string
  /** 電子信箱 */
  email: string
  /** 姓名 */
  fullName: string | null
}

/** 更新用戶請求 */
export interface UpdateAdminUserRequest {
  /** 登入帳號；PUT 是完整替換，沒帶會被寫成空字串，未修改時也要把原值帶回 */
  account: string
  /** 電子信箱 */
  email: string
  /** 姓名 */
  fullName: string | null
  /** 是否已停用；這支端點沒有「不能停用自己」與「系統預設不可停用」的防護，要改停用狀態請走 disabled-state */
  isDisabled: boolean
}

/** 更新停用狀態請求 */
export interface UpdateAdminUserDisabledStateRequest {
  /** 是否停用 */
  isDisabled: boolean
}

/** 更新用戶角色請求 */
export interface UpdateAdminUserRolesRequest {
  /** 角色唯一編號清單，全量替換 */
  roleIds: string[]
}

/**
 * 查詢所有後台用戶
 * @description 回傳全部用戶資料、角色對應，以及每位用戶已綁定的登入方式
 * @returns 用戶列表
 */
export async function getAdminUsers(): Promise<ResponseStructure<AdminUserResponse[]>> {
  return await request<AdminUserResponse[]>({ url: BASE_API_URL, method: 'GET' })
}

/**
 * 查詢指定後台用戶
 * @param userId 用戶唯一編號
 * @returns 單筆用戶資料
 */
export async function getAdminUserById(userId: string): Promise<ResponseStructure<AdminUserResponse>> {
  return await request<AdminUserResponse>({ url: `${BASE_API_URL}/${userId}`, method: 'GET' })
}

/**
 * 新增後台用戶
 * @description 只建立帳號本身，不含密碼與角色；新帳號尚未綁定登入方式，需另行啟用才能登入
 * @param data 帳號、電子信箱與姓名
 * @returns 新用戶的唯一編號與建立時間
 */
export async function createAdminUser(data: CreateAdminUserRequest): Promise<ResponseStructure<CreatedResponse>> {
  return await request<CreatedResponse>({ url: BASE_API_URL, method: 'POST', data })
}

/**
 * 更新後台用戶基本資料
 * @description
 * 完整替換：帳號、電子信箱、姓名與停用狀態都要帶齊，沒帶的欄位會被寫成空值。
 * 帳號與電子信箱可以修改，但不能改成其他用戶正在使用的值，重複時回 409。
 * 停用狀態請原樣帶回，要變更請改用 updateAdminUserDisabledState。
 * @param userId 用戶唯一編號
 * @param data 帳號、電子信箱、姓名與停用狀態
 * @returns 用戶唯一編號與更新時間
 */
export async function updateAdminUser(userId: string, data: UpdateAdminUserRequest): Promise<ResponseStructure<UpdatedResponse>> {
  return await request<UpdatedResponse>({ url: `${BASE_API_URL}/${userId}`, method: 'PUT', data })
}

/**
 * 更新後台用戶的啟停用狀態
 * @description 停用後該帳號立即失去全部權限；不能停用自己、系統預設帳號不允許停用，兩者都會回 403
 * @param userId 用戶唯一編號
 * @param data 是否停用
 * @returns 用戶唯一編號與更新時間
 */
export async function updateAdminUserDisabledState(userId: string, data: UpdateAdminUserDisabledStateRequest): Promise<ResponseStructure<UpdatedResponse>> {
  return await request<UpdatedResponse>({ url: `${BASE_API_URL}/${userId}/disabled-state`, method: 'PATCH', data })
}

/**
 * 查詢指定用戶的角色清單
 * @param userId 用戶唯一編號
 * @returns 角色對應列表
 */
export async function getAdminUserRoles(userId: string): Promise<ResponseStructure<AdminUserRoleMappingResponse[]>> {
  return await request<AdminUserRoleMappingResponse[]>({ url: `${BASE_API_URL}/${userId}/roles`, method: 'GET' })
}

/**
 * 更新指定用戶的角色清單
 * @description 全量替換，未列入的既有角色對應會被移除
 * @param userId 用戶唯一編號
 * @param data 角色唯一編號清單
 * @returns 更新後的角色對應列表
 */
export async function updateAdminUserRoles(userId: string, data: UpdateAdminUserRolesRequest): Promise<ResponseStructure<AdminUserRoleMappingResponse[]>> {
  return await request<AdminUserRoleMappingResponse[]>({ url: `${BASE_API_URL}/${userId}/roles`, method: 'PUT', data })
}
