import type { RouteRecordRaw } from 'vue-router'

/**
 * 系統管理路由
 *
 * 列表頁是選單項目，帶 title 與 icon；只從列表進入的頁面一律不設 title，
 * 選單來源 menuRoutes 會把沒有 title 的節點整支剔掉，因此不會出現在選單上。
 *
 * requiresAuth 只掛在 MainLayout 一層，這裡不重複——to.meta 會沿 matched 由父到子合併。
 * resourceCode 對應後端端點的 RequirePermission，一律標在葉節點；新增、編輯頁另外要求新增、修改權限
 */
export const systemRoutes: RouteRecordRaw = {
  path: 'system-management',
  name: 'systemManagement',
  redirect: { name: 'home' },
  meta: { title: 'systemManagement', icon: 'mdi-cog' },
  children: [
    // 用戶管理
    {
      path: 'users',
      name: 'userManagementList',
      meta: { title: 'userManagementList', icon: 'mdi-account-circle', resourceCode: 'admin_users' },
      component: () => import('@/pages/AdminUserManagement/AdminUserManagementList.vue'),
    },
    {
      path: 'users/new',
      name: 'userManagementAdd',
      meta: { resourceCode: 'admin_users', permissionAction: 'canCreate' },
      component: () => import('@/pages/AdminUserManagement/AdminUserManagementAdd.vue'),
    },
    {
      path: 'users/:userId',
      name: 'userManagementView',
      meta: { resourceCode: 'admin_users' },
      component: () => import('@/pages/AdminUserManagement/AdminUserManagementView.vue'),
    },
    {
      path: 'users/:userId/edit',
      name: 'userManagementEdit',
      meta: { resourceCode: 'admin_users', permissionAction: 'canUpdate' },
      component: () => import('@/pages/AdminUserManagement/AdminUserManagementEdit.vue'),
    },

    // 角色管理
    {
      path: 'roles',
      name: 'roleManagementList',
      meta: { title: 'roleManagementList', icon: 'mdi-account-group', resourceCode: 'admin_roles' },
      component: () => import('@/pages/AdminRoleManagement/AdminRoleManagementList.vue'),
    },
    {
      path: 'roles/new',
      name: 'roleManagementAdd',
      meta: { resourceCode: 'admin_roles', permissionAction: 'canCreate' },
      component: () => import('@/pages/AdminRoleManagement/AdminRoleManagementAdd.vue'),
    },
    {
      path: 'roles/:roleId',
      name: 'roleManagementView',
      meta: { resourceCode: 'admin_roles' },
      component: () => import('@/pages/AdminRoleManagement/AdminRoleManagementView.vue'),
    },
    {
      path: 'roles/:roleId/edit',
      name: 'roleManagementEdit',
      meta: { resourceCode: 'admin_roles', permissionAction: 'canUpdate' },
      component: () => import('@/pages/AdminRoleManagement/AdminRoleManagementEdit.vue'),
    },

    // 選單設定
    {
      path: 'menu-settings',
      name: 'menuSettingsList',
      meta: { title: 'menuSettingsList', icon: 'mdi-file-tree', resourceCode: 'admin_resources' },
      component: () => import('@/pages/AdminResourceManagement/AdminResourceManagementList.vue'),
    },
  ],
}
