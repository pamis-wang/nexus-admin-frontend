/**
 * 已登入狀態的測試環境
 *
 * 登入狀態與權限都放在 localStorage，路由守衛只讀這些值，因此直接種進去就能繞過登入頁；
 * 後端在測試環境不存在，API 一律攔截後回傳假資料。
 *
 * 權限查詢表要種齊：守衛是用 meta.resourceName 去查這張表，少一個鍵那一頁就會被導去 403，
 * 導覽會停在一個永遠等不到錨點的頁面上。
 */
import { test as base, type Page } from '@playwright/test'

/** 測試用的假使用者 */
const USER_PROFILE = {
  id: 'e2e-user',
  account: 'e2e',
  email: 'e2e@example.com',
  fullName: '測試員',
  roles: [{ id: 'e2e-role', name: '測試角色' }],
}

/** 該用戶被指派的角色 */
const ASSIGNED_ROLES = [
  { id: 'e2e-role', name: '測試角色' },
  { id: 'other-role', name: '一般使用者' },
]

/**
 * 全系統的資源，與 src/router 各路由的 meta.resourceName 一一對應
 *
 * 這份清單就是權限的來源：漏掉一筆，那個功能的選單與頁面都會消失。
 */
const RESOURCE_NAMES = [
  '首頁',
  '系統管理',
  '系統管理>用戶管理',
  '系統管理>角色管理',
  '系統管理>資源管理',
  '內容管理',
  '內容管理>文章管理',
  '內容管理>進階設定',
  '內容管理>進階設定>分類設定',
  '內容管理>進階設定>標籤設定',
]

/** 後台用戶的假資料，需要至少兩列才能驗證「只有第一列帶錨點」 */
const ADMIN_USERS = [
  {
    id: 'user-1',
    account: 'alice',
    email: 'alice@example.com',
    fullName: '王小明',
    isSystemDefault: true,
    isDisabled: false,
    activateAt: '2026-01-02T03:04:05Z',
    lastLoginAt: '2026-09-01T08:00:00Z',
    roleMappings: [{ adminId: 'user-1', adminName: '王小明', roleId: 'e2e-role', roleName: '測試角色' }],
    logins: [
      {
        id: 'login-1',
        provider: 'password',
        providerName: '密碼登入',
        providerEmail: 'alice@example.com',
        verifiedAt: '2026-01-02T03:04:05Z',
        isUsable: true,
        requiresReset: false,
        failedCount: 0,
        lockedUntil: null,
        lastUsedAt: '2026-09-01T08:00:00Z',
      },
    ],
  },
  {
    id: 'user-2',
    account: 'bob',
    email: 'bob@example.com',
    // 姓名可空，用來確認列表上會顯示為「-」
    fullName: null,
    isSystemDefault: false,
    isDisabled: true,
    activateAt: null,
    lastLoginAt: null,
    roleMappings: [],
    // 沒有登入方式，用來確認列表上會標示「尚未綁定登入方式」
    logins: [],
  },
]

/** 角色的假資料，userCount 需有非零值才能呈現「有人在用就刪不掉」的狀態 */
const ADMIN_ROLES = [
  { id: 'e2e-role', name: '測試角色', isSystemDefault: true, version: 'v1', userCount: 2 },
  { id: 'other-role', name: '一般使用者', isSystemDefault: false, version: 'v1', userCount: 0 },
]

export const test = base.extend({
  page: async ({ page }, use) => {
    await mockApi(page)
    await seedAuthState(page)
    await use(page)
  },
})

export { expect } from '@playwright/test'

/**
 * 把登入狀態與權限種進 localStorage
 * @param page 測試頁面
 */
async function seedAuthState(page: Page) {
  const storageEntries: Record<string, string> = {
    // useStorage 對字串型別直接存原值，不做 JSON 編碼
    accessToken: 'e2e-access-token',
    refreshToken: 'e2e-refresh-token',
    isAuthenticated: 'true',
    permissionMode: 'union',
    userProfile: JSON.stringify(USER_PROFILE),
    assignedRoles: JSON.stringify(ASSIGNED_ROLES),
    activeRoles: JSON.stringify([ASSIGNED_ROLES[0]]),
    resourcePermissions: JSON.stringify(buildResourcePermissions()),
  }

  await page.addInitScript((entries: Record<string, string>) => {
    for (const [key, value] of Object.entries(entries)) {
      window.localStorage.setItem(key, value)
    }
  }, storageEntries)
}

