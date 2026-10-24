import { createRouter, createWebHistory, type RouteLocationNormalizedLoaded } from 'vue-router'
import { allRoutes } from '@/router/routes'
import { siteHooks } from '@/config/siteHooks'
import { useUserStore } from '@/stores/useUser'
import { useLogger } from '@/composables/useLogger'
import type { MenuTitleKey } from '@/locale'
import type { PermissionAction } from '@/types/permission'

/** 定義路由元訊息 */
declare module 'vue-router' {
  interface RouteMeta {
    /** 選單標題，填語系檔 menu 底下的 key（慣例用路由 name）；沒設定或是空值就不會出現在選單 */
    title?: MenuTitleKey | ''
    /** 顯示圖示 */
    icon?: string
    /** 是否需要驗證 */
    requiresAuth?: boolean
    /** 要求的資源代碼，對應後端端點要求的權限，由 siteHooks.canAccess 判斷；沒設定代表登入即可進入 */
    resourceCode?: string
    /** 要求的操作，預設為檢視；新增頁、編輯頁分別要求新增、修改，直接輸入網址也進不去 */
    permissionAction?: PermissionAction
  }
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: allRoutes,
})

const logger = useLogger({ prefix: 'Router', enabled: import.meta.env.DEV })

/**
 * 路由守衛
 *
 * 先做站別檢查（siteHooks.prepareNavigation，例如網址所屬單位不存在導 404），
 * 再三段：未驗證導向登入頁、已驗證時登入頁導回上一頁、沒有該頁的資源權限時導向 403。
 * 登入頁、首頁與 403 頁的位置由 siteHooks 提供。權限只是讓畫面不顯示用不到的功能，真正的把關在後端每個端點
 */
router.beforeEach(async (to, from) => {
  const siteRedirect = await siteHooks.prepareNavigation(to)
  if (siteRedirect !== undefined) {
    logger.warn('站別檢查不通過，改導向', { 目標路由: to.path })
    return siteRedirect
  }

  const userStore = useUserStore()

  if (to.meta.requiresAuth && !userStore.isAuthenticated) {
    logger.warn('未驗證，導向登入頁', { 目標路由: to.path })
    return siteHooks.loginLocation(to)
  }

  if (to.name === 'login' && userStore.isAuthenticated) {
    logger.debug('已驗證，登入頁導回上一頁')
    return from.name ? { name: from.name } : siteHooks.homeLocation(to)
  }

  if (to.meta.requiresAuth && !isRouteAccessible(to)) {
    logger.warn('沒有資源權限，導向 403', { 目標路由: to.path, 資源代碼: to.meta.resourceCode, 操作: to.meta.permissionAction })
    return siteHooks.forbiddenLocation(to)
  }
})

/**
 * 目前使用者能不能進入這個路由
 *
 * meta 沿 matched 由父到子合併，資源代碼一律標在葉節點的路由上
 * @param route 路由位置
 * @returns 沒有要求資源權限，或站別判斷（siteHooks.canAccess）放行對應的操作時為 true
 */
export function isRouteAccessible(route: RouteLocationNormalizedLoaded): boolean {
  const resourceCode = route.meta.resourceCode
  if (resourceCode === undefined) return true

  return siteHooks.canAccess(resourceCode, route.meta.permissionAction ?? 'canAccess')
}

export default router
