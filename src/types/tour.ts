/** 導覽泡泡相對於錨點的位置 */
export type TourStepSide = 'top' | 'right' | 'bottom' | 'left'

/** 導覽泡泡在該側的對齊方式 */
export type TourStepAlign = 'start' | 'center' | 'end'

/**
 * 導覽上給使用者看的文字，每個支援的語系各寫一份
 *
 * 導覽內容是資料不是程式碼，文字跟著定義檔走、不放進語系檔：
 * 一份導覽的中英文寫在同一處，改內容時不必在兩個檔案之間來回對照。
 */
export interface TourText {
  /** 繁體中文，不能空白；其他語系的文字是空字串時退回顯示這一份 */
  'zh-TW': string
  /** 英文；還沒翻譯時給空字串，畫面會退回顯示繁中 */
  'en-US': string
}

/** 導覽的單一步驟 */
export interface TourStep {
  /** 錨點名稱，對應畫面上的 data-tour 屬性值；為 null 代表不指向特定元素，泡泡置中顯示 */
  anchor: string | null
  /** 步驟標題 */
  title: TourText
  /** 步驟說明，寫這一步在做什麼、為什麼要做；可含 HTML 標籤（例：<br>、<strong>） */
  description: TourText
  /** 這一步所在頁面的路由名稱；與目前頁面不同時會先導頁、等頁面就緒再顯示 */
  routeName: string | null
  /** 泡泡相對錨點的位置，為 null 時由套件自動決定 */
  side: TourStepSide | null
  /** 泡泡在該側的對齊方式，為 null 時由套件自動決定 */
  align: TourStepAlign | null
}

/** 導覽啟動前畫面上必須出現的錨點 */
export interface TourAnchorRequirement {
  /** 錨點名稱，對應畫面上的 data-tour 屬性值 */
  anchor: string
  /** 畫面上沒有這個錨點時，顯示在導覽選單上的提示：要先做什麼，或該改看哪一份導覽 */
  hint: TourText
}

/** 一份完整的導覽定義 */
export interface TourDefinition {
  /** 導覽識別碼，需全站唯一，同時作為「已看過」的紀錄鍵值 */
  id: string
  /** 導覽名稱，顯示在導覽選單 */
  name: TourText
  /**
   * 導覽選單上的分組名稱，對齊左側選單的第一層；為 null 代表歸到「通用」。
   *
   * 使用者是照左側選單找功能的，分組名稱與選單一致，兩邊才對得起來。
   * 分組以繁中名稱為準，同一組的每份定義檔，各語系的名稱都要寫得一模一樣。
   */
  groupName: TourText | null
  /**
   * 在導覽選單上的排序，數字小的排前面。
   *
   * 導覽之間有教學順序（先看懂畫面、再學怎麼操作），依 id 或名稱排都排不出來，
   * 只能明寫。習慣留 10 的間隔，之後要插進兩份之間不必重編其他份。
   */
  order: number
  /**
   * 綁定的路由名稱：只有停在其中一頁時才能啟動，空陣列代表任何頁面都能啟動。
   *
   * 給網址帶識別編號的頁面用——那種頁面無法從導覽定義自動導頁，
   * 因為要用哪一筆資料只有使用者當下知道。
   * 用陣列是因為同一個畫面常掛在新增、修改兩條路由上，兩條都要能播同一份導覽。
   */
  requiresRouteNames: string[]
  /**
   * 需要的資源代碼，為 null 代表不限權限。
   *
   * 沒有該資源訪問權的人，選單看不到那個功能、路由守衛也會把他擋下，
   * 導覽播到一半只會卡在等不到的錨點上。與其讓他點了才失敗，不如不要列出。
   * 判斷一律走 siteHooks.canAccess，不另外寫一份。
   */
  resourceCode: string | null
  /**
   * 畫面上必須先出現的錨點，為 null 代表不限。
   *
   * 同一頁會隨資料進度換一副樣子（例：還沒設定時是表單、設定好後是清單）。
   * 導覽若在錯的樣子播放，每一步都要等滿逾時、最後泡泡指向不存在的東西。
   * 與其讓使用者空等，不如讓選單直接告訴他現在該看哪一份。
   */
  requiresAnchor: TourAnchorRequirement | null
  /** 導覽步驟，依序播放 */
  steps: TourStep[]
}

/** 導覽選單上的一個分組 */
export interface TourGroup {
  /** 分組鍵值，取繁中的群組名稱（「通用」組另有固定鍵值）；不隨語系變動，切換語系時分組結果與列表的 key 才穩定 */
  key: string
  /** 群組名稱，對齊左側選單的第一層 */
  name: TourText
  /** 這個群組底下的導覽，依教學順序排列 */
  tours: TourDefinition[]
}
