import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { driver, type Config, type DriveStep, type Driver } from 'driver.js'
import type { NavigationFailure, RouteLocationRaw } from 'vue-router'
import { siteHooks } from '@/config/siteHooks'
import { i18n } from '@/plugins/i18n'
import { useTourStore } from '@/stores/useTour'
import type { TourDefinition, TourStep, TourText } from '@/types/tour'

/**
 * 假的路由、driver.js、使用者 store 與站別權限
 *
 * 導覽只讀路由的 currentRoute，而且只在被呼叫的當下讀一次、不參與任何 computed，因此用普通物件即可。
 * driver.js 會操作真實 DOM 畫遮罩，這裡只驗「有沒有開始播、交給它什麼」，換成記錄呼叫的假物件。
 * 使用者 store 只取導覽用到的 userId；權限一律走 siteHooks.canAccess，換成以一組資源代碼判斷。
 */
const { routerMock, driverMock, userStoreMock, grantedResourceCodes } = vi.hoisted(() => ({
  routerMock: {
    currentRoute: { value: { name: 'home' as string } },
    push: vi.fn<(to: RouteLocationRaw) => Promise<NavigationFailure | void | undefined>>(),
  },
  driverMock: {
    drive: vi.fn<(stepIndex?: number) => void>(),
    destroy: vi.fn<() => void>(),
    moveTo: vi.fn<(index: number) => void>(),
    refresh: vi.fn<() => void>(),
    getActiveIndex: vi.fn<() => number | undefined>(() => 0),
    isActive: vi.fn<() => boolean>(),
    setConfig: vi.fn<(config: Config) => void>(),
    setSteps: vi.fn<(steps: DriveStep[]) => void>(),
    getConfig: vi.fn<() => Config>(),
    getState: vi.fn<(key?: string) => unknown>(),
    isFirstStep: vi.fn<() => boolean>(),
    isLastStep: vi.fn<() => boolean>(),
    getActiveStep: vi.fn<() => DriveStep | undefined>(),
    getActiveElement: vi.fn<() => Element | undefined>(),
    getPreviousElement: vi.fn<() => Element | undefined>(),
    getPreviousStep: vi.fn<() => DriveStep | undefined>(),
    getNextStep: vi.fn<() => DriveStep | undefined>(),
    moveNext: vi.fn<() => void>(),
    movePrevious: vi.fn<() => void>(),
    hasNextStep: vi.fn<() => boolean>(),
    hasPreviousStep: vi.fn<() => boolean>(),
    highlight: vi.fn<(step: DriveStep) => void>(),
  },
  userStoreMock: { userId: null as string | null },
  grantedResourceCodes: new Set<string>(),
}))

vi.mock('@/router', () => ({ default: routerMock }))
vi.mock('driver.js', () => ({ driver: vi.fn<(options?: Config) => Driver>(() => driverMock) }))
vi.mock('@/stores/useUser', () => ({ STORAGE_KEY_PREFIX: 'tour-spec:', useUserStore: () => userStoreMock }))
vi.mock('@/config/siteHooks', () => ({
  siteHooks: { canAccess: vi.fn<(resourceCode: string) => boolean>((resourceCode) => grantedResourceCodes.has(resourceCode)) },
}))

