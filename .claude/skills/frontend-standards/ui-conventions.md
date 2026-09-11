# 後台 UI 慣例

> 來源：development-standards — `frontend-standards/08.後台樣式規範.md`

只適用**後台（Quasar）**專案。頁面的建立順序（service → 路由 → 頁面 → 列表 → 表單）在 `crud-page.md`；這份講**畫面要長什麼樣**：共用元件、色彩、圖示、按鈕、版面、表單、表格、對話框。

---

## 共用元件優先

全域元件註冊在 `plugins/` 下的註冊檔（`customComponents.ts` 或 `custom.ts`）。**先讀那個檔，確認這個專案註冊了哪些 `x-` 元件**，各專案的集合不一樣。有註冊的就用，不手刻同等功能：

| 元件 | 用途 | 何時用 |
|---|---|---|
| `x-breadcrumb` | 麵包屑 | 每個頁面必用 |
| `x-page-header` | 頁面標題與功能列 | 有註冊就必用；沒有時以 `text-h6 text-primary` 手刻標題列 |
| `x-table` | 資料表格 | 列表必用，不手刻 `q-table` |
| `x-icon` | 表格列操作圖示按鈕 | 表格操作欄必用 |
| `x-section-header-bar` | 表單分區標題 | 有註冊就必用；沒有時才退回 `q-separator` ＋ 小標題 |
| `x-switch` | 開關 | 視需要 |
| `x-draggable-table` | 可拖曳排序表格 | 需要拖曳排序時（部分專案才有） |
| `x-btn` | 自訂按鈕 | 不用，按鈕一律 `q-btn` |

`x-table`、`x-page-header`、`x-breadcrumb`、`x-icon` 幾乎都有註冊，直接用。`x-section-header-bar` 要先確認——沒有的專案才退回 `q-separator` ＋ 小標題。

---

## 色彩

一律用 Quasar **語意色名**；色值定義在專案的 Quasar 變數檔（路徑查 `vite.config.ts` 的 `sassVariables`）。元件裡寫 `color="negative"`、`class="text-primary"`，不寫 hex，也不寫 `red-5`、`blue-8` 這類調色盤色階。

| 語意色 | 用途 |
|---|---|
| `primary` | 主要動作、頁面標題、表格表頭 |
| `secondary` | 次要動作、分頁 |
| `accent` | 強調 |
| `positive` | 成功狀態 |
| `negative` | 刪除、錯誤、必填標示 |
| `warning` | 警告 |
| `info` | 資訊 |
| `grey` | 取消、次要文字 |

例外：以配色本身為展示內容的元件（版面配色預覽之類），其 hex 是展示的資料，可以寫死。

---

## 圖示

圖示集只有 Material Design Icons（`mdi-` 前綴），`plugins/quasar.ts` 只引入 `mdi-v7` 一套。動作對照表：

| 動作 | 圖示 |
|---|---|
| 新增 | `mdi-plus` |
| 編輯 | `mdi-file-document-edit-outline` 或 `mdi-pencil-outline` |
| 刪除 | `mdi-trash-can-outline` |
| 檢視 | `mdi-eye-outline` |
| 儲存 | `mdi-content-save-outline` |
| 送出（不可逆的送審類動作） | `mdi-send` |
| 取消／關閉 | `mdi-close` |
| 返回 | `mdi-arrow-left` |
| 重新整理 | `mdi-refresh` |
| 清除篩選 | `mdi-filter-remove` |
| 搜尋 | `mdi-magnify` |
| 複製 | `mdi-content-copy` |
| 下載 | `mdi-download` |
| 上傳 | `mdi-upload` |
| 啟用 | `mdi-check-circle-outline` |
| 停用 | `mdi-cancel` |

- 刪除一律 `mdi-trash-can-outline`；`mdi-close` 只給「關閉」這個語意。
- 編輯有兩個在用的圖示，`mdi-file-document-edit-outline` 較普遍。**同一專案內統一用一個**——先看該專案既有頁面用哪個就跟著用。
- 表格列內的操作圖示用 `-outline` 版本（視覺較輕，不與工具列按鈕搶焦點），表格外的按鈕用實心版本。
- 頁面標題圖示依業務語意自選（`mdi-account-multiple`、`mdi-office-building`），不受本表限制。

---

## 按鈕

四個階級，選錯階級等於改了視覺層次：

| 階級 | 寫法 | 用途 |
|---|---|---|
| 主要動作 | `unelevated color="primary"` | 儲存、送出、新增 |
| 次要動作 | `outline color="secondary"` | 返回、匯出、次級功能 |
| 低調動作 | `flat color="grey"` | 取消、重新整理 |
| 破壞性動作 | `outline color="negative"` | 刪除 |

