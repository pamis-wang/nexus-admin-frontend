import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { RouteRecordRaw } from 'vue-router'
import { useUserStore } from '@/stores/useUser'
import type { CurrentAuthorizationResponse } from '@/services/auth/authService'
import { filterMenuRoutesByPermission, menuRoutes } from '@/router/routes'
import router from '@/router'

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

/**
 * 組一份授權狀態，指定的資源都給訪問權限
 * @param resourceNames 有訪問權限的資源完整路徑
 */
function buildAuthorization(resourceNames: string[]): CurrentAuthorizationResponse {
  return {
    permissionMode: 'audit',
    roles: [{ id: 'role-1', name: '管理員' }],
    activeRoles: [{ id: 'role-1', name: '管理員' }],
    permissions: resourceNames.map((resourceName, index) => ({
      resourceId: `resource-${index}`,
      parentId: null,
      resourceName,
      level: 1,
      displayOrder: index,
      canAccess: true,
      canCreate: false,
      canUpdate: false,
      canDelete: false,
      children: [],
    })),
  }
}

/**
 * 登入並寫入授權狀態
 * @param resourceNames 有訪問權限的資源完整路徑，預設只給首頁
 */
async function signIn(resourceNames: string[] = ['首頁']) {
  const userStore = useUserStore()
  await userStore.storageUser('access-token', 'refresh-token', mockUserProfile)
  await userStore.storageAuthorization(buildAuthorization(resourceNames))
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

  it('403 在版面內，已登入時可以正常進入', async () => {
    await signIn()

    await router.push({ name: 'error403' })

    expect(router.currentRoute.value.name).toBe('error403')
  })
})

describe('資源權限守衛', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    await useUserStore().clearUser()
    // 每個案例都從登入頁出發：停在上一個案例的目標路由時，再 push 同一個路由會被
    // vue-router 當成重複導航略過，守衛根本不會執行，測試就會假性通過
    await router.push({ name: 'login' })
  })

  it('有訪問權限時可以進入', async () => {
    await signIn(['首頁', '系統管理>用戶管理'])

    await router.push({ name: 'userManagementList' })

    expect(router.currentRoute.value.name).toBe('userManagementList')
  })

  it('沒有訪問權限時導向 403', async () => {
    await signIn(['首頁'])

    await router.push({ name: 'userManagementList' })

    expect(router.currentRoute.value.name).toBe('error403')
  })

  it('列表以外的頁面共用同一個資源，一起被擋下', async () => {
    await signIn(['首頁'])

    await router.push({ name: 'userManagementAdd' })

    expect(router.currentRoute.value.name).toBe('error403')
  })

  it('資源有權限時，該資源底下的新增頁也進得去', async () => {
    await signIn(['首頁', '系統管理>用戶管理'])

    await router.push({ name: 'userManagementAdd' })

    expect(router.currentRoute.value.name).toBe('userManagementAdd')
  })

  it('權限只給到別的資源時不會互通', async () => {
    await signIn(['首頁', '系統管理>角色管理'])

    await router.push({ name: 'userManagementList' })

    expect(router.currentRoute.value.name).toBe('error403')
  })

  it('沒有 resourceName 的路由不受權限影響，403 自己不會被再擋一次', async () => {
    await signIn([])

    await router.push({ name: 'error403' })

    expect(router.currentRoute.value.name).toBe('error403')
  })

  it('canAccess 為否時視同沒有權限', async () => {
    const userStore = useUserStore()
    await userStore.storageUser('access-token', 'refresh-token', mockUserProfile)
    await userStore.storageAuthorization({
      permissionMode: 'audit',
      roles: [],
      activeRoles: [],
      permissions: [
        {
          resourceId: 'resource-0',
          parentId: null,
          resourceName: '系統管理>用戶管理',
          level: 2,
          displayOrder: 0,
          canAccess: false,
          canCreate: true,
          canUpdate: true,
          canDelete: true,
          children: [],
        },
      ],
    })

    await router.push({ name: 'userManagementList' })

    expect(router.currentRoute.value.name).toBe('error403')
  })
})

describe('選單權限過濾', () => {
  /**
   * 依資源名稱清單過濾選單
   * @param resourceNames 有訪問權限的資源
   */
  function filterByResourceNames(resourceNames: string[]): RouteRecordRaw[] {
    return filterMenuRoutesByPermission(menuRoutes, (resourceName) => resourceNames.includes(resourceName))
  }

  it('只留下有權限的項目', () => {
    const names = collectRouteNames(filterByResourceNames(['首頁', '系統管理', '系統管理>用戶管理']))

    expect(names).toContain('home')
    expect(names).toContain('userManagementList')
    expect(names).not.toContain('roleManagementList')
    expect(names).not.toContain('menuSettingsList')
  })

  it('父層底下沒有任何看得到的子項時整組消失', () => {
    const names = collectRouteNames(filterByResourceNames(['首頁', '系統管理']))

    expect(names).toContain('home')
    expect(names).not.toContain('systemManagement')
  })

  it('父層漏設權限但子項有權限時仍保留父層，否則整組功能會從選單消失', () => {
    const names = collectRouteNames(filterByResourceNames(['系統管理>用戶管理']))

    expect(names).toContain('systemManagement')
    expect(names).toContain('userManagementList')
  })

  it('完全沒有權限時選單是空的', () => {
    expect(filterByResourceNames([])).toEqual([])
  })
})

describe('系統管理路由', () => {
  // 合併到 system.routes.ts 之後網址必須完全不變，否則既有連結與書籤會斷
  it('網址解析到原本的路由名稱', () => {
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
    ]

    for (const [path, expectedName] of expectedNames) {
      expect(router.resolve(path).name).toBe(expectedName)
    }
  })

  it('新增頁的靜態網址不會被檢視頁的動態參數吃掉', () => {
    expect(router.resolve('/system-management/users/new').name).toBe('userManagementAdd')
    expect(router.resolve('/system-management/roles/new').name).toBe('roleManagementAdd')
  })

  it('詳細頁帶得到路由參數', () => {
    expect(router.resolve('/system-management/users/abc-123').params).toEqual({ userId: 'abc-123' })
    expect(router.resolve('/system-management/roles/abc-123/edit').params).toEqual({ roleId: 'abc-123' })
  })
})

describe('選單來源 menuRoutes', () => {
  it('只含選單項目，不含只從列表進入的頁面', () => {
    const names = collectRouteNames(menuRoutes)

    expect(names).toContain('userManagementList')
    expect(names).toContain('roleManagementList')
    expect(names).toContain('menuSettingsList')
    expect(names).not.toContain('userManagementAdd')
    expect(names).not.toContain('userManagementView')
    expect(names).not.toContain('userManagementEdit')
    expect(names).not.toContain('roleManagementAdd')
    expect(names).not.toContain('roleManagementView')
    expect(names).not.toContain('roleManagementEdit')
  })

  it('每個節點都有 title，選單才不會出現空白項目', () => {
    const collectTitles = (routes: RouteRecordRaw[]): Array<string | undefined> =>
      routes.flatMap((route) => [route.meta?.title, ...(route.children ? collectTitles(route.children) : [])])

    for (const title of collectTitles(menuRoutes)) {
      expect(title).toBeTruthy()
    }
  })

  it('保留三層結構', () => {
    const contentManagement = menuRoutes.find((route) => route.name === 'contentManagement')
    const advancedSettings = contentManagement?.children?.find((route) => route.name === 'advancedSettings')

    expect(advancedSettings?.children?.map((route) => route.name)).toEqual(['categorySettingsList', 'tagSettingsList'])
  })
})