// 導覽定義來自 src/tours/ 的實際檔案，各站不同、也會隨專案成長而變動；
// 這裡換成固定的假定義，讓測試驗的是過濾、分組與判斷邏輯，而不是當下有哪幾份導覽。
// resolveTourText 沿用真的實作，才驗得到泡泡與提示的文字有跟著語系走。
vi.mock('@/tours', async (importOriginal) => {
  const { resolveTourText } = await importOriginal<typeof import('@/tours')>()
  const definitions: TourDefinition[] = [
    buildDefinition({ id: 'public-tour', name: buildText('人人都看得到', 'For everyone'), order: 10 }),
    buildDefinition({
      id: 'restricted-tour',
      name: buildText('需要帳號管理權限', 'Needs user permission'),
      order: 20,
      resourceCode: 'users',
      groupName: buildText('系統管理', 'System Management'),
    }),
    buildDefinition({
      id: 'page-bound-tour',
      name: buildText('只能在表單頁播', 'Form page only'),
      order: 30,
      requiresRouteNames: ['formCreate', 'formModify'],
    }),
    buildDefinition({
      id: 'other-module-tour',
      name: buildText('別的模組', 'Another module'),
      order: 40,
      resourceCode: 'events',
      groupName: buildText('活動', 'Events'),
    }),
    buildDefinition({
      id: 'second-restricted-tour',
      name: buildText('同組的第二份', 'Second in group'),
      order: 50,
      resourceCode: 'users',
      groupName: buildText('系統管理', 'System Management'),
    }),
    buildDefinition({
      id: 'anchor-bound-tour',
      name: buildText('畫面要先換成清單', 'List view only'),
      order: 60,
      requiresRouteNames: ['userList'],
      resourceCode: 'users',
      groupName: buildText('系統管理', 'System Management'),
      requiresAnchor: { anchor: 'user-list-table', hint: buildText('請先切到清單再開啟', 'Switch to the list first') },
    }),
    buildDefinition({
      id: 'untranslated-tour',
      name: buildText('還沒翻譯', ''),
      order: 70,
      requiresAnchor: { anchor: 'untranslated-anchor', hint: buildText('只有中文的提示', '') },
      steps: [buildStep({ title: buildText('只有中文的標題', ''), description: buildText('先按<strong>儲存</strong><br>再離開', '') })],
    }),
    buildDefinition({
      id: 'anchored-tour',
      name: buildText('指向元素的導覽', 'Anchored tour'),
      order: 80,
      steps: [buildStep({ anchor: 'anchor-first' }), buildStep({ anchor: 'anchor-hidden' })],
    }),
  ]

  return {
    tourDefinitions: definitions,
    findTourById: (tourId: string) => definitions.find((definition) => definition.id === tourId) ?? null,
    resolveTourText,
  }
})

/**
 * 組出一份導覽文字
 * @param zhTW 繁中文字
 * @param enUS 英文文字，空字串代表還沒翻譯
 * @returns 導覽文字
 */
function buildText(zhTW: string, enUS: string): TourText {
  return { 'zh-TW': zhTW, 'en-US': enUS }
}

/** 組出一個最小的步驟 */
function buildStep(overrides: Partial<TourStep>): TourStep {
  return {
    anchor: null,
    title: buildText('第一步', 'Step 1'),
    description: buildText('說明', 'Description'),
    routeName: null,
    side: null,
    align: null,
    ...overrides,
  }
}

/** 組出一份最小的導覽定義：不分組、不限權限、不綁頁面 */
function buildDefinition(overrides: Partial<TourDefinition>): TourDefinition {
  return {
    id: 'tour',
    name: buildText('導覽', 'Tour'),
    groupName: null,
    order: 0,
    requiresRouteNames: [],
    resourceCode: null,
    requiresAnchor: null,
    steps: [buildStep({})],
    ...overrides,
  }
}

/**
 * 種入登入狀態與權限
 * @param userId 使用者唯一編號，null 代表未登入
 * @param resourceCodes 這位使用者有訪問權的資源代碼
 */
function signIn(userId: string | null, resourceCodes: string[] = []) {
  userStoreMock.userId = userId
  grantedResourceCodes.clear()
  resourceCodes.forEach((resourceCode) => grantedResourceCodes.add(resourceCode))
}

/**
 * 在畫面上掛一個錨點
 *
 * jsdom 不排版，元素的矩形全是 0，導覽會以為還沒顯示出來而一直等；給一個固定的矩形，導覽才等得到它穩定。
 * @param anchor 錨點名稱
 */
function mountAnchor(anchor: string) {
  const element = document.createElement('div')
  element.dataset.tour = anchor
  element.getBoundingClientRect = () => DOMRect.fromRect({ x: 0, y: 0, width: 100, height: 20 })
  document.body.appendChild(element)
}

/**
 * 取得最近一次建立 driver.js 實例時傳入的設定
 * @returns driver.js 設定
 */
function getLastDriverConfig(): Config | undefined {
  return vi.mocked(driver).mock.lastCall?.[0]
}

/** 模擬在泡泡上按「下一步」：driver.js 會呼叫建立實例時傳入的 onNextClick */
function clickNext() {
  const onNextClick = getLastDriverConfig()?.onNextClick as (() => void) | undefined

  onNextClick?.()
}

