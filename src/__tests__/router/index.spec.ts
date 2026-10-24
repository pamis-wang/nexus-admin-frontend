import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { RouteRecordRaw } from 'vue-router'
import { useUserStore } from '@/stores/useUser'
import { filterMenuRoutes, menuRoutes } from '@/router/routes'
import router from '@/router'
import type { AuthorizationPermissionResponse } from '@/services/auth/authService'
import type { PermissionAction } from '@/types/permission'

/**
 * 遞迴收集路由名稱
 * @param routes 路由樹
 * @returns 樹內全部的路由名稱
 */
function collectRouteNames(routes: RouteRecordRaw[]): string[] {
  return routes.flatMap((route) => [String(route.name), ...(route.children ? collectRouteNames(route.children) : [])])
}

const mockUserProfile = {
  id: '1',
  account: 'admin',
  email: 'admin@example.com',
  fullName: null,
  roles: [],
}

/** nexus 後台全部的資源代碼 */
const ALL_RESOURCE_CODES = ['admin_users', 'admin_roles', 'admin_resources']

/**
 * 組出權限樹的一個節點
 * @param resourceCode 資源代碼
 * @param actions 有權限的操作
 */
function buildPermission(resourceCode: string, actions: PermissionAction[]): AuthorizationPermissionResponse {
  return {
    resourceId: `resource-${resourceCode}`,
    parentId: null,
    resourceName: resourceCode,
    resourceCode,
    level: 1,
    displayOrder: 0,
    canAccess: actions.includes('canAccess'),
    canCreate: actions.includes('canCreate'),
    canUpdate: actions.includes('canUpdate'),
    canDelete: actions.includes('canDelete'),
    children: [],
  }
}

/**
 * 登入並指定生效角色的權限
 * @param grants 各資源代碼有權限的操作；預設為全部資源的全部操作
 */
async function signIn(
  grants: Record<string, PermissionAction[]> = Object.fromEntries(
    ALL_RESOURCE_CODES.map((code) => [code, ['canAccess', 'canCreate', 'canUpdate', 'canDelete']])
  )
) {
  const userStore = useUserStore()
  await userStore.storageUser('access-token', 'refresh-token', mockUserProfile)
  await userStore.storageAuthorization({
    permissionMode: 'audit',
    roles: [{ id: 'role-1', name: '測試角色' }],
    activeRoles: [{ id: 'role-1', name: '測試角色' }],
    permissions: Object.entries(grants).map(([resourceCode, actions]) => buildPermission(resourceCode, actions)),
  })
}

describe('router 導航守衛', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    await useUserStore().clearUser()
  })

  it('未驗證時，需要驗證的路由會導向 login', async () => {
    await router.push({ name: 'home' })

    expect(router.currentRoute.value.name).toBe('login')
  })

  it('已驗證時，可以正常進入需要驗證的路由', async () => {
    await signIn()

    await router.push({ name: 'home' })

    expect(router.currentRoute.value.name).toBe('home')
  })

  it('已驗證時，訪問登入頁會導向首頁', async () => {
    await signIn()
    await router.push({ name: 'home' })

    await router.push({ name: 'login' })

    expect(router.currentRoute.value.name).toBe('home')
  })

  it('未驗證時，可以正常進入登入頁', async () => {
    await router.push({ name: 'login' })

    expect(router.currentRoute.value.name).toBe('login')
  })

  it('未驗證時，直接用路徑 / 導航會導向 login（不是用路由名稱導航）', async () => {
    await router.push('/')

    expect(router.currentRoute.value.name).toBe('login')
  })

  it('已驗證時，直接用路徑 / 導航可以正常進入首頁', async () => {
    await signIn()

    await router.push('/')

    expect(router.currentRoute.value.name).toBe('home')
  })

  it('首頁沒有標資源代碼，沒有任何權限也進得去', async () => {
    await signIn({})

    await router.push({ name: 'home' })

    expect(router.currentRoute.value.name).toBe('home')
  })
})

describe('router 資源權限', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    await useUserStore().clearUser()
    // 從中立的 404 頁出發：router 是共用的單例，停在同一個路由時再導航一次不會觸發守衛
    await router.push('/error-404')
  })

  it('有檢視權限時可以進入列表頁', async () => {
    await signIn({ admin_roles: ['canAccess'] })

    await router.push({ name: 'roleManagementList' })

    expect(router.currentRoute.value.name).toBe('roleManagementList')
  })

  it('沒有檢視權限時導向 403，而不是登入頁', async () => {
    await signIn({ admin_users: ['canAccess'] })

    await router.push({ name: 'roleManagementList' })

    expect(router.currentRoute.value.name).toBe('error403')
  })

  it('新增頁要求新增權限，只有檢視權限時直接輸入網址也進不去', async () => {
    await signIn({ admin_roles: ['canAccess'] })

    await router.push('/system-management/roles/new')

    expect(router.currentRoute.value.name).toBe('error403')
  })

  it('編輯頁要求修改權限，檢視頁只要檢視權限', async () => {
    await signIn({ admin_roles: ['canAccess'] })

    await router.push({ name: 'roleManagementView', params: { roleId: 'abc-123' } })
    expect(router.currentRoute.value.name).toBe('roleManagementView')

    await router.push({ name: 'roleManagementEdit', params: { roleId: 'abc-123' } })
    expect(router.currentRoute.value.name).toBe('error403')
  })

  it('選單設定看自己的資源代碼，與角色管理的權限分開', async () => {
    await signIn({ admin_roles: ['canAccess'] })

    await router.push({ name: 'roleManagementList' })
    expect(router.currentRoute.value.name).toBe('roleManagementList')

    await router.push({ name: 'menuSettingsList' })
    expect(router.currentRoute.value.name).toBe('error403')
  })

  it('新增用戶要求新增權限，編輯要求修改權限', async () => {
    await signIn({ admin_users: ['canAccess', 'canUpdate'] })

    await router.push({ name: 'userManagementAdd' })
    expect(router.currentRoute.value.name).toBe('error403')

    await router.push({ name: 'userManagementEdit', params: { userId: 'abc-123' } })
    expect(router.currentRoute.value.name).toBe('userManagementEdit')
  })

  it('403 頁本身不要求資源權限，沒有任何權限也看得到', async () => {
    await signIn({})

    await router.push({ name: 'error403' })

    expect(router.currentRoute.value.name).toBe('error403')
  })
})

