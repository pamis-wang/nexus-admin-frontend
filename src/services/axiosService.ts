import axios, { AxiosError, type AxiosInstance, type AxiosRequestConfig, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import { useUserStore } from '@/stores/useUser'
import { useLogger } from '@/composables/useLogger'
import router from '@/router'
import { refresh } from '@/services/auth/authService'

// ==================== 回應型別定義 ====================

/**
 * 統一的回應格式介面
 * @template TResponse - 回應資料的型別
 */
export interface ResponseStructure<TResponse> {
  /** 後端標準回應結構，包含 data 和 error */
  result: BaseResponse<TResponse>
  /** HTTP 狀態碼（例如：200, 404, 500） */
  status: number
  /** HTTP 狀態文字（例如：OK, Not Found, Internal Server Error） */
  statusText: string
  /** 請求是否成功（HTTP 狀態碼為 2xx 時為 true） */
  success: boolean
  /** 統一的錯誤訊息，來自後端錯誤或網路錯誤 */
  errorMessage?: string
  /** 回應時間戳記（毫秒），用於除錯和追蹤 */
  timestamp: number
  /** 原始請求的 URL，用於追蹤和除錯 */
  requestUrl?: string
  /** 回應的 HTTP headers，用於存取中繼資料（如分頁資訊、快取控制等） */
  headers?: Record<string, string>
}

/**
 * 後端標準回應結構
 * @description data 和 error 二擇一，不會同時存在
 * @template T - 資料的型別
 */
export interface BaseResponse<T> {
  /** 成功時的回應資料，失敗時為 null */
  data: T | null
  /** 失敗時的錯誤資訊，成功時為 null */
  error: ErrorResponse | null
}

/**
 * 後端錯誤回應結構
 * @description 統一的錯誤格式，包含錯誤代碼和訊息
 */
export interface ErrorResponse {
  /** 錯誤代碼（通常為 HTTP 狀態碼） */
  code: number
  /** 錯誤訊息，描述錯誤的詳細資訊 */
  message: string
}

/**
 * 新增資料回應結構
 * @description 用於 POST 請求成功後的回應
 */
export interface CreatedResponse {
  /** 新增資料的唯一編號 */
  id: string | null
  /**
   * 資料建立時間 - ISO 8601 格式
   * @example "2025-06-09T07:19:07.2128455+00:00"
   */
  createdAt: string | null
}

/**
 * 更新資料回應結構
 * @description 用於 PUT/PATCH 請求成功後的回應
 */
export interface UpdatedResponse {
  /** 更新資料的唯一編號 */
  id: string | null
  /**
   * 資料更新時間 - ISO 8601 格式
   * @example "2025-06-09T07:19:07.2128455+00:00"
   */
  updatedAt: string | null
}

/**
 * 上傳檔案回應結構
 * @description 用於檔案上傳成功後的回應
 */
export interface UploadedResponse {
  /** 上傳檔案的唯一編號 */
  id: string | null
  /** 上傳檔案的存取連結 URL */
  link: string | null
  /**
   * 檔案上傳時間 - ISO 8601 格式
   * @example "2025-06-09T07:19:07.2128455+00:00"
   */
  updatedAt: string | null
}

/**
 * 刪除資料回應結構
 * @description 用於 DELETE 請求成功後的回應
 */
export interface DeletedResponse {
  /** 是否成功刪除資料 */
  success: boolean
  /** 受影響的記錄數量（刪除的筆數） */
  record: number
}

// ==================== Token 刷新佇列 ====================

/** 是否正在刷新 Token */
let isRefreshing = false

/** 是否正在強制登出中 */
let isLoggingOut = false

/** 等待 Token 刷新的請求佇列 */
let refreshSubscribers: Array<(token: string) => void> = []

/** 將請求加入佇列，等待新 Token */
function subscribeTokenRefresh(callback: (token: string) => void) {
  refreshSubscribers.push(callback)
}

/** Token 刷新成功後，通知所有等待中的請求 */
function onTokenRefreshed(newToken: string) {
  refreshSubscribers.forEach((callback) => callback(newToken))
  refreshSubscribers = []
}

/** 強制登出（刷新失敗時） */
async function forceLogout() {
  if (isLoggingOut) return
  isLoggingOut = true
  const userStore = useUserStore()
  await userStore.clearUser()
  try {
    await router.push({ name: 'login' })
  } finally {
    isLoggingOut = false
  }
}

// ==================== Axios 實例 ====================

/**共用的 Axios 實體包含專案預設設定 */
const axiosService: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 30000,
})

/** 日誌實體設定 */
const logger = useLogger({
  prefix: 'AxiosService',
  enabled: true,
  minLevel: import.meta.env.VITE_LOG_LEVEL ? 'info' : 'warn',
})

/**
 * 請求攔截 - 自動為每個請求添加 Bearer token
 */
