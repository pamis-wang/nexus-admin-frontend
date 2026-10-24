import axios, { AxiosError, type AxiosInstance, type AxiosRequestConfig, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import { siteHooks } from '@/config/siteHooks'
import { useLogger } from '@/composables/useLogger'
import { translateBackendMessage } from '@/locale/backendMessages'
import { getLocale, i18n } from '@/plugins/i18n'
import router from '@/router'
import { createEventStreamParser, type EventStreamMessage } from '@/services/eventStreamParser'
import { useUserStore } from '@/stores/useUser'

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
  /** 統一的錯誤訊息，來自後端錯誤或網路錯誤；非 2xx 時已依目前語系轉成給使用者看的文字 */
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

// ==================== 權杖換發與強制登出 ====================

/**
 * 換發 Token 後重送的請求設定
 * @description 帶這個標記的請求再遇到 401 就不再換發，避免換發成功但請求仍被拒時無限重試
 */
interface RetriedRequestConfig extends InternalAxiosRequestConfig {
  /** 是否已經是換發 Token 後重送的請求 */
  isRetriedAfterRefresh?: boolean
}

/**
 * 進行中的換發
 *
 * 同時有多個請求遇到 401 時共用同一次換發：刷新 Token 換過一次就失效，各自換發的話只有第一個會成功，
 * 其餘的會失敗而把使用者登出
 */
let pendingRefresh: Promise<string | null> | null = null

/**
 * 是否正在強制登出
 *
 * 換發失敗後清除登入狀態、回登入頁的這段期間，其他請求的錯誤一律掛起不回：畫面馬上就要離開，不必再跳錯誤通知
 */
let isLoggingOut = false

/**
 * 不會有結果的 Promise
 * @description 強制登出時讓請求掛起，呼叫端的 catch 與錯誤通知都不會執行
 * @returns 永遠不會 resolve 或 reject 的 Promise
 */
function suspend<T>(): Promise<T> {
  return new Promise<T>(() => {})
}

/**
 * 以刷新 Token 換發新的一組 Token 並寫入 store
 * @description 換發端點與回應形狀各站不同，交給 siteHooks.refreshTokens
 * @returns 新的存取 Token；沒有刷新 Token 或換發失敗時回傳 null
 */
async function refreshTokens(): Promise<string | null> {
  const userStore = useUserStore()
  const refreshToken = userStore.refreshToken
  if (!refreshToken) {
    return null
  }

  const tokens = await siteHooks.refreshTokens({ accessToken: userStore.accessToken || '', refreshToken }).catch(() => null)
  if (tokens !== null) {
    await userStore.updateTokens(tokens.accessToken, tokens.refreshToken)
    logger.info('存取 Token 已換發')
    return tokens.accessToken
  }

  // 另一個分頁可能剛好先換發成功、把刷新 Token 輪替掉了，這裡才會失敗；
  // store 透過 localStorage 跨分頁同步，已經同步到新的 Token 就直接沿用，不必登出
  if (userStore.refreshToken && userStore.refreshToken !== refreshToken) {
    return userStore.accessToken
  }

  logger.warn('換發存取 Token 失敗，需要重新登入')
  return null
}

/**
 * 換發 Token；已有換發進行中時等待同一次的結果
 * @returns 新的存取 Token；換發失敗時回傳 null
 */
function refreshTokensOnce(): Promise<string | null> {
  if (pendingRefresh === null) {
    pendingRefresh = refreshTokens().finally(() => {
      pendingRefresh = null
    })
  }

  return pendingRefresh
}

/**
 * 是否為換發 Token 的請求
 * @param config 請求設定
 * @returns 是換發端點時為 true
 */
function isRefreshRequest(config: InternalAxiosRequestConfig): boolean {
  return config.url?.endsWith('/auth/refresh') ?? false
}

/**
 * 是否為登入或換發的請求
 *
 * 這兩個端點失敗時回非 2xx，但回應本體帶 authStatus 與 message，要原樣交給呼叫端判斷；
 * 登入回 401 代表密碼錯誤，不是存取 Token 過期，不能拿去換發
 * @param config 請求設定
 * @returns 是登入或換發端點時為 true
 */
function isAuthRequest(config: InternalAxiosRequestConfig | undefined): boolean {
  return (config?.url?.endsWith('/auth/login') ?? false) || (config !== undefined && isRefreshRequest(config))
}

/**
 * 清除登入狀態並回登入頁；已在登出中就不重複執行
 * @description 登入頁的位置要在清除之前取得：站別可能要讀登入時記下的資料（例如單位代碼）
 */
async function forceLogout() {
  if (isLoggingOut) {
    return
  }

  isLoggingOut = true
  try {
    const loginLocation = siteHooks.loginLocation(router.currentRoute.value)
    await useUserStore().clearUser()
    await router.push(loginLocation)
  } finally {
    isLoggingOut = false
  }
}

/**
 * 換發 Token 後重送遇到 401 的請求
 * @param config 遇到 401 的請求設定
 * @returns 重送的回應；不該換發或換發失敗時回傳 null
 */
async function retryWithRefreshedToken(config: RetriedRequestConfig | undefined): Promise<AxiosResponse | null> {
  // 換發端點失敗回 400 不會走到這裡；仍然排除它，萬一回了 401 也不會等自己的換發結果而卡死
  if (!config || config.isRetriedAfterRefresh || isRefreshRequest(config)) {
    return null
  }

  const userStore = useUserStore()

  // 送出時帶的已經不是目前的 Token：同一頁的其他請求或另一個分頁剛換發過，直接用目前的重送，不必再換發一次
  const isSentWithCurrentToken = config.headers.Authorization === `Bearer ${userStore.accessToken}`
  const accessToken = isSentWithCurrentToken ? await refreshTokensOnce() : userStore.accessToken
  if (!accessToken) {
    return null
  }

  config.isRetriedAfterRefresh = true
  config.headers.Authorization = `Bearer ${accessToken}`
  return axiosService.request(config)
}

// ==================== 錯誤訊息 ====================

/**
 * 將 axios 原始錯誤轉為使用者看得懂的訊息
 * @description 後端沒有提供錯誤訊息，或英文介面查不到後端訊息的對照時使用
 * @param error axios 錯誤
 * @param status HTTP 狀態碼；沒收到回應時為 0
 * @returns 依目前語系的通用說明
 */
function toFriendlyMessage(error: AxiosError, status: number): string {
  const { t } = i18n.global

  // 請求已送出但沒收到回應：斷網、CORS、逾時
  if (!error.response) {
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      return t('http.timeout')
    }
    return t('http.network')
  }

  switch (status) {
    case 400:
      return t('http.badRequest')
    case 401:
      return t('http.unauthorized')
    case 403:
      return t('http.forbidden')
    case 404:
      return t('http.notFound')
    case 422:
      return t('http.unprocessable')
    case 500:
      return t('http.server')
    default:
      return t('http.unexpected', { status })
  }
}

