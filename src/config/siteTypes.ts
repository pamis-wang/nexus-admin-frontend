import type { Ref } from 'vue'
import type { RouteLocationNormalizedLoaded, RouteLocationRaw } from 'vue-router'
import type { MenuTitleKey } from '@/locale'
import type { LayoutConfig } from '@/types/layout'
import type { PermissionAction } from '@/types/permission'

/**
 * 站別設定與站別行為的型別（四站共用）
 *
 * 共用程式（版面、路由守衛、axios、導覽）四站逐字相同，各站不同的值與行為只能放在：
 * - src/config/site.ts：純值，例如功能開關
 * - src/config/siteHooks.ts：會用到 store 或 service 的函式；store 一律在函式內取，避免循環 import
 */

/** 站別設定（純值） */
export interface SiteConfig {
  /** 功能開關 */
  features: {
    /** 頂部列提供切換生效角色；沒有角色的站關閉 */
    roleSwitch: boolean
    /** 頂部列提供色彩方案切換與主題設定面板；關閉時版面固定用預設外觀（共用預設套上 layoutDefaults） */
    themeSettings: boolean
  }
  /** 標誌的顯示高度（px），依各站標誌圖檔的長寬比調整 */
  logoHeight: {
    /** 水平版面的頂部列 */
    topbar: number
    /** 垂直版面的側邊選單 */
    menu: number
    /** 登入前的版面（登入、忘記密碼、錯誤頁等） */
    login: number
  }
  /**
   * 版面設定的站別預設值，只填和共用預設不同的項目，沒有就給空物件
   *
   * 使用者沒改過設定、或按下重置時套用；共用預設見 stores/useLayout.ts
   */
  layoutDefaults: Partial<LayoutConfig>
  /** 頂部列使用者選單在登出上方的額外連結，沒有就給空陣列 */
  userMenuLinks: UserMenuLink[]
}

/** 使用者選單的額外連結 */
export interface UserMenuLink {
  /** 連到的路由名稱 */
  routeName: string
  /** 圖示，mdi- 開頭 */
  icon: string
  /** 顯示名稱，填 menu 字典的 key（顯示時用 t(`menu.${title}`)），與路由 meta.title 同一套 */
  title: MenuTitleKey
}

/** 站別行為 */
export interface SiteHooks {
  /**
   * 目前使用者能否對資源執行指定操作，路由守衛、選單、導覽都用它判斷
   * @param resourceCode 資源代碼
   * @param action 操作，預設為進入（canAccess）
   * @returns 可以執行時為 true
   */
  canAccess: (resourceCode: string, action?: PermissionAction) => boolean
  /**
   * 站別的啟動工作，例如已登入就向後端補拉一次授權狀態；沒有就留空函式
   *
   * main.ts 在路由裝好之後、掛載之前以 app.runWithContext 呼叫一次，函式內可以用 store 與 useRouter 這類組合函式。
   * 不要等耗時的工作做完，畫面要先出來
   */
  runSiteStartup: () => void
  /**
   * 登入前版面在標誌下方顯示的副標，例如網址所屬單位的名稱；沒有副標就回傳空字串
   *
   * 在登入前版面（layouts/DefaultLayout.vue）的 setup 內呼叫，函式內可以用 store 與組合函式
   * @returns 副標文字，會隨語系或資料更新
   */
  useLoginSubtitle: () => Readonly<Ref<string>>
  /**
   * 以刷新 Token 換發新的一組 Token；axios 遇到 401 時呼叫，寫回 store 由 axios 負責
   * @param tokens 目前的存取 Token（可為已過期）與刷新 Token
   * @returns 新的一組 Token；換發失敗、或缺少站別需要的資料（例如登入時的單位代碼）時為 null，也可以直接拋出
   */
  refreshTokens: (tokens: TokenPair) => Promise<TokenPair | null>
  /**
   * 登入頁的位置：路由守衛擋下未登入的人、axios 換發失敗清除登入狀態後都導到這裡
   *
   * axios 在清除登入狀態之前呼叫，函式內可以讀登入時記下的資料（例如單位代碼）
   * @param route 路由守衛傳要前往的路由，axios 傳目前的路由
   * @returns 登入頁的位置
   */
  loginLocation: (route: RouteLocationNormalizedLoaded) => RouteLocationRaw
  /**
   * 首頁的位置：已登入的人進登入頁、又沒有上一頁可回時導到這裡
   * @param route 要前往的路由
   * @returns 首頁的位置
   */
  homeLocation: (route: RouteLocationNormalizedLoaded) => RouteLocationRaw
  /**
   * 403 頁的位置：路由守衛擋下沒有資源權限的人時導到這裡
   *
   * 403 頁掛在需要參數的路由底下時（例如網址所屬單位），第一次進站沒有上一頁的參數可沿用，要在這裡明確帶上
   * @param route 要前往的路由
   * @returns 403 頁的位置
   */
  forbiddenLocation: (route: RouteLocationNormalizedLoaded) => RouteLocationRaw
  /**
   * 路由守衛在登入與權限檢查之前先做的站別檢查，例如網址所屬單位不存在時導 404、換了單位就清除登入狀態；沒有就回傳 undefined
   * @param to 要前往的路由
   * @returns 要改導向的位置；照常往下檢查時為 undefined
   */
  prepareNavigation: (to: RouteLocationNormalizedLoaded) => Promise<RouteLocationRaw | undefined>
}

/** 一組存取 Token 與刷新 Token */
export interface TokenPair {
  /** 存取 Token */
  accessToken: string
  /** 刷新 Token */
  refreshToken: string
}
