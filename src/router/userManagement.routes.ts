import type { RouteRecordRaw } from 'vue-router'

/**
 * 用戶管理的非選單頁面
 *
 * 列表頁是選單項目，定義在 routes.ts 的 featureRoutes；新增／編輯／檢視只從列表進入，
 * 放在這裡是因為選單直接展開 featureRoutes 的每個子路由、不會依 meta.title 過濾。
 */
export const userManagementRoutes: RouteRecordRaw[] = [
  {
    path: 'system-management/users/new',
    name: 'userManagementAdd',
    meta: { resourceName: '系統管理>用戶管理' },
    component: () => import('@/pages/UserManagement/UserManagementAdd.vue'),
  },
  {
    path: 'system-management/users/:userId',
    name: 'userManagementView',
    meta: { resourceName: '系統管理>用戶管理' },
    component: () => import('@/pages/UserManagement/UserManagementView.vue'),
  },
  {
    path: 'system-management/users/:userId/edit',
    name: 'userManagementEdit',
    meta: { resourceName: '系統管理>用戶管理' },
    component: () => import('@/pages/UserManagement/UserManagementEdit.vue'),
  },
]
