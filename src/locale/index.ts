/**
 * 多語系的語系定義與初始語系判斷
 *
 * 語系檔依「語系資料夾／命名空間 JSON」組織：`zh-TW/table.json` 對應 `t('table.xxx')`。
 * 新增命名空間時，兩個語系的 index.ts 都要 import；繁中是結構基準，英文少了 key 型別檢查會失敗。
 *
 * 畫面文字一律寫在語系檔，元件內用 `const { t } = useI18n()`；
 * 元件以外（service、store、路由）拿不到 useI18n，改用 `@/plugins/i18n` 匯出的 `i18n.global.t`。
 */
import enUS from '@/locale/en-US'
import zhTW from '@/locale/zh-TW'

/** 支援的語系，採 BCP 47 格式，與後端 emailLanguage 的值一致 */
export type SupportedLocale = 'zh-TW' | 'en-US'

/** 語系檔的結構，以繁中為準 */
export type MessageSchema = typeof zhTW

/** 選單標題的 key，路由 meta.title 只能填這些值 */
export type MenuTitleKey = keyof MessageSchema['menu']

/** 初始語系判斷需要的資料 */
export interface InitialLocaleSource {
  /** 這台瀏覽器記住的語系：使用者手動切換過的語系 */
  storedLocale: string | null
  /** 瀏覽器的語言偏好，依優先順序排列 */
  browserLanguages: readonly string[]
}

/** 找不到翻譯時退回的語系；繁中是結構基準，一定有值 */
export const FALLBACK_LOCALE: SupportedLocale = 'zh-TW'

/** 語系切換選單的選項；名稱一律用該語言本身書寫，不隨目前語系翻譯，使用者才認得出自己的語言 */
export const LOCALE_OPTIONS: ReadonlyArray<{ value: SupportedLocale; label: string }> = [
  { value: 'zh-TW', label: '繁體中文' },
  { value: 'en-US', label: 'English' },
]

/** 各語系的語系檔 */
export const messages: Record<SupportedLocale, MessageSchema> = {
  'zh-TW': zhTW,
  'en-US': enUS,
}

/**
 * 是否為支援的語系
 * @param value 任意值，通常來自 localStorage 或後端
 * @returns 是支援的語系時為 true
 */
export function isSupportedLocale(value: unknown): value is SupportedLocale {
  return LOCALE_OPTIONS.some((option) => option.value === value)
}

/**
 * 依瀏覽器語言推定語系
 *
 * 只看第一偏好語言：中文一律用繁中（目前只有繁中一種中文），其他語言用英文。
 * @param browserLanguages 瀏覽器的語言偏好，依優先順序排列
 * @returns 推定的語系
 */
export function resolveBrowserLocale(browserLanguages: readonly string[]): SupportedLocale {
  const primaryLanguage = browserLanguages[0] ?? ''

  return primaryLanguage.toLowerCase().startsWith('zh') ? 'zh-TW' : 'en-US'
}

/**
 * 決定開啟網站時的語系
 *
 * 優先順序：瀏覽器記住的語系 → 瀏覽器語言。
 * 帳號沒有語系設定，使用者手動切換的結果記在這台瀏覽器，重新整理後也要保留。
 * @param source 初始語系判斷需要的資料
 * @returns 開啟網站時要套用的語系
 */
export function resolveInitialLocale(source: InitialLocaleSource): SupportedLocale {
  if (isSupportedLocale(source.storedLocale)) return source.storedLocale

  return resolveBrowserLocale(source.browserLanguages)
}
