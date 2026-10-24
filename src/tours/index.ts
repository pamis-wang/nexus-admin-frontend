/**
 * 導覽定義的載入與驗證
 *
 * 導覽內容是「資料」不是「程式碼」：只要在本目錄新增一份 JSON，
 * 不必修改任何 .ts／.vue 就會被自動收錄。
 * 給使用者看的文字（名稱、分組、步驟標題與說明、錨點條件的提示）同樣寫在 JSON 裡，每個語系各一份，
 * 顯示時再以 resolveTourText 取出目前語系的內容。
 *
 * JSON 不受 TypeScript 保護，因此在此做執行期驗證：
 * 開發環境直接拋錯（讓格式問題立刻現形），正式環境略過該份導覽並記錄錯誤，
 * 避免輔助功能的設定錯誤導致主功能無法使用。
 */
import { useLogger } from '@/composables/useLogger'
import { getLocale } from '@/plugins/i18n'
import type { TourAnchorRequirement, TourDefinition, TourStep, TourStepAlign, TourStepSide, TourText } from '@/types/tour'

/** 泡泡位置的合法值 */
const VALID_SIDES: readonly string[] = ['top', 'right', 'bottom', 'left']

/** 泡泡對齊方式的合法值 */
const VALID_ALIGNS: readonly string[] = ['start', 'center', 'end']

/** 繁中是基準語系，不能空白；其他語系還沒翻譯時可以先給空字串，畫面會退回顯示繁中 */
const BASE_LOCALE: keyof TourText = 'zh-TW'

/** 導覽文字必須逐一寫出的語系，與 TourText 的欄位一致 */
const TOUR_TEXT_LOCALES: readonly (keyof TourText)[] = ['zh-TW', 'en-US']

/** 每份導覽必須明確列出的欄位 */
const REQUIRED_DEFINITION_KEYS: readonly string[] = ['id', 'name', 'groupName', 'order', 'requiresRouteNames', 'resourceCode', 'requiresAnchor', 'steps']

/** 每個步驟必須明確列出的欄位 */
const REQUIRED_STEP_KEYS: readonly string[] = ['anchor', 'title', 'description', 'routeName', 'side', 'align']

const logger = useLogger({ prefix: 'Tour', enabled: import.meta.env.DEV, showTimestamp: true })

/** Vite 在建置期展開，收集本目錄下所有導覽定義 */
const tourModules = import.meta.glob<{ default: unknown }>('./*.json', { eager: true })

/** 所有通過驗證的導覽定義，依教學順序排序 */
export const tourDefinitions: TourDefinition[] = collectTourDefinitions()

/**
 * 依 id 取得導覽定義
 * @param tourId 導覽識別碼
 * @returns 導覽定義；找不到時為 null
 */
export function findTourById(tourId: string): TourDefinition | null {
  return tourDefinitions.find((definition) => definition.id === tourId) ?? null
}

/**
 * 取出導覽文字在目前語系的內容
 *
 * 每次呼叫都讀當下的語系，在模板或 computed 裡呼叫會追蹤語系，切換語系後自動重算。
 * 目前語系的文字是空字串時退回繁中：翻譯還沒補上時，寧可顯示中文也不要顯示一片空白。
 * @param text 導覽文字
 * @returns 目前語系要顯示的文字
 */
export function resolveTourText(text: TourText): string {
  const localized = text[getLocale()]

  return localized.trim() === '' ? text[BASE_LOCALE] : localized
}

/**
 * 收集並驗證所有導覽定義
 * @returns 通過驗證的導覽定義，依 order 排序；order 相同時依 id
 */
