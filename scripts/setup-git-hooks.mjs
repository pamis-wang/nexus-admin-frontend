// 把 git 的 hooks 目錄指向版控中的 .githooks/，讓 hooks 隨 repo 散佈。
// 由 package.json 的 prepare（npm install 時）與 predev / prebuild 自動執行——
// 掛兩處是因為 prepare 不保證在所有安裝方式下都會跑，
// 而只要有人跑過 npm run dev 或 npm run build，hooks 就一定會生效。
//
// 這支腳本刻意不讓任何錯誤中斷安裝或啟動：拿不到 git 或不在 repo 內就靜默跳過。
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'

const HOOKS_DIR = '.githooks'

function readCurrentHooksPath() {
  try {
    return execFileSync('git', ['config', '--get', 'core.hooksPath'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    // 尚未設定時 git config --get 會以非零退出，視為空值
    return ''
  }
}

function main() {
  // 不是 git working tree（例如以 tarball 安裝），沒有 hooks 可掛
  if (!existsSync('.git')) {
    return
  }

  if (!existsSync(HOOKS_DIR)) {
    console.warn(`\n⚠ 找不到 ${HOOKS_DIR}/，略過 git hooks 設定\n`)
    return
  }

  // 已經設定正確就不重複執行、不輸出，避免每次 npm run dev 都吵
  if (readCurrentHooksPath() === HOOKS_DIR) {
    return
  }

  try {
    execFileSync('git', ['config', 'core.hooksPath', HOOKS_DIR], { stdio: 'pipe' })
    console.log(`✔ git hooks 已指向 ${HOOKS_DIR}/`)
  } catch {
    console.warn(`\n⚠ git hooks 設定失敗，請手動執行： git config core.hooksPath ${HOOKS_DIR}\n`)
  }
}

main()
