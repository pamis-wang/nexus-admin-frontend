import { request, type ResponseStructure } from '@/services/axiosService'

/** 呼叫 API 路徑 */
const BASE_API_URL = `${import.meta.env.VITE_API_URL}/api/admin-resources`

/** 後台用戶資源 */
export interface AdminResourceResponse {
  /** 唯一編號 */
  id: string
  /** 父級資源唯一編號；第一層為 null */
  parentId: string | null
  /** 資源層級 (1:一層, 2:二層, 3:三層) */
  level: number
  /** 資源名稱（完整路徑，例：系統管理>選單設定） */
  resourceName: string
  /** 資源代碼，端點權限的判斷鍵 */
  resourceCode: string
  /** 顯示順序，格式 1AA2BB3CC，同時作為排序依據 */
  displayOrder: number
  /** 是否啟用 */
  isEnabled: boolean
}

/** 後台用戶資源與當前登入用戶的權限 */
export interface AdminResourceWithPermissionResponse {
  /** 唯一編號 */
  id: string
  /** 父級資源唯一編號；第一層為 null */
  parentId: string | null
  /** 資源層級 (1:一層, 2:二層, 3:三層) */
  level: number
  /** 資源名稱（完整路徑，例：系統管理>選單設定） */
  resourceName: string
  /** 資源代碼，端點權限的判斷鍵 */
  resourceCode: string
  /** 顯示順序，格式 1AA2BB3CC，同時作為排序依據 */
  displayOrder: number
  /** 訪問權限 */
  canAccess: boolean
  /** 新增權限 */
  canCreate: boolean
  /** 修改權限 */
  canUpdate: boolean
  /** 刪除權限 */
  canDelete: boolean
}

/** 後台資源樹節點 */
export interface AdminResourceTreeNodeResponse {
  /** 資源唯一編號 */
  id: string
  /** 父級資源唯一編號；第一層為 null */
  parentId: string | null
  /** 資源層級 (1:一層, 2:二層, 3:三層) */
  level: number
  /** 資源名稱（完整路徑，例：系統管理>選單設定） */
  resourceName: string
  /** 資源代碼（唯讀），端點權限的判斷鍵 */
  resourceCode: string
  /** 顯示順序，格式 1AA2BB3CC，由樹狀位置重算 */
  displayOrder: number
  /** 是否啟用 */
  isEnabled: boolean
  /** 子節點，陣列順序即顯示順序 */
  children: AdminResourceTreeNodeResponse[]
}

/** 後台資源樹 */
export interface AdminResourceTreeResponse {
  /** 樹的版本戳記，整批替換時要原封不動帶回來做樂觀鎖；資料表為空時為 null */
  version: string | null
  /** 第一層資源，陣列順序即顯示順序 */
  items: AdminResourceTreeNodeResponse[]
}

/** 後台資源樹節點請求 */
export interface AdminResourceTreeNodeRequest {
  /** 既有資源的唯一編號；資源只由後端種子資料建立，這裡不能新增 */
  id: string
  /** 資源名稱，需送完整路徑（例：系統管理>選單設定），整棵樹內不可重複 */
  resourceName: string
  /** 是否啟用 */
  isEnabled: boolean
  /** 子節點，陣列順序即顯示順序；最多三層 */
  children: AdminResourceTreeNodeRequest[]
}

/** 後台資源樹整批替換請求 */
export interface ReplaceAdminResourceTreeRequest {
  /** 讀取時取得的版本戳記，用於樂觀鎖；與資料庫當下的值不符會回 409 */
  version: string | null
  /** 第一層資源，陣列順序即顯示順序；不可為空 */
  items: AdminResourceTreeNodeRequest[]
}

/**
 * 取得全部後台用戶資源
 * @description 回傳所有資源，不論是否啟用，啟用狀態由 isEnabled 欄位標示
 * @returns 扁平的資源列表
 */
export async function getAdminResources(): Promise<ResponseStructure<AdminResourceResponse[]>> {
  return await request<AdminResourceResponse[]>({ url: BASE_API_URL, method: 'GET' })
}

/**
 * 取得已啟用的後台用戶資源與權限
 * @description 只回傳已啟用且父節點也啟用的資源及其權限設定，適用於前端選單顯示
 * @returns 扁平的資源與權限列表
 */
export async function getAdminResourceWithPermissions(): Promise<ResponseStructure<AdminResourceWithPermissionResponse[]>> {
  return await request<AdminResourceWithPermissionResponse[]>({ url: `${BASE_API_URL}/permissions`, method: 'GET' })
}

/**
 * 取得指定後台用戶可用資源
 * @param resourceId 資源唯一編號
 * @returns 單筆資源與權限
 */
export async function getAdminResourceById(resourceId: string): Promise<ResponseStructure<AdminResourceWithPermissionResponse>> {
  return await request<AdminResourceWithPermissionResponse>({ url: `${BASE_API_URL}/${resourceId}`, method: 'GET' })
}

/**
 * 取得整棵後台資源樹
 * @description 管理介面的讀取來源，回傳的 version 要在整批替換時原封不動帶回來
 * @returns 嵌套資源樹與版本戳記
 */
export async function getAdminResourceTree(): Promise<ResponseStructure<AdminResourceTreeResponse>> {
  return await request<AdminResourceTreeResponse>({ url: `${BASE_API_URL}/tree`, method: 'GET' })
}

/**
 * 以整棵樹整批更新全部後台資源的名稱、位置與啟用狀態
 * @description
 * 單一交易：資源只由後端種子資料建立，樹中必須剛好是全部的既有資源——沒帶 id 的節點回 400，
 * 少了既有資源回 403。既有節點更新名稱與啟用狀態並支援跨父節點搬移；parentId／level／displayOrder
 * 由嵌套位置重算，送了也會被忽略。空樹回 400、version 不符回 409。
 * @param data 嵌套的資源樹與讀取時取得的版本戳記
 * @returns 寫入後的資源樹與新版本戳記
 */
export async function replaceAdminResourceTree(data: ReplaceAdminResourceTreeRequest): Promise<ResponseStructure<AdminResourceTreeResponse>> {
  return await request<AdminResourceTreeResponse>({ url: `${BASE_API_URL}/tree`, method: 'PUT', data })
}
