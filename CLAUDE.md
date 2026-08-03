# 前端開發規範

> 來源：development-standards @ `d76e95f`（2026-07-28）
> 完整規範見 GitLab `agent-go/development-standards` 的 `frontend-standards/`。
> 本檔只列**預設做法會出錯**的規則；其餘細節在 skill `frontend-standards`。

技術基礎：Vue 3.5（TypeScript）＋ Vite，Composition API ＋ `<script setup lang="ts">`。
UI：**Quasar（後台）｜Tailwind CSS（前台）** ← 複製到專案後刪掉不適用的一項。

---

## 回應語言與術語

**一律使用繁體中文，採台灣本地化用語**——用 程式碼／資料／函式／物件／介面／型別／快取／預設／效能，不用 代碼／數據／函數／對象／接口／類型／緩存／默認／性能。即使以英文提問，回應仍用繁體中文；commit 說明也適用。

中文敘述一律用「**元件**」（不用「組件」）、「**共用元件**」、「**組合函式**」（不用 Composable／Hook）、「**服務**」、「**狀態管理**」。程式碼識別字、檔名、目錄名（`src/composables/`、`src/services/`）與 API（`defineStore`、`useUserStore`）保持英文，**不翻譯**。

---

## 程式碼風格

- **函數一律用 `function` 宣告，禁止 `const` ＋ 箭頭函式。** 例外：作為參數傳入或物件屬性值時允許（`items.filter((item) => …)`、`watch(() => props.id, …)`）。
- **所有 import 一律用 `@/` 別名，禁止相對路徑**（`./`、`../`）。
- `<script setup>` 固定分區排序：

  ```
  import → const → interface → lifecycle → async function → function
  ```

  `const` 內部順序：官方組合函式（`useRoute`／`useRouter`）→ 共用組合函式 → `defineProps` → `ref`／`useTemplateRef`／`emit` → `computed`。
  **`watch`／`watchEffect` 屬於 lifecycle 區塊**（與 `onMounted` 並列），不放在函數區。

- **`computed` 優先於 `watch`**：衍生值一律用 `computed`；`watch` 只用於「狀態變化時要執行副作用」（發 API、寫 log）。
- **禁止 deep watch 整包物件**，改鎖定欄位：`watch(() => formData.status, …)`。非同步 `watch` 需清理前次副作用時用 `onWatcherCleanup`。
- **非同步函數不加 `Async` 後綴**（`getUsers`，不是 `getUsersAsync`）。與後端 C# 慣例相反。

## 型別

- **Response／POST／PATCH 一律固定欄位，可空用 `| null`，不用 `?`。** `?` 只給查詢／篩選參數（query string）。
- 判斷可空一律 `=== null`，**不用 `=== undefined`**——後端有送 key，值是 `null`。
- **禁用 `Omit`／`Pick`／`Partial` 等衍生型別**，欄位逐一明確列出；共同欄位用 `extends`。
- **頁面 `types.ts` 禁止 import service 層型別**，須在頁面自己的 `types.ts` 重新宣告，以頁面功能為前綴。
- 所有 interface 欄位加 `/** */` JSDoc。
- **後端字串列舉值用字面值聯集，不用 TypeScript `enum`。** 值逐一比照後端字串碼（如 `type AuthStatus = 'success' | 'account_not_found'`），判斷用 `===` 直接比較。

## API 串接

- **一律透過 `axiosService` 呼叫後端，禁止在頁面／元件直接 import axios。**
- **一個 service 檔對齊一個 API resource，只有一個 `BASE_API_URL`。** 要呼叫別的 resource 就拆成新檔，不共用。
- 契約型別（`Response`／`Request`）與請求函數放同一檔。

## 元件、組合函式、狀態管理

