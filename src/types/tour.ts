/** 導覽泡泡相對於錨點的位置 */
export type TourStepSide = 'top' | 'right' | 'bottom' | 'left'

/** 導覽泡泡在該側的對齊方式 */
export type TourStepAlign = 'start' | 'center' | 'end'

/** 導覽的單一步驟 */
export interface TourStep {
  /** 錨點名稱，對應畫面上的 data-tour 屬性值；為 null 代表不指向特定元素，泡泡置中顯示 */
  anchor: string | null
  /** 步驟標題 */
  title: string
  /** 步驟說明，寫這一步在做什麼、為什麼要做 */
  description: string
  /** 這一步所在頁面的路由名稱；與目前頁面不同時會先導頁、等頁面就緒再顯示 */
  routeName: string | null
  /** 泡泡相對錨點的位置，為 null 時由套件自動決定 */
  side: TourStepSide | null
  /** 泡泡在該側的對齊方式，為 null 時由套件自動決定 */
  align: TourStepAlign | null
}

/** 一份完整的導覽定義 */
export interface TourDefinition {
  /** 導覽識別碼，需全站唯一，同時作為「已看過」的紀錄鍵值 */
  id: string
  /** 導覽名稱，顯示在導覽選單 */
  name: string
  /**
   * 在導覽選單上的排序，數字小的排前面。
   *
   * 導覽之間有教學順序（先看懂畫面、再學怎麼操作），依 id 或名稱排都排不出來，
   * 只能明寫。習慣留 10 的間隔，之後要插進兩份之間不必重編其他份。
   */
  order: number
  /**
   * 綁定的路由名稱：只有停在該頁時才能啟動，為 null 代表任何頁面都能啟動。
   * 給網址帶識別編號的頁面用——那種頁面無法從導覽定義自動導頁，
   * 因為要用哪一筆資料只有使用者當下知道。
   */
  requiresRouteName: string | null
  /**
   * 需要的資源權限名稱（例：系統管理>用戶管理），為 null 代表不限權限。
   *
   * 沒有該資源訪問權的人，選單看不到那個功能、路由守衛也會把他導去 403，
   * 導覽播到一半只會卡在等不到的錨點上。與其讓他點了才失敗，不如不要列出。
   * 判斷一律走 userStore.hasPermission，不另外寫一份。
   */
  resourceName: string | null
  /** 導覽步驟，依序播放 */
  steps: TourStep[]
}
