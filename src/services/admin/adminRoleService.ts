import { request, type CreatedResponse, type DeletedResponse, type ResponseStructure, type UpdatedResponse } from '@/services/axiosService'

/** 呼叫 API 路徑 */
const BASE_API_URL = `${import.meta.env.VITE_API_URL}/api/admin-roles`

/** 後台用戶角色 */
export interface AdminRoleResponse {
  /** 唯一編號 */
  id: string
  /** 角色名稱 */
  name: string
  /** 是否為系統預設角色；系統預設角色不可刪除 */
  isSystemDefault: boolean
  /** 版本戳記，更新角色時要原封不動帶回來做樂觀鎖 */
  version: string | null
  /** 使用這個角色的用戶人數 */
  userCount: number
}

/** 角色的單筆資源權限設定 */
export interface AdminRolePermissionResponse {
  /** 唯一編號 */
  id: string
  /** 角色唯一編號 */
  roleId: string
  /** 角色名稱 */
  roleName: string
  /** 資源唯一編號 */
  resourceId: string
  /** 資源名稱（完整路徑，例：系統管理>角色管理） */
  resourceName: string | null
  /** 訪問權限 */
  canAccess: boolean
  /** 新增權限 */
  canCreate: boolean
  /** 修改權限 */
  canUpdate: boolean
  /** 刪除權限 */
  canDelete: boolean
}

/** 送出用的單筆權限設定 */
export interface AdminRolePermissionItemRequest {
  /** 資源唯一編號 */
  resourceId: string
  /** 訪問權限 */
  canAccess: boolean
  /** 新增權限 */
  canCreate: boolean
  /** 修改權限 */
  canUpdate: boolean
  /** 刪除權限 */
  canDelete: boolean
}

/** 新增角色請求 */
export interface CreateAdminRoleRequest {
  /** 角色名稱，整個系統內不可重複 */
  name: string
  /** 權限矩陣，帶上全部資源；未列入的資源等同沒有任何權限 */
  permissions: AdminRolePermissionItemRequest[]
}

/** 更新角色請求 */
export interface UpdateAdminRoleRequest {
  /** 角色名稱，整個系統內不可重複 */
  name: string
  /** 讀取角色時取得的版本戳記，用於樂觀鎖；與資料庫當下的值不符會回 409 */
  version: string | null
  /** 權限矩陣，全量替換；未列入的既有權限會被移除 */
  permissions: AdminRolePermissionItemRequest[]
}

/**
 * 取得全部後台用戶角色
 * @description 回傳所有角色資料，包含各角色的用戶人數
 * @returns 角色列表
 */
export async function getAdminRoles(): Promise<ResponseStructure<AdminRoleResponse[]>> {
  return await request<AdminRoleResponse[]>({ url: BASE_API_URL, method: 'GET' })
}

/**
 * 取得指定後台用戶角色
 * @param roleId 角色唯一編號
 * @returns 單筆角色資料
 */
export async function getAdminRoleById(roleId: string): Promise<ResponseStructure<AdminRoleResponse>> {
  return await request<AdminRoleResponse>({ url: `${BASE_API_URL}/${roleId}`, method: 'GET' })
}

/**
 * 新增後台用戶角色
 * @description 角色與完整權限矩陣在單一交易中一起寫入，兩者一起成功或失敗；角色名稱重複回 409
 * @param data 角色名稱與權限矩陣
 * @returns 新角色的唯一編號與建立時間
 */
export async function createAdminRole(data: CreateAdminRoleRequest): Promise<ResponseStructure<CreatedResponse>> {
  return await request<CreatedResponse>({ url: BASE_API_URL, method: 'POST', data })
}

/**
 * 更新後台用戶角色
 * @description
 * 角色基本資料與權限矩陣在單一交易中一起寫入。權限是全量替換：請求內容就是該角色的完整權限，
 * 未列入的既有權限會被移除。version 與資料庫當下的值不符會回 409。
 * @param roleId 角色唯一編號
 * @param data 角色名稱、版本戳記與權限矩陣
 * @returns 角色唯一編號與更新時間
 */
export async function updateAdminRole(roleId: string, data: UpdateAdminRoleRequest): Promise<ResponseStructure<UpdatedResponse>> {
  return await request<UpdatedResponse>({ url: `${BASE_API_URL}/${roleId}`, method: 'PUT', data })
}

/**
 * 刪除後台用戶角色
 * @description 系統預設角色不允許刪除，後端會回 403
 * @param roleId 角色唯一編號
 * @returns 刪除結果
 */
export async function deleteAdminRoleById(roleId: string): Promise<ResponseStructure<DeletedResponse>> {
  return await request<DeletedResponse>({ url: `${BASE_API_URL}/${roleId}`, method: 'DELETE' })
}

/**
 * 取得指定角色的所有權限設定
 * @param roleId 角色唯一編號
 * @returns 該角色已設定的資源權限列表
 */
export async function getAdminRolePermissionsByRoleId(roleId: string): Promise<ResponseStructure<AdminRolePermissionResponse[]>> {
  return await request<AdminRolePermissionResponse[]>({ url: `${BASE_API_URL}/${roleId}/permissions`, method: 'GET' })
}