/**
 * 決定要顯示給使用者的錯誤訊息
 *
 * 後端訊息優先；但後端目前只回中文，英文介面查不到對照時改顯示通用訊息，不讓中文出現在英文介面上。
 * 查不到的原文記在 log，缺漏的對照才找得到。
 * @param backendMessage 後端回傳的錯誤訊息原文；可能沒有
 * @param error axios 錯誤
 * @param status HTTP 狀態碼；沒收到回應時為 0
 * @returns 要顯示的文字
 */
function toDisplayMessage(backendMessage: string | undefined, error: AxiosError, status: number): string {
  if (!backendMessage) {
    return toFriendlyMessage(error, status)
  }

  const translated = translateBackendMessage(backendMessage, getLocale())
  if (translated !== null) {
    return translated
  }

  logger.warn('後端錯誤訊息沒有英文對照，改顯示通用訊息:', backendMessage)
  return toFriendlyMessage(error, status)
}

/**
 * 取得錯誤回應的本體
 * @description 串流請求（requestEventStream）的錯誤回應本體也是 ReadableStream，要先讀成 JSON 才拿得到後端的錯誤訊息
 * @param data 錯誤回應的本體
 * @returns 後端標準回應結構；讀不出 JSON 時為 undefined
 */
async function readErrorResponseData(data: BaseResponse<null> | ReadableStream<Uint8Array> | undefined): Promise<BaseResponse<null> | undefined> {
  if (!(data instanceof ReadableStream)) {
    return data
  }

  try {
    return (await new Response(data).json()) as BaseResponse<null>
  } catch {
    return undefined
  }
}

// ==================== 攔截器 ====================

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
  }
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
    // 呼叫端以 AbortSignal 主動中斷的請求不是錯誤：不記 log，原樣拋出讓呼叫端以 signal.aborted 辨識
    if (axios.isCancel(error)) {
      return Promise.reject(error)
    }

    // 強制登出期間其他請求的錯誤一律掛起，避免回登入頁前又跳出錯誤通知
    if (isLoggingOut && !isAuthRequest(error.config)) {
      return suspend()
    }

    // 提取錯誤資訊
    const status = error.response?.status ?? 0 // HTTP status
    const responseData = await readErrorResponseData(error.response?.data)

    // 檢查是否為標準的 BaseResponse 格式；代理伺服器的錯誤頁（例如 502）本體是 HTML 字串，不能直接用 in 檢查
    const isBaseResponse = typeof responseData === 'object' && responseData !== null && 'error' in responseData && 'data' in responseData
    const backendError = isBaseResponse ? (responseData as BaseResponse<null>).error : null

    // 處理錯誤訊息：顯示用的依目前語系轉換，原始訊息保留給 logger
    const rawMessage = backendError?.message || error.message
    const errorMessage = toDisplayMessage(backendError?.message, error, status)

    // 登入與換發的失敗原因在回應本體裡，原樣交給呼叫端
    if (error.response && isAuthRequest(error.config) && isBaseResponse) {
      const authErrorResponse: ResponseStructure<null> = {
        result: responseData as BaseResponse<null>,
        status,
        statusText: error.response.statusText || 'Error',
        success: false,
        errorMessage,
        timestamp: Date.now(),
        requestUrl: error.config?.url,
        headers: error.response.headers as Record<string, string>,
      }
      return Promise.reject(authErrorResponse)
    }

    if (error.response) {
      switch (status) {
        case 400:
          logger.error('錯誤請求 (400):', rawMessage)
          break
        case 401: {
          // 存取 Token 過期：先以刷新 Token 換發再重送，使用者不必重新登入；換發不成才回登入頁。
          // 換發失敗是 400／403，不是 401，所以這裡分得出「該換發」與「該重新登入」
          const retriedResponse = await retryWithRefreshedToken(error.config)
          if (retriedResponse !== null) {
            return retriedResponse
          }

          // 換發不成：清除登入狀態、回登入頁；這個請求與其他還在等回應的請求都掛起不回
          logger.error('未授權 (401):', rawMessage)
          await forceLogout()
          return suspend()
        }
        case 403:
          logger.error('禁止存取 (403):', rawMessage)
          break
        case 404:
          logger.error('找不到資源 (404):', rawMessage)
          break
        case 422:
          logger.error('無法處理的實體 (422):', rawMessage)
          break
        case 500:
          logger.error('伺服器內部錯誤 (500):', rawMessage)
          break
        default:
          logger.error(`未預期的錯誤 (${status}):`, rawMessage)
      }
    } else if (error.request) {
      // 請求已發出，但沒收到回應（網路錯誤、CORS、timeout）；過期的存取 Token 一定收得到 401，這裡不換發
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
  }
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

