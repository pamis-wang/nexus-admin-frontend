# 從零做一個 CRUD 頁面

> 來源：development-standards @ `d76e95f` — `frontend-standards/09.開發實作指南.md`

以「使用者管理（User）」為例。**順序不可跳**：service 先建好，型別才穩定，頁面才有東西可串。

```
1. 建 service（型別 + 請求函數）
      ↓
2. 註冊路由
      ↓
3. 建頁面模組資料夾與頁面型別
      ↓
4. 列表頁：串接 + 導覽
      ↓
5. 表單頁：新增／編輯 + 送出
```

---

## 1　建 service

`services/user/userService.ts`——一檔一 `BASE_API_URL`，契約型別與請求函數同檔。完整模板與三種呼叫方式見 **`api-service.md`**。

---

## 2　註冊路由

`router/user.routes.ts`——`path` kebab-case、`name` camelCase、頁面元件**動態 import**、`meta` 放 `title`／`requiresAuth`。

```ts
import type { RouteRecordRaw } from 'vue-router'

export const userRoutes: RouteRecordRaw = {
  path: 'user-management',
  name: 'userManagement',
  meta: { title: '使用者管理', requiresAuth: true },
  children: [
    {
      path: 'users',
      name: 'users',
      component: () => import('@/pages/UserManagement/UserManagementList.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: 'users/new',
      name: 'userNew',
      component: () => import('@/pages/UserManagement/UserManagementAdd.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: 'users/:userId/edit',
      name: 'userEdit',
      component: () => import('@/pages/UserManagement/UserManagementEdit.vue'),
      meta: { requiresAuth: true },
    },
  ],
}
```

在 `router/routes.ts` 匯入彙整。ID 一律走路由參數（`users/:userId`），**不用 query string**。

---

## 3　建頁面模組與頁面型別

```
pages/UserManagement/
├── UserManagementList.vue      # 列表
├── UserManagementAdd.vue       # 新增
├── UserManagementEdit.vue      # 編輯
├── components/                 # 只服務此模組的元件
├── composables/                # 只服務此模組的邏輯
└── types.ts                    # 此模組的頁面型別
```

頁面型別**自行宣告，禁止 import service 型別**——以頁面功能為前綴，欄位逐一列出：

```ts
// pages/UserManagement/types.ts

/** 使用者表單 */
export interface UserFormData {
  /** 帳號 */
  account: string
  /** 電子信箱 */
  email: string
}
```

> 為什麼不直接用 service 的 `UserResponse`：頁面與 service 解耦，後端合約改動不會悄悄穿透到頁面。判斷細則見 `types.md`。

---

## 4　列表頁

`<script setup>` 依固定分區排序：import → const → interface → lifecycle → async function → function。

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

import { useDialog } from '@/composables/useDialog'

import { getUsers, deleteUser, type UserResponse } from '@/services/user/userService'
import type { ResponseStructure } from '@/services/axiosService'

const router = useRouter()
const dialog = useDialog()

const loading = ref<boolean>(false)
const rows = ref<UserResponse[]>([])

onMounted(() => {
  loadUsers()
})

async function loadUsers() {
  loading.value = true
  try {
    const response = await getUsers()
    if (response.status === 200 && response.result.data) {
      rows.value = response.result.data
    } else if (response.result.error) {
      dialog.showWarning(response.result.error.message, '載入失敗')
    }
  } catch (error) {
    dialog.showError((error as ResponseStructure<null>).errorMessage || '未知錯誤', '載入失敗')
  } finally {
    loading.value = false
  }
}

function navigateToEdit(userId: string) {
  router.push({ name: 'userEdit', params: { userId } })
}
</script>
```

注意四件事：

- `import` 分組並空行隔開：Vue 核心 → Vue 官方套件 → npm 套件 → 共用組合函式／utils → services → 頁面內部元件。
- `const` 依序：官方組合函式 → 共用組合函式 → `defineProps` → `ref`／`emit` → `computed`。
- `onMounted` 等 lifecycle 在函數**之前**。
- `async function` 排在一般 `function` 之前。

---

## 5　表單頁

送出後成功導回列表。`finally` 一定要收掉 `loading`。

```ts
async function onSubmit() {
  loading.value = true
  try {
    const response = await createUser({ account: form.account, email: form.email })
    if (response.success) {
      dialog.showSuccess('新增成功')
      router.push({ name: 'users' })
    } else {
      dialog.showError(response.result.error?.message || '新增失敗')
    }
  } finally {
    loading.value = false
  }
}
```

編輯頁在 `onMounted` 先載入單筆資料填入表單，送出改呼叫 `updateUser(userId, data)`。`userId` 從 `useRoute().params` 取。

---

## 錯誤處理分工

| 層級 | 誰處理 |
|---|---|
| HTTP 層（401 刷新 Token、刷新失敗強制登出、狀態碼 log） | **`axiosService` 統一處理，頁面不重複寫** |
| 業務錯誤（`result.error`） | 頁面以對話框呈現 |
| 未預期例外 | `try / catch`，`catch` 讀 `errorMessage` |
| loading 狀態 | 一律 `finally` 收掉 |

---

## 提交前檢查清單

- [ ] 型別忠實對應後端 JSON，可空用 `| null`，Response 沒有 `?`
- [ ] 一律走 `axiosService`，沒有直接 import axios
- [ ] 所有 import 用 `@/`，沒有相對路徑
- [ ] 函數一律 `function` 宣告，沒有頂層 `const` 箭頭函式
- [ ] 頁面 `types.ts` 沒有 import service 型別
- [ ] 沒有用 `Omit`／`Pick`／`Partial`
- [ ] 衍生值用 `computed`，沒有 deep watch 整包物件
- [ ] 元件樣式有 `scoped`，顏色字級走 token 沒寫死
- [ ] `npm run lint` 與 `npm run type-check` 通過
