import { afterEach, describe, expect, it } from 'vitest'
import type { RouteRecordRaw } from 'vue-router'
import { i18n } from '@/plugins/i18n'
import { allRoutes, featureRoutes } from '@/router/routes'
import { findTourById, resolveTourText, tourDefinitions } from '@/tours'
import type { TourDefinition, TourText } from '@/types/tour'

/**
 * 本站導覽定義檔的檢查
 *
 * 只讀 tourDefinitions 與路由匯出，不寫死任何一份導覽的內容，每一站都能沿用。
 */

/** 選單項目的錨點前綴，與選單元件的 buildMenuAnchor 一致 */
const MENU_ANCHOR_PREFIX = 'menu-'

/** 導覽文字的每個語系，與 TourText 的欄位一致 */
const TOUR_TEXT_LOCALES: (keyof TourText)[] = ['zh-TW', 'en-US']

/** 還沒翻譯也能上線的語系：空白時畫面退回繁中，只列進翻譯進度，不算錯 */
const OPTIONAL_LOCALES: (keyof TourText)[] = ['en-US']

/**
 * 所有 .vue 原始碼，用來比對導覽的錨點有沒有宣告在畫面上
 *
 * 錨點改名或被刪掉時，導覽只會默默退化成置中泡泡，畫面上看不出壞了；
 * e2e 實際把導覽走一遍之外，這裡先比對原始碼，在單元測試就擋下來。
 */
const vueSources: string[] = Object.values(import.meta.glob<string>('@/**/*.vue', { query: '?raw', import: 'default', eager: true }))

/**
 * data-tour 綁定樣板字串時的固定前綴，例如 `tab-${tab.key}` 的 tab-
 *
 * 分頁、清單這類錨點由資料組出來，原始碼只看得到前綴
 */