- **非必要不拆分元件。** 只有真正會被重用、單一元件職責過大、或模板過長難讀才拆。
- **重複出現 3 次以上**才考慮抽組合函式，且**抽取前先與主管討論，不可自行重構**。
- 雙向綁定用 **`defineModel`**（Vue 3.4+），不手寫 `props` ＋ `emit('update:xxx')`。
- props 視為**唯讀**，不在子元件內直接修改；要回傳變更用 emit 或 `defineModel`。
- store 解構：state／getter 用 **`storeToRefs`** 保留響應性；action 可直接解構。
- 全域 store 只放「真正需跨頁面、跨元件共享」的狀態（登入用戶、權限、版面設定）；區域狀態用組合函式表達。
- 跨頁面共用的元件／組合函式放 `src/components/`、`src/composables/`；只服務單一模組的放 `pages/<模組>/components/`、`pages/<模組>/composables/`。

## 樣式

- 元件樣式一律 **`<style scoped>`**，避免污染全域。
- **不寫死設計值**：顏色、字級、間距一律用 token——後台改 `quasar-variables.sass`，前台用 `tailwind.config.js` 的 `theme.extend`。模板只引用語意 token（`text-primary`、`text-h1`），不寫 `#B3A093` 或 `text-[#B3A093]`。

## 命名

| 對象               | 規則                                                              |
| ------------------ | ----------------------------------------------------------------- |
| 頁面模組資料夾     | PascalCase（`UserManagement/`）                                   |
| 頁面（CRUD 視圖）  | `<模組名><動作>.vue`，動作固定 `List`／`Add`／`Edit`／`View`      |
| 共用元件           | `PascalCase.vue`                                                  |
| 組合函式／狀態管理 | `useXxx.ts`                                                       |
| 服務               | `xxxService.ts`                                                   |
| 路由檔             | `xxx.routes.ts`                                                   |
| API 型別           | `Response`／`Request` 後綴（`UserResponse`、`CreateUserRequest`） |
| 頁面表單型別       | 頁面功能為前綴（`UserFormData`）                                  |
| 布林               | `is`／`has`／`should` 前綴                                        |
| 模組層常數         | `UPPER_SNAKE_CASE`（`BASE_API_URL`）                              |
| 路由 `path`        | kebab-case 複數（`user-management`）                              |
| 路由 `name`        | camelCase（`userEdit`）                                           |

- 固定識別欄位（ID）用**路由參數**，不用 query string：`users/:userId`。
- 頁面元件一律**動態 import** 懶載入。

## Git

- Commit 格式 `<type>: <中文說明>`，type 只有 `feat`／`fix`／`docs`／`style`／`refactor`／`test`／`chore`。**說明用中文**、**不使用 scope**（不寫 `feat(user):`）。
- 破壞性變更（呼叫端不改程式就會壞）在 type 後加 `!`：`feat!: 移除 UserResponse 的 status 欄位`。
- 分支 `<類型>/<描述>`，類型**只有** `feat`／`fix`／`refactor`／`docs`／`chore`。一律從 `develop` 切出、PR／MR 回 `develop`。
- `main`／`stage`／`develop` 為環境分支：不得直接推送、不得強制推送。

---

## 專案上下文

> 以下內容為本專案自有的背景資訊，**不屬於** development-standards 同步下來的規範，不受上方版本／同步機制管控。

- 本專案（`nexus-admin-frontend`）為全新專案，對應的後端專案為本機 `D:\ProjectCollection\NexusBackend`。確認 API 契約、資料形狀、後端行為時，應以該專案的原始碼為準。
- 團隊前端開發規範的唯一來源是 `D:\development-standards`（GitLab repo `agent-go/development-standards`，`frontend-standards/`）。本檔上方的規範內容與 `.claude/skills` 內的 `frontend-standards` 皆為同步下來的副本，規範仍在成形中，會持續調整。
- **若發現上方規範內容與實際開發需求有衝突或缺漏，不可直接修改本檔或 skill 檔案來「修正」規範本身**，須回到來源 `D:\development-standards` 修改，再以同步的形式帶回本專案，確保規範的資料流單向（來源 → 專案），避免副本與來源分岔。