describe('錯誤頁路由', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    await useUserStore().clearUser()
  })

  it('未登入時，不存在的網址導向 404 而不是登入頁', async () => {
    await router.push('/this-page-does-not-exist')

    expect(router.currentRoute.value.name).toBe('error404')
  })

  it('已登入時，不存在的網址一樣導向 404', async () => {
    await signIn()

    await router.push('/this-page-does-not-exist')

    expect(router.currentRoute.value.name).toBe('error404')
  })

  it('403 在版面內，未登入時會先被導去登入頁', async () => {
    await router.push({ name: 'error403' })

    expect(router.currentRoute.value.name).toBe('login')
  })
})

describe('路由網址', () => {
  it('網址解析到對應的路由名稱，靜態網址不會被動態參數吃掉', () => {
    const expectedNames: Array<[string, string]> = [
      ['/system-management/users', 'userManagementList'],
      ['/system-management/users/new', 'userManagementAdd'],
      ['/system-management/users/abc-123', 'userManagementView'],
      ['/system-management/users/abc-123/edit', 'userManagementEdit'],
      ['/system-management/roles', 'roleManagementList'],
      ['/system-management/roles/new', 'roleManagementAdd'],
      ['/system-management/roles/abc-123', 'roleManagementView'],
      ['/system-management/roles/abc-123/edit', 'roleManagementEdit'],
      ['/system-management/menu-settings', 'menuSettingsList'],
      ['/error-403', 'error403'],
    ]

    for (const [path, expectedName] of expectedNames) {
      expect(router.resolve(path).name).toBe(expectedName)
    }
  })

  it('檢視與編輯頁帶得到唯一編號', () => {
    expect(router.resolve('/system-management/users/abc-123').params).toEqual({ userId: 'abc-123' })
    expect(router.resolve('/system-management/roles/abc-123/edit').params).toEqual({ roleId: 'abc-123' })
  })
})

describe('選單來源 menuRoutes', () => {
  it('只含選單項目，不含只從列表進入的頁面', () => {
    const names = collectRouteNames(menuRoutes)

    expect(names).toEqual(expect.arrayContaining(['userManagementList', 'roleManagementList', 'menuSettingsList']))
    expect(names).not.toContain('userManagementAdd')
    expect(names).not.toContain('userManagementView')
    expect(names).not.toContain('userManagementEdit')
    expect(names).not.toContain('roleManagementAdd')
    expect(names).not.toContain('roleManagementView')
    expect(names).not.toContain('roleManagementEdit')
    expect(names).not.toContain('error403')
  })

  it('每個節點都有 title，選單才不會出現空白項目', () => {
    const collectTitles = (routes: RouteRecordRaw[]): Array<string | undefined> =>
      routes.flatMap((route) => [route.meta?.title, ...(route.children ? collectTitles(route.children) : [])])

    for (const title of collectTitles(menuRoutes)) {
      expect(title).toBeTruthy()
    }
  })

  it('選單項目都有標資源代碼，只有首頁例外', () => {
    const collectLeaves = (routes: RouteRecordRaw[]): RouteRecordRaw[] =>
      routes.flatMap((route) => (route.children !== undefined && route.children.length > 0 ? collectLeaves(route.children) : [route]))

    const leavesWithoutCode = collectLeaves(menuRoutes).filter((route) => route.meta?.resourceCode === undefined)

    expect(leavesWithoutCode.map((route) => route.name)).toEqual(['home'])
  })
})

describe('filterMenuRoutes', () => {
  it('只留下有檢視權限的項目，子項目全被篩掉的群組整組不顯示', () => {
    const visible = filterMenuRoutes(menuRoutes, (resourceCode) => resourceCode === 'admin_roles')

    expect(collectRouteNames(visible)).toEqual(['home', 'systemManagement', 'roleManagementList'])
  })

  it('沒有任何權限時只剩首頁', () => {
    const visible = filterMenuRoutes(menuRoutes, () => false)

    expect(collectRouteNames(visible)).toEqual(['home'])
  })

  it('children 是空陣列的節點當成空群組整組隱藏，有權限也一樣', () => {
    const routes: RouteRecordRaw[] = [
      { path: 'system-management', name: 'systemManagement', meta: { title: 'systemManagement', resourceCode: 'admin_users' }, children: [] },
    ]

    expect(filterMenuRoutes(routes, () => true)).toEqual([])
    expect(filterMenuRoutes(routes, () => false)).toEqual([])
  })

  it('沒有標資源代碼的一般項目一律顯示，不呼叫權限判斷', () => {
    const canAccess = vi.fn<(resourceCode: string) => boolean>(() => false)
    const routes: RouteRecordRaw[] = [{ path: '', name: 'home', meta: { title: 'home' }, component: { template: '<div />' } }]

    expect(collectRouteNames(filterMenuRoutes(routes, canAccess))).toEqual(['home'])
    expect(canAccess).not.toHaveBeenCalled()
  })
})
