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

/**
 * 路由守衛
 *
 * 三段：未驗證導向登入頁、已驗證時登入頁導回首頁、無資源權限導向 403。
 *
 * 權限判斷一律走 userStore.hasPermission，不另外包組合函式——守衛不在元件的 setup context 內，
 * 組合函式若在頂層呼叫 useRoute()／useRouter() 會 inject 不到東西。
 *
 * 這裡擋的只是畫面。每個端點的權限由後端各自驗證，前端擋不住的一樣進不了 API。
 */
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

  // 沒有 resourceName 的路由（登入頁、錯誤頁）不做權限檢查，否則 403 自己也會被擋而形成迴圈
  const resourceName = to.meta.resourceName
  if (to.meta.requiresAuth === true && resourceName !== undefined && !userStore.hasPermission(resourceName)) {
    logger.warn('無訪問權限，導向 403', { 資源: resourceName, 目標路由: to.path })
    return { name: 'error403' }
  }
})

export default router
