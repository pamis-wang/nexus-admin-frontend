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

/** 權限動作；依權限矩陣的欄位順序為 access、create、update、delete */
export type AdminRolePermissionActionResponse = 'access' | 'create' | 'update' | 'delete'

/** 權限矩陣上的一個資源節點：資源本身、這個角色對它的四個旗標，以及它實際有哪些操作可以授權 */
export interface AdminRolePermissionNodeResponse {
  /** 資源唯一編號 */
  resourceId: string
  /** 父級資源唯一編號；第一層為 null */
  parentId: string | null
  /** 資源名稱（完整路徑，例：系統管理>角色管理） */
  resourceName: string
  /** 資源代碼；null 表示這筆資源沒有綁定端點權限，只開放檢視 */
  resourceCode: string | null
  /** 資源層級 (1:一層, 2:二層, 3:三層) */
  level: number
  /** 顯示順序，格式 1AA2BB3CC */
  displayOrder: number
  /** 是否啟用；停用的資源照樣列出，權限原樣保留，選單重新啟用後立即生效 */
  isEnabled: boolean
  /** 訪問權限 */
  canAccess: boolean
  /** 新增權限；不在 availableActions 裡時一律為 false */
  canCreate: boolean
  /** 修改權限；不在 availableActions 裡時一律為 false */
  canUpdate: boolean
  /** 刪除權限；不在 availableActions 裡時一律為 false */
  canDelete: boolean
  /** 可以授權的操作；不在清單裡的操作沒有任何端點會檢查，儲存時後端會把旗標清成 false */
  availableActions: AdminRolePermissionActionResponse[]
  /** 子節點，依顯示順序排列 */
  children: AdminRolePermissionNodeResponse[]
}

/** 角色與它的權限矩陣 */
export interface AdminRolePermissionMatrixResponse {
  /** 角色，含用戶人數與版本戳記 */
  role: AdminRoleResponse
  /** 以全部資源為底的權限樹（含停用的資源），依顯示順序排列 */
  permissions: AdminRolePermissionNodeResponse[]
}

/** 使用某個角色的用戶 */
export interface AdminRoleUserResponse {
  /** 用戶唯一編號 */
  id: string
  /** 登入帳號 */
  account: string
  /** 姓名；未填時為 null */
  fullName: string | null
  /** 是否已停用 */
  isDisabled: boolean
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
 * 取得角色與它的權限矩陣
 * @description 角色本身與以全部資源為底的權限樹一次回來，編輯頁與檢視頁只要打這一支，不必另外有資源管理的檢視權限
 * @param roleId 角色唯一編號
 * @returns 角色與權限樹；角色不存在時回 404
 */
export async function getAdminRolePermissionMatrix(roleId: string): Promise<ResponseStructure<AdminRolePermissionMatrixResponse>> {
  return await request<AdminRolePermissionMatrixResponse>({ url: `${BASE_API_URL}/${roleId}/permissions`, method: 'GET' })
}

/**
 * 取得使用指定角色的用戶
 * @description 只需要角色管理的檢視權限；角色存在但沒有人使用時為空陣列
 * @param roleId 角色唯一編號
 * @returns 依帳號排序的用戶；角色不存在時回 404
 */
export async function getAdminRoleUsers(roleId: string): Promise<ResponseStructure<AdminRoleUserResponse[]>> {
  return await request<AdminRoleUserResponse[]>({ url: `${BASE_API_URL}/${roleId}/users`, method: 'GET' })
}
