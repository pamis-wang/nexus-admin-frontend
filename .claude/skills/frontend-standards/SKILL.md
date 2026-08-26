---
name: frontend-standards
description: Vue 3 前端的照抄模板與開發順序——從零做一個 CRUD 頁面（路由、列表、表單）、service 檔與 axiosService 串接、檔案上傳、TypeScript 型別與後端 JSON 形狀對應、可空性判斷、頁面型別解耦、Quasar 元件測試（mount／plugin／vi.mock 的 ref／vi.waitFor）
---

# 前端開發規範

> 正本在 `development-standards` 的 `ai-templates/frontend/`——改正本再複製到各專案，勿改副本。

Vue 3.5（TypeScript）＋ Vite，Composition API ＋ `<script setup>`。跨任務都會踩到的硬規則（程式碼風格、命名、型別可空性、元件拆分時機、樣式 token）在專案根目錄 `CLAUDE.md`；本 skill 放**照抄用的流程與模板**，兩邊不重複。

## 什麼情況讀哪一份

| 手上的任務 | 讀這份 |
|---|---|
| 從零做一個 CRUD 頁面（含路由、列表、表單） | `crud-page.md` |
| 新增或修改 service 檔、串 API、處理回應與錯誤、檔案上傳 | `api-service.md` |
| 宣告型別、判斷欄位可空性、對應後端 JSON 形狀 | `types.md` |
| 寫元件測試（`mount`／Quasar plugin／`vi.mock`／`vi.waitFor`） | `component-test.md` |

一個完整 CRUD 頁面會依序用到四份：`crud-page.md` 給順序，`api-service.md` 給串接模板，`types.md` 給型別判斷，`component-test.md` 給測試模板。

## 這裡查不到的東西

環境建置、技術選型依據、樣式細節、路由守衛與權限控管，以及各項決策的完整理由（`附錄01`–`附錄05`），都在 GitLab `agent-go/development-standards` 的 `frontend-standards/`，**不在本專案內**。Node 版本限定的設定由 skill `node-version-lock` 負責。

Vue／Quasar／Tailwind 的框架知識查官方文件——規範只記錄**團隊的約定與取捨**。

團隊約定不明確時**先問，確認後再一次做對**，不要自己發明並套用到多個檔案。抽象相關的判斷（要不要拆元件、要不要抽組合函式）尤其如此，規範明訂抽取前須先討論。
