import process from 'node:process'
import { defineConfig, devices } from '@playwright/test'

/**
 * e2e 專用的開發伺服器埠號
 *
 * 刻意不用 Vite 預設的 5173：後台專案的開發伺服器常佔著它，
 * 而 reuseExistingServer 只看埠號、不看是哪個專案，會直接拿別的專案來測。
 * 起服務時加 --strictPort，埠號被佔用就報錯，不會默默換到別的埠。
 */
const DEV_SERVER_PORT = 5191

/** 參考 https://playwright.dev/docs/test-configuration */
export default defineConfig({
  testDir: './e2e',
  /* 單一測試的逾時上限；導覽要逐步播完，步驟多的那幾份需要比預設更長 */
  timeout: 60 * 1000,
  expect: {
    /* expect() 等待條件成立的逾時上限 */
    timeout: 5000,
  },
  /* CI 上若不小心留下 test.only 就讓建置失敗 */
  forbidOnly: !!process.env.CI,
  /* 只在 CI 上重試 */
  retries: process.env.CI ? 2 : 0,
  /* CI 上不平行跑，避免資源爭用造成偶發失敗 */
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    /* 單一動作（如 click）的逾時上限，0 為不限制 */
    actionTimeout: 0,
    /* page.goto('/') 的基底網址 */
    baseURL: process.env.CI ? 'http://localhost:4173' : `http://localhost:${DEV_SERVER_PORT}`,
    /* 重試時才收集追蹤檔 */
    trace: 'on-first-retry',
    /*
     * CI 上跑無頭模式，本機預設保留畫面方便排查。
     * 本機想在背景跑、不要一直彈出瀏覽器時，設 PLAYWRIGHT_HEADLESS=1。
     */
    headless: !!process.env.CI || process.env.PLAYWRIGHT_HEADLESS === '1',
    /*
     * 網站沒有記住語系時依瀏覽器語言決定介面語系，Playwright 的瀏覽器預設是 en-US。
     * 固定成繁中，測試裡用中文文字找元素才找得到；要測英文介面的案例再個別覆寫。
     */
    locale: 'zh-TW',
  },

  /*
   * 目前只跑 chromium。導覽錨點測試驗的是 data-tour 存不存在與有沒有捲進視野，
   * 那是版面行為不是瀏覽器相容性，跑三種瀏覽器只是讓等待時間變三倍。
   * 真的要驗跨瀏覽器再加 firefox／webkit，記得先 npx playwright install。
   */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* 開測試前自動起服務；本機用 dev 回饋快，CI 用 preview 貼近正式產物 */
  webServer: {
    command: process.env.CI ? 'npm run preview' : `npm run dev -- --port ${DEV_SERVER_PORT} --strictPort`,
    port: process.env.CI ? 4173 : DEV_SERVER_PORT,
    reuseExistingServer: !process.env.CI,
  },
})