const anchorPrefixes: string[] = vueSources.flatMap((source) => [...source.matchAll(/data-tour="`([\w-]+)\$\{/g)].map((match) => match[1] ?? ''))

/** 所有路由記錄，含巢狀子路由 */
const routeRecords: RouteRecordRaw[] = flattenRoutes(allRoutes)

/** 出現在左側選單上的路由名稱：功能路由中各層有標題的項目 */
const menuRouteNames: Set<string> = new Set(
  flattenRoutes(featureRoutes)
    .filter((route) => hasMenuTitle(route))
    .map((route) => String(route.name))
)

describe('導覽定義載入', () => {
  it('目錄下的定義檔都通過驗證', () => {
    // 載入時若有定義檔格式錯誤，開發環境會直接拋錯，這個測試就會紅
    expect(tourDefinitions.length).toBeGreaterThan(0)
  })

  it('依 order 由小到大排序', () => {
    const orders = tourDefinitions.map((definition) => definition.order)

    expect(orders).toEqual([...orders].sort((left, right) => left - right))
  })

  it('id 全站唯一', () => {
    const ids = tourDefinitions.map((definition) => definition.id)

    expect(new Set(ids).size).toBe(ids.length)
  })

  it('新手導覽存在、不綁定頁面也不限權限', () => {
    // 新手上路給第一次使用的人從頂部列的入口開，綁了頁面或權限就有人開不了
    const gettingStarted = findTourById('getting-started')

    expect(gettingStarted?.requiresRouteNames).toEqual([])
    expect(gettingStarted?.resourceCode).toBeNull()
  })

  it('步驟文字沒有寫入時毀損的字元', () => {
    // 寫檔管道曾把中文寫壞成取代字元，畫面上會看到一個黑色菱形問號。
    // 壞字不會讓任何機制失效，只會默默上線給使用者看見，因此在這裡擋下來。
    const REPLACEMENT_CHARACTER = String.fromCharCode(0xfffd)

    const damaged = tourDefinitions.flatMap((definition) =>
      collectTourTexts(definition)
        .flatMap(({ text }) => TOUR_TEXT_LOCALES.map((locale) => text[locale]))
        .filter((text) => text.includes(REPLACEMENT_CHARACTER))
        .map((text) => `${definition.id}：${text.slice(0, 20)}`)
    )

    expect(damaged, `以下文字含有毀損字元，請重新寫入那一段：${damaged.join('、')}`).toEqual([])
  })

  it('每個錨點都宣告在畫面上', () => {
    const missing = tourDefinitions.flatMap((definition) => [
      ...definition.steps
        .filter((step) => step.anchor !== null && !isAnchorDeclared(step.anchor))
        .map((step) => `${definition.id}「${step.title['zh-TW']}」→ data-tour="${step.anchor}"`),
      ...(definition.requiresAnchor !== null && !isAnchorDeclared(definition.requiresAnchor.anchor)
        ? [`${definition.id} 的 requiresAnchor → data-tour="${definition.requiresAnchor.anchor}"`]
        : []),
    ])

    expect(missing, `以下錨點在任何 .vue 都找不到，請把 data-tour 加回元素，或同步修改導覽定義：\n${missing.join('\n')}`).toEqual([])
  })

  it('步驟與綁定頁面用到的路由名稱都存在', () => {
    const routeNames = new Set(routeRecords.map((route) => String(route.name)))

    const unknown = tourDefinitions.flatMap((definition) =>
      [...definition.requiresRouteNames, ...definition.steps.map((step) => step.routeName)]
        .filter((routeName): routeName is string => routeName !== null && !routeNames.has(routeName))
        .map((routeName) => `${definition.id}：${routeName}`)
    )

    expect(unknown, `以下路由名稱不存在，可能已改名：${unknown.join('、')}`).toEqual([])
  })

  it('步驟自動導頁的路由不帶網址參數', () => {
    // 導覽只會以路由名稱導頁，不知道要帶哪一筆資料的編號；帶參數的頁面要改用 requiresRouteNames 綁定
    const parameterized = new Set(routeRecords.filter((route) => route.path.includes(':')).map((route) => String(route.name)))

    const invalid = tourDefinitions.flatMap((definition) =>
      definition.steps
        .filter((step) => step.routeName !== null && parameterized.has(step.routeName))
        .map((step) => `${definition.id}「${step.title['zh-TW']}」→ ${step.routeName}`)
    )

    expect(invalid, `以下步驟會導到需要網址參數的頁面，改用 requiresRouteNames 綁定該頁：\n${invalid.join('\n')}`).toEqual([])
  })

  it.each(TOUR_TEXT_LOCALES)('導覽名稱不會互為子字串（%s）', (locale) => {
    // 名稱是使用者在選單上辨認導覽的唯一依據，一個名稱若是另一個的子字串，很容易點錯。
    // 比的是畫面上實際顯示的文字：還沒翻譯的語系會退回繁中
    const clashes = tourDefinitions.flatMap((definition) => {
      const name = displayText(definition.name, locale)

      return tourDefinitions
        .filter((other) => other.id !== definition.id && displayText(other.name, locale).includes(name))
        .map((other) => `${name}（被包含於：${displayText(other.name, locale)}）`)
    })

    expect(clashes, `以下導覽名稱是其他導覽名稱的子字串，請加上模組前綴以示區別：${clashes.join('、')}`).toEqual([])
  })

  it('同一分組的每份定義，各語系的分組名稱都一致', () => {
    // 分組以繁中名稱為準，選單顯示的是該組第一份定義的名稱；
    // 其他份的翻譯寫得不一樣時不會報錯，只會默默被忽略，因此在這裡擋下來。
    // 還沒翻譯（空白）的不比，那是翻譯進度的事
    const firstByGroup = new Map<string, TourText>()

    const mismatched = tourDefinitions.flatMap((definition) => {
      if (definition.groupName === null) return []

      const groupName = definition.groupName
      const first = firstByGroup.get(groupName['zh-TW'])
      if (first === undefined) {
        firstByGroup.set(groupName['zh-TW'], groupName)
        return []
      }

      return TOUR_TEXT_LOCALES.filter((locale) => !isBlank(groupName[locale]) && !isBlank(first[locale]) && groupName[locale] !== first[locale]).map(
        (locale) => `${definition.id} 的 ${locale}「${groupName[locale]}」與同組的「${first[locale]}」不同`
      )
    })

    expect(mismatched, `以下分組名稱與同組其他定義不一致：\n${mismatched.join('\n')}`).toEqual([])
  })

  it('不分組的導覽 groupName 給 null，不手寫「通用」', () => {
    // 「通用」組由 groupName: null 歸成一組；手寫成同名的分組會在選單上多出一組同名的群組
    const commonGroupName = i18n.global.t('tour.group.common', {}, { locale: 'zh-TW' })

    const handWritten = tourDefinitions.filter((definition) => definition.groupName?.['zh-TW'] === commonGroupName).map((definition) => definition.id)

    expect(handWritten, `以下導覽的 groupName 手寫成「${commonGroupName}」，請改成 null：${handWritten.join('、')}`).toEqual([])
  })

  it('查無此 id 時回傳 null 而不是拋錯', () => {
    expect(findTourById('不存在的導覽')).toBeNull()
  })
})

/*
 * 翻譯進度：列出英文還沒翻的段落
 *
 * 英文空白時畫面退回繁中，功能不受影響，所以不算失敗，各站在翻譯前也能先換上導覽核心。
 * 每份還有段落沒翻的導覽登記成一項 todo：測試摘要的 todo 數就是還沒翻完的導覽數，
 * 項目名稱寫出是哪幾段（加 --reporter=verbose 逐項列出）。全部翻完時不登記任何項目。
 * 不包在 describe 裡：全部翻完時那一組會是空的，vitest 會把空的分組當成錯誤。
 * todo 在這裡是刻意的，用來列出進度而不是待寫的測試，因此關掉 warn-todo 這條規則。
 */
const untranslatedTexts = tourDefinitions.flatMap((definition) =>
  OPTIONAL_LOCALES.map((locale) => ({
    id: definition.id,
    locale,
    labels: collectTourTexts(definition)
      .filter(({ text }) => isBlank(text[locale]))
      .map(({ label }) => label),
  })).filter(({ labels }) => labels.length > 0)
)

untranslatedTexts.forEach(({ id, locale, labels }) => {
  // oxlint-disable-next-line vitest/warn-todo
  it.todo(`翻譯進度：${id} 的 ${locale} 還有 ${labels.length} 段沒翻（${labels.join('、')}）`)
})

describe('resolveTourText', () => {
  afterEach(() => {
    i18n.global.locale.value = 'zh-TW'
  })

  it('繁中顯示繁中文字', () => {
    expect(resolveTourText({ 'zh-TW': '公司資料', 'en-US': 'Company profile' })).toBe('公司資料')
  })

  it('英文顯示英文文字', () => {
    i18n.global.locale.value = 'en-US'

    expect(resolveTourText({ 'zh-TW': '公司資料', 'en-US': 'Company profile' })).toBe('Company profile')
  })

  it('目前語系的文字是空字串時退回繁中，不顯示空白', () => {
    i18n.global.locale.value = 'en-US'

    expect(resolveTourText({ 'zh-TW': '公司資料', 'en-US': '' })).toBe('公司資料')
    expect(resolveTourText({ 'zh-TW': '公司資料', 'en-US': '  ' })).toBe('公司資料')
  })
})

/**
 * 取出一份導覽定義裡所有給使用者看的文字
 * @param definition 導覽定義
 * @returns 每段文字與它在定義檔裡的位置：名稱、分組名稱、錨點條件的提示，以及每個步驟的標題與說明
 */
function collectTourTexts(definition: TourDefinition): { label: string; text: TourText }[] {
  return [
    { label: 'name', text: definition.name },
    ...(definition.groupName === null ? [] : [{ label: 'groupName', text: definition.groupName }]),
    ...(definition.requiresAnchor === null ? [] : [{ label: 'requiresAnchor.hint', text: definition.requiresAnchor.hint }]),
    ...definition.steps.flatMap((step, index) => [
      { label: `第 ${index + 1} 步 title`, text: step.title },
      { label: `第 ${index + 1} 步 description`, text: step.description },
    ]),
  ]
}

/**
 * 畫面上實際顯示的文字：該語系空白時退回繁中，與 resolveTourText 一致
 * @param text 導覽文字
 * @param locale 語系
 * @returns 顯示的文字
 */
function displayText(text: TourText, locale: keyof TourText): string {
  return isBlank(text[locale]) ? text['zh-TW'] : text[locale]
}

/**
 * 是否為空白字串
 * @param value 文字
 * @returns 空字串或只有空白時為 true
 */
function isBlank(value: string): boolean {
  return value.trim() === ''
}

/**
 * 錨點是否有宣告在畫面上
 * @param anchor 錨點名稱
 * @returns 找得到宣告時為 true
 */
function isAnchorDeclared(anchor: string): boolean {
  // 選單項目的錨點由路由名稱組出來，原始碼裡不會有字面值
  if (anchor.startsWith(MENU_ANCHOR_PREFIX) && menuRouteNames.has(anchor.slice(MENU_ANCHOR_PREFIX.length))) return true

  if (anchorPrefixes.some((prefix) => prefix !== '' && anchor.startsWith(prefix))) return true

  // 錨點也可能寫在資料裡再綁到 data-tour（例如分區設定的 tourAnchor），所以比對整份 .vue 的字串字面值
  return vueSources.some((source) => source.includes(`"${anchor}"`) || source.includes(`'${anchor}'`))
}

/**
 * 是否為會出現在選單上的路由
 * @param route 路由記錄
 * @returns 有標題時為 true
 */
function hasMenuTitle(route: RouteRecordRaw): boolean {
  return route.meta?.title !== undefined && route.meta.title !== ''
}

/**
 * 攤平巢狀路由
 * @param routes 路由記錄
 * @returns 所有層級的路由記錄
 */
function flattenRoutes(routes: RouteRecordRaw[]): RouteRecordRaw[] {
  return routes.flatMap((route) => [route, ...flattenRoutes(route.children ?? [])])
}
