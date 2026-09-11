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
    meta: { title: '登入' },
    component: () => import('@/pages/Authentication/LoginPage.vue'),
  },
]

/** 功能頁面路由 */
export const featureRoutes: RouteRecordRaw[] = [
  {
    path: '',
    name: 'home',
    meta: { title: '首頁', icon: 'mdi-home', resourceName: '首頁' },
    component: () => import('@/pages/PlaceholderPage.vue'),
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

/** Catch All 路由必須單獨定義並放在最後 */
export const catchAllRoute: RouteRecordRaw = {
  path: '/:catchAll(.*)*',
  redirect: { name: 'home' },
}

/** 主要應用路由 */
export const mainRoutes: RouteRecordRaw[] = [
  {
    path: '/',
    component: () => import('@/layouts/MainLayout.vue'),
    meta: { requiresAuth: true },
    children: featureRoutes,
  },
]

export const allRoutes: RouteRecordRaw[] = [...authRoutes, ...mainRoutes, catchAllRoute]

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
