import { computed } from 'vue'
import type { SiteHooks } from '@/config/siteTypes'
import { useAuthentication } from '@/composables/useAuthentication'
import { refresh } from '@/services/auth/authService'
import { useUserStore } from '@/stores/useUser'

/** nexus 後台的站別行為，各函式的用途見 siteTypes.ts */
export const siteHooks: SiteHooks = {
  canAccess(resourceCode, action = 'canAccess') {
    return useUserStore().hasPermission(resourceCode, action)
  },
  runSiteStartup() {
    // localStorage 裡的權限是上次登入或切換角色時留下的，重新整理後補拉一次。
    // 不等結果：選單先用舊資料畫出來，拉到新的再自動更新；失敗就沿用舊的
    if (useUserStore().isAuthenticated) {
      useAuthentication().loadAuthorization()
    }
  },
  useLoginSubtitle() {
    return computed(() => '')
  },
  async refreshTokens(tokens) {
    const response = await refresh(tokens)
    if (response.authStatus !== 'success' || response.accessToken === null || response.refreshToken === null) return null

    return { accessToken: response.accessToken, refreshToken: response.refreshToken }
  },
  loginLocation() {
    return { name: 'login' }
  },
  homeLocation() {
    return { name: 'home' }
  },
  forbiddenLocation() {
    return { name: 'error403' }
  },
  prepareNavigation() {
    // nexus 後台沒有網址所屬單位這一層，不必先檢查
    return Promise.resolve(undefined)
  },
}
