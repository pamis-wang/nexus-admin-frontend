import { computed } from 'vue'
import type { SiteHooks } from '@/config/siteTypes'
import { useAuthentication } from '@/composables/useAuthentication'
import { refresh } from '@/services/auth/authService'
import { useUserStore } from '@/stores/useUser'

/**
 * nexus 後台的站別行為，各函式的用途見 siteTypes.ts
 *
 * 過渡期：/api/auth/authorization 的權限樹還沒有 ResourceCode，resourceCode 參數目前收的是資源名稱路徑
 * （例：系統管理>用戶管理），與路由 meta.resourceName 同格式；後端補上 ResourceCode 後改成資源代碼
 */
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
    // 共用路由守衛才會呼叫；nexus 目前用自己的守衛，也沒有網址所屬單位這一層
    return Promise.resolve(undefined)
  },
}
