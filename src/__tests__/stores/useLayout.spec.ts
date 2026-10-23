import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { Dark } from 'quasar'
import { useLayoutStore } from '@/stores/useLayout'

// Quasar 的 Dark 會改 body 的 class 並監聽 prefers-color-scheme，測試只需要「設定值」與「是否生效」兩件事，
// 換成同樣是響應式的替身，store 裡依 Dark.isActive 算出的 computed 與 watch 才會照常運作
vi.mock('quasar', async (importOriginal) => {
  const { reactive } = await import('vue')
  const dark = reactive({
    isActive: false,
    set: vi.fn<(value: boolean | 'auto') => void>((value) => {
      dark.isActive = value === true
    }),
  })

  return { ...(await importOriginal<typeof import('quasar')>()), Dark: dark }
})

describe('useLayoutStore 重置設定', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    Dark.set(false)
    vi.mocked(Dark.set).mockClear()
  })

  it('localStorage 沒有資料時改過設定，重置後回到預設值並同步到 Quasar', async () => {
    const layoutStore = useLayoutStore()
    await layoutStore.setLayout('horizontal')
    await layoutStore.setColorScheme('dark')
    await layoutStore.setTopbarColor('brand')
    await layoutStore.setSidebarSize('sm-hover')

    await layoutStore.resetConfig()

    expect(layoutStore.layoutConfig).toEqual({
      layout: 'vertical',
      colorScheme: 'light',
      topbarColor: 'light',
      menuColor: 'light',
      sidebarSize: 'default',
    })
    expect(Dark.set).toHaveBeenLastCalledWith(false)
  })
})
