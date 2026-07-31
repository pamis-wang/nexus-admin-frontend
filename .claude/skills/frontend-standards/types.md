# TypeScript 型別與可空性

> 來源：development-standards @ `d76e95f` — `frontend-standards/06.型別與API串接規範.md`、`附錄01`

---

## 一句話規則

**`?` 管「欄位在不在」，`| null` 管「值是不是空的」。**

Response、POST、PATCH 一律固定欄位、可空用 `| null`、**不用 `?`**；`?` 只用在查詢參數（query string）這種 key 真的可能不出現的場景。

| 寫法 | 意義 | 取出型別 | `{}` 合法？ |
|---|---|---|---|
| `name: string` | key 一定在、值一定是字串 | `string` | 否 |
| `name: string \| null` | key 一定在、值可能是 null | `string \| null` | 否 |
| `name?: string` | key 可能不存在 | `string \| undefined` | 是 |

---

## 為什麼 Response 不用 `?`

後端 C# 的 `string?` **預設行為是值為 null 時仍輸出 `"name": null`，key 不會消失**。前端實際拿到的是 `null`，不是 `undefined`。

用 `name?: string` 的語意是「key 可能不存在」，與後端「key 一定在」的實際行為矛盾；而且以 `=== undefined` 判斷會失效——實際值是 `null`。

**判斷可空一律用 `=== null`。**

例外：後端額外設定了 `JsonIgnoreCondition.WhenWritingNull`，key 才會整個消失——**這時前端才用 `?`**。這種情況少見，遇到要確認後端行為。

---

## C# → JSON → TypeScript 對照

| C# 後端 | 序列化後 JSON | 前端 TypeScript |
|---|---|---|
| `public string Name { get; set; } = string.Empty;` | `"name": "Bob"` | `name: string` |
| `public required string Name { get; set; }` | `"name": "Bob"` | `name: string` |
| `public bool Flag { get; set; }` | `"flag": true` | `flag: boolean` |
| `public string? Name`（值為 null） | `"name": null` | `name: string \| null` |
| `public int? Value`（值為 null） | `"value": null` | `value: number \| null` |
| `IEnumerable<T> Items { get; set; } = []` | `"items": []` | `items: T[]` |
| `public string? Name` ＋ `WhenWritingNull` | key 消失 | `name?: string` |

集合欄位後端保證回空陣列（不會是 null），前端直接宣告 `T[]`，不必 `T[] | null`。

---

## Request 型別

### 建立資源（POST）

所有欄位必傳。必有值用 `string`，可空用 `| null`，**不用 `?`**。

```ts
interface CreateUserRequest {
  /** 帳號 */
  account: string
  /** 電子信箱 */
  email: string
  /** 備註 */
  note: string | null    // 必傳 key，值可為 null
}
```

### 部分更新（PATCH）

團隊約定**切在端點／DTO 層級**——一個 PATCH 端點對應一個固定 DTO，**不靠省略 key 表達「不改這個欄位」**。因此與 Response 同一套規則：固定欄位、可空用 `| null`、不用 `?`。不想改的欄位也要把現值一起帶回。

```ts
interface UpdateUserRequest {
  /** 帳號 */
  account: string | null   // 給字串 = 更新，給 null = 設為 null
  /** 電子信箱 */
  email: string | null
}
```

### 查詢／篩選參數

**這裡才用 `?`**——省略代表「不篩選這個條件」。

```ts
interface UserQuery {
  keyword?: string   // 沒給 = 不搜尋
  status?: string    // 沒給 = 全部狀態
  page?: number      // 沒給 = 後端預設第 1 頁
}
```

---

## 禁用 Utility Types

**禁止 `Omit`／`Pick`／`Partial` 等衍生型別**，欄位逐一明確列出。

```ts
// ✗ 禁止：讀者須心算哪些欄位被排除，且 service 型別改動會悄悄影響此型別
export type UserDetail = Omit<UserResponse, 'id' | 'status'>

// ✓ 正確：欄位一目了然、與 service 解耦
export interface UserDetail {
  /** 統一編號 */
  taxId: string
  /** 組織中文名稱 */
  organizationNameZhTw: string
}
```

共同欄位用 **`extends`**，不用 `Omit`：

```ts
export interface UserFormData extends UserDetail {
  /** 附件 */
  attachments: UserAttachment[]
}
```

---

## 頁面型別不得 import service 型別

頁面層（`pages/`）的 `types.ts` **禁止**直接引用 service 層型別，須在頁面自己的 `types.ts` **重新宣告**，以頁面功能為前綴命名。

```ts
// ✗ 禁止
import type { DonationAttachment } from '@/services/donation/donationApplicantService'

// ✓ 正確：在 page 的 types.ts 自行定義
/** 捐贈申請附件 */
export interface DonationApplicationAttachment {
  /** 附件連結 */
  url: string | null
  /** 原始檔名 */
  originalFileName: string | null
}
```

目的：頁面與 service 解耦，**service 型別改動不會悄悄影響頁面**。這是刻意接受「型別重複宣告」來換取解耦。

---

## JSDoc

所有 interface 欄位加 `/** */`，內容對齊後端該欄位的說明。

```ts
// ✗ 不足
taxId: string

// ✓ 正確
/** 營業統一編號 */
taxId: string
```

---

## 型別命名

| 對象 | 規則 | 範例 |
|---|---|---|
| API 回應型別 | `Response` 後綴 | `UserResponse` |
| API 請求型別 | `Request` 後綴（含動作） | `CreateUserRequest`、`UpdateUserRequest` |
| 頁面表單型別 | 頁面功能為前綴 ＋ 用途後綴 | `UserFormData`、`DonationApplicationDetail` |
