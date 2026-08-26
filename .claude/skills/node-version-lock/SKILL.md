---
name: node-version-lock
description: 限定前端專案的 Node 版本——初始化新專案、engines 還是 create-vue 預設值、要升級或改鎖 Node 版本、npm install 冒出 EBADENGINE 時使用
---

# 限定 Node 版本

> 來源：development-standards @ `616810d`（`frontend-standards/01.環境建置.md`）

`.nvmrc` 只是宣告，不具強制力——Windows 的 nvm 根本不讀它。要真正擋住錯誤版本得靠三層：**宣告**、**安裝期**、**執行期**，各守不同時機，缺一層就留一個缺口。

版本取決於專案：新專案用 `24.16.0`；既有專案沿用它 `.nvmrc`／`engines` 現有的版本，只補齊缺的層次。**舊專案不順手升級**——各專案 Node 版本交錯並存是團隊常態。

## 1. 宣告：`.nvmrc`

內容只有版本號，格式與 Docker tag 一致（無 `v` 前綴）：

```
24.16.0
```

Windows 的 nvm 不讀 `.nvmrc`、也沒有進入目錄自動切換，切換版本要打完整版號（`nvm use 24.16.0`）。這一層是給人、CI 與其他版本管理器看的。

## 2. 安裝期：`engines` ＋ `engine-strict`

`package.json`：

```jsonc
{
  "engines": {
    "node": "^24.16.0"
  }
}
```

**鎖 major，patch 保持開放。** `^24.16.0` 等同 `>=24.16.0 <25.0.0`；Node 的 patch 向後相容，寫成精確的 `24.16.0` 會讓每次安全修補都得改 repo、通知全隊重裝。

`create-vue` 產生的預設值是 `^20.19.0 || >=22.12.0`，放行 Node 20／22，與專案的 `@tsconfig/node24`、`@types/node@^24` 矛盾——初始化後務必收斂。

`.npmrc`：

```
engine-strict=true
```

少了這行，`engines` 不符只印 `EBADENGINE` 警告、安裝照樣完成；加上後 `npm install`／`npm ci` 直接中止。此設定僅對 npm 有效。

## 3. 執行期：守門腳本

`engine-strict` 只在安裝期生效，`npm run dev`／`npm run build` 不檢查 `engines`。裝好套件後切走 Node 再回來跑 dev 沒有任何阻擋，而 Vite 在鄰近版本上通常跑得起來，只是安靜地產生行為差異。Windows 沒有目錄自動切換，這個缺口尤其常踩。

`scripts/ensure-node-version.mjs`：

```js
// package.json 的 engines 只在 npm install / npm ci 時驗證，
// 此腳本補上執行期（dev / build）的檢查，判斷範圍與 engines 保持一致。
// 由 package.json 的 predev / prebuild 自動執行。
import { readFileSync } from 'node:fs'

const { engines } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

// 只處理 ^x.y.z 形式（目前為 ^24.16.0，等同 >=24.16.0 <25.0.0）
const [requiredMajor, requiredMinor] = engines.node.replace(/^\^/, '').split('.').map(Number)
const [major, minor] = process.versions.node.split('.').map(Number)

if (major !== requiredMajor || minor < requiredMinor) {
  console.error(`\n✖ 此專案需要 Node.js ${engines.node}，目前為 v${process.versions.node}`)
  console.error(`  請執行： nvm use ${requiredMajor}.${requiredMinor}.0\n`)
  process.exit(1)
}
```

`package.json` 掛兩個 hook：

```jsonc
{
  "scripts": {
    "predev": "node scripts/ensure-node-version.mjs",
    "dev": "vite",
    "prebuild": "node scripts/ensure-node-version.mjs",
    "build": "run-p type-check \"build-only {@}\" --"
  }
}
```

- 判斷範圍**從 `engines` 推導**，維持單一事實來源。改成與 `.nvmrc` 字串完全比對會連 patch 更新一起擋掉，與第 2 層的決策矛盾。
- 版本比較**手寫**。`semver` 通常只是被 hoist 到頂層的間接依賴，未宣告在 `package.json`，依賴一升級就可能不在原位。
- 副檔名用 **`.mjs`**：ESLint 的 `files` 與 `tsconfig.node.json` 的 `include` 都不涵蓋它，省下額外的 lint／型別檢查設定。
- 安裝入口交給 `engine-strict` 即可，`preinstall` 留空不掛。

## 4. Docker：base image 對齊

專案有 `Dockerfile` 時，base image 要與 `.nvmrc` 同版本，否則映像內的 `npm ci` 會直接以 `EBADENGINE` 失敗：

```dockerfile
# 版本需與 .nvmrc / package.json engines 保持一致
FROM node:24.16.0-alpine3.23 AS base
```

映像 tag **釘死到 patch**（可重現建構），與 `engines` 用範圍不衝突：`engines` 是給人的下限，tag 是給機器的固定值。動手前先確認該 tag 存在：

```bash
curl -s "https://hub.docker.com/v2/repositories/library/node/tags?name=24.16.0-alpine&page_size=50" | grep -o '"name":"[^"]*"'
```

## 5. 驗證

三項全部通過才算完成：

| 檢查 | 預期 |
|---|---|
| 用其他 major 的 node 執行守門腳本 | exit 1，印出版本要求 |
| 用專案版本執行守門腳本 | exit 0 |
| 用專案版本執行 `npm run build` | log 出現 `prebuild`，且 exit 0 |

第一項直接呼叫 nvm 已安裝的其他版本，不必切換全域版本：

```bash
"$(nvm root)/v22.17.0/node.exe" scripts/ensure-node-version.mjs      # Windows
~/.nvm/versions/node/v22.17.0/bin/node scripts/ensure-node-version.mjs   # macOS／Linux
```

守門腳本檢查的是 PATH 上的 `node`，與 npm 實際用來執行 Vite 的是同一個，因此結果可信。

## 升級 Node 版本時

同步改四處，漏一處就是半鎖狀態：`.nvmrc`、`engines`、`Dockerfile` base image、README 的版本說明。改完重跑第 5 節。

## 合併前

收斂 `engines` 後合併回 `develop` 前先通知團隊切換 Node——其他人的 `npm install` 會直接中止，不是警告。CI 首次建構也會重新拉 base image，那一次會比平常慢。
