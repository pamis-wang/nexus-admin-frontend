import type { RouteRecordRaw } from 'vue-router'
import { systemRoutes } from '@/router/system.routes'
import { contentRoutes } from '@/router/content.routes'

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
    meta: { title: 'home', icon: 'mdi-home', resourceName: '首頁' },
    component: () => import('@/pages/Home/HomeView.vue'),
  },
  systemRoutes,
  contentRoutes,
]

/**
 * 選單來源
 *
 * featureRoutes 同時是路由定義與選單定義，但兩者不等價：只從列表進入的頁面
 * （新增／檢視／編輯）必須註冊成路由，卻不該出現在選單。以 meta.title 區分，
 * 選單元件一律吃這棵樹，不要自己再過濾一次。
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

/**
 * 版面內的錯誤頁
 *
 * 403 只會發生在已登入的情況，放在版面內保留選單，使用者可以直接轉往有權限的功能。
 * 不設 title 所以不會進選單，也不設 resourceName 所以不會被權限守衛再擋一次。
 */
export const layoutErrorRoutes: RouteRecordRaw[] = [
  {
    path: 'error-403',
    name: 'error403',
    component: () => import('@/pages/Error/ErrorPage403.vue'),
  },
]

/** Catch All 路由必須單獨定義並放在最後 */
export const catchAllRoute: RouteRecordRaw = {
  path: '/:catchAll(.*)*',
  redirect: { name: 'error404' },
}

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
 * 依權限篩掉看不到的選單項目
 *
 * 分組節點（有子選單的那一層）本身不是可以進入的頁面，只看底下還剩不剩子項：
 * 全被擋掉、或 children 本來就是空陣列，就整組收起來，留一個點不進去的空群組沒有意義；
 * 反過來只要還有子項就保留，因為父層漏設權限而讓整組功能從選單消失太容易誤判。
 *
 * 葉節點則看自己有沒有訪問權限。沒有標權限欄位的節點一律顯示，與守衛的判斷一致。
 * 過渡期：權限樹還沒有資源代碼，傳給 canAccess 的是 meta.resourceName。
 *
 * 不做成 computed 放在本檔：這支在模組載入時就會被求值，那時 pinia 還沒安裝，
 * 拿不到 store。由選單元件各自包一層 computed 傳入判斷函式。
 * @param routes 選單樹，通常是 menuRoutes
 * @param canAccess 判斷某個資源有沒有檢視權限
 * @returns 篩選後的選單樹
 */
export function filterMenuRoutes(routes: RouteRecordRaw[], canAccess: (resourceCode: string) => boolean): RouteRecordRaw[] {
  const visibleItems: RouteRecordRaw[] = []

  for (const route of routes) {
    if (route.children !== undefined) {
      const children = filterMenuRoutes(route.children, canAccess)
      if (children.length > 0) {
        visibleItems.push({ ...route, children })
      }
      continue
    }

    const resourceName = route.meta?.resourceName
    if (resourceName === undefined || canAccess(resourceName)) {
      visibleItems.push(route)
    }
  }

  return visibleItems
}

/**
 * 遞迴篩出選單項目
 *
 * 沒有 meta.title 的節點整支剔除。父層把子項剔光後仍保留自己，
 * 由選單元件依 children 是否為空決定要當成一般項目還是可展開群組。
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
