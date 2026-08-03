import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/useUser'
import { login as loginRequest, logout as logoutRequest } from '@/services/auth/authService'

/** 登入結果 */
export interface LoginResult {
  /** 是否成功 */
  success: boolean
  /** 顯示用訊息，成功時為空字串 */
  message: string
}

/** 認證相關操作：登入、登出 */
export function useAuthentication() {
  const router = useRouter()
  const userStore = useUserStore()

  const isLoggingIn = ref(false)
  const isLoggingOut = ref(false)

  /** 登入，成功時寫入用戶狀態並導向首頁 */
  async function login(account: string, password: string): Promise<LoginResult> {
    isLoggingIn.value = true
    try {
      const response = await loginRequest({ account, password })

      if (response.authStatus === 'success' && response.accessToken && response.refreshToken && response.userProfile) {
        await userStore.storageUser(response.accessToken, response.refreshToken, response.userProfile)
        await router.push({ name: 'home' })
        return { success: true, message: '' }
      }

      return { success: false, message: response.message ?? '登入失敗，請稍後再試' }
    } finally {
      isLoggingIn.value = false
    }
  }

  /** 登出，撤銷刷新權杖並清空用戶狀態（撤銷失敗不影響登出流程） */
  async function logout(): Promise<void> {
    isLoggingOut.value = true
    try {
      await logoutRequest()
    } finally {
      await userStore.clearUser()
      await router.push({ name: 'login' })
      isLoggingOut.value = false
    }
  }

  return {
    isLoggingIn,
    isLoggingOut,
    login,
    logout,
  }
}
