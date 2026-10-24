import { describe, expect, it } from 'vitest'
import { isSupportedLocale, messages, resolveBrowserLocale, resolveInitialLocale } from '@/locale'

/**
 * 所有 .vue／.ts 原始碼（不含測試）
 *
 * vue-i18n 的 t() 型別接受任意字串，打錯 key 不會被 vue-tsc 擋下，執行時只會把 key 原樣顯示在畫面上。
 * 退而求其次在這裡掃原始碼，把字面值 key 逐一拿去語系檔比對。
 */
const sources: Record<string, string> = import.meta.glob<string>(['@/**/*.vue', '@/**/*.ts', '!@/__tests__/**'], {
  query: '?raw',
  import: 'default',
  eager: true,
})

/** t('key')、$t('key')、i18n.global.t('key') 的字面值 key；樣板字串組出來的 key 另有型別保護，這裡不處理 */
const TRANSLATION_CALL_PATTERN = /(?<![\w$])\$?t\(\s*(['"])([\w.-]+)\1/g

/** <i18n-t keypath="key"> 的 key */
const KEYPATH_PATTERN = /keypath=(['"])([\w.-]+)\1/g

describe('isSupportedLocale', () => {
  it('只接受 BCP 47 格式的兩種語系', () => {
    expect(isSupportedLocale('zh-TW')).toBe(true)
    expect(isSupportedLocale('en-US')).toBe(true)
    // 底線格式不是 BCP 47
    expect(isSupportedLocale('zh_tw')).toBe(false)
    expect(isSupportedLocale('')).toBe(false)
    expect(isSupportedLocale(null)).toBe(false)
  })
})

describe('resolveBrowserLocale', () => {
  it('第一偏好是任何一種中文都用繁中', () => {
    expect(resolveBrowserLocale(['zh-TW', 'en-US'])).toBe('zh-TW')
    expect(resolveBrowserLocale(['zh-CN'])).toBe('zh-TW')
    expect(resolveBrowserLocale(['zh'])).toBe('zh-TW')
  })

  it('第一偏好不是中文就用英文，即使後面有中文', () => {
    expect(resolveBrowserLocale(['en-US', 'zh-TW'])).toBe('en-US')
    expect(resolveBrowserLocale(['ja-JP'])).toBe('en-US')
  })

  it('瀏覽器沒有提供語言時用英文', () => {
    expect(resolveBrowserLocale([])).toBe('en-US')
  })
})

describe('resolveInitialLocale', () => {
  it('瀏覽器記住的語系最優先', () => {
    expect(resolveInitialLocale({ storedLocale: 'en-US', browserLanguages: ['zh-TW'] })).toBe('en-US')
  })

  it('記住的值不合法時視為沒有記住，依瀏覽器語言', () => {
    expect(resolveInitialLocale({ storedLocale: 'zh_tw', browserLanguages: ['en-GB'] })).toBe('en-US')
  })

  it('沒有記住語系時依瀏覽器語言', () => {
    expect(resolveInitialLocale({ storedLocale: null, browserLanguages: ['en-GB'] })).toBe('en-US')
    expect(resolveInitialLocale({ storedLocale: null, browserLanguages: ['zh-TW'] })).toBe('zh-TW')
  })
})

describe('語系檔', () => {
  it('兩個語系的 key 完全一致', () => {
    // 英文少了 key 會被型別擋下，但多出來的 key 不會；兩邊一起比對
    expect(collectKeys(messages['en-US'])).toEqual(collectKeys(messages['zh-TW']))
  })

  it('沒有空字串', () => {
    const emptyKeys = Object.entries(messages).flatMap(([locale, message]) =>
      collectKeys(message)
        .filter((key) => resolveMessage(message, key) === '')
        .map((key) => `${locale}:${key}`)
    )

    expect(emptyKeys).toEqual([])
  })

  it('沒有亂碼字元', () => {
    // 編碼轉換出錯時中文會變成 U+FFFD（�），畫面上看得到但肉眼審查很容易漏掉
    const garbledKeys = Object.entries(messages).flatMap(([locale, message]) =>
      collectKeys(message)
        .filter((key) => String(resolveMessage(message, key)).includes('�'))
        .map((key) => `${locale}:${key}`)
    )

    expect(garbledKeys).toEqual([])
  })

  it('原始碼沒有亂碼字元', () => {
    const garbledFiles = Object.entries(sources)
      .filter(([, source]) => source.includes('�'))
      .map(([path]) => path)

    expect(garbledFiles).toEqual([])
  })

  it('原始碼引用的 key 都存在', () => {
    const missingKeys = Object.entries(sources).flatMap(([path, source]) =>
      [...stripComments(source).matchAll(TRANSLATION_CALL_PATTERN), ...stripComments(source).matchAll(KEYPATH_PATTERN)]
        .map((match) => match[2] ?? '')
        .filter((key) => typeof resolveMessage(messages['zh-TW'], key) !== 'string')
        .map((key) => `${path}：${key}`)
    )

    expect(missingKeys, `以下 key 在語系檔找不到：\n${missingKeys.join('\n')}`).toEqual([])
  })
})

/**
 * 去掉原始碼的註解，避免註解裡的範例被當成真正的呼叫
 * @param source 原始碼
 * @returns 去掉區塊註解、HTML 註解與整行單行註解後的原始碼
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^\s*\/\/.*$/gm, '')
}

/**
 * 攤平語系檔的所有 key
 * @param message 語系檔或其中一段
 * @param prefix 上層的 key
 * @returns 以點串起的完整 key，依字母排序
 */
function collectKeys(message: object, prefix = ''): string[] {
  return Object.entries(message)
    .flatMap(([key, value]) => (typeof value === 'object' && value !== null ? collectKeys(value, `${prefix}${key}.`) : [`${prefix}${key}`]))
    .sort()
}

/**
 * 依完整 key 取出語系檔的值
 * @param message 語系檔
 * @param key 以點串起的完整 key
 * @returns 對應的值；路徑不存在時為 undefined
 */
function resolveMessage(message: object, key: string): unknown {
  return key
    .split('.')
    .reduce<unknown>((node, segment) => (typeof node === 'object' && node !== null ? (node as Record<string, unknown>)[segment] : undefined), message)
}
