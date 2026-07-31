---
name: frontend-standards
description: 開發 Vue 3 前端專案時使用——從零做一個 CRUD 頁面的順序、service 檔與 axiosService 串接、檔案上傳、TypeScript 型別與後端 JSON 形狀對應、可空性判斷、頁面型別解耦
---

# 前端開發規範

> 來源：development-standards @ `d76e95f`（2026-07-28）

Vue 3.5（TypeScript）＋ Vite，Composition API ＋ `<script setup>`。硬規則（程式碼風格、命名、型別可空性、元件拆分時機）已在專案根目錄 `CLAUDE.md`，本 skill **不重複**，只放需要照抄的流程與模板。

## 什麼情況讀哪一份

| 手上的任務 | 讀這份 |
|---|---|
| 從零做一個 CRUD 頁面（含路由、列表、表單） | `crud-page.md` |
| 新增或修改 service 檔、串 API、處理回應與錯誤、檔案上傳 | `api-service.md` |
| 宣告型別、判斷欄位可空性、對應後端 JSON 形狀 | `types.md` |

一個完整 CRUD 頁面會依序用到三份：`crud-page.md` 給順序，`api-service.md` 給串接模板，`types.md` 給型別判斷。

## 這裡查不到的東西

環境建置、技術選型依據、樣式細節、路由守衛與權限控管，本 skill 未收錄。到 GitLab `agent-go/development-standards` 的 `frontend-standards/` 查對應章節：

| 章節 | 內容 |
|---|---|
| `01.環境建置.md` | Node／NVM、Lint 工具鏈、專案初始化與常用指令 |
| `02.技術選型.md` | 框架／UI／狀態／路由／HTTP／樣式的選型依據與設定 |
| `03.專案架構與目錄說明.md` | `src/` 完整目錄結構、各層職責、依賴方向 |
| `07.元件、組合函式、狀態管理設計規範.md` | props／emit／`defineModel`、Pinia setup store 寫法 |
| `08.樣式規範.md` | Quasar 註冊與 SCSS 變數、Tailwind 設定與設計 token、響應式 |
| `附錄01`–`附錄03` | 不用 Optional、一律 `function` 宣告、`computed` 優先於 `watch` 的決策理由 |

## 遇到規範沒寫的情況

規範只記錄**團隊的約定與取捨**，不重複 Vue／Quasar／Tailwind 的框架知識——那些查官方文件。若是團隊約定不明確，**不要自己發明並套用到多個檔案**：先問，再一次做對。抽象相關的判斷（要不要拆元件、要不要抽組合函式）尤其如此，規範明訂抽取前須先討論。