axiosService.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const userStore = useUserStore()
    const token = userStore.accessToken

    logger.debug('請求位址:', config.url)
    logger.debug('完整位址:', (config.baseURL ?? '') + config.url)

    if (token) {
      config.headers.Authorization = `Bearer ${token}`
      logger.debug('已附加 Token 至請求')
    } else {
      logger.debug('請求期間未找到 Token；繼續進行但不包含驗證標頭')
    }

    return config
  },
  (error: AxiosError) => {
    logger.error('請求錯誤:', error)
    return Promise.reject(error)
  },
)

/**
 * 回應攔截 - 統一回應處理
 */
axiosService.interceptors.response.use(
  // HTTP 狀態碼為 2xx 時執行（成功）
  (response: AxiosResponse) => {
    return response
  },
  // HTTP 狀態碼非 2xx 時執行（錯誤）
  async (error: AxiosError<BaseResponse<null>>) => {
    // login／refresh 的回應形狀由 authService 自行解析（HTTP 狀態碼隨 authStatus 變動、data 不可靠推斷成功失敗），
    // 攔截器不做任何轉換，直接把原始錯誤丟回去，避免真正的回應內容被這裡的錯誤處理邏輯蓋掉
    const requestUrl = error.config?.url ?? ''
    if (requestUrl.endsWith('/admin-auth/login') || requestUrl.endsWith('/admin-auth/refresh')) {
      return Promise.reject(error)
    }

    // 若正在登出中，靜默忽略所有錯誤（避免登出後飛行中的請求觸發錯誤視窗）
    if (isLoggingOut) return new Promise(() => {})

    // 提取錯誤資訊
    const status = error.response?.status ?? 0 // HTTP status
    const responseData = error.response?.data

    // 檢查是否為標準的 BaseResponse 格式
    const isBaseResponse = responseData && 'error' in responseData && 'data' in responseData
    const backendError = isBaseResponse ? (responseData as BaseResponse<null>).error : null

    // 處理錯誤訊息
    const errorMessage = backendError?.message || error.message

    if (error.response) {
      switch (status) {
        case 400:
          logger.error('錯誤請求 (400):', errorMessage)
          break
        case 401:
          logger.warn('未授權 (401)，嘗試刷新 Token:', errorMessage)
          {
            const userStore = useUserStore()
            const currentAccessToken = userStore.accessToken
            const currentRefreshToken = userStore.refreshToken

            // 若無 Refresh Token，直接登出
            if (!currentRefreshToken) {
              logger.error('無 Refresh Token，強制登出')
              await forceLogout()
              return new Promise(() => {})
            }

            // 若已在刷新中，將此請求加入佇列等待
            if (isRefreshing) {
              return new Promise<AxiosResponse>((resolve, reject) => {
                subscribeTokenRefresh((newToken: string) => {
                  if (error.config) {
                    error.config.headers.Authorization = `Bearer ${newToken}`
                    resolve(axiosService.request(error.config))
                  } else {
                    reject(error)
                  }
                })
              })
            }

            // 開始刷新 Token
            isRefreshing = true
            try {
              const refreshResult = await refresh({
                accessToken: currentAccessToken ?? '',
                refreshToken: currentRefreshToken,
              })

              if (refreshResult.authStatus === 'success' && refreshResult.accessToken && refreshResult.refreshToken) {
                const newAccessToken = refreshResult.accessToken
                const newRefreshToken = refreshResult.refreshToken
                userStore.updateTokens(newAccessToken, newRefreshToken)
                logger.info('Token 刷新成功，重試原始請求')

                // 通知佇列中的所有請求
                onTokenRefreshed(newAccessToken)
                isRefreshing = false

                // 重試原始請求
                if (error.config) {
                  error.config.headers.Authorization = `Bearer ${newAccessToken}`
                  return axiosService.request(error.config)
                }
              } else {
                logger.error('Token 刷新失敗，強制登出:', refreshResult.message)
                isRefreshing = false
                refreshSubscribers = []
                await forceLogout()
                return new Promise(() => {})
              }
            } catch {
              logger.error('Token 刷新過程發生錯誤，強制登出')
              isRefreshing = false
              refreshSubscribers = []
              await forceLogout()
              return new Promise(() => {})
            }
          }
          break
        case 403:
          logger.error('禁止存取 (403):', errorMessage)
          break
        case 404:
          logger.error('找不到資源 (404):', errorMessage)
          break
        case 422:
          logger.error('無法處理的實體 (422):', errorMessage)
          break
        case 500:
          logger.error('伺服器內部錯誤 (500):', errorMessage)
          break
        default:
          logger.error(`未預期的錯誤 (${status}):`, errorMessage)
      }
    } else if (error.request) {
      // 請求已發出，但沒收到回應（網路錯誤、CORS 阻擋 401 回應、timeout）
      // 若有 Refresh Token，可能是後端 CORS 設定未在 401 加 headers，嘗試刷新 Token
      const userStore = useUserStore()
      const currentRefreshToken = userStore.refreshToken
      if (currentRefreshToken && error.config) {
        logger.warn('無回應錯誤，可能為 CORS 阻擋 401，嘗試刷新 Token:', error.message)
        if (!isRefreshing) {
          isRefreshing = true
          try {
            const refreshResult = await refresh({
              accessToken: userStore.accessToken ?? '',
              refreshToken: currentRefreshToken,
            })
            if (refreshResult.authStatus === 'success' && refreshResult.accessToken && refreshResult.refreshToken) {
              const newAccessToken = refreshResult.accessToken
              const newRefreshToken = refreshResult.refreshToken
              userStore.updateTokens(newAccessToken, newRefreshToken)
              onTokenRefreshed(newAccessToken)
              isRefreshing = false
              error.config.headers.Authorization = `Bearer ${newAccessToken}`
              return axiosService.request(error.config)
            } else {
              isRefreshing = false
              refreshSubscribers = []
              await forceLogout()
              return new Promise(() => {})
            }
          } catch {
            isRefreshing = false
            refreshSubscribers = []
            await forceLogout()
            return new Promise(() => {})
          }
        } else {
          return new Promise<AxiosResponse>((resolve, reject) => {
            subscribeTokenRefresh((newToken: string) => {
              if (error.config) {
                error.config.headers.Authorization = `Bearer ${newToken}`
                resolve(axiosService.request(error.config))
              } else {
                reject(error)
              }
            })
          })
        }
      }
      logger.error('網路錯誤或請求逾時:', error.message)
    } else {
      // 請求還沒發出就失敗（config 錯誤）
      logger.error('請求配置錯誤:', error.message)
    }

    // 建立統一的 ResponseStructure 錯誤物件
    const errorResponse: ResponseStructure<null> = {
      result: {
        data: null,
        error: backendError || { code: status, message: errorMessage },
      },
      status,
      statusText: error.response?.statusText || 'Error',
      success: false,
      errorMessage: errorMessage,
      timestamp: Date.now(),
      requestUrl: error.config?.url,
      headers: error.response?.headers as Record<string, string>,
    }

    // 拋出完整的 ResponseStructure 物件
    return Promise.reject(errorResponse)
  },
)

