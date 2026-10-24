export interface Permission {
  /** 資源ID */
  resourceId: string
  /** 父級資源ID */
  parentId?: string
  /** 資源層級 (1:一層, 2:二層, 3:三層) */
  level: ResourceLevel
  /** 資源名稱，給人看的，營運端可以改 */
  resourceName: string
  /** 資源代碼，權限判斷一律用它；純選單分組的資源沒有代碼 */
  resourceCode: string | null
  /** 排序 */
  sortOrder: number
  /** 子資源列表 */
  children?: Permission[]
  /** 訪問權限 */
  canAccess: boolean
  /** 新增權限 */
  canCreate: boolean
  /** 修改權限 */
  canUpdate: boolean
  /** 刪除權限 */
  canDelete: boolean
}

/** 資源層級定義
 * @description
 */
export type ResourceLevel = 1 | 2 | 3

/** 權限類型列舉 */
export enum PermissionType {
  /** 訪問權限 */
  Access = 'canAccess',
  /** 新增權限 */
  Create = 'canCreate',
  /** 修改權限 */
  Update = 'canUpdate',
  /** 刪除權限 */
  Delete = 'canDelete',
}

/**
 * 資源的四種操作權限，對應授權狀態權限樹節點上的四個旗標
 *
 * 後端端點以 [RequirePermission(資源代碼, 操作)] 宣告要求，前端的路由守衛、選單與操作按鈕依同一組旗標判斷
 */
export type PermissionAction = 'canAccess' | 'canCreate' | 'canUpdate' | 'canDelete'
