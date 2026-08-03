import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { mount } from '@vue/test-utils'
import quasarPlugin from '@/plugins/quasar'
import LoginPage from '@/pages/Authentication/LoginPage.vue'
import type { LoginResult } from '@/composables/useAuthentication'

const loginMock = vi.fn<(account: string, password: string) => Promise<LoginResult>>()

vi.mock('@/composables/useAuthentication', () => ({
  useAuthentication: () => ({
    isLoggingIn: ref(false),
    login: loginMock,
  }),
}))

function mountLoginPage() {
  return mount(LoginPage, {
    global: {
      plugins: [quasarPlugin],
    },
  })
}

describe('LoginPage', () => {
  beforeEach(() => {
    loginMock.mockReset()
  })

  it('帳號為空時顯示提示，不呼叫 login', async () => {
    const wrapper = mountLoginPage()

    await wrapper.find('form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.text()).toContain('請輸入帳號'))

    expect(loginMock).not.toHaveBeenCalled()
  })

  it('密碼為空時顯示提示，不呼叫 login', async () => {
    const wrapper = mountLoginPage()

    await wrapper.find('input[autocomplete="username"]').setValue('admin')
    await wrapper.find('form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.text()).toContain('請輸入密碼'))

    expect(loginMock).not.toHaveBeenCalled()
  })

  it('登入失敗時顯示後端回傳訊息，並清空密碼欄位', async () => {
    loginMock.mockResolvedValue({ success: false, message: '帳號或密碼錯誤' })
    const wrapper = mountLoginPage()

    await wrapper.find('input[autocomplete="username"]').setValue('admin')
    await wrapper.find('input[autocomplete="current-password"]').setValue('wrong-password')
    await wrapper.find('form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.text()).toContain('帳號或密碼錯誤'))

    expect(loginMock).toHaveBeenCalledWith('admin', 'wrong-password')
    expect((wrapper.find('input[autocomplete="current-password"]').element as HTMLInputElement).value).toBe('')
  })

  it('登入成功時不顯示錯誤訊息', async () => {
    loginMock.mockResolvedValue({ success: true, message: '' })
    const wrapper = mountLoginPage()

    await wrapper.find('input[autocomplete="username"]').setValue('admin')
    await wrapper.find('input[autocomplete="current-password"]').setValue('correct-password')
    await wrapper.find('form').trigger('submit')
    await vi.waitFor(() => expect(loginMock).toHaveBeenCalled())

    expect(wrapper.text()).not.toContain('帳號或密碼錯誤')
  })
})