// =========================== API 請求函數 ===========================

/**
 * 標準 API 請求 - 返回完整 ResponseStructure
 *
 * **建議使用**：包含完整的 HTTP 狀態碼、data 和 error 資訊
 *
 * @returns ResponseStructure<T> 統一的回應格式
 * @example
 * const response = await request<User>({ method: 'GET', url: '/user' })
 * console.log(response.status)        // 200
 * console.log(response.statusText)    // "OK"
 * console.log(response.result.data)   // User object
 * console.log(response.result.error)  // null
 */
export async function request<T>(config: AxiosRequestConfig): Promise<ResponseStructure<T>> {
  const response = await axiosService.request<BaseResponse<T>>(config)
  return {
    result: response.data,
    status: response.status,
    statusText: response.statusText,
    success: response.status >= 200 && response.status < 300,
    errorMessage: response.data.error?.message,
    timestamp: Date.now(),
    requestUrl: config.url,
    headers: response.headers as Record<string, string>,
  }
}

/** 上傳進度資訊 */
export interface UploadProgress {
  /** 已上傳的位元組數 */
  loaded: number
  /** 檔案總位元組數 */
  total: number
  /** 上傳進度百分比 (0-100) */
  percentage: number
}

/**
 * 上傳檔案到預簽名 URL
 * @description 用於直接上傳檔案到 MinIO/S3 預簽名 URL，支援進度回調
 * @param presignedUrl 預簽名 URL
 * @param file 要上傳的檔案
 * @param onProgress 上傳進度回調函數
 * @returns Promise<void>
 * @throws Error 當上傳失敗時
 * @example
 * await uploadFileToPresignedUrl(url, file, ({ loaded, total, percentage }) => {
 *   console.log(`上傳進度: ${percentage}% (${loaded}/${total} bytes)`)
 * })
 */
export async function uploadFileToPresignedUrl(presignedUrl: string, file: File, onProgress?: (progress: UploadProgress) => void): Promise<void> {
  try {
    await axios.put(presignedUrl, file, {
      headers: {
        'Content-Type': file.type,
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percentage = Math.round((progressEvent.loaded / progressEvent.total) * 100)
          onProgress({
            loaded: progressEvent.loaded,
            total: progressEvent.total,
            percentage,
          })
        }
      },
    })
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`檔案上傳失敗: ${error.message}`)
    }
    throw new Error('檔案上傳失敗: 未知錯誤')
  }
}

export { axiosService }
export type { AxiosRequestConfig, AxiosResponse }
