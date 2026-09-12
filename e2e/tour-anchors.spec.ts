/**
 * 導覽錨點防呆
 *
 * 掃過 src/tours/ 的每一份導覽定義，實際把導覽走一遍，
 * 確認每個步驟的 data-tour 錨點都存在於真正渲染出來的畫面上。
 *
 * 這裡刻意走使用者的真實路徑（從導覽選單啟動、按下一步前進），
 * 而不是自行維護一份「路由名稱對應網址」的表——那種表本身就會過期。
 * 導覽找不到錨點時會退化成置中泡泡，因此「錨點有沒有被高亮」正好是判準。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Page } from '@playwright/test'
import { test, expect } from './fixtures/authed'

const TOURS_DIR = fileURLToPath(new URL('../src/tours', import.meta.url))

/**
 * 綁定路由的導覽要停在該頁才播得動，而那些頁面的網址帶識別編號，
 * 無法從路由名稱推出來，只好在這裡列出測試用的網址；
 * 其中的識別編號由 fixtures/authed.ts 的假資料提供。
 * 只有這類導覽需要登記，一般導覽會自己導頁。
 */
const TEST_PATH_BY_ROUTE_NAME: Record<string, string> = {}

/** 導覽定義檔的形狀，只取本測試需要的欄位 */
interface TourStep {
  anchor: string | null
  title: string
  routeName: string | null
}

/** 一份導覽定義，附帶來源檔名以便錯誤訊息指路 */
interface TourFile {
  fileName: string
  id: string
  name: string
  requiresRouteName: string | null
  steps: TourStep[]
}

/*
 * 這支測試是資料驅動的：步驟數量、以及某一步有沒有指定錨點，都由 JSON 定義決定。
 * 迴圈內的分支是在描述資料的形狀，不是測試邏輯的不確定分支，因此關閉這條規則。
 */
/* eslint-disable playwright/no-conditional-in-test */

/**
 * 等待泡泡出現的逾時，必須大於 useTour 的 ANCHOR_WAIT_TIMEOUT（5 秒）。
 * 錨點不存在時，導覽會先等滿那 5 秒才改以置中泡泡顯示。
 * 這裡若設得比它短，會在泡泡出現前就逾時，
 * 錯誤訊息就會變成「導覽卡住」而蓋掉真正的原因（某個錨點不見了）。
 */
const POPOVER_TIMEOUT = 10_000

const TOURS = loadTours()

test('每一份導覽定義都通過驗證並出現在導覽選單', async ({ page }) => {
  await page.goto('/')
  await page.locator('[data-tour="topbar-tour-entry"]').click()

  const fileList = TOURS.map((tour) => tour.fileName).join('、')

  await expect(
    page.locator('.q-menu .q-item'),
    `src/tours/ 共有 ${TOURS.length} 份導覽定義（${fileList}），但導覽選單列出的數量不符，` +
      `代表有定義檔沒有通過格式驗證而被略過，或是它的 resourceName 對不上任何一筆權限`,
  ).toHaveCount(TOURS.length)
})

for (const tour of TOURS) {
  test(`導覽「${tour.name}」的每個錨點都存在於畫面上`, async ({ page }) => {
    await page.goto(resolveStartPath(tour))
    await startTour(page, tour)

    const popover = page.locator('.driver-popover')

    for (const [index, step] of tour.steps.entries()) {
      const stepLabel = `[${tour.id}] 第 ${index + 1} 步「${step.title}」`

      if (index > 0) await popover.locator('.driver-popover-next-btn').click()

      await expect(popover, `${stepLabel}：導覽沒有停在這一步，前一步可能卡住了`).toContainText(step.title, {
        timeout: POPOVER_TIMEOUT,
      })

      // 錨點存在不代表畫面是好的：頁面載入失敗時錯誤對話框會蓋在上面，
      // 而放在外層容器的錨點依然找得到。這一條用來抓那種情況。
      await expect(
        page.locator('.q-dialog'),
        `${stepLabel}：畫面出現非預期的對話框，該頁可能沒有正常載入（例如 API 回應格式不符）`,
      ).toHaveCount(0)

      // anchor 為 null 代表這一步刻意不指向元素，泡泡置中顯示
      if (step.anchor === null) continue

      await expect(
        page.locator(`[data-tour="${step.anchor}"]`),
        `${stepLabel}找不到錨點 data-tour="${step.anchor}"（頁面：${step.routeName ?? '不指定'}）。\n` +
          `該元素可能已被移除或改名。請把 data-tour 加回原本的元素，或同步修改 src/tours/${tour.fileName} 的這一步。`,
      ).toHaveClass(/driver-active-element/)

      // 錨點存在、也被高亮了，仍可能整個在畫面外——那時使用者只會看到遮罩框住空白處。
      // 導覽負責把目標捲進視野，這一條就是在守那件事。
      await expect(
        page.locator(`[data-tour="${step.anchor}"]`),
        `${stepLabel}的錨點不在可視範圍內。導覽應該先把它捲進畫面再顯示說明，否則使用者會看到遮罩框在空白處。`,
      ).toBeInViewport()
    }
  })
}

/**
 * 導覽要從哪一頁開始跑：綁定路由的導覽必須先停在該頁
 * @param tour 導覽定義
 * @returns 起始網址
 */
function resolveStartPath(tour: TourFile): string {
  if (tour.requiresRouteName === null) return '/'

  const startPath = TEST_PATH_BY_ROUTE_NAME[tour.requiresRouteName]
  if (startPath === undefined) {
    throw new Error(
      `導覽 ${tour.fileName} 綁定路由「${tour.requiresRouteName}」，` +
        `請在 e2e/tour-anchors.spec.ts 的 TEST_PATH_BY_ROUTE_NAME 補上該頁的測試網址。`,
    )
  }

  return startPath
}

/**
 * 從頂部欄的導覽選單啟動指定導覽
 * @param page 測試頁面
 * @param tour 導覽定義
 */
async function startTour(page: Page, tour: TourFile) {
  await page.locator('[data-tour="topbar-tour-entry"]').click()

  const entry = page.locator('.q-menu .q-item').filter({ hasText: tour.name })

  await expect(entry, `導覽選單裡找不到「${tour.name}」，請確認 src/tours/${tour.fileName} 有通過格式驗證`).toHaveCount(1)

  await entry.click()
}

/**
 * 讀取所有導覽定義檔
 * @returns 導覽定義，依檔名排序
 */
function loadTours(): TourFile[] {
  return fs
    .readdirSync(TOURS_DIR)
    .filter((fileName) => fileName.endsWith('.json'))
    .sort()
    .map((fileName) => {
      const fullPath = path.join(TOURS_DIR, fileName)

      try {
        const raw = JSON.parse(fs.readFileSync(fullPath, 'utf8')) as TourFile
        return { ...raw, fileName }
      } catch (error) {
        throw new Error(`導覽定義 src/tours/${fileName} 不是合法的 JSON：${(error as Error).message}`)
      }
    })
}
