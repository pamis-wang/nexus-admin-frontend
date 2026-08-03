import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useUserStore } from '@/stores/useUser'
import router from '@/router'

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
