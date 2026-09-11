import axios from 'axios'
import { axiosService, request, type BaseResponse, type ResponseStructure } from '@/services/axiosService'

/** 呼叫路徑 */
const BASE_API_URL = `${import.meta.env.VITE_API_URL}/api/auth`

/** 認證狀態 */
export type AuthStatus =
  | 'success'
  | 'account_not_found'
  | 'account_disabled'
  | 'account_not_activated'
  | 'account_locked'
  | 'password_reset_required'
  | 'password_incorrect'
  | 'password_attempts_exceeded'
  | 'token_invalid'
  | 'token_expired'
  | 'validation_error'
  /** 指定了未被指派給該用戶的角色 */
  | 'role_not_assigned'
  /** 稽核模式下一次只能有一個角色生效 */
  | 'multiple_active_roles_not_allowed'

/** 登入請求 */
export interface LoginRequest {
  /** 帳號，可為 admin_users 的帳號或電子信箱 */
  account: string
  /** 明文密碼 */
  password: string
}

/** 登入用戶的角色 */
export interface LoginUserProfileRoleResponse {
  /** 唯一編號 */
  id: string
  /** 角色名稱 */
  name: string
}

/** 登入用戶的簡化資料 */
export interface LoginUserProfileResponse {
  /** 唯一編號 */
  id: string
  /** 帳號 */
  account: string
  /** 電子信箱 */
  email: string
  /** 姓名 */
  fullName: string | null
  /** 角色列表 */
  roles: LoginUserProfileRoleResponse[]
}

/** 登入回應 */
export interface LoginResponse {
  /** 認證狀態 */
  authStatus: AuthStatus
  /** 回應訊息，供顯示用 */
  message: string | null
  /** 令牌類型，登入成功時固定為 Bearer */
  tokenType: string | null
  /** 存取權杖，僅登入成功時提供 */
  accessToken: string | null
  /** 刷新權杖，僅登入成功時提供 */
  refreshToken: string | null
  /** 登入用戶的簡化資料，僅登入成功時提供 */
  userProfile: LoginUserProfileResponse | null
}

/** 換發權杖請求 */
export interface RefreshTokenRequest {
  /** 已核發的存取權杖，可為已過期 */
  accessToken: string
  /** 刷新權杖 */
  refreshToken: string
}

/** 換發權杖回應 */
export interface RefreshTokenResponse {
  /** 認證狀態 */
  authStatus: AuthStatus
  /** 回應訊息，供顯示用 */
  message: string | null
  /** 令牌類型，換發成功時固定為 Bearer */
  tokenType: string | null
  /** 新的存取權杖，僅換發成功時提供 */
  accessToken: string | null
  /** 新的刷新權杖，僅換發成功時提供 */
  refreshToken: string | null
}

/** 登出回應 */
export interface LogoutResponse {
  /** 認證狀態 */
  authStatus: AuthStatus
  /** 回應訊息，供顯示用 */
  message: string | null
}

/**
 * 登入
 * @description AuthController 不論登入結果一律回傳完整的回應內容，只有 HTTP 狀態碼隨 authStatus 變動
 * （例如密碼錯誤回 401、帳號鎖定回 429），這裡繞過共用的 request()（它假設非 2xx 一律視為錯誤、內容不可靠），
 * 改成自行解析回應內容，統一以 authStatus 判斷結果，不看 HTTP 狀態碼。
 */
export async function login(data: LoginRequest): Promise<LoginResponse> {
  const fallback: LoginResponse = {
    authStatus: 'validation_error',
    message: null,
    tokenType: null,
    accessToken: null,
    refreshToken: null,
    userProfile: null,
  }

  try {
    const response = await axiosService.post<BaseResponse<LoginResponse>>(`${BASE_API_URL}/login`, data)
    return response.data.data ?? fallback
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data) {
      const body = error.response.data as BaseResponse<LoginResponse>
      if (body.data) return body.data
      return { ...fallback, message: body.error?.message ?? '登入失敗，請稍後再試' }
    }
    return { ...fallback, message: '網路異常，請稍後再試' }
  }
}

/**
 * 換發權杖（Token Rotation）
 * @description 與 login 相同的契約特性，繞過共用的 request() 自行解析回應。
 */
export async function refresh(data: RefreshTokenRequest): Promise<RefreshTokenResponse> {
  const fallback: RefreshTokenResponse = {
    authStatus: 'validation_error',
    message: null,
    tokenType: null,
    accessToken: null,
    refreshToken: null,
  }

  try {
    const response = await axiosService.post<BaseResponse<RefreshTokenResponse>>(`${BASE_API_URL}/refresh`, data)
    return response.data.data ?? fallback
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data) {
      const body = error.response.data as BaseResponse<RefreshTokenResponse>
      if (body.data) return body.data
      return { ...fallback, message: body.error?.message ?? '換發權杖失敗' }
    }
    return { ...fallback, message: '網路異常，請稍後再試' }
  }
}