function collectTourDefinitions(): TourDefinition[] {
  const definitions: TourDefinition[] = []
  const seenIds = new Set<string>()

  for (const [path, module] of Object.entries(tourModules)) {
    const issues: string[] = []
    const definition = parseDefinition(module.default, issues)

    if (definition === null) {
      reportIssues(path, issues)
      continue
    }

    if (seenIds.has(definition.id)) {
      reportIssues(path, [`導覽 id「${definition.id}」與其他定義檔重複，id 必須全站唯一`])
      continue
    }

    seenIds.add(definition.id)
    definitions.push(definition)
  }

  return definitions.sort((left, right) => (left.order === right.order ? left.id.localeCompare(right.id) : left.order - right.order))
}

/**
 * 驗證單一導覽定義
 * @param raw 定義檔的原始內容
 * @param issues 驗證過程發現的問題，會就地追加
 * @returns 驗證通過的導覽定義；有問題時為 null
 */
function parseDefinition(raw: unknown, issues: string[]): TourDefinition | null {
  if (typeof raw !== 'object' || raw === null) {
    issues.push('內容不是物件')
    return null
  }

  const source = raw as Record<string, unknown>

  // 欄位固定，不允許省略：漏寫 resourceCode 會讓沒權限的人也看到那份導覽，
  // 漏寫 requiresRouteNames 會讓綁定頁面的導覽在別頁被啟動、卡在等不到的錨點上，都不能靜默放行
  const missingKeys = REQUIRED_DEFINITION_KEYS.filter((key) => !(key in source))
  if (missingKeys.length > 0) {
    issues.push(`缺少欄位 ${missingKeys.join('、')}`)
    return null
  }

  if (!isNonEmptyString(source.id)) issues.push('id 必須是非空字串')
  validateTourText(source.name, 'name', issues)
  if (source.groupName !== null) validateTourText(source.groupName, 'groupName（不分組時給 null）', issues)
  if (typeof source.order !== 'number' || !Number.isFinite(source.order)) issues.push('order 必須是數字')
  if (!Array.isArray(source.requiresRouteNames) || !source.requiresRouteNames.every((routeName) => isNonEmptyString(routeName))) {
    issues.push('requiresRouteNames 必須是字串陣列，不綁定頁面時給空陣列')
  }
  if (source.resourceCode !== null && !isNonEmptyString(source.resourceCode)) {
    issues.push('resourceCode 必須是非空字串或 null')
  }
  const requiresAnchor = parseAnchorRequirement(source.requiresAnchor, issues)
  if (!Array.isArray(source.steps) || source.steps.length === 0) {
    issues.push('steps 必須是至少有一個步驟的陣列')
    return null
  }

  const steps = source.steps.map((rawStep, index) => parseStep(rawStep, index, issues))

  if (issues.length > 0) return null

  return {
    id: source.id as string,
    name: source.name as TourText,
    groupName: source.groupName as TourText | null,
    order: source.order as number,
    requiresRouteNames: source.requiresRouteNames as string[],
    resourceCode: source.resourceCode as string | null,
    requiresAnchor,
    steps: steps as TourStep[],
  }
}

/**
 * 驗證導覽啟動前要出現的錨點
 * @param raw requiresAnchor 的原始內容
 * @param issues 驗證過程發現的問題，會就地追加
 * @returns 驗證通過的條件；不限或有問題時為 null
 */
function parseAnchorRequirement(raw: unknown, issues: string[]): TourAnchorRequirement | null {
  if (raw === null) return null

  if (typeof raw !== 'object' || Array.isArray(raw)) {
    issues.push('requiresAnchor 必須是 { anchor, hint } 物件或 null')
    return null
  }

  const source = raw as Record<string, unknown>
  const issueCount = issues.length

  // 提示不能省：選單上灰掉的項目若不說為什麼，使用者只會以為導覽壞了
  if (!isNonEmptyString(source.anchor)) issues.push('requiresAnchor.anchor 必須是非空字串')
  validateTourText(source.hint, 'requiresAnchor.hint', issues)

  if (issues.length > issueCount) return null

  return { anchor: source.anchor as string, hint: source.hint as TourText }
}

/**
 * 驗證單一步驟
 * @param raw 步驟的原始內容
 * @param index 步驟序號，從 0 起算
 * @param issues 驗證過程發現的問題，會就地追加
 * @returns 驗證通過的步驟；有問題時為 null
 */
