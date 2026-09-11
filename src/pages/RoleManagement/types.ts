/** 角色列表的顯示列 */
export interface RoleManagementRow {
  /** 角色唯一編號 */
  id: string
  /** 角色名稱 */
  name: string
  /** 是否為系統預設角色 */
  isSystemDefault: boolean
  /** 使用這個角色的用戶人數 */
  userCount: number
}

/** 新增角色的表單 */
export interface RoleManagementFormData {
  /** 角色名稱 */
  name: string
}

/** 編輯與檢視角色的表單，另含唯讀的角色資訊 */
export interface RoleManagementDetailFormData extends RoleManagementFormData {
  /** 角色唯一編號 */
  id: string
  /** 是否為系統預設角色 */
  isSystemDefault: boolean
  /** 使用這個角色的用戶人數 */
  userCount: number
  /** 載入時取得的版本戳記，送出更新時原封不動帶回做樂觀鎖 */
  version: string | null
}

/** 單一資源的四種權限狀態 */
export interface RolePermissionState {
  /** 訪問權限 */
  canAccess: boolean
  /** 新增權限 */
  canCreate: boolean
  /** 修改權限 */
  canUpdate: boolean
  /** 刪除權限 */
  canDelete: boolean
}

/** 權限種類，對應 RolePermissionState 的四個欄位 */
export type RolePermissionType = 'canAccess' | 'canCreate' | 'canUpdate' | 'canDelete'

/** 權限矩陣用的資源節點（扁平） */
export interface RolePermissionResource {
  /** 資源唯一編號 */
  resourceId: string
  /** 父資源唯一編號；第一層為 null */
  parentResourceId: string | null
  /** 資源層級 (1:一層, 2:二層, 3:三層) */
  level: number
  /** 這一層的顯示名稱（不含父路徑） */
  name: string
  /** 完整資源名稱（含父路徑） */
  fullPath: string
  /** 是否啟用；停用的資源仍要顯示，否則整批替換會把它的權限洗掉 */
  isEnabled: boolean
  /** 顯示順序 */
  displayOrder: number
  /** 選單圖示，取自路由 meta，找不到時依層級給預設值 */
  icon: string
}

/** 權限矩陣用的資源節點（巢狀，給 q-tree 用） */
export interface RolePermissionTreeNode extends RolePermissionResource {
  /** 子資源，依顯示順序排列 */
  children: RolePermissionTreeNode[]
}
