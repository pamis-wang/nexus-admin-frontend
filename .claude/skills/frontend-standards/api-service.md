# service 檔與 axiosService 串接

> 來源：development-standards @ `d76e95f` — `frontend-standards/06.型別與API串接規範.md`、`13.多語系規範.md`

**一律透過 `axiosService` 呼叫後端，禁止在頁面／元件直接 import axios。**

---

## service 檔模板

`services/<領域>/<resource>Service.ts`——**一檔一 `BASE_API_URL`，對齊一個 API resource**。要呼叫別的 resource 就拆新檔，不共用。

```ts
import { request, type ResponseStructure, type CreatedResponse, type UpdatedResponse } from '@/services/axiosService'

/** 呼叫 API 路徑 */
const BASE_API_URL = `${import.meta.env.VITE_API_URL}/api/users`

/** 使用者資料 */
export interface UserResponse {
  /** 唯一編號 */
  id: string
  /** 帳號 */
  account: string
  /** 電子信箱 */
  email: string
  /** 停用時間 - ISO 8601 */
  disabledAt: string | null
}

/** 新增使用者請求 */
export interface CreateUserRequest {
  /** 帳號 */
  account: string
  /** 電子信箱 */
  email: string
}

/** 取得全部使用者 */
export async function getUsers(): Promise<ResponseStructure<UserResponse[]>> {
  return await request<UserResponse[]>({ url: BASE_API_URL, method: 'GET' })
}

/** 取得單一使用者 */
export async function getUserById(userId: string): Promise<ResponseStructure<UserResponse>> {
  return await request<UserResponse>({ url: `${BASE_API_URL}/${userId}`, method: 'GET' })
}

/** 新增使用者 */
export async function createUser(data: CreateUserRequest): Promise<ResponseStructure<CreatedResponse>> {
  return await request<CreatedResponse>({ url: BASE_API_URL, method: 'POST', data })
}

/** 更新使用者 */
export async function updateUser(userId: string, data: CreateUserRequest): Promise<ResponseStructure<UpdatedResponse>> {
  return await request<UpdatedResponse>({ url: `${BASE_API_URL}/${userId}`, method: 'PUT', data })
}

/** 刪除使用者 */
export async function deleteUser(userId: string): Promise<ResponseStructure<null>> {
  return await request<null>({ url: `${BASE_API_URL}/${userId}`, method: 'DELETE' })
}
```

要點：

- `export async function` ＋ **動詞開頭**、**不加 `Async` 後綴**。
- 契約型別與請求函數**同檔**，每個欄位加 `/** */` JSDoc。
- service 檔名對齊 resource：`userService.ts` ↔ `/api/users`、`adminUserService.ts` ↔ `/api/admin-users`。

---

## 統一契約型別

```ts
/** 後端標準回應結構：data 與 error 二擇一 */
export interface BaseResponse<T> {
  /** 成功時的資料，失敗時為 null */
  data: T | null
  /** 失敗時的錯誤，成功時為 null */
  error: ErrorResponse | null
}

/** 後端錯誤結構 */
export interface ErrorResponse {
  /** 錯誤代碼（通常為 HTTP 狀態碼） */
  code: number
  /** 錯誤訊息 */
  message: string
}

/** 前端統一回應包裝（含 HTTP 狀態與中繼資訊） */
export interface ResponseStructure<TResponse> {
  result: BaseResponse<TResponse>
  status: number
  statusText: string
  success: boolean
  errorMessage?: string
  timestamp: number
  requestUrl?: string
  headers?: Record<string, string>
}
```

標準 CRUD 回應型別（對應後端）：

| 型別 | 欄位 |
|---|---|
| `CreatedResponse` | `id`、`createdAt` |
| `UpdatedResponse` | `id`、`updatedAt` |
| `UploadedResponse` | `id`、`link`、`updatedAt` |
| `DeletedResponse` | `success`、`record` |

---

## 三種呼叫方式

| 函數 | 回傳 | 使用時機 |
|---|---|---|
| `request<T>` | `ResponseStructure<T>` | **預設用這個**：需要完整 HTTP 狀態、`data` 與 `error` |
| `requestData<T>` | `T`（自動解包） | 便捷用法，業務錯誤自動拋出 |
| `requestBase<T>` | `BaseResponse<T>` | 需手動判斷 `data`／`error` |

