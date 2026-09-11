import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { RouteRecordRaw } from 'vue-router'
import { useUserStore } from '@/stores/useUser'
import { menuRoutes } from '@/router/routes'
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
    await useUserStore().storageUser('access-token', 'refresh-token', mockUserProfile)

    await router.push({ name: 'home' })

    expect(router.currentRoute.value.name).toBe('home')
  })

  it('已驗證時，訪問登入頁會導向首頁', async () => {
    await useUserStore().storageUser('access-token', 'refresh-token', mockUserProfile)

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
    await useUserStore().storageUser('access-token', 'refresh-token', mockUserProfile)

    await router.push('/')

    expect(router.currentRoute.value.name).toBe('home')
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
