import { describe, it, expect, vi, beforeEach } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import { useUserStore } from '@/stores/useUser'
import { useAuthentication } from '@/composables/useAuthentication'
import type { LoginRequest, LoginResponse, LogoutResponse } from '@/services/auth/authService'
import type { ResponseStructure } from '@/services/axiosService'

const logoutRequestMock = vi.fn<() => Promise<ResponseStructure<LogoutResponse>>>()

vi.mock('@/services/auth/authService', () => ({
  login: vi.fn<(data: LoginRequest) => Promise<LoginResponse>>(),
  logout: (...args: unknown[]) => logoutRequestMock(...args),
}))

const mockUserProfile = {
  id: '1',
  account: 'admin',
  email: 'admin@example.com',
  fullName: null,
  roles: [],
}

async function mountAuthentication() {
  const router = createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/', name: 'home', component: { template: '<div />' } },
      { path: '/login', name: 'login', component: { template: '<div />' } },
    ],
  })

  let authentication!: ReturnType<typeof useAuthentication>
  mount(
    defineComponent({
      setup() {
        authentication = useAuthentication()
        return () => h('div')
      },
    }),
    { global: { plugins: [router] } },
  )
  await router.push({ name: 'home' })

  return { authentication, router }
}

describe('useAuthentication - logout', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    logoutRequestMock.mockReset()
  })

  it('撤銷成功時，清空使用者狀態並導向登入頁', async () => {
    logoutRequestMock.mockResolvedValue(undefined)
    const { authentication, router } = await mountAuthentication()
    const userStore = useUserStore()
    await userStore.storageUser('access-token', 'refresh-token', mockUserProfile)

    await authentication.logout()

    expect(userStore.isAuthenticated).toBe(false)
    expect(userStore.accessToken).toBeNull()
    expect(router.currentRoute.value.name).toBe('login')
  })

  it('撤銷失敗時，不拋出例外，仍清空使用者狀態並導向登入頁', async () => {
    logoutRequestMock.mockRejectedValue(new Error('network error'))
    const { authentication, router } = await mountAuthentication()
    const userStore = useUserStore()
    await userStore.storageUser('access-token', 'refresh-token', mockUserProfile)

    await expect(authentication.logout()).resolves.toBeUndefined()

    expect(userStore.isAuthenticated).toBe(false)
    expect(userStore.accessToken).toBeNull()
    expect(router.currentRoute.value.name).toBe('login')
  })
})
