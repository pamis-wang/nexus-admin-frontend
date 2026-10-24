import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { i18n } from '@/plugins/i18n'
import { useUserStore } from '@/stores/useUser'
import { isRouteAccessible } from '@/router'
import {
  getCurrentAuthorization,
  login as loginRequest,
  logout as logoutRequest,
  setActiveRoles,
  type AuthorizationRoleResponse,
} from '@/services/auth/authService'
import type { ResponseStructure } from '@/services/axiosService'

/** 登入結果 */
export interface LoginResult {
  /** 是否成功 */
  success: boolean
  /** 顯示用訊息，成功時為空字串 */
  message: string
}

/** 變更生效角色的結果 */
export interface ChangeActiveRolesResult {
  /** 是否成功 */
  success: boolean
  /** 顯示用訊息 */
  message: string
}

/** 認證相關操作：登入、登出、授權狀態與生效角色 */
export function useAuthentication() {
  const router = useRouter()
  const userStore = useUserStore()

  const isLoggingIn = ref(false)
  const isLoggingOut = ref(false)
  const isChangingRoles = ref(false)

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

      return { success: false, message: response.message ?? i18n.global.t('auth.login.failed') }
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
   *
   * 切換後目前所在的頁面若已經沒有權限就導向 403，留在原地會看到自己無權操作的畫面
   * @param roleIds 要生效的角色唯一編號，須為自己已被指派角色的子集
   * @returns 結果與顯示用訊息；成功時訊息為目前生效的角色
   */
  async function changeActiveRoles(roleIds: string[]): Promise<ChangeActiveRolesResult> {
    isChangingRoles.value = true
    try {
      const response = await setActiveRoles({ roleIds })
      const data = response.result.data

      if (response.success && data?.authStatus === 'success' && data.accessToken) {
        // 後端換發了存取權杖；沒換掉的話後續請求仍以舊的生效角色判斷權限
        await userStore.updateAccessToken(data.accessToken)
        await loadAuthorization()

        if (!isRouteAccessible(router.currentRoute.value)) {
          await router.push({ name: 'error403' })
        }

        // 切換後選單與可進入的頁面都會變，沒有回饋使用者不會知道這次點擊生效了；
        // 角色以變更回應為準，授權狀態查詢失敗時 store 裡的還是切換前的角色
        return { success: true, message: i18n.global.t('auth.activeRole.switched', { roles: describeActiveRoles(data.activeRoles) }) }
      }

      return { success: false, message: data?.message ?? i18n.global.t('auth.activeRole.changeFailed') }
    } catch (error) {
      const failure = error as ResponseStructure<null>

      if (failure.status === 403) {
        return { success: false, message: failure.errorMessage || i18n.global.t('auth.activeRole.notAssigned') }
      }

      return { success: false, message: failure.errorMessage || i18n.global.t('auth.activeRole.changeFailedRetry') }
    } finally {
      isChangingRoles.value = false
    }
  }

  /**
   * 生效角色的顯示名稱，多個角色以頓號串接
   * @param activeRoles 生效角色
   * @returns 顯示名稱
   */
  function describeActiveRoles(activeRoles: AuthorizationRoleResponse[]): string {
    return activeRoles.map((role) => role.name).join(i18n.global.t('auth.activeRole.separator')) || i18n.global.t('auth.activeRole.none')
  }

  return {
    isLoggingIn,
    isLoggingOut,
    isChangingRoles,
    login,
    logout,
    loadAuthorization,
    changeActiveRoles,
  }
}
