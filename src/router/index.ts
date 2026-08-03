import { createRouter, createWebHistory } from 'vue-router'
import { allRoutes } from '@/router/routes'
import { useUserStore } from '@/stores/useUser'
import { useLogger } from '@/composables/useLogger'

/** 定義路由元訊息 */
declare module 'vue-router' {
  interface RouteMeta {
    /** 顯示名稱，如果沒設定或是空值就不會出現在選單 */
    title?: string
    /** 顯示圖示 */
    icon?: string
    /** 是否需要驗證 */
    requiresAuth?: boolean
    /** 要求資源名稱，用於多層選單判斷目前路由所屬的資源群組 */
    resourceName?: string
  }
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: allRoutes,
})

const logger = useLogger({ prefix: 'Router', enabled: import.meta.env.DEV })

/** 路由守衛：未驗證時導向登入頁，已驗證時登入頁導向首頁 */
router.beforeEach((to, from) => {
  const userStore = useUserStore()

  if (to.meta.requiresAuth && !userStore.isAuthenticated) {
    logger.warn('未驗證，導向登入頁', { 目標路由: to.path })
    return { name: 'login' }
  }

  if (to.name === 'login' && userStore.isAuthenticated) {
    logger.debug('已驗證，登入頁導向首頁')
    return { name: from.name ? from.name : 'home' }
  }
})

export default router
