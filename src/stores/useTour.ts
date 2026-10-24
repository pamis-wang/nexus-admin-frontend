/**
 * 系統內建導覽的狀態管理
 *
 * 導覽會跨路由播放，狀態必須在頁面切換後存活，因此放在 store 而非頁面區域狀態。
 * driver.js 實例是命令式物件，不放進響應式狀態，改以模組層變數持有。
 */
import { computed, nextTick, ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import { useStorage } from '@vueuse/core'
import { driver, type Driver } from 'driver.js'
import router from '@/router'
import { useLogger } from '@/composables/useLogger'
import { siteHooks } from '@/config/siteHooks'
import { i18n } from '@/plugins/i18n'
import { STORAGE_KEY_PREFIX, useUserStore } from '@/stores/useUser'
import { findTourById, resolveTourText, tourDefinitions } from '@/tours'
import type { TourDefinition, TourGroup, TourStep, TourText } from '@/types/tour'

import 'driver.js/dist/driver.css'

/** 等待錨點出現的逾時毫秒數，逾時就讓該步驟以置中泡泡呈現而不是卡住 */
const ANCHOR_WAIT_TIMEOUT = 5000

/** 等錨點位置穩下來的逾時毫秒數，逾時就直接標位置，寧可位置稍偏也不要卡住 */
const ANCHOR_SETTLE_TIMEOUT = 1000

/** 錨點靠右時要留的邊距，避免貼死在畫面邊緣 */
const HORIZONTAL_SCROLL_MARGIN = 16

/** 「通用」組的分組鍵值；其他組以繁中名稱當鍵值，這一組沒有定義檔裡的名稱可取 */
const COMMON_GROUP_KEY = 'common'

/** 未登入時用來歸戶「已看過」紀錄的識別字 */
const ANONYMOUS_USER_KEY = 'anonymous'

const logger = useLogger({ prefix: 'Tour', enabled: import.meta.env.DEV, showTimestamp: true })

/** 目前的 driver.js 實例，沒有導覽進行時為 null */
let driverInstance: Driver | null = null

export const useTourStore = defineStore('tour', () => {
  const userStore = useUserStore()

  /** 已看過的導覽紀錄：使用者唯一編號對應到已看過的導覽 id */
  const seenTourRecord = useStorage<Record<string, string[]>>(`${STORAGE_KEY_PREFIX}seenTours`, {})

  /** 目前正在播放的導覽，沒有播放時為 null */
  const activeTour = shallowRef<TourDefinition | null>(null)

  /**
   * 導覽目前指向、或正要指向的錨點；沒有導覽播放、或這一步不指向元素時為 null
   *
   * 錨點可能收在步驟條、分頁這類一次只渲染一塊的元件裡，還沒切到的那一塊根本不在 DOM 上，
   * 導覽只能等到逾時再退成置中泡泡。那種頁面監看這個值，把錨點所在的那一塊切出來即可：
   * 導覽在等錨點之前就先寫入，頁面切過去、錨點一掛上 DOM，導覽就接著播。
   */
  const activeAnchor = ref<string | null>(null)

  /**
   * 目前這位使用者能看的導覽，供重看入口列出
   *
   * 依資源權限過濾：沒有該功能訪問權的人，選單看不到那個功能、路由守衛也會把他擋下，
   * 導覽只會卡在等不到的錨點上。與其讓他點了才失敗，不如不要列出。
   */
  const availableTours = computed<TourDefinition[]>(() =>
    tourDefinitions.filter((definition) => definition.resourceCode === null || siteHooks.canAccess(definition.resourceCode))
  )

  /**
   * 依左側選單分組的導覽，供選單分段列出
   *
   * 導覽累積到幾十份之後，一長串平鋪的清單找不到東西。
   * 群組依第一次出現的順序排列；導覽本身已依 order 排好，群組自然跟著選單的順序走。
   * 以繁中的群組名稱分組，不隨語系變動；要顯示哪個語系由畫面決定。
   * 沒有權限的導覽先濾掉，整組都看不到的群組就不會出現成空群組。
   */
  const tourGroups = computed<TourGroup[]>(() => {
    const groups: TourGroup[] = []

    for (const definition of availableTours.value) {
      const key = definition.groupName === null ? COMMON_GROUP_KEY : definition.groupName['zh-TW']
      const existing = groups.find((group) => group.key === key)

      if (existing === undefined) {
        groups.push({ key, name: definition.groupName ?? buildCommonGroupName(), tours: [definition] })
        continue
      }

      existing.tours.push(definition)
    }

    return groups
  })

  /** 目前是否有導覽正在播放 */
  const isRunning = computed<boolean>(() => activeTour.value !== null)

  /**
   * 啟動指定導覽
   * @param tourId 導覽識別碼
   */
  async function startTour(tourId: string) {
    const definition = findTourById(tourId)

    if (definition === null) {
      logger.warn(`找不到導覽定義：${tourId}`)
      return
    }

    if (!canStartTour(tourId)) {
      logger.warn(`導覽「${definition.id}」在目前狀態下無法啟動`, {
        原因: resolveStartBlockedHint(tourId),
        需要路由: definition.requiresRouteNames,
        需要權限: definition.resourceCode,
        需要錨點: definition.requiresAnchor?.anchor ?? null,
        目前路由: String(router.currentRoute.value.name),
      })
      return
    }

    // 同時只允許一份導覽播放，重複啟動先收掉前一份
    stopTour()

    const firstStep = definition.steps[0]
    if (firstStep === undefined) return

    // 第一步同樣可能需要先導頁，準備完才開始播放
    await prepareStep(firstStep)

    activeTour.value = definition
    driverInstance = createDriver(definition)
    driverInstance.drive(0)
  }

  /** 結束目前導覽 */
  function stopTour() {
    // 先清掉指標再銷毀：destroy 會同步觸發後續流程，避免重入時重複銷毀
    const instance = driverInstance
    driverInstance = null
    activeTour.value = null
    activeAnchor.value = null

    instance?.destroy()
  }

  /**
   * 目前能不能啟動指定導覽
   * @param tourId 導覽識別碼
   * @returns 可以啟動時為 true
   */
  function canStartTour(tourId: string): boolean {
    return resolveStartBlockedHint(tourId) === null
  }

  /**
   * 指定導覽現在為什麼不能啟動，供導覽選單說明
   *
   * 依序檢查：找不到定義；沒有該功能的權限一律不給播；綁定路由的導覽只有停在其中一頁時才播得動——
   * 那種頁面的網址帶識別編號，導覽定義無從得知要用哪一筆資料，只能沿用使用者當下所在的頁面；
   * 要求錨點的導覽只在畫面換成對應的樣子後才播，否則每一步都指向不存在的東西。
   *
   * 錨點是當下直接查 DOM，不參與響應式計算：選單每次打開都會重新渲染，查到的就是當時的畫面。
   * @param tourId 導覽識別碼
   * @returns 不能啟動的原因（目前語系）；可以啟動時為 null
   */
  function resolveStartBlockedHint(tourId: string): string | null {
    const definition = findTourById(tourId)

    if (definition === null) return i18n.global.t('tour.hint.notFound')
    if (definition.resourceCode !== null && !siteHooks.canAccess(definition.resourceCode)) return i18n.global.t('tour.hint.noPermission')
    if (definition.requiresRouteNames.length > 0 && !definition.requiresRouteNames.includes(String(router.currentRoute.value.name))) {
      return i18n.global.t('tour.hint.requiresPage')
    }
    if (definition.requiresAnchor !== null && document.querySelector(buildAnchorSelector(definition.requiresAnchor.anchor)) === null) {
      return resolveTourText(definition.requiresAnchor.hint)
    }

    return null
  }

  /**
   * 是否已看過指定導覽
   * @param tourId 導覽識別碼
   * @returns 已看過時為 true
   */
  function hasSeenTour(tourId: string): boolean {
    return getSeenTourIds().includes(tourId)
  }

  /**
   * 記錄指定導覽已看過
   * @param tourId 導覽識別碼
   */
  function markTourSeen(tourId: string) {
    if (hasSeenTour(tourId)) return

    // 直接指派新物件，確保 useStorage 偵測到變更並寫回 localStorage
    seenTourRecord.value = {
      ...seenTourRecord.value,
      [getCurrentUserKey()]: [...getSeenTourIds(), tourId],
    }
  }

  /** 清除目前使用者的所有已看過紀錄，讓導覽重新標示為未看過 */
  function resetSeenTours() {
    seenTourRecord.value = { ...seenTourRecord.value, [getCurrentUserKey()]: [] }
  }

  /**
   * 取得目前使用者的紀錄鍵值，未登入時歸到匿名
   * @returns 使用者唯一編號，或匿名識別字
   */
  function getCurrentUserKey(): string {
    return userStore.userId ?? ANONYMOUS_USER_KEY
  }

  /**
   * 取得目前使用者已看過的導覽 id
   * @returns 已看過的導覽識別碼
   */
  function getSeenTourIds(): string[] {
    return seenTourRecord.value[getCurrentUserKey()] ?? []
  }

  /**
   * 建立 driver.js 實例，並接管上一步／下一步以支援非同步準備
   * @param definition 要播放的導覽定義
   * @returns driver.js 實例
   */
  function createDriver(definition: TourDefinition): Driver {
    return driver({
      showProgress: true,
      allowClose: true,
      // 方向鍵會直接前進而繞過非同步準備，關掉以避免步驟顯示在還沒就緒的頁面上
      allowKeyboardControl: false,
      overlayOpacity: 0.6,
      stagePadding: 6,
      stageRadius: 4,
      // 泡泡的樣式由全域樣式表以這個 class 指定
      popoverClass: 'tour-popover',
      // 每次開始播放才建立實例，按鈕文字與步驟的標題、說明都取當下的語系
      nextBtnText: i18n.global.t('tour.button.next'),
      prevBtnText: i18n.global.t('tour.button.prev'),
      doneBtnText: i18n.global.t('tour.button.done'),
      progressText: '{{current}} / {{total}}',
      steps: definition.steps.map((step) => ({
        element: step.anchor === null ? undefined : buildAnchorSelector(step.anchor),
        popover: {
          // driver.js 以 innerHTML 塞入，說明裡的 <br>、<strong> 會照原樣呈現
          title: resolveTourText(step.title),
          description: resolveTourText(step.description),
          side: step.side ?? undefined,
          align: step.align ?? undefined,
          showButtons: ['previous', 'next', 'close'],
        },
      })),
      // 設定 onNextClick／onPrevClick 後 driver.js 不會自動前進，
      // 由我們先完成導頁與等待錨點，再手動推進到下一步
      onNextClick: () => {
        void moveToStep(definition, getActiveIndex() + 1)
      },
      onPrevClick: () => {
        void moveToStep(definition, getActiveIndex() - 1)
      },
      // driver.js 高亮時會自行捲動，把我們先前歸零的水平位置又捲走；
      // 等它捲完再歸零一次，並讓遮罩依新位置重畫
      onHighlighted: (element) => {
        if (!(element instanceof HTMLElement)) return

        if (ensureHorizontallyVisible(element)) driverInstance?.refresh()
      },
      // 最後一步的按鈕會落到這裡，明確處理避免導覽走完卻關不掉
      onDoneClick: () => {
        markTourSeen(definition.id)
        stopTour()
      },
      onDestroyStarted: () => {
        // 不論是走完、略過或點遮罩關閉，都視為看過，之後在選單上標示為「可重看」
        markTourSeen(definition.id)
        stopTour()
      },
    })
  }

  /**
   * 準備並移動到指定步驟；超出範圍代表導覽結束
   * @param definition 播放中的導覽定義
   * @param index 目標步驟索引
   */
  async function moveToStep(definition: TourDefinition, index: number) {
    if (driverInstance === null) return

    if (index < 0 || index >= definition.steps.length) {
      stopTour()
      markTourSeen(definition.id)
      return
    }

    const step = definition.steps[index]
    if (step === undefined) return

    await prepareStep(step)

    // 準備期間使用者可能已經關掉導覽
    if (driverInstance === null) return

    driverInstance.moveTo(index)
  }

  /**
   * 取得 driver.js 目前所在的步驟索引
   * @returns 步驟索引，從 0 起算
   */
  function getActiveIndex(): number {
    return driverInstance?.getActiveIndex() ?? 0
  }

  /**
   * 導到步驟所屬頁面並等待錨點出現，確保泡泡不會指向還不存在的元素
   * @param step 要準備的步驟
   */
  async function prepareStep(step: TourStep) {
    if (step.routeName !== null && router.currentRoute.value.name !== step.routeName) {
      await router.push({ name: step.routeName })
      await nextTick()
    }

    // 在等錨點之前公布，讓把錨點收在步驟條、分頁裡的頁面先切過去
    activeAnchor.value = step.anchor
    if (step.anchor === null) return

    const element = await waitForAnchor(step.anchor, ANCHOR_WAIT_TIMEOUT)

    if (element === null) {
      logger.warn(`錨點在 ${ANCHOR_WAIT_TIMEOUT}ms 內沒有出現，該步驟將以置中泡泡呈現：data-tour="${step.anchor}"`)
      return
    }

    scrollAnchorIntoView(element)
    await waitForStableRect(element, ANCHOR_SETTLE_TIMEOUT)
    await nextTick()
  }

  return {
    // 狀態
    activeTour,
    activeAnchor,
    availableTours,
    tourGroups,
    isRunning,

    // 方法
    startTour,
    stopTour,
    canStartTour,
    resolveStartBlockedHint,
    hasSeenTour,
    markTourSeen,
    resetSeenTours,
  }
})

/**
 * 組出「通用」組的名稱
 *
 * 不分組的導覽沒有定義檔裡的名稱可取，改由語系檔提供，每個語系各取一份，
 * 與其他組一樣交給畫面以 resolveTourText 決定顯示哪個語系。
 * @returns 各語系的「通用」
 */
function buildCommonGroupName(): TourText {
  return {
    'zh-TW': i18n.global.t('tour.group.common', {}, { locale: 'zh-TW' }),
    'en-US': i18n.global.t('tour.group.common', {}, { locale: 'en-US' }),
  }
}

/**
 * 組出錨點的選擇器；一律以 data-tour 定位，不依賴 class 或位置
 * @param anchor 錨點名稱
 * @returns CSS 選擇器
 */
export function buildAnchorSelector(anchor: string): string {
  return `[data-tour="${anchor}"]`
}

/**
 * 把錨點捲進視野，讓遮罩挖在使用者看得到的地方
 *
 * 步驟之間頁面可能已經捲到很下面，光是找到錨點還不夠：
 * 錨點若整個在畫面外，使用者只會看到遮罩框住一片空白。
 * @param element 錨點元素
 */
function scrollAnchorIntoView(element: HTMLElement) {
  element.scrollIntoView({ block: 'center', inline: 'nearest' })

  ensureHorizontallyVisible(element)
}

/**
 * 讓錨點在水平方向上完整看得見
 *
 * 兩個目標有衝突，依序處理：先試著靠左——遮罩掛在 body 上、不受捲動區裁切，
 * 一旦水平捲動，洞就會挖到側邊選單上。但欄位多的頁面本身就比畫面寬，
 * 右側的按鈕靠左之後根本不在畫面上，那時只能捲到剛好看得見為止。
 *
 * driver.js 高亮時也會自己捲動，而它捲的位置不一定足以讓元素完整露出來，
 * 因此 onHighlighted 也要再呼叫一次。
 * @param element 錨點元素
 * @returns 實際改變了捲動位置時為 true
 */
function ensureHorizontallyVisible(element: HTMLElement): boolean {
  const scrollContainer = element.closest('.q-scrollarea__container')
  if (scrollContainer === null) return false

  const previous = scrollContainer.scrollLeft
  if (previous !== 0) scrollContainer.scrollLeft = 0

  const viewportWidth = document.documentElement.clientWidth
  const overflow = element.getBoundingClientRect().right - viewportWidth
  if (overflow > 0) scrollContainer.scrollLeft = overflow + HORIZONTAL_SCROLL_MARGIN

  return scrollContainer.scrollLeft !== previous
}

/**
 * 等錨點的位置與尺寸穩定下來
 *
 * 在 DOM 裡不等於看得見：選單群組展開、對話框開啟、折疊區塊展開都有動畫，
 * 這段期間元素高度可能是 0 或一直在變。這時叫 driver.js 標位置，
 * 遮罩會挖在舊位置上——使用者看到的就是框在空白處。
 *
 * 以連續兩幀矩形一致作為穩定的判準，不寫死等待時間，動畫快慢都適用。
 * @param element 錨點元素
 * @param timeout 逾時毫秒數
 */
function waitForStableRect(element: HTMLElement, timeout: number): Promise<void> {
  return new Promise((resolve) => {
    const deadline = performance.now() + timeout
    let previous: DOMRect | null = null

    function check() {
      const current = element.getBoundingClientRect()
      const isVisible = current.width > 0 && current.height > 0
      const isSame = previous !== null && previous.top === current.top && previous.left === current.left && previous.height === current.height

      if ((isVisible && isSame) || performance.now() > deadline) {
        resolve()
        return
      }

      previous = current
      window.requestAnimationFrame(check)
    }

    window.requestAnimationFrame(check)
  })
}

/**
 * 等待錨點出現在畫面上
 * @param anchor 錨點名稱
 * @param timeout 逾時毫秒數
 * @returns 錨點元素；逾時時為 null
 */
function waitForAnchor(anchor: string, timeout: number): Promise<HTMLElement | null> {
  const selector = buildAnchorSelector(anchor)
  const existing = document.querySelector<HTMLElement>(selector)

  if (existing !== null) return Promise.resolve(existing)

  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      observer.disconnect()
      resolve(null)
    }, timeout)

    // 頁面是懶載入且資料非同步，錨點可能在任何時間點才掛上 DOM
    const observer = new MutationObserver(() => {
      const element = document.querySelector<HTMLElement>(selector)
      if (element === null) return

      window.clearTimeout(timer)
      observer.disconnect()
      resolve(element)
    })

    observer.observe(document.body, { childList: true, subtree: true })
  })
}
