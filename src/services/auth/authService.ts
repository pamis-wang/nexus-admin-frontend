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
