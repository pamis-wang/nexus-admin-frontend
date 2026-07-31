import type { RouteRecordRaw } from 'vue-router'

/**
 * 路由配置主檔案
 *
 * 選單資料目前尚未串接後端頁面與權限系統，先以固定的假路由展示多層選單版面
 * （單層、二層、三層各一組），之後接上真實頁面時再逐一替換 component。
 */

/** 功能頁面路由 */
export const featureRoutes: RouteRecordRaw[] = [
  {
    path: '',
    name: 'home',
    meta: { title: '首頁', icon: 'mdi-home', resourceName: '首頁' },
    component: () => import('@/pages/PlaceholderPage.vue'),
  },
  {
    path: 'system-management',
    name: 'systemManagement',
    redirect: { name: 'home' },
    meta: { title: '系統管理', icon: 'mdi-cog', resourceName: '系統管理' },
    children: [
      {
        path: 'users',
        name: 'userManagementList',
        meta: { title: '使用者管理', icon: 'mdi-account-group', resourceName: '系統管理>使用者管理' },
        component: () => import('@/pages/PlaceholderPage.vue'),
      },
      {
        path: 'roles',
        name: 'roleManagementList',
        meta: { title: '角色管理', icon: 'mdi-shield-account', resourceName: '系統管理>角色管理' },
        component: () => import('@/pages/PlaceholderPage.vue'),
      },
    ],
  },
  {
    path: 'content-management',
    name: 'contentManagement',
    redirect: { name: 'home' },
    meta: { title: '內容管理', icon: 'mdi-file-document-multiple', resourceName: '內容管理' },
    children: [
      {
        path: 'articles',
        name: 'articleManagementList',
        meta: { title: '文章管理', icon: 'mdi-file-document-edit', resourceName: '內容管理>文章管理' },
        component: () => import('@/pages/PlaceholderPage.vue'),
      },
      {
        path: 'advanced-settings',
        name: 'advancedSettings',
        redirect: { name: 'home' },
        meta: { title: '進階設定', icon: 'mdi-tune', resourceName: '內容管理>進階設定' },
        children: [
          {
            path: 'categories',
            name: 'categorySettingsList',
            meta: { title: '分類設定', icon: 'mdi-shape', resourceName: '內容管理>進階設定>分類設定' },
            component: () => import('@/pages/PlaceholderPage.vue'),
          },
          {
            path: 'tags',
            name: 'tagSettingsList',
            meta: { title: '標籤設定', icon: 'mdi-tag-multiple', resourceName: '內容管理>進階設定>標籤設定' },
            component: () => import('@/pages/PlaceholderPage.vue'),
          },
        ],
      },
    ],
  },
]

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
    meta: {},
    children: [...featureRoutes],
  },
]

export const allRoutes: RouteRecordRaw[] = [...mainRoutes, catchAllRoute]
