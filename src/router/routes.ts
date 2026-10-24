import type { RouteRecordRaw } from 'vue-router'
import { systemRoutes } from '@/router/system.routes'

/**
 * 路由配置主檔案
 *
 * 各功能領域的路由分別定義在 <領域>.routes.ts，本檔只負責組裝。
 */

/** 不須驗證就可使用的路由 */
export const authRoutes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    meta: { title: 'login' },
    component: () => import('@/pages/Authentication/LoginPage.vue'),
  },
]

/** 功能頁面路由 */
export const featureRoutes: RouteRecordRaw[] = [
  {
    path: '',
    name: 'home',
    meta: { title: 'home', icon: 'mdi-home' },
    component: () => import('@/pages/Home/HomeView.vue'),
  },
  systemRoutes,
]

/**
 * 選單來源
 *
 * featureRoutes 同時是路由定義與選單定義，但兩者不等價：只從列表進入的頁面
 * （新增／檢視／編輯）必須註冊成路由，卻不該出現在選單。以 meta.title 區分，
 * 選單元件一律吃這棵樹，不要自己再過濾一次。meta.title 填語系檔 menu 底下的 key，顯示時用 t(`menu.${title}`)
 */
export const menuRoutes: RouteRecordRaw[] = buildMenuRoutes(featureRoutes)

/**
 * 版面外的錯誤頁
 *
 * 404 不要求登入：打錯網址的人不一定登入，掛進版面會被守衛導去登入頁，反而看不到錯在哪。
 */
export const errorRoutes: RouteRecordRaw[] = [
  {
    path: '/error-404',
    name: 'error404',
    component: () => import('@/pages/Error/ErrorPage404.vue'),
  },
]

/** Catch All 路由必須單獨定義並放在最後 */
export const catchAllRoute: RouteRecordRaw = {
  path: '/:catchAll(.*)*',
  redirect: { name: 'error404' },
}

/**
 * 版面內的錯誤頁
 *
 * 403 只會發生在已登入的人身上，掛在版面裡保留選單，使用者可以直接改去有權限的頁面
 */
export const layoutErrorRoutes: RouteRecordRaw[] = [
  {
    path: 'error-403',
    name: 'error403',
    component: () => import('@/pages/Error/ErrorPage403.vue'),
  },
]

/** 主要應用路由 */
export const mainRoutes: RouteRecordRaw[] = [
  {
    path: '/',
    component: () => import('@/layouts/MainLayout.vue'),
    meta: { requiresAuth: true },
    children: [...featureRoutes, ...layoutErrorRoutes],
  },
]

export const allRoutes: RouteRecordRaw[] = [...authRoutes, ...errorRoutes, ...mainRoutes, catchAllRoute]

/**
 * 遞迴篩出選單項目
 *
 * 沒有 meta.title 的節點整支剔除。父層把子項剔光後仍保留自己（children 為空陣列），
 * filterMenuRoutes 會把它當成空群組整組隱藏——要出現在選單的頁面不要掛只從它進入的子路由。
 * @param routes 來源路由
 * @returns 只含選單項目的路由樹
 */
function buildMenuRoutes(routes: RouteRecordRaw[]): RouteRecordRaw[] {
  const menuItems: RouteRecordRaw[] = []

  for (const route of routes) {
    const title = route.meta?.title
    if (title === undefined || title === '') {
      continue
    }

    if (route.children === undefined) {
      menuItems.push(route)
      continue
    }

    menuItems.push({ ...route, children: buildMenuRoutes(route.children) })
  }

  return menuItems
}

/**
 * 依生效角色的權限篩出看得到的選單項目
 *
 * 一般項目（沒有 children）看自己的 meta.resourceCode，沒有標資源代碼的（首頁）一律顯示；
 * 群組（有 children，包含空陣列）只看底下還剩不剩項目，子項目全被篩掉或本來就沒有就整組不顯示，
 * 不另外看群組資源本身的權限——留一個點不進去的空群組沒有意義。
 *
 * 不做成 computed 放在本檔：這支在模組載入時還拿不到 store，由選單元件各自包一層 computed 傳入判斷函式
 * @param routes 選單來源（menuRoutes）
 * @param canAccess 判斷某個資源代碼有沒有檢視權限，選單元件傳 siteHooks.canAccess
 * @returns 看得到的選單樹
 */
export function filterMenuRoutes(routes: RouteRecordRaw[], canAccess: (resourceCode: string) => boolean): RouteRecordRaw[] {
  const visibleItems: RouteRecordRaw[] = []

  for (const route of routes) {
    if (route.children !== undefined) {
      const visibleChildren = filterMenuRoutes(route.children, canAccess)
      if (visibleChildren.length > 0) {
        visibleItems.push({ ...route, children: visibleChildren })
      }
      continue
    }

    const resourceCode = route.meta?.resourceCode
    if (resourceCode === undefined || canAccess(resourceCode)) {
      visibleItems.push(route)
    }
  }

  return visibleItems
}
