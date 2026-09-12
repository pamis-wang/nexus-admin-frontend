/**
 * 系統內建導覽的狀態管理
 *
 * 導覽會跨路由播放，狀態必須在頁面切換後存活，因此放在 store 而非頁面區域狀態。
 * driver.js 實例是命令式物件，不放進響應式狀態，改以模組層變數持有。
 */
import { computed, nextTick, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import { useStorage } from '@vueuse/core'
import { driver, type Driver } from 'driver.js'
import router from '@/router'
import { useLogger } from '@/composables/useLogger'
import { useUserStore } from '@/stores/useUser'
import { findTourById, tourDefinitions } from '@/tours'
import type { TourDefinition, TourStep } from '@/types/tour'

import 'driver.js/dist/driver.css'

/** 等待錨點出現的逾時毫秒數，逾時就讓該步驟以置中泡泡呈現而不是卡住 */
const ANCHOR_WAIT_TIMEOUT = 5000

/** 未登入時用來歸戶「已看過」紀錄的識別字 */
const ANONYMOUS_USER_KEY = 'anonymous'

const logger = useLogger({ prefix: 'Tour', enabled: import.meta.env.DEV, showTimestamp: true })

/** 目前的 driver.js 實例，沒有導覽進行時為 null */
let driverInstance: Driver | null = null

export const useTourStore = defineStore('tour', () => {
  const userStore = useUserStore()

  /** 已看過的導覽紀錄：使用者唯一編號對應到已看過的導覽 id */
  const seenTourRecord = useStorage<Record<string, string[]>>('seenTours', {})

  /** 目前正在播放的導覽，沒有播放時為 null */
  const activeTour = shallowRef<TourDefinition | null>(null)

  /**
   * 目前這位使用者能看的導覽，供重看入口列出
   *
   * 依資源權限過濾：沒有該功能訪問權的人，選單看不到那個功能、路由守衛也會把他導去 403，
   * 導覽只會卡在等不到的錨點上。與其讓他點了才失敗，不如不要列出。
   */
  const availableTours = computed<TourDefinition[]>(() =>
    tourDefinitions.filter((definition) => definition.resourceName === null || userStore.hasPermission(definition.resourceName)),
  )

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
        需要路由: definition.requiresRouteName,
        需要權限: definition.resourceName,
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

    instance?.destroy()
  }

  /**
   * 目前這一頁能不能啟動指定導覽
   *
   * 兩道關卡：沒有該功能的權限一律不給播；綁定路由的導覽只有停在該頁時才播得動——
   * 那種頁面的網址帶識別編號，導覽定義無從得知要用哪一筆資料，只能沿用使用者當下所在的頁面。
   * @param tourId 導覽識別碼
   * @returns 可以啟動時為 true
   */
  function canStartTour(tourId: string): boolean {
    const definition = findTourById(tourId)

    if (definition === null) return false
    if (definition.resourceName !== null && !userStore.hasPermission(definition.resourceName)) return false
    if (definition.requiresRouteName === null) return true

    return router.currentRoute.value.name === definition.requiresRouteName
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
    const userProfile = userStore.userProfile
    if (userProfile === null || userProfile.id === '') return ANONYMOUS_USER_KEY

    return userProfile.id
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
      nextBtnText: '下一步',
      prevBtnText: '上一步',
      doneBtnText: '完成',
      progressText: '{{current}} / {{total}}',
      steps: definition.steps.map((step) => ({
        element: step.anchor === null ? undefined : buildAnchorSelector(step.anchor),
        popover: {
          title: step.title,
          description: step.description,
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

        const scrollContainer = element.closest('.q-scrollarea__container')
        if (scrollContainer === null || scrollContainer.scrollLeft === 0) return

        scrollContainer.scrollLeft = 0
        driverInstance?.refresh()
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

    if (step.anchor === null) return

    const element = await waitForAnchor(step.anchor, ANCHOR_WAIT_TIMEOUT)

    if (element === null) {
      logger.warn(`錨點在 ${ANCHOR_WAIT_TIMEOUT}ms 內沒有出現，該步驟將以置中泡泡呈現：data-tour="${step.anchor}"`)
      return
    }

    scrollAnchorIntoView(element)
    await nextTick()
  }

  return {
    // 狀態
    activeTour,
    availableTours,
    isRunning,

    // 方法
    startTour,
    stopTour,
    canStartTour,
    hasSeenTour,
    markTourSeen,
    resetSeenTours,
  }
})

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

  // 欄位多的表格會把整頁撐寬，一旦水平捲動，元素位置就落到側邊選單底下；
  // 遮罩掛在 body 上、不受捲動區裁切，就會把洞挖到選單上。一律靠左可避免。
  const scrollContainer = element.closest('.q-scrollarea__container')
  if (scrollContainer !== null) scrollContainer.scrollLeft = 0
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