/** 登出，撤銷目前登入用戶的刷新權杖 */
export async function logout(): Promise<ResponseStructure<LogoutResponse>> {
  return request<LogoutResponse>({
    url: `${BASE_API_URL}/logout`,
    method: 'POST',
  })
}

/**
 * 生效角色的模式
 *
 * 由伺服器端決定，前端只能讀不能指定：若讓呼叫端自由指定生效角色，稽核模式形同虛設。
 * unknown 是後端設定漏填或填錯時的值，一律當成 audit 處理。
 */
export type PermissionMode = 'audit' | 'union' | 'unknown'

/** 權限種類，對應權限節點的四個布林欄位 */
export type PermissionType = 'canAccess' | 'canCreate' | 'canUpdate' | 'canDelete'

/** 授權狀態內的角色 */
export interface AuthorizationRoleResponse {
  /** 唯一編號 */
  id: string
  /** 角色名稱 */
  name: string
}

/** 授權狀態內的單筆資源權限 */
export interface AuthorizationPermissionResponse {
  /** 資源唯一編號 */
  resourceId: string
  /** 父資源唯一編號；第一層為 null */
  parentId: string | null
  /** 資源名稱，完整路徑（例：系統管理>用戶管理），與路由 meta.resourceName 同格式 */
  resourceName: string
  /** 資源層級 (1:一層, 2:二層, 3:三層) */
  level: number
  /** 顯示順序 */
  displayOrder: number
  /** 訪問權限 */
  canAccess: boolean
  /** 新增權限 */
  canCreate: boolean
  /** 修改權限 */
  canUpdate: boolean
  /** 刪除權限 */
  canDelete: boolean
  /** 子層級的資源權限 */
  children: AuthorizationPermissionResponse[]
}

/** 當前登入者的授權狀態 */
export interface CurrentAuthorizationResponse {
  /** 生效角色的模式 */
  permissionMode: PermissionMode
  /** 該用戶擁有的全部角色，角色切換選單的來源 */
  roles: AuthorizationRoleResponse[]
  /** 目前生效的角色，權限依這些角色判斷 */
  activeRoles: AuthorizationRoleResponse[]
  /** 生效角色的權限樹（多角色取聯集），依 displayOrder 排序 */
  permissions: AuthorizationPermissionResponse[]
}

/** 變更生效角色請求 */
export interface SetActiveRolesRequest {
  /** 要生效的角色唯一編號，必須是該用戶已被指派角色的子集 */
  roleIds: string[]
}

/** 變更生效角色回應 */
export interface SetActiveRolesResponse {
  /** 認證狀態 */
  authStatus: AuthStatus
  /** 回應訊息，供顯示用 */
  message: string | null
  /** 令牌類型，成功時固定為 Bearer */
  tokenType: string | null
  /** 換發後的存取權杖，成功時提供；必須用它取代原有的存取權杖 */
  accessToken: string | null
  /** 變更後生效的角色 */
  activeRoles: AuthorizationRoleResponse[]
}

/**
 * 查詢當前登入者的授權狀態
 * @description
 * 回傳前端決定選單顯示與角色切換所需的一切：模式、可選角色、生效角色與權限樹。
 * 這支只要求登入，任何登入者都能查自己的權限；admin-roles 那支需要角色管理權限，一般用戶拿不到。
 * @returns 當前授權狀態
 */
export async function getCurrentAuthorization(): Promise<ResponseStructure<CurrentAuthorizationResponse>> {
  return request<CurrentAuthorizationResponse>({
    url: `${BASE_API_URL}/authorization`,
    method: 'GET',
  })
}

/**
 * 變更生效角色
 * @description
 * 會換發存取權杖，呼叫成功後必須用回應的 accessToken 取代原有的，否則後端仍以舊的生效角色判斷權限。
 * 不輪替刷新權杖。目標角色須為該用戶已被指派角色的子集（允許自願降權）；稽核模式下只能給一個。
 * @param data 要生效的角色唯一編號
 * @returns 換發後的存取權杖與生效角色
 */
export async function setActiveRoles(data: SetActiveRolesRequest): Promise<ResponseStructure<SetActiveRolesResponse>> {
  return request<SetActiveRolesResponse>({
    url: `${BASE_API_URL}/active-roles`,
    method: 'PUT',
    data,
  })
}
