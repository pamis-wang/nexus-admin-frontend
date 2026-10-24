# Quasar 元件測試

> 來源：development-standards — `frontend-standards/11.測試規範.md`、`13.多語系規範.md`

Vitest ＋ `@vue/test-utils`。以下幾條都是**預設做法會靜默失敗**的地方——照做，不要憑框架直覺寫。

## 檔案位置與命名

**測試檔一律集中放 `src/__tests__/`**，依來源檔案的 `src/` 相對路徑建子目錄，不與原始碼並排開 `__tests__/`。命名 `<原始檔名>.spec.ts`。

```
src/pages/UserManagement/UserList.vue
src/__tests__/pages/UserManagement/UserList.spec.ts
```

## 一律 `mount`，不用 `shallowMount`

`shallowMount` 會把 `q-input`／`q-form` 等 Quasar 元件 stub 成空殼，模板內不會有真正的 `<input>`／`<form>`，選擇器全部找不到。

## `mount` 時務必安裝 Quasar plugin；有 `src/locale/` 再加 i18n

```ts
import quasarPlugin from '@/plugins/quasar'
import { i18n } from '@/plugins/i18n'        // 有 src/locale/ 的專案

mount(UserList, {
  global: { plugins: [quasarPlugin, i18n] },  // 沒有 src/locale/ 的專案只放 quasarPlugin
})
```

沒裝 Quasar 的話，部分 Quasar 元件缺少 `$q` context 時會在 `beforeMount` **直接丟出執行期錯誤**，不只是警告。沒裝 i18n 的話，元件裡的 `useI18n()` 直接丟錯（「Need to install with `app.use` function」），整個元件掛不起來。

- 測試時的語系是 i18n 的預設語系（繁中），斷言照寫繁中原文。
- 要測英文就設 `i18n.global.locale.value = 'en-US'`，並在 `afterEach` 切回 `'zh-TW'`——`i18n` 是全域單一實例，沒切回會汙染後面的測試。
- 在元件外直接呼叫的組合函式拿不到 `useI18n`，把 `vue-i18n` mock 成回傳 key：

  ```ts
  vi.mock('vue-i18n', () => ({
    useI18n: () => ({ t: (key: string) => key }),
  }))
  ```

## `vi.mock` 的響應式回傳值要用真正的 `ref()`

```ts
vi.mock('@/composables/useUserForm', () => ({
  useUserForm: () => ({ isLoading: ref(false) }),   // ✅
  // useUserForm: () => ({ isLoading: { value: false } }),   ❌
}))
```

模板若把該值綁到 Quasar 元件 prop，Vue 的 auto-unwrap **只認得真正的 `ref`**；一般物件會讓 prop 收到物件而不是預期的原始值。

## `vi.fn` 一律帶被替換函式的完整簽章

```ts
const getUsersMock = vi.fn<() => Promise<ResponseStructure<UserResponse[]>>>()
const deleteUserMock = vi.fn<(userId: string) => Promise<ResponseStructure<null>>>()

vi.mock('@/services/user/userService', () => ({
  getUsers: () => getUsersMock(),
  deleteUser: (userId: string) => deleteUserMock(userId),
}))
```

裸的 `vi.fn()` 型別是「任何參數、任何回傳」：`mockResolvedValue` 塞了形狀不對的回應也編譯得過，service 簽章改了測試照樣通過，壞掉的是正式環境。`vi.mock` 會被提升到檔案最上面，factory 裡用箭頭函式包住 mock，才不會在變數宣告前就讀取它。

## 表單送出後的斷言要用 `vi.waitFor` 包

```ts
await wrapper.find('form').trigger('submit')
await vi.waitFor(() => expect(createUser).toHaveBeenCalled())
```

欄位一旦被 `setValue()` 動過，Quasar 的 `QForm`／`QField` 驗證流程會多一段非同步延遲，單純 `await trigger()` 等不到。

## 檢查清單

- [ ] 測試檔在 `src/__tests__/` 下，路徑鏡射原始碼，命名 `<原始檔名>.spec.ts`
- [ ] 用 `mount`，`global.plugins` 有裝 Quasar；有 `src/locale/` 時也裝了 `i18n`
- [ ] 切過語系的測試在 `afterEach` 切回繁中
- [ ] `vi.mock` 回傳的響應式值是 `ref()`
- [ ] 每個 `vi.fn` 都帶被替換函式的完整簽章
- [ ] 表單相關斷言包在 `vi.waitFor` 內
