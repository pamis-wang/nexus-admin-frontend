import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { Dark } from 'quasar'
import { useLayoutStore } from '@/stores/useLayout'
import { STORAGE_KEY_PREFIX } from '@/stores/useUser'
import type { LayoutConfig } from '@/types/layout'

/** 假的作業系統偏好：色彩方案為「跟隨系統」時，Dark.set('auto') 依這個值決定亮暗 */
const { osPreference } = vi.hoisted(() => ({ osPreference: { isDark: false } }))

/** 假的站別設定：各站 site.ts 的版面預設值不同，測試固定成沒有站別差異，需要時個別案例再填 */
const { site } = vi.hoisted(() => ({ site: { layoutDefaults: {} as Partial<LayoutConfig> } }))

// Quasar 的 Dark 會改 body 的 class 並監聽 prefers-color-scheme，測試只需要「設定值」與「是否生效」兩件事，
// 換成同樣是響應式的替身，store 裡依 Dark.isActive 算出的 computed 與 watch 才會照常運作
vi.mock('quasar', async (importOriginal) => {
  const { reactive } = await import('vue')
  const dark = reactive({
    isActive: false,
    set: vi.fn<(status: boolean | 'auto') => void>((value: boolean | 'auto') => {
      dark.isActive = value === 'auto' ? osPreference.isDark : value
    }),
  })

  return { ...(await importOriginal<typeof import('quasar')>()), Dark: dark }
})

vi.mock('@/config/site', () => ({ siteConfig: site }))

/** 共用的佈局預設值 */
const SHARED_DEFAULTS: LayoutConfig = {
  layout: 'vertical',
  colorScheme: 'light',
  topbarColor: 'light',
  menuColor: 'light',
  sidebarSize: 'default',
}

describe('useLayoutStore 色彩方案', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    osPreference.isDark = false
    site.layoutDefaults = {}
    Dark.set(false)
    vi.mocked(Dark.set).mockClear()
  })

  it('依序切換亮色 → 暗色 → 跟隨系統 → 亮色，並把對應的值交給 Quasar', async () => {
    const layoutStore = useLayoutStore()

    expect(layoutStore.layoutConfig.colorScheme).toBe('light')
    expect(layoutStore.nextColorScheme).toBe('dark')

    await layoutStore.cycleColorScheme()
    expect(layoutStore.layoutConfig.colorScheme).toBe('dark')
    expect(Dark.set).toHaveBeenLastCalledWith(true)

    await layoutStore.cycleColorScheme()
    expect(layoutStore.layoutConfig.colorScheme).toBe('system')
    expect(Dark.set).toHaveBeenLastCalledWith('auto')

    await layoutStore.cycleColorScheme()
    expect(layoutStore.layoutConfig.colorScheme).toBe('light')
    expect(Dark.set).toHaveBeenLastCalledWith(false)
  })

  it('暗色生效時，亮色選單自動改為暗色選單', async () => {
    const layoutStore = useLayoutStore()

    await layoutStore.setColorScheme('dark')
    await nextTick()

    expect(layoutStore.layoutConfig.menuColor).toBe('dark')
  })

  it('跟隨系統且作業系統為暗色時，同樣改為暗色選單；品牌色選單維持不動', async () => {
    osPreference.isDark = true
    const layoutStore = useLayoutStore()

    await layoutStore.setColorScheme('system')
    await nextTick()

    expect(layoutStore.isDarkActive).toBe(true)
    expect(layoutStore.layoutConfig.menuColor).toBe('dark')

    await layoutStore.setColorScheme('light')
    await layoutStore.setMenuColor('brand')
    await layoutStore.setColorScheme('system')
    await nextTick()

    expect(layoutStore.layoutConfig.menuColor).toBe('brand')
  })

  it('跟隨系統且作業系統為亮色時，亮色選單維持不動', async () => {
    const layoutStore = useLayoutStore()

    await layoutStore.setColorScheme('system')
    await nextTick()

    expect(layoutStore.isDarkActive).toBe(false)
    expect(layoutStore.layoutConfig.menuColor).toBe('light')
  })

  it('初始化時把儲存的色彩方案套用到 Quasar', () => {
    localStorage.setItem(
      `${STORAGE_KEY_PREFIX}layoutConfig`,
      JSON.stringify({ layout: 'vertical', colorScheme: 'system', topbarColor: 'light', menuColor: 'dark', sidebarSize: 'default' })
    )
    const layoutStore = useLayoutStore()

    layoutStore.initColorScheme()

    expect(Dark.set).toHaveBeenLastCalledWith('auto')
  })

  it('重置設定時回到亮色並同步到 Quasar', async () => {
    const layoutStore = useLayoutStore()
    await layoutStore.setColorScheme('dark')
    await layoutStore.setTopbarColor('brand')

    await layoutStore.resetConfig()

    expect(layoutStore.layoutConfig.colorScheme).toBe('light')
    expect(layoutStore.layoutConfig.topbarColor).toBe('light')
    expect(Dark.set).toHaveBeenLastCalledWith(false)
  })
})

describe('useLayoutStore 預設值與重置', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    osPreference.isDark = false
    site.layoutDefaults = {}
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

    expect(layoutStore.layoutConfig).toEqual(SHARED_DEFAULTS)
    expect(Dark.set).toHaveBeenLastCalledWith(false)
  })

  it('設定側邊選單尺寸會存進 localStorage', async () => {
    const layoutStore = useLayoutStore()

    await layoutStore.setSidebarSize('sm-hover')
    await nextTick()

    expect(layoutStore.layoutConfig.sidebarSize).toBe('sm-hover')
    expect(JSON.parse(localStorage.getItem(`${STORAGE_KEY_PREFIX}layoutConfig`) ?? '{}')).toMatchObject({ sidebarSize: 'sm-hover' })
  })

  it('之前存下的設定缺少後來新增的欄位時，用預設值補上，其他欄位沿用儲存的值', () => {
    localStorage.setItem(
      `${STORAGE_KEY_PREFIX}layoutConfig`,
      JSON.stringify({ layout: 'horizontal', colorScheme: 'dark', topbarColor: 'brand', menuColor: 'dark' })
    )

    const layoutStore = useLayoutStore()

    expect(layoutStore.layoutConfig).toEqual({ layout: 'horizontal', colorScheme: 'dark', topbarColor: 'brand', menuColor: 'dark', sidebarSize: 'default' })
  })

  it('站別的版面預設值蓋過共用預設，重置時也回到站別的預設值', async () => {
    site.layoutDefaults = { topbarColor: 'brand' }
    const layoutStore = useLayoutStore()

    expect(layoutStore.layoutConfig).toEqual({ ...SHARED_DEFAULTS, topbarColor: 'brand' })

    await layoutStore.setTopbarColor('light')
    await layoutStore.resetConfig()

    expect(layoutStore.layoutConfig.topbarColor).toBe('brand')
  })
})