**一個畫面只有一個主要動作按鈕**——新增第二顆 `unelevated color="primary"` 前，先把其中一顆降級。

文案固定用詞：對話框的「確認／取消」由 `showConfirm` 內建、頁面不用傳，表單送出（新增／編輯皆同）用「儲存」，不可逆送審用「送出」，取消用「取消」。

---

## 版面三段

後台頁面由上而下固定三段，每段各自一張 `q-card flat bordered`：

```
麵包屑（x-breadcrumb）→ 標題與功能操作區（x-page-header）→ 內容區（表格／表單）
```

麵包屑是頁面第一個元素，由「首頁」逐層展開到當前頁。**當前頁不帶 `to`**；中間層是純分類、沒有對應路由時也省略 `to`。

```vue
<x-breadcrumb
  :items="[
    { label: '首頁', icon: 'mdi-home', to: { name: 'home' } },
    { label: '會員管理' },
    { label: '會員列表', to: { name: 'organizations' } },
    { label: '新增會員聯絡人資料' },
  ]"
/>
```

標題區的功能按鈕放 `#actions` slot，**由左至右依次要 → 主要 → 低調**排列：

```vue
<x-page-header title="會員聯絡人列表" icon="mdi-account-multiple">
  <template #actions>
    <q-btn outline color="secondary" icon="mdi-arrow-left" label="返回會員列表" :to="buildOrganizationsRoute()" />
    <q-btn unelevated color="primary" icon="mdi-plus" label="新增聯絡人" :to="buildAddRoute()" />
    <q-btn flat color="grey" icon="mdi-refresh" label="重新整理" :loading="loading" @click="onRefresh" />
  </template>
</x-page-header>
```

---

## 表單

### 分區

每個分區一個 `x-section-header-bar`，標題只放名詞短語、不加標點。第一個分區不加 `q-mt-md`，後續分區加 `q-mt-md`。短表單也照這個寫法，不因分區少而改寫別的。

```vue
<x-section-header-bar title="公司基本資料" />
<div class="row q-col-gutter-md">
  <!-- 欄位 -->
</div>

<x-section-header-bar title="附件上傳" class="q-mt-md" />
<div class="row q-col-gutter-md">
  <!-- 欄位 -->
</div>
```

### 欄位

- 一律 `dense outlined`。
- 柵格用 `row q-col-gutter-md` ＋ `col-12 col-md-N`。
- 寬度依內容語意：短欄位 `col-md-3`、中 `col-md-4`／`col-md-6`、長 `col-md-9`／`col-12`。

### 必填標示

必填欄位在 `#prepend` 放紅色星號；**非必填欄位放等寬佔位**，左緣才會對齊。

```vue
<!-- 必填 -->
<q-input dense outlined label="姓名" v-model="formData.name" :rules="[requiredRule('姓名')]">
  <template #prepend>
    <q-icon name="mdi-asterisk" color="negative" size="8px" />
  </template>
</q-input>

<!-- 非必填 -->
<q-input dense outlined label="備註" v-model="formData.memo">
  <template #prepend>
    <div style="width: 8px" />
  </template>
</q-input>
```

### 底部按鈕與送出

按鈕列**置中對齊，取消在左、主要動作在右**，上方加 `<q-separator />` 與表單內容區隔。主要動作必須綁 `:loading`，送出期間才不會被重複點擊。

```vue
<q-separator />
<div class="q-pa-md q-mt-lg">
  <div class="row q-gutter-sm justify-center">
    <q-btn flat label="取消" color="grey" size="md" @click="onCancel" class="q-px-xl" />
    <q-btn unelevated label="儲存" color="primary" size="md" :loading="loading" @click="onSubmit" class="q-px-xl" />
  </div>
</div>
```

送出前先跑 `q-form` 的 `validate()`：

```ts
const isValid = await formRef.value.validate()
if (!isValid) {
  dialog.showError('請檢查表單欄位是否填寫完整', '驗證失敗')
  return
}
```

---

## 表格

`x-table` 已內建表頭 `bg-primary text-white`、`separator="cell"`、`flat bordered`、載入動畫、「查無資料」提示、緊湊模式切換、每頁筆數選擇、分頁列與筆數資訊。**這些在頁面重寫一次就是多餘的程式碼。**

```ts
const columns: XTableColumn[] = [
  { name: 'number', align: 'center', label: '項次', field: '' },
  { name: 'name', align: 'left', label: '姓名', field: (row: XxxResponse) => row.name },
  { name: 'action', align: 'center', label: '操作', field: 'action', style: 'width: 100px;' },
]
```

