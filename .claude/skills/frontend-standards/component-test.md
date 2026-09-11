# Quasar 元件測試

> 來源：development-standards — `frontend-standards/11.測試規範.md`

Vitest ＋ `@vue/test-utils`。以下五條都是**預設做法會靜默失敗**的地方——照做，不要憑框架直覺寫。

## 檔案位置與命名

**測試檔一律集中放 `src/__tests__/`**，依來源檔案的 `src/` 相對路徑建子目錄，不與原始碼並排開 `__tests__/`。命名 `<原始檔名>.spec.ts`。

```
src/pages/UserManagement/UserList.vue
src/__tests__/pages/UserManagement/UserList.spec.ts
```

## 一律 `mount`，不用 `shallowMount`

`shallowMount` 會把 `q-input`／`q-form` 等 Quasar 元件 stub 成空殼，模板內不會有真正的 `<input>`／`<form>`，選擇器全部找不到。

## `mount` 時務必安裝 Quasar plugin

```ts
mount(UserList, {
  global: { plugins: [quasarPlugin] },   // import quasarPlugin from '@/plugins/quasar'
})
```

沒裝的話，部分 Quasar 元件缺少 `$q` context 時會在 `beforeMount` **直接丟出執行期錯誤**，不只是警告。

## `vi.mock` 的響應式回傳值要用真正的 `ref()`

```ts
vi.mock('@/composables/useUserForm', () => ({
  useUserForm: () => ({ isLoading: ref(false) }),   // ✅
  // useUserForm: () => ({ isLoading: { value: false } }),   ❌
}))
```

模板若把該值綁到 Quasar 元件 prop，Vue 的 auto-unwrap **只認得真正的 `ref`**；一般物件會讓 prop 收到物件而不是預期的原始值。

## 表單送出後的斷言要用 `vi.waitFor` 包

```ts
await wrapper.find('form').trigger('submit')
await vi.waitFor(() => expect(createUser).toHaveBeenCalled())
```

欄位一旦被 `setValue()` 動過，Quasar 的 `QForm`／`QField` 驗證流程會多一段非同步延遲，單純 `await trigger()` 等不到。

## 檢查清單

- [ ] 測試檔在 `src/__tests__/` 下，路徑鏡射原始碼，命名 `<原始檔名>.spec.ts`
- [ ] 用 `mount`，`global.plugins` 有裝 Quasar
- [ ] `vi.mock` 回傳的響應式值是 `ref()`
- [ ] 表單相關斷言包在 `vi.waitFor` 內
