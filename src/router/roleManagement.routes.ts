import type { RouteRecordRaw } from 'vue-router'

/**
 * 角色管理的非選單頁面
 *
 * 列表頁是選單項目，定義在 routes.ts 的 featureRoutes；新增／編輯／檢視只從列表進入，
 * 放在這裡是因為選單直接展開 featureRoutes 的每個子路由、不會依 meta.title 過濾，
 * 混在一起會讓選單多出三個沒有名字的項目。
 */
export const roleManagementRoutes: RouteRecordRaw[] = [
  {
    path: 'system-management/roles/new',
    name: 'roleManagementAdd',
    meta: { resourceName: '系統管理>角色管理' },
    component: () => import('@/pages/RoleManagement/RoleManagementAdd.vue'),
  },
  {
    path: 'system-management/roles/:roleId',
    name: 'roleManagementView',
    meta: { resourceName: '系統管理>角色管理' },
    component: () => import('@/pages/RoleManagement/RoleManagementView.vue'),
  },
  {
    path: 'system-management/roles/:roleId/edit',
    name: 'roleManagementEdit',
    meta: { resourceName: '系統管理>角色管理' },
    component: () => import('@/pages/RoleManagement/RoleManagementEdit.vue'),
  },
]
