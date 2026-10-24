import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import { i18n } from '@/plugins/i18n'
import { login, refresh } from '@/services/auth/authService'
import { axiosService } from '@/services/axiosService'

/** 原本的 adapter，測試結束後還原 */
const originalAdapter = axiosService.defaults.adapter

/**
 * 讓所有請求都回同一個回應；非 2xx 時比照真正的 adapter 丟出 AxiosError
 * @param status HTTP 狀態碼
 * @param data 回應本體
 */
function respondWith(status: number, data: unknown) {
  axiosService.defaults.adapter = (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
    const response: AxiosResponse = { data, status, statusText: String(status), headers: {}, config }
    if (status >= 200 && status < 300) {
      return Promise.resolve(response)
    }

    return Promise.reject(new AxiosError(`Request failed with status code ${status}`, AxiosError.ERR_BAD_REQUEST, config, {}, response))
  }
}

/** 讓所有請求都收不到回應（斷網、CORS） */
function failWithoutResponse() {
  axiosService.defaults.adapter = (config: InternalAxiosRequestConfig): Promise<AxiosResponse> =>
    Promise.reject(new AxiosError('Network Error', AxiosError.ERR_NETWORK, config, {}))
}

/**
 * 登入與換發失敗時後端回非 2xx，回應本體仍帶 authStatus 與 message；
 * axiosService 會把本體放進拋出的 ResponseStructure，這裡要從那裡取出，不能一律當成網路錯誤
 */
describe('authService 登入與換發失敗', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    axiosService.defaults.adapter = originalAdapter
  })

  it('登入密碼錯誤（401）時回傳回應本體的 authStatus 與 message', async () => {
    respondWith(401, {
      data: { authStatus: 'password_incorrect', message: '密碼錯誤', tokenType: null, accessToken: null, refreshToken: null, userProfile: null },
      error: null,
    })

    const result = await login({ account: 'admin', password: 'wrong' })

    expect(result.authStatus).toBe('password_incorrect')
    expect(result.message).toBe('密碼錯誤')
  })

  it('登入時回應本體不是預期形狀，改用轉好的錯誤訊息', async () => {
    respondWith(500, '<html>Bad Gateway</html>')

    const result = await login({ account: 'admin', password: 'secret' })

    expect(result.authStatus).toBe('validation_error')
    expect(result.message).toBe(i18n.global.t('http.server'))
  })

  it('登入時沒收到回應，帶網路錯誤的說明', async () => {
    failWithoutResponse()

    const result = await login({ account: 'admin', password: 'secret' })

    expect(result.authStatus).toBe('validation_error')
    expect(result.message).toBe(i18n.global.t('http.network'))
  })

  it('換發失敗（400）時回傳回應本體的 authStatus', async () => {
    respondWith(400, {
      data: { authStatus: 'token_invalid', message: '刷新權杖無效', tokenType: null, accessToken: null, refreshToken: null },
      error: null,
    })

    const result = await refresh({ accessToken: 'access-expired', refreshToken: 'refresh-revoked' })

    expect(result.authStatus).toBe('token_invalid')
    expect(result.accessToken).toBeNull()
  })
})
