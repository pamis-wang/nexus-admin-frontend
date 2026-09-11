import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/useUser'
import { getCurrentAuthorization, login as loginRequest, logout as logoutRequest, setActiveRoles } from '@/services/auth/authService'
import type { ResponseStructure } from '@/services/axiosService'

/** 登入結果 */
export interface LoginResult {
  /** 是否成功 */
  success: boolean
  /** 顯示用訊息，成功時為空字串 */
  message: string
}

/** 變更生效角色的結果 */
export interface SwitchActiveRolesResult {
  /** 是否成功 */
  success: boolean
  /** 顯示用訊息，成功時為空字串 */
  message: string
}

/** 認證相關操作：登入、登出、授權狀態與生效角色 */
export function useAuthentication() {
  const router = useRouter()
  const userStore = useUserStore()

  const isLoggingIn = ref(false)
  const isLoggingOut = ref(false)
  const isSwitchingActiveRoles = ref(false)

  /** 登入，成功時寫入用戶狀態與授權狀態並導向首頁 */
  async function login(account: string, password: string): Promise<LoginResult> {
    isLoggingIn.value = true
    try {
      const response = await loginRequest({ account, password })

      if (response.authStatus === 'success' && response.accessToken && response.refreshToken && response.userProfile) {
        await userStore.storageUser(response.accessToken, response.refreshToken, response.userProfile)
        // 授權狀態要先備妥再導航，否則首頁這一步就會被權限守衛擋下
        await loadAuthorization()
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
    } catch {
      // 撤銷失敗不影響登出流程，仍繼續清空使用者狀態並導向登入頁
    } finally {
      await userStore.clearUser()
      await router.push({ name: 'login' })
      isLoggingOut.value = false
    }
  }

  /**
   * 取回授權狀態並寫入 store
   *
   * 登入後、App 掛載時與變更生效角色後都要呼叫。失敗不拋出：store 裡還有上次的權限可用，
   * 最終判斷仍在後端，畫面暫時沿用舊資料不會造成越權。
   * @returns 是否成功取得
   */
  async function loadAuthorization(): Promise<boolean> {
    try {
      const response = await getCurrentAuthorization()

      if (response.status === 200 && response.result.data) {
        await userStore.storageAuthorization(response.result.data)
        return true
      }

      return false
    } catch {
      return false
    }
  }

  /**
   * 變更生效角色
   * @param roleIds 要生效的角色唯一編號，須為自己已被指派角色的子集
   * @returns 結果與顯示用訊息
   */
  async function switchActiveRoles(roleIds: string[]): Promise<SwitchActiveRolesResult> {
    isSwitchingActiveRoles.value = true
    try {
      const response = await setActiveRoles({ roleIds })
      const data = response.result.data

      if (response.success && data?.authStatus === 'success' && data.accessToken) {
        // 後端換發了存取權杖；沒換掉的話後續請求仍以舊的生效角色判斷權限
        userStore.updateAccessToken(data.accessToken)
        await loadAuthorization()
        return { success: true, message: '' }
      }

      return { success: false, message: data?.message ?? '變更生效角色失敗' }
    } catch (error) {
      const failure = error as ResponseStructure<null>

      if (failure.status === 403) {
        return { success: false, message: failure.errorMessage || '無法變更為這組角色，請確認角色是否仍被指派給你。' }
      }

      return { success: false, message: failure.errorMessage || '變更生效角色失敗，請稍後再試' }
    } finally {
      isSwitchingActiveRoles.value = false
    }
  }

  return {
    isLoggingIn,
    isLoggingOut,
    isSwitchingActiveRoles,
    login,
    logout,
    loadAuthorization,
    switchActiveRoles,
  }
}