`request` 的判斷模式：

```ts
const response = await getUsers()
if (response.status === 200 && response.result.data) {
  rows.value = response.result.data
} else if (response.result.error) {
  notify.notifyError(response.result.error.message)
}
```

或用 `response.success` 做簡化判斷（送出表單時常用）：

```ts
if (response.success) {
  notify.notifySuccess('新增成功')
} else {
  notify.notifyError(response.result.error?.message || '新增失敗')
}
```

非 2xx 不會走到 `else`——`request` 直接拋出，錯誤在 `catch` 處理，見〈錯誤訊息〉。

---

## axiosService 已經做掉的事——頁面不要重複做

- 自動附加 `Authorization: Bearer <token>`（從 user store 取 `accessToken`）。
- 非 2xx 依狀態碼記 log（400／403／404／422／500…），並把錯誤轉成**友善訊息**放進 `errorMessage`。
- **401 自動用 `refreshToken` 換發**；換發期間其他遇到 401 的請求共用同一次換發，拿到新 token 後重送。沒收到回應（斷網、逾時）不是 401，不嘗試換發。
- **換發失敗或沒有 refresh token 就強制登出、導回登入頁，這個請求與其他還在等回應的請求一律掛起不回**：Promise 不 resolve 也不 reject，頁面的 `catch` 不會執行，跳回登入頁前不會冒出錯誤通知。
- 最後統一拋出 `ResponseStructure` 錯誤物件。

> 共用同一次換發，是因為 refresh token 換過一次就失效：並行請求各自換發，只有第一個成功、其餘失敗而把使用者登出。這是團隊標準實作，**不要在頁面另寫一套 401 處理，也不要為登出期間的錯誤另寫判斷**。

頁面只需要處理：業務錯誤（`result.error`）的呈現、未預期例外的 `catch`、`loading` 的 `finally`。

---

## 錯誤訊息

要顯示給使用者的錯誤取 `catch` 拿到的 **`errorMessage`**，沒有才退回頁面自己的文字：

```ts
} catch (error) {
  notify.notifyError((error as ResponseStructure<null>).errorMessage || '新增失敗', 0)
}
```

`errorMessage` 已經是友善訊息：後端有回錯誤訊息就用後端的；沒有（斷網、逾時、代理伺服器的錯誤頁）就依狀態碼給通用說明（「請求逾時，請稍後再試」「沒有權限執行此操作」）。頁面不自己依狀態碼拼訊息，也不顯示 axios 的原始錯誤文字。

**有 `src/locale/` 時**，`errorMessage` 也已依目前語系處理：

- 繁中直接顯示後端原文；英文查後端訊息的英文對照表，查不到就改顯示 `http` 字典的通用說明（原文記在 log）——英文介面不會冒出中文。
- 後端訊息的英文對照**不放進 vue-i18n 字典**：後端訊息含 `[ ] { } .` 等字元，當成 key 會被解析成路徑或訊息語法。補對照時加進專案的後端訊息對照表，key 用後端的中文原文。
- `result.error.message` 是後端原文、沒經過語系處理。2xx 卻帶 `result.error` 而要顯示它時，先經過專案的後端訊息轉換（例如 `resolveBackendMessage(message, t('user.loadFailed'))`），查不到就顯示自己的 `t()` 文字。
- 退回用的頁面文字也走 `t()`：`errorMessage || t('user.createFailed')`。

---

## 檔案上傳（預簽名 URL）

檔案不直接送 API，走 MinIO／S3 的預簽名 URL：

```ts
await uploadFileToPresignedUrl(presignedUrl, file, ({ percentage }) => {
  uploadProgress.value = percentage
})
```

預簽名 URL 由後端端點取得，回應型別為 `UploadedResponse`。

---

## 與後端合約的關係

前端型別是**後端回傳 JSON 形狀的鏡像**。後端 API 的回應結構改動時，對應的 service 型別必須同步更新——否則型別檢查會過、執行時才炸。

欄位可空性怎麼判斷（`string` 還是 `string | null`）見 **`types.md`**。