- 第一欄固定「項次」，用 `body-cell-number` slot 渲染 `props.rowIndex + 1`。
- 最後一欄固定「操作」，`align: 'center'`、`style: 'width: 100px;'`。
- 文字欄 `align: 'left'`，數值／狀態欄 `align: 'center'`。
- 空值統一顯示 `'-'`。

列操作按鈕用 `x-icon`，**每顆都要帶 `tooltip`**。顏色固定：檢視 `primary`、編輯 `warning`、刪除 `negative`。`:size` 綁 `props.isDense`，按鈕才會隨表格緊湊模式縮放。導頁的用 `:to`，刪除這種沒有網址的用 `@click`。

```vue
<template v-slot:body-cell-action="props">
  <q-td :props="props">
    <div class="q-gutter-xs">
      <x-icon tooltip="檢視" color="primary" icon="mdi-eye-outline" :size="props.isDense ? 'sm' : 'md'" flat dense
              :to="buildViewRoute(props.row.id)" />
      <x-icon tooltip="編輯" color="warning" icon="mdi-pencil-outline" :size="props.isDense ? 'sm' : 'md'" flat dense
              :to="buildEditRoute(props.row.id)" />
      <x-icon tooltip="刪除" color="negative" icon="mdi-trash-can-outline" :size="props.isDense ? 'sm' : 'md'" flat
              dense @click="confirmDelete(props.row)" />
    </div>
  </q-td>
</template>
```

---

## 對話框與通知

**阻斷性**決定用哪一個：使用者必須先處理完才能繼續的用 `dialog`，能繼續操作的用 `notify`。

| 情境 | 用法 |
|---|---|
| 需要使用者決定（刪除確認、離開未儲存頁面） | `dialog.showConfirm` |
| 表單驗證失敗 | `dialog.showError` |
| 單筆資料載入失敗（編輯／檢視頁沒有資料可顯示） | `dialog.showError`，確認後導回列表 |
| 列表或區塊載入失敗（頁面骨架仍在、可重新整理） | `notify.notifyError` |
| 操作成功（新增／編輯／刪除完成） | `notify.notifySuccess` |
| 操作失敗（新增／編輯／刪除的 API 業務錯誤） | `notify.notifyError` |

`notifyError` 的第二個參數是 timeout（預設 3000ms）。可重試的失敗一律傳 `0`——`notify.notifyError(message, 0)`。關閉鈕 `useNotify` 已內建，不用自己加；成功訊息維持預設自動關閉。

**例外**：成功訊息帶了使用者必須讀完的內容（送審案號、匯入完成但有失敗明細、一次性密碼），那是結果不是回饋，改用 `dialog.showSuccess`。

刪除確認的訊息**要帶被刪除對象的名稱**，並註明「此操作無法復原」——只寫「確定要刪除嗎」使用者無法確認刪到的是哪一筆。

```ts
async function confirmDelete(data: XxxResponse) {
  const message = `確定要刪除「${data.name}」嗎？此操作無法復原。`

  dialog.showConfirm(message, '確認刪除').onOk(async () => {
    try {
      await deleteXxx(data.id)
      notify.notifySuccess('刪除成功')
      loadList()
    } catch (error) {
      const errorMessage = (error as ErrorResponseStructure).errorMessage || '未知錯誤'
      notify.notifyError(errorMessage, 0)
    }
  })
}
```

---

## 交付前逐條對過

每一項都要實際回到程式碼確認，不憑印象打勾：

- [ ] 有對應 `x-` 元件的地方都用了它，沒有手刻 `q-table`、沒有 `q-separator` ＋ 小標題當分區
- [ ] 圖示都是 `mdi-*`，動作圖示符合〈圖示〉對照表
- [ ] 顏色都是語意色名，沒有 hex、沒有 `red-5` 這類色階
- [ ] 頁面結構為 麵包屑 → `x-page-header` → 內容區，當前頁的麵包屑沒有 `to`
- [ ] 整個畫面只有一顆 `unelevated color="primary"`
- [ ] 表單底部按鈕置中、取消在左、主要動作在右且綁 `:loading`
- [ ] 必填欄位有 `mdi-asterisk`，非必填有等寬佔位
- [ ] 表格首欄「項次」、末欄「操作」，空值顯示 `'-'`
- [ ] 每顆 `x-icon` 都有 `tooltip`，顏色為 檢視 `primary`／編輯 `warning`／刪除 `negative`
- [ ] 刪除有 `showConfirm`，訊息含對象名稱與「此操作無法復原」
- [ ] 成功用 `notifySuccess`、可重試的失敗用 `notifyError`（`timeout: 0` 不自動關）、阻斷性錯誤用 `showError`
