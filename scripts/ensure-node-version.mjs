// package.json 的 engines 只在 npm install / npm ci 時驗證，
// 此腳本補上執行期（dev / build）的檢查，判斷範圍與 engines 保持一致。
// 由 package.json 的 predev / prebuild 自動執行。
import { readFileSync } from 'node:fs'

const { engines } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

// 只處理 ^x.y.z 形式（目前為 ^24.22.1，等同 >=24.22.1 <25.0.0）
const requiredVersion = engines.node.replace(/^\^/, '')
const [requiredMajor, requiredMinor, requiredPatch] = requiredVersion.split('.').map(Number)
const [major, minor, patch] = process.versions.node.split('.').map(Number)

const isOlderThanRequired = minor < requiredMinor || (minor === requiredMinor && patch < requiredPatch)

if (major !== requiredMajor || isOlderThanRequired) {
  console.error(`\n✖ 此專案需要 Node.js ${engines.node}，目前為 v${process.versions.node}`)
  console.error(`  請執行： nvm use ${requiredVersion}\n`)
  process.exit(1)
}
