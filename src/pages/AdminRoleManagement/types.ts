/** 角色列表的顯示列 */
export interface AdminRoleManagementRow {
  /** 角色唯一編號 */
  id: string
  /** 角色名稱 */
  name: string
  /** 是否為系統預設角色 */
  isSystemDefault: boolean
  /** 使用這個角色的用戶人數 */
  userCount: number
}

/** 角色基本資料表單 */
export interface AdminRoleManagementFormData {
  /** 角色名稱 */
  name: string
}

/** 角色的摘要資訊（編輯頁、檢視頁的標題區用） */
export interface AdminRoleManagementSummary {
  /** 角色唯一編號 */
  id: string
  /** 角色名稱 */
  name: string
  /** 是否為系統預設角色；系統預設角色不能刪除，權限仍可調整 */
  isSystemDefault: boolean
  /** 載入時取得的版本戳記，送出更新時原封不動帶回做樂觀鎖 */
  version: string | null
  /** 使用這個角色的用戶人數 */
  userCount: number
}

/** 使用某個角色的用戶（檢視頁的名單） */
export interface AdminRoleManagementUser {
  /** 用戶唯一編號 */
  id: string
  /** 登入帳號 */
  account: string
  /** 姓名；未填時為 null */
  fullName: string | null
  /** 是否已停用 */
  isDisabled: boolean
}

/** 權限矩陣的四種操作，對應權限樹節點上的四個旗標 */
export type AdminRolePermissionAction = 'canAccess' | 'canCreate' | 'canUpdate' | 'canDelete'

/**
 * 一格、一列或一欄的勾選狀態
 *
 * all：底下每個功能都有；some：有的有、有的沒有（畫面顯示半勾）；none：都沒有；
 * na：底下沒有任何功能有這種操作（畫面顯示「不適用」）
 */
export type AdminRolePermissionCheckState = 'all' | 'some' | 'none' | 'na'

/** 單一資源的四個旗標 */
export interface AdminRolePermissionState {
  /** 訪問權限 */
  canAccess: boolean
  /** 新增權限 */
  canCreate: boolean
  /** 修改權限 */
  canUpdate: boolean
  /** 刪除權限 */
  canDelete: boolean
}

/** 權限矩陣的一列資源（扁平，依顯示順序排列） */
export interface AdminRolePermissionResource {
  /** 資源唯一編號 */
  resourceId: string
  /** 父資源唯一編號；第一層為 null */
  parentResourceId: string | null
  /** 資源層級 (1:一層, 2:二層, 3:三層) */
  level: number
  /** 這一層的顯示名稱（不含父路徑） */
  name: string
  /** 完整資源名稱（含父路徑，例：系統管理>角色管理） */
  fullPath: string
  /** 是否啟用；停用的資源照樣列出，權限原樣保留，選單重新啟用後立即生效 */
  isEnabled: boolean
  /** 這個資源實際可以授權的操作；不在清單裡的操作畫面顯示「不適用」 */
  availableActions: AdminRolePermissionAction[]
  /** 選單圖示，依完整資源名稱取自路由 meta，找不到時依層級給預設值 */
  icon: string
}

/** 權限矩陣畫面上的一列，含聚合後的勾選狀態 */
export interface AdminRolePermissionRow extends AdminRolePermissionResource {
  /** 是否有子資源；有子資源的是群組列，勾選狀態由底下的功能聚合而來 */
  hasChildren: boolean
  /** 四種操作各自的勾選狀態 */
  cells: AdminRolePermissionCells
  /** 整列（可授權的操作合起來）的勾選狀態 */
  rowState: AdminRolePermissionCheckState
  /** 與載入時不同的操作（尚未儲存） */
  changedActions: AdminRolePermissionAction[]
}

/** 一列的四個勾選狀態 */
export interface AdminRolePermissionCells {
  /** 檢視 */
  canAccess: AdminRolePermissionCheckState
  /** 新增 */
  canCreate: AdminRolePermissionCheckState
  /** 修改 */
  canUpdate: AdminRolePermissionCheckState
  /** 刪除 */
  canDelete: AdminRolePermissionCheckState
}