/**
 * 攔截全部後端請求
 *
 * 路由的比對順序是後註冊的優先，因此路徑較長的要放在後面，
 * 否則 /api/admin-resources/tree 會被 /api/admin-resources 先接走。
 * @param page 測試頁面
 */
async function mockApi(page: Page) {
  // 先擺 catch-all：沒有明確攔截的端點一律回成功空值，
  // 避免漏網的請求打到不存在的後端，讓頁面跳出錯誤對話框蓋住導覽
  await fulfillJson(page, '**/api/**', null)

  await fulfillJson(page, '**/api/auth/authorization', {
    permissionMode: 'union',
    roles: ASSIGNED_ROLES,
    activeRoles: [ASSIGNED_ROLES[0]],
    permissions: buildPermissionTree(),
  })

  await fulfillJson(page, '**/api/admin-users', ADMIN_USERS)
  await fulfillJson(page, '**/api/admin-roles', ADMIN_ROLES)
  await fulfillJson(page, '**/api/admin-resources', buildFlatResources())
  await fulfillJson(page, '**/api/admin-resources/tree', { version: 'v1', items: buildResourceTree() })
}

/**
 * 讓指定路徑回傳後端的標準回應結構
 * @param page 測試頁面
 * @param urlPattern 要攔截的網址樣式
 * @param data 要回傳的資料
 */
async function fulfillJson(page: Page, urlPattern: string, data: unknown) {
  await page.route(urlPattern, (route) => {
    void route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data, error: null }),
    })
  })
}

/**
 * 組出攤平的權限查詢表，全部資源都給滿四種權限
 * @returns 資源完整路徑對應到四種權限
 */
function buildResourcePermissions(): Record<string, Record<string, boolean>> {
  const table: Record<string, Record<string, boolean>> = {}

  for (const resourceName of RESOURCE_NAMES) {
    table[resourceName] = { canAccess: true, canCreate: true, canUpdate: true, canDelete: true }
  }

  return table
}

/**
 * 組出授權端點要回傳的權限樹
 *
 * 前端只用 resourceName 當鍵，樹的巢狀結構不影響查詢結果，
 * 因此這裡攤平成同一層即可，不必還原真正的父子關係。
 * @returns 權限樹
 */
function buildPermissionTree(): unknown[] {
  return RESOURCE_NAMES.map((resourceName, index) => ({
    resourceId: `resource-${index + 1}`,
    parentId: null,
    resourceName,
    level: 1,
    displayOrder: index + 1,
    canAccess: true,
    canCreate: true,
    canUpdate: true,
    canDelete: true,
    children: [],
  }))
}

/**
 * 組出角色權限矩陣要用的扁平資源列表
 * @returns 扁平的資源列表
 */
function buildFlatResources(): unknown[] {
  return RESOURCE_NAMES.map((resourceName, index) => ({
    id: `resource-${index + 1}`,
    parentId: resolveParentId(resourceName),
    level: resourceName.split('>').length,
    resourceName,
    resourceCode: null,
    displayOrder: index + 1,
    isEnabled: true,
  }))
}

/**
 * 組出選單設定要用的資源樹
 * @returns 第一層資源，子節點依完整路徑組回巢狀結構
 */
function buildResourceTree(): unknown[] {
  return RESOURCE_NAMES.filter((resourceName) => !resourceName.includes('>')).map((rootName) => buildTreeNode(rootName))
}

/**
 * 遞迴組出單一樹節點與它的子節點
 * @param resourceName 資源完整路徑
 * @returns 樹節點
 */
function buildTreeNode(resourceName: string): unknown {
  const index = RESOURCE_NAMES.indexOf(resourceName)
  const childNames = RESOURCE_NAMES.filter((candidate) => candidate.startsWith(`${resourceName}>`))
  const directChildNames = childNames.filter((candidate) => candidate.split('>').length === resourceName.split('>').length + 1)

  return {
    id: `resource-${index + 1}`,
    parentId: resolveParentId(resourceName),
    level: resourceName.split('>').length,
    resourceName,
    resourceCode: null,
    displayOrder: index + 1,
    isEnabled: true,
    children: directChildNames.map((childName) => buildTreeNode(childName)),
  }
}

/**
 * 由完整路徑推出父資源的唯一編號
 * @param resourceName 資源完整路徑
 * @returns 父資源唯一編號；第一層為 null
 */
function resolveParentId(resourceName: string): string | null {
  const segments = resourceName.split('>')
  if (segments.length === 1) return null

  const parentName = segments.slice(0, -1).join('>')
  const parentIndex = RESOURCE_NAMES.indexOf(parentName)

  return parentIndex === -1 ? null : `resource-${parentIndex + 1}`
}