/** 模擬關掉泡泡：driver.js 會呼叫建立實例時傳入的 onDestroyStarted */
function closePopover() {
  const onDestroyStarted = getLastDriverConfig()?.onDestroyStarted as (() => void) | undefined

  onDestroyStarted?.()
}

// jsdom 沒有實作 scrollIntoView，導覽捲到錨點時會呼叫
Element.prototype.scrollIntoView = vi.fn<(arg?: boolean | ScrollIntoViewOptions) => void>()

describe('useTourStore', () => {
  beforeEach(() => {
    // useStorage 會把狀態寫進 localStorage 並在建立時讀回，不清會汙染下一個案例
    localStorage.clear()
    setActivePinia(createPinia())
    routerMock.currentRoute.value = { name: 'home' }
    signIn(null)
    vi.clearAllMocks()
  })

  afterEach(() => {
    i18n.global.locale.value = 'zh-TW'
    document.body.innerHTML = ''
  })

  describe('availableTours', () => {
    it('不限權限的導覽一律列出', () => {
      signIn('user-1')

      expect(useTourStore().availableTours.map((definition) => definition.id)).toContain('public-tour')
    })

    it('沒有權限的導覽不列出', () => {
      signIn('user-1')

      expect(useTourStore().availableTours.map((definition) => definition.id)).not.toContain('restricted-tour')
    })

    it('有權限時列出該導覽，權限交給站別的 canAccess 判斷', () => {
      signIn('user-1', ['users'])

      expect(useTourStore().availableTours.map((definition) => definition.id)).toContain('restricted-tour')
      expect(siteHooks.canAccess).toHaveBeenCalledWith('users')
    })
  })

  describe('tourGroups', () => {
    it('依 groupName 分組，群組依第一次出現的順序排列', () => {
      signIn('user-1', ['users', 'events'])

      expect(useTourStore().tourGroups.map((group) => group.name['zh-TW'])).toEqual(['通用', '系統管理', '活動'])
    })

    it('groupName 為 null 的導覽歸到「通用」，名稱取語系檔', () => {
      signIn('user-1')

      const commonGroup = useTourStore().tourGroups[0]

      expect(commonGroup?.name).toEqual(buildText('通用', 'General'))
      expect(commonGroup?.tours.map((tour) => tour.id)).toEqual(['public-tour', 'page-bound-tour', 'untranslated-tour', 'anchored-tour'])
    })

    it('同一組的導覽維持 order 的順序', () => {
      signIn('user-1', ['users'])

      const group = useTourStore().tourGroups.find((item) => item.name['zh-TW'] === '系統管理')

      expect(group?.tours.map((tour) => tour.id)).toEqual(['restricted-tour', 'second-restricted-tour', 'anchor-bound-tour'])
    })

    it('以繁中名稱當分組鍵值，切換語系不影響分組', () => {
      signIn('user-1', ['users', 'events'])
      const zhKeys = useTourStore().tourGroups.map((group) => group.key)

      i18n.global.locale.value = 'en-US'
      setActivePinia(createPinia())

      expect(useTourStore().tourGroups.map((group) => group.key)).toEqual(zhKeys)
    })

    it('沒有權限的模組不會出現成空群組', () => {
      signIn('user-1')

      expect(useTourStore().tourGroups.map((group) => group.name['zh-TW'])).toEqual(['通用'])
    })
  })

  describe('startTour', () => {
    it('泡泡的標題與說明取目前語系的文字', async () => {
      signIn('user-1')
      i18n.global.locale.value = 'en-US'

      await useTourStore().startTour('public-tour')

      expect(driver).toHaveBeenLastCalledWith(
        expect.objectContaining({ steps: [expect.objectContaining({ popover: expect.objectContaining({ title: 'Step 1', description: 'Description' }) })] })
      )
    })

    it('英文還沒翻譯時退回繁中，說明裡的 HTML 原樣交給 driver.js', async () => {
      signIn('user-1')
      mountAnchor('untranslated-anchor')
      i18n.global.locale.value = 'en-US'

      await useTourStore().startTour('untranslated-tour')

      expect(driver).toHaveBeenLastCalledWith(
        expect.objectContaining({
          steps: [
            expect.objectContaining({ popover: expect.objectContaining({ title: '只有中文的標題', description: '先按<strong>儲存</strong><br>再離開' }) }),
          ],
        })
      )
    })

    it('按鈕文字取目前語系，泡泡掛上導覽專用的樣式', async () => {
      signIn('user-1')
      i18n.global.locale.value = 'en-US'

      await useTourStore().startTour('public-tour')

      expect(driver).toHaveBeenLastCalledWith(
        expect.objectContaining({ nextBtnText: 'Next', prevBtnText: 'Previous', doneBtnText: 'Done', popoverClass: 'tour-popover' })
      )
    })

    it('開始播放後記住目前的導覽', async () => {
      signIn('user-1')
      const tourStore = useTourStore()

      await tourStore.startTour('public-tour')

      expect(tourStore.isRunning).toBe(true)
      expect(tourStore.activeTour?.id).toBe('public-tour')
      expect(driverMock.drive).toHaveBeenCalledWith(0)
    })

    it('不能啟動的導覽不會開始播放', async () => {
      signIn('user-1')
      const tourStore = useTourStore()

      await tourStore.startTour('restricted-tour')

      expect(driver).not.toHaveBeenCalled()
      expect(tourStore.isRunning).toBe(false)
    })

    it('關掉泡泡就結束導覽，並記為已看過', async () => {
      signIn('user-1')
      const tourStore = useTourStore()
      await tourStore.startTour('public-tour')

      closePopover()

      expect(tourStore.isRunning).toBe(false)
      expect(tourStore.hasSeenTour('public-tour')).toBe(true)
      expect(driverMock.destroy).toHaveBeenCalled()
    })
  })

  describe('canStartTour', () => {
    it('不綁定頁面的導覽在任何頁面都能啟動', () => {
      signIn('user-1')

      expect(useTourStore().canStartTour('public-tour')).toBe(true)
    })

    it('綁定頁面的導覽在別的頁面無法啟動', () => {
      signIn('user-1')

      expect(useTourStore().canStartTour('page-bound-tour')).toBe(false)
    })

    it('綁定多條路由時，停在其中任何一條都能啟動', () => {
      signIn('user-1')
      routerMock.currentRoute.value = { name: 'formModify' }

      expect(useTourStore().canStartTour('page-bound-tour')).toBe(true)
    })

    it('沒有權限時不能啟動', () => {
      signIn('user-1')

      expect(useTourStore().canStartTour('restricted-tour')).toBe(false)
    })

    it('查無此 id 時回傳 false 而不是拋錯', () => {
      signIn('user-1')

      expect(useTourStore().canStartTour('不存在的導覽')).toBe(false)
    })

    describe('要求錨點的導覽', () => {
      beforeEach(() => {
        signIn('user-1', ['users'])
        routerMock.currentRoute.value = { name: 'userList' }
      })

      it('畫面上沒有該錨點時不能啟動，並提示定義裡寫的原因', () => {
        const tourStore = useTourStore()

        expect(tourStore.canStartTour('anchor-bound-tour')).toBe(false)
        expect(tourStore.resolveStartBlockedHint('anchor-bound-tour')).toBe('請先切到清單再開啟')
      })

      it('錨點出現後就能啟動', () => {
        mountAnchor('user-list-table')
        const tourStore = useTourStore()

        expect(tourStore.canStartTour('anchor-bound-tour')).toBe(true)
        expect(tourStore.resolveStartBlockedHint('anchor-bound-tour')).toBeNull()
      })

      it('不在綁定的頁面時先提示進入頁面，而不是錨點的提示', () => {
        routerMock.currentRoute.value = { name: 'home' }

        expect(useTourStore().resolveStartBlockedHint('anchor-bound-tour')).toBe('請先進入該功能頁面再開啟')
      })
    })
  })

  describe('resolveStartBlockedHint', () => {
    it('可以啟動時為 null', () => {
      signIn('user-1')

      expect(useTourStore().resolveStartBlockedHint('public-tour')).toBeNull()
    })

    it('找不到導覽時說明原因', () => {
      signIn('user-1')

      expect(useTourStore().resolveStartBlockedHint('不存在的導覽')).toBe('找不到這份導覽')
    })

    it('沒有權限時先說明權限，不提頁面與錨點', () => {
      signIn('user-1')

      expect(useTourStore().resolveStartBlockedHint('anchor-bound-tour')).toBe('沒有這個功能的使用權限')
    })

    it('提示跟著目前語系', () => {
      signIn('user-1', ['users'])
      routerMock.currentRoute.value = { name: 'userList' }
      i18n.global.locale.value = 'en-US'
      const tourStore = useTourStore()

      expect(tourStore.resolveStartBlockedHint('restricted-tour')).toBeNull()
      expect(tourStore.resolveStartBlockedHint('page-bound-tour')).toBe('Open the feature page first to start this tour')
      expect(tourStore.resolveStartBlockedHint('anchor-bound-tour')).toBe('Switch to the list first')
    })

    it('錨點提示的英文還沒翻譯時退回繁中', () => {
      signIn('user-1')
      i18n.global.locale.value = 'en-US'

      expect(useTourStore().resolveStartBlockedHint('untranslated-tour')).toBe('只有中文的提示')
    })
  })

  describe('activeAnchor', () => {
    it('播放時公布目前步驟的錨點', async () => {
      signIn('user-1')
      mountAnchor('anchor-first')

      await useTourStore().startTour('anchored-tour')

      expect(useTourStore().activeAnchor).toBe('anchor-first')
    })

    it('要前往的錨點還不在畫面上時先公布，頁面把它掛上之後導覽就接著播', async () => {
      signIn('user-1')
      mountAnchor('anchor-first')
      await useTourStore().startTour('anchored-tour')

      clickNext()

      // 錨點收在還沒切到的步驟裡：導覽先公布要找誰，等頁面切過去
      expect(useTourStore().activeAnchor).toBe('anchor-hidden')
      expect(driverMock.moveTo).not.toHaveBeenCalled()

      mountAnchor('anchor-hidden')

      await vi.waitFor(() => expect(driverMock.moveTo).toHaveBeenCalledWith(1))
    })

    it('結束導覽後清空', async () => {
      signIn('user-1')
      mountAnchor('anchor-first')
      await useTourStore().startTour('anchored-tour')

      useTourStore().stopTour()

      expect(useTourStore().activeAnchor).toBeNull()
    })
  })

  describe('已看過的紀錄', () => {
    it('標記後即視為已看過', () => {
      signIn('user-1')
      const tourStore = useTourStore()

      expect(tourStore.hasSeenTour('public-tour')).toBe(false)
      tourStore.markTourSeen('public-tour')

      expect(tourStore.hasSeenTour('public-tour')).toBe(true)
    })

    it('紀錄依使用者歸戶，存在帶站別前綴的 seenTours', async () => {
      signIn('user-1')

      useTourStore().markTourSeen('public-tour')
      // useStorage 在下一個 tick 才寫回 localStorage
      await nextTick()

      expect(JSON.parse(localStorage.getItem('tour-spec:seenTours') ?? '{}')).toEqual({ 'user-1': ['public-tour'] })
    })

    it('換人登入不會沿用', () => {
      signIn('user-1')
      useTourStore().markTourSeen('public-tour')

      signIn('user-2')

      expect(useTourStore().hasSeenTour('public-tour')).toBe(false)
    })

    it('未登入時歸到匿名，不會記到任何使用者身上', async () => {
      useTourStore().markTourSeen('public-tour')
      await nextTick()

      signIn('user-1')

      expect(useTourStore().hasSeenTour('public-tour')).toBe(false)
      expect(JSON.parse(localStorage.getItem('tour-spec:seenTours') ?? '{}')).toEqual({ anonymous: ['public-tour'] })
    })

    it('重設後回到未看過', () => {
      signIn('user-1')
      const tourStore = useTourStore()
      tourStore.markTourSeen('public-tour')

      tourStore.resetSeenTours()

      expect(tourStore.hasSeenTour('public-tour')).toBe(false)
    })

    it('重設只影響目前使用者', () => {
      signIn('user-1')
      useTourStore().markTourSeen('public-tour')

      signIn('user-2')
      useTourStore().markTourSeen('public-tour')
      useTourStore().resetSeenTours()

      signIn('user-1')

      expect(useTourStore().hasSeenTour('public-tour')).toBe(true)
    })
  })
})
