import type { RouteRecordRaw } from 'vue-router'

/**
 * 內容管理路由
 *
 * 目前全部指向佔位頁，用來展示三層選單的版面；接上真實頁面時逐一替換 component。
 */
export const contentRoutes: RouteRecordRaw = {
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
}
