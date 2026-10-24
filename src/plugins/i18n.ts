/**
 * 多語系外掛與語系切換
 *
 * 切換語系要同時動到三處：vue-i18n 的畫面文字、Quasar 元件內建的文字（日期選擇器的月份與星期等），以及頁籤標題。
 * 一律透過 setLocale 切換，不要直接改 i18n.global.locale，否則 Quasar 會停在舊語系。
 */
import { createI18n } from 'vue-i18n'
import { Lang, type QuasarLanguage } from 'quasar'
import quasarLanguageEnUS from 'quasar/lang/en-US'
import quasarLanguageZhTW from 'quasar/lang/zh-TW'
import { FALLBACK_LOCALE, messages, type MessageSchema, type SupportedLocale } from '@/locale'
import { STORAGE_KEY_PREFIX } from '@/stores/useUser'

declare module 'vue-i18n' {
  /** 讓 t() 的 key 有型別檢查：打錯或語系檔沒有的 key 會在 vue-tsc 被擋下 */
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface DefineLocaleMessage extends MessageSchema {}
}

/** 記住語系用的 localStorage 鍵值；前綴的理由見 STORAGE_KEY_PREFIX */
const LOCALE_STORAGE_KEY = `${STORAGE_KEY_PREFIX}locale`

/** 各語系對應的 Quasar 語言包 */
const QUASAR_LANGUAGE_PACKS: Record<SupportedLocale, QuasarLanguage> = {
  'zh-TW': quasarLanguageZhTW,
  'en-US': quasarLanguageEnUS,
}

export const i18n = createI18n<[MessageSchema], SupportedLocale, false>({
  legacy: false,
  locale: FALLBACK_LOCALE,
  fallbackLocale: FALLBACK_LOCALE,
  messages,
})

/**
 * 切換語系，並記在這台瀏覽器
 *
 * Quasar 語言包會一併設定 `<html lang>`，不必另外處理。
 * @param locale 要切換的語系
 */
export function setLocale(locale: SupportedLocale) {
  i18n.global.locale.value = locale
  // Quasar 自己的兩份型別不一致：語言包的 date.prevRangeYears 參數必填，Lang.set 卻宣告成可省略；實際是同一個物件
  Lang.set(QUASAR_LANGUAGE_PACKS[locale] as Parameters<typeof Lang.set>[0])
  document.title = i18n.global.t('layout.appTitle')
  localStorage.setItem(LOCALE_STORAGE_KEY, locale)
}

/**
 * 取得目前的語系
 * @returns 目前的語系
 */
export function getLocale(): SupportedLocale {
  return i18n.global.locale.value
}

/**
 * 讀取這台瀏覽器記住的語系
 * @returns 記住的值；可能是不支援的格式（例如底線的 zh_tw）或被手動改過，使用前要先檢查是否為支援的語系
 */
export function readStoredLocale(): string | null {
  return localStorage.getItem(LOCALE_STORAGE_KEY)
}
