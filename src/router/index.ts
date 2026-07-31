import { createRouter, createWebHistory } from 'vue-router'
import { allRoutes } from '@/router/routes'

/** 定義路由元訊息 */
declare module 'vue-router' {
  interface RouteMeta {
    /** 顯示名稱，如果沒設定或是空值就不會出現在選單 */
    title?: string
    /** 顯示圖示 */
    icon?: string
    /** 要求資源名稱，用於多層選單判斷目前路由所屬的資源群組 */
    resourceName?: string
  }
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: allRoutes,
})

export default router