/**
 * 簡化請求 - 自動解包，直接回傳 data
 *
 * **便捷使用**：會自動拋出業務邏輯錯誤（error），可直接使用資料無需檢查
 *
 * @throws Error 當 API 回傳業務邏輯錯誤時（HTTP 錯誤已由 interceptor 處理）
 * @example
 * const user = await requestData<User>({ method: 'GET', url: '/user' })
 * console.log(user.name) // 直接使用
 */
export async function requestData<T>(config: AxiosRequestConfig): Promise<T> {
  const response = await axiosService.request<BaseResponse<T>>(config)
  if (response.data.error) {
    throw new Error(response.data.error.message)
  }
  return response.data.data as T
}

/**
 * 取得 BaseResponse - 包含 data 和 error
 *
 * **手動處理錯誤時使用**：不自動拋出異常，需要手動判斷 data/error
 *
 * @returns BaseResponse<T> 後端標準回應結構
 * @example
 * const result = await requestBase<User>({ method: 'GET', url: '/user' })
 * if (result.error) {
 *   console.error('錯誤:', result.error.message)
 * } else {
 *   console.log('資料:', result.data)
 * }
 */
export async function requestBase<T>(config: AxiosRequestConfig): Promise<BaseResponse<T>> {
  const response = await axiosService.request<BaseResponse<T>>(config)
  return response.data
}

/**
 * 串流請求 - 讀取 Server-Sent Events，每收到一個事件就交給 onMessage，串流結束才 resolve
 *
 * 瀏覽器內建的 EventSource 帶不了 Authorization 標頭，XHR 又讀不了串流，所以改用 axios 的 fetch adapter 取得 ReadableStream；
 * token、錯誤訊息與 401 的處理都和其他請求相同，非 2xx 一樣拋出 ResponseStructure。
 *
 * 串流結束前 timeout 都在計時，產生時間長的串流要自行加大 config.timeout；要中斷時在 config.signal 帶 AbortSignal
 * @param config 請求設定
 * @param onMessage 每收到一個事件就呼叫
 * @example
 * await requestEventStream({ url: '/reason', method: 'GET', signal }, (message) => console.log(message.event, message.data))
 */
export async function requestEventStream(config: AxiosRequestConfig, onMessage: (message: EventStreamMessage) => void): Promise<void> {
  const response = await axiosService.request<ReadableStream<Uint8Array>>({ ...config, adapter: 'fetch', responseType: 'stream' })
  const reader = response.data.getReader()
  const decoder = new TextDecoder()
  const parser = createEventStreamParser(onMessage)

  let chunk = await reader.read()
  while (!chunk.done) {
    parser.push(decoder.decode(chunk.value, { stream: true }))
    chunk = await reader.read()
  }
  parser.push(decoder.decode())
  parser.end()
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
 * @throws Error 當上傳失敗時，message 是依目前語系給使用者看的說明
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
    // 預簽名 URL 指向物件儲存，錯誤回應不是後端的 BaseResponse，只依狀態碼給通用說明；原文記在 log
    if (!axios.isAxiosError(error)) {
      logger.error('檔案上傳失敗:', error)
      throw new Error(i18n.global.t('http.uploadFailed', { reason: i18n.global.t('common.unknownError') }))
    }

    logger.error('檔案上傳失敗:', error.message)
    throw new Error(i18n.global.t('http.uploadFailed', { reason: toFriendlyMessage(error, error.response?.status ?? 0) }))
  }
}

export { axiosService }
export type { AxiosRequestConfig, AxiosResponse }
