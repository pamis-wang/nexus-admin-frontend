import type { RouteRecordRaw } from 'vue-router'

/**
 * 系統管理路由
 *
 * 列表頁是選單項目，帶 title 與 icon；新增／檢視／編輯只從列表進入，一律不設 title，
 * 選單來源 menuRoutes 會把沒有 title 的節點整支剔掉，因此不會出現在選單上。
 *
 * requiresAuth 只掛在 MainLayout 一層，這裡不重複——to.meta 會沿 matched 由父到子合併。
 * resourceName 則每一筆都要寫：非選單頁與列表頁屬於同一個資源，權限判斷才會一致。
 */
export const systemRoutes: RouteRecordRaw = {
  path: 'system-management',
  name: 'systemManagement',
  redirect: { name: 'home' },
  meta: { title: '系統管理', icon: 'mdi-cog', resourceName: '系統管理' },
  children: [
    // 用戶管理
    {
      path: 'users',
      name: 'userManagementList',
      meta: { title: '用戶管理', icon: 'mdi-account-circle', resourceName: '系統管理>用戶管理' },
      component: () => import('@/pages/AdminUserManagement/AdminUserManagementList.vue'),
    },
    {
      path: 'users/new',
      name: 'userManagementAdd',
      meta: { resourceName: '系統管理>用戶管理' },
      component: () => import('@/pages/AdminUserManagement/AdminUserManagementAdd.vue'),
    },
    {
      path: 'users/:userId',
      name: 'userManagementView',
      meta: { resourceName: '系統管理>用戶管理' },
      component: () => import('@/pages/AdminUserManagement/AdminUserManagementView.vue'),
    },
    {
      path: 'users/:userId/edit',
      name: 'userManagementEdit',
      meta: { resourceName: '系統管理>用戶管理' },
      component: () => import('@/pages/AdminUserManagement/AdminUserManagementEdit.vue'),
    },

    // 角色管理
    {
      path: 'roles',
      name: 'roleManagementList',
      meta: { title: '角色管理', icon: 'mdi-account-group', resourceName: '系統管理>角色管理' },
      component: () => import('@/pages/AdminRoleManagement/AdminRoleManagementList.vue'),
    },
    {
      path: 'roles/new',
      name: 'roleManagementAdd',
      meta: { resourceName: '系統管理>角色管理' },
      component: () => import('@/pages/AdminRoleManagement/AdminRoleManagementAdd.vue'),
    },
    {
      path: 'roles/:roleId',
      name: 'roleManagementView',
      meta: { resourceName: '系統管理>角色管理' },
      component: () => import('@/pages/AdminRoleManagement/AdminRoleManagementView.vue'),
    },
    {
      path: 'roles/:roleId/edit',
      name: 'roleManagementEdit',
      meta: { resourceName: '系統管理>角色管理' },
      component: () => import('@/pages/AdminRoleManagement/AdminRoleManagementEdit.vue'),
    },

    // 選單設定
    {
      // resourceName 對齊後端 AdminResourceSeed 的「系統管理>資源管理」（權限判斷鍵 admin_resources 綁在該筆），
      // 與畫面顯示的 title 刻意不同名
      path: 'menu-settings',
      name: 'menuSettingsList',
      meta: { title: '選單設定', icon: 'mdi-file-tree', resourceName: '系統管理>資源管理' },
      component: () => import('@/pages/AdminResourceManagement/AdminResourceManagementList.vue'),
    },
  ],
}
