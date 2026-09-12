import { test, expect } from '@playwright/test'

/**
 * 冒煙測試：應用程式能正常啟動，且未登入時會被路由守衛擋在登入頁。
 * 這裡刻意不種入任何登入狀態，驗的是最外層的把關行為。
 */
test('未登入時進入系統會被導向登入頁', async ({ page }) => {
  await page.goto('/')

  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('button', { name: '登入' })).toBeVisible()
})
