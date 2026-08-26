# nexus-admin-frontend

This template should help get you started developing with Vue 3 in Vite.

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Recommended Browser Setup

- Chromium-based browsers (Chrome, Edge, Brave, etc.):
  - [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd)
  - [Turn on Custom Object Formatter in Chrome DevTools](http://bit.ly/object-formatters)
- Firefox:
  - [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
  - [Turn on Custom Object Formatter in Firefox DevTools](https://fxdx.dev/firefox-devtools-custom-object-formatters/)

## Type Support for `.vue` Imports in TS

TypeScript cannot handle type information for `.vue` imports by default, so we replace the `tsc` CLI with `vue-tsc` for type checking. In editors, we need [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) to make the TypeScript language service aware of `.vue` types.

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Node.js 版本

本專案限定 Node.js `24.16.0`（`engines` 為 `^24.16.0`，即 24.16.0 以上、25.0.0 以下）。
版本不符時，`.npmrc` 的 `engine-strict=true` 會讓 `npm install` / `npm ci` 直接中止（EBADENGINE）；
`npm run dev` / `npm run build` 則由 `scripts/ensure-node-version.mjs` 在 `predev` / `prebuild` 擋下。

```sh
nvm install 24.16.0
nvm use 24.16.0
```

> nvm-windows 不支援讀取 `.nvmrc`，必須明確指定版號；macOS / Linux 的 nvm 可直接執行 `nvm use`。

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Type-Check, Compile and Minify for Production

```sh
npm run build
```

### Run Unit Tests with [Vitest](https://vitest.dev/)

```sh
npm run test:unit
```

### Run End-to-End Tests with [Playwright](https://playwright.dev)

```sh
# Install browsers for the first run
npx playwright install

# When testing on CI, must build the project first
npm run build

# Runs the end-to-end tests
npm run test:e2e
# Runs the tests only on Chromium
npm run test:e2e -- --project=chromium
# Runs the tests of a specific file
npm run test:e2e -- tests/example.spec.ts
# Runs the tests in debug mode
npm run test:e2e -- --debug
```

### Lint with [ESLint](https://eslint.org/)

```sh
npm run lint
```

## 提交前的自動檢查（Git hooks）

`.githooks/` 內的 hooks 隨 repo 一起進版控，透過 `git config core.hooksPath .githooks` 生效。
設定由 `scripts/setup-git-hooks.mjs` 自動完成，掛在 `prepare`（`npm install` 時）
以及 `predev` / `prebuild`——**clone 後跑過任一個指令就會生效，不需要額外步驟**。

| 時機 | 檢查內容 | 約耗時 |
|---|---|---|
| `pre-commit` | 格式（`oxfmt --check`）、`oxlint` | 0.5 秒 |
| `pre-push` | 上述加上 `eslint`、型別檢查、單元測試、`vite build` | 9 秒 |

`pre-push` 的目的是讓推上去發 MR 的分支保證 `npm run build` 過得去。
想在推之前自己先跑一次完整檢查：

```sh
npm run verify
```

只跑快的那一段（格式與 oxlint）：

```sh
npm run verify:quick
```

`verify:*` 各項也可以單獨執行，用來定位失敗：

```sh
npm run verify:format   # oxfmt --check src/
npm run verify:oxlint   # oxlint . --deny-warnings
npm run verify:eslint   # eslint . --max-warnings 0
npm run verify:types    # vue-tsc --build --force
npm run verify:test     # vitest run
npm run verify:build    # vite build
```

> `verify:*` 系列一律**不帶 `--fix`**，只回報不修改；`npm run lint` 與 `npm run format` 才會動檔案。
> 型別檢查與 build 的涵蓋範圍不同：`verify:types` 收 `src/**/*`（含未被引用的檔案），
> `verify:build` 只走進入點可達的模組但抓得到靜態資源、SASS、動態 import 等 TypeScript 看不到的錯誤——兩者互補，缺一不可。