function parseStep(raw: unknown, index: number, issues: string[]): TourStep | null {
  const stepLabel = `第 ${index + 1} 步`

  if (typeof raw !== 'object' || raw === null) {
    issues.push(`${stepLabel}：內容不是物件`)
    return null
  }

  const source = raw as Record<string, unknown>

  // 欄位固定，不允許省略：漏寫時要在這裡就被指出，而不是導覽跑到一半才出狀況
  const missingKeys = REQUIRED_STEP_KEYS.filter((key) => !(key in source))
  if (missingKeys.length > 0) {
    issues.push(`${stepLabel}：缺少欄位 ${missingKeys.join('、')}`)
    return null
  }

  const issueCount = issues.length

  if (source.anchor !== null && !isNonEmptyString(source.anchor)) issues.push(`${stepLabel}：anchor 必須是非空字串或 null`)
  validateTourText(source.title, `${stepLabel}：title`, issues)
  validateTourText(source.description, `${stepLabel}：description`, issues)
  if (source.routeName !== null && !isNonEmptyString(source.routeName)) issues.push(`${stepLabel}：routeName 必須是非空字串或 null`)
  if (source.side !== null && !VALID_SIDES.includes(source.side as string)) {
    issues.push(`${stepLabel}：side 必須是 ${VALID_SIDES.join('／')} 或 null`)
  }
  if (source.align !== null && !VALID_ALIGNS.includes(source.align as string)) {
    issues.push(`${stepLabel}：align 必須是 ${VALID_ALIGNS.join('／')} 或 null`)
  }

  if (issues.length > issueCount) return null

  return {
    anchor: source.anchor as string | null,
    title: source.title as TourText,
    description: source.description as TourText,
    routeName: source.routeName as string | null,
    side: source.side as TourStepSide | null,
    align: source.align as TourStepAlign | null,
  }
}

/**
 * 驗證導覽文字：必須是物件，每個語系都要寫出字串，繁中不能空白
 *
 * 其他語系允許空字串：翻譯可以晚一步補上，在那之前畫面退回顯示繁中，
 * 還沒翻的段落由導覽定義的測試列出來。但欄位本身不能省略——
 * 缺了哪個語系或把語系代碼拼錯（例：en-us）就逐一點名，一看就知道要補哪裡。
 * @param value 待檢查的值
 * @param label 錯誤訊息裡的欄位名稱（例：name、第 2 步：title）
 * @param issues 驗證過程發現的問題，會就地追加
 */
function validateTourText(value: unknown, label: string, issues: string[]): void {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    issues.push(`${label} 必須是物件，逐一寫出 ${TOUR_TEXT_LOCALES.join('、')} 的文字`)
    return
  }

  const source = value as Record<string, unknown>
  const missingLocales = TOUR_TEXT_LOCALES.filter((locale) => typeof source[locale] !== 'string')

  if (missingLocales.length > 0) {
    issues.push(`${label} 缺少 ${missingLocales.join('、')} 的文字；還沒翻譯的語系給空字串`)
    return
  }

  if (!isNonEmptyString(source[BASE_LOCALE])) issues.push(`${label} 的 ${BASE_LOCALE} 必須是非空字串`)
}

/**
 * 回報定義檔問題：開發環境直接拋錯，正式環境記錄後略過
 * @param path 定義檔路徑
 * @param issues 發現的問題
 */
function reportIssues(path: string, issues: string[]): void {
  const message = `導覽定義 ${path} 格式錯誤：\n- ${issues.join('\n- ')}`

  if (import.meta.env.DEV) throw new Error(message)

  logger.error(message)
}

/**
 * 是否為非空字串
 * @param value 待檢查的值
 * @returns 是非空字串時為 true
 */
function isNonEmptyString(value: unknown): boolean {
  return typeof value === 'string' && value.trim() !== ''
}
